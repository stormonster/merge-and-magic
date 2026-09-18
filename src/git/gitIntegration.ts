import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';
import { ActivityEventInput } from '../activity/types';
import { recordReleasePush } from '../game/achievements';
import { GameState } from '../game/types';
import {
  classifyHeadChange,
  classifySnapshotTransition,
  GitActivity,
  GitSnapshot
} from './activityClassifier';
import { applyGitRewardGate, GitRewardSkip } from './rewardGate';

const execFile = util.promisify(cp.execFile);
const INSPECT_DEBOUNCE_MS = 400;
const FALLBACK_POLL_MS = 10 * 1000;

type WatchState = {
  repo: any | null;
  snapshot: GitSnapshot | null;
  pendingTimer: NodeJS.Timeout | null;
};

async function runGit(rootPath: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', rootPath, ...args], {
    timeout: 5000,
    windowsHide: true
  });

  return result.stdout.trim();
}

async function safeRunGit(rootPath: string, args: string[]): Promise<string | null> {
  try {
    return await runGit(rootPath, args);
  } catch {
    return null;
  }
}

function getRepoRoot(repo: any): string | null {
  const rootUri = repo?.rootUri;
  if (rootUri && typeof rootUri.fsPath === 'string') {
    return rootUri.fsPath;
  }

  const fsPath = repo?.rootUri?.path || repo?.rootUri;
  return typeof fsPath === 'string' ? fsPath : null;
}

async function gitPathExists(rootPath: string, gitPath: string): Promise<boolean> {
  const resolvedPath = await safeRunGit(rootPath, ['rev-parse', '--git-path', gitPath]);
  if (!resolvedPath) {
    return false;
  }

  try {
    await fs.access(resolvedPath);
    return true;
  } catch {
    return false;
  }
}

async function hasRebaseInProgress(rootPath: string): Promise<boolean> {
  return (await gitPathExists(rootPath, 'rebase-merge')) || (await gitPathExists(rootPath, 'rebase-apply'));
}

async function isGitRepoRoot(candidatePath: string): Promise<boolean> {
  return (await safeRunGit(candidatePath, ['rev-parse', '--show-toplevel'])) !== null;
}

function hasConflictStatus(statusOutput: string | null): boolean {
  if (!statusOutput) {
    return false;
  }

  return statusOutput
    .split('\n')
    .some((line) => /^(DD|AU|UD|UA|DU|AA|UU) /.test(line));
}

function splitUpstreamRef(upstreamRef: string | null): { remote: string | null; branch: string | null } {
  if (!upstreamRef) {
    return { remote: null, branch: null };
  }

  const slashIndex = upstreamRef.indexOf('/');
  if (slashIndex <= 0 || slashIndex >= upstreamRef.length - 1) {
    return { remote: null, branch: null };
  }

  return {
    remote: upstreamRef.slice(0, slashIndex),
    branch: upstreamRef.slice(slashIndex + 1)
  };
}

async function getRemoteHead(rootPath: string, upstreamRef: string | null): Promise<string | null> {
  const { remote, branch } = splitUpstreamRef(upstreamRef);
  if (!remote || !branch) {
    return null;
  }

  const output = await safeRunGit(rootPath, ['ls-remote', '--heads', remote, branch]);
  if (!output) {
    return null;
  }

  const [remoteHead] = output.trim().split(/\s+/);
  return remoteHead || null;
}

async function getSnapshot(rootPath: string, repo?: any): Promise<GitSnapshot | null> {
  const headState = repo?.state?.HEAD;
  const head = headState?.commit || (await safeRunGit(rootPath, ['rev-parse', '--verify', 'HEAD']));
  const branch = headState?.name || (await safeRunGit(rootPath, ['branch', '--show-current'])) || null;
  const upstreamRef = await safeRunGit(rootPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const status = await safeRunGit(rootPath, ['status', '--porcelain=v1']);
  const stashHash = await safeRunGit(rootPath, ['rev-parse', '--verify', '-q', 'refs/stash']);
  const mergeInProgress = await gitPathExists(rootPath, 'MERGE_HEAD');
  const rebaseInProgress = await hasRebaseInProgress(rootPath);
  const ahead = typeof headState?.ahead === 'number' ? headState.ahead : null;
  const behind = typeof headState?.behind === 'number' ? headState.behind : null;
  const remoteHead = await getRemoteHead(rootPath, upstreamRef);

  return {
    branch,
    head,
    remoteHead,
    mergeInProgress,
    rebaseInProgress,
    hasConflicts: hasConflictStatus(status),
    stashHash,
    ahead,
    behind
  };
}

async function getReflogSubject(rootPath: string): Promise<string> {
  return (await safeRunGit(rootPath, ['reflog', '-1', '--format=%gs'])) || '';
}

async function getCommitTimestamp(rootPath: string, commitHash: string | null): Promise<string | null> {
  if (!commitHash) {
    return null;
  }

  return await safeRunGit(rootPath, ['show', '-s', '--format=%cI', commitHash]);
}

async function getCommitSubject(rootPath: string, commitHash: string | null): Promise<string | null> {
  if (!commitHash) {
    return null;
  }

  return await safeRunGit(rootPath, ['show', '-s', '--format=%s', commitHash]);
}

async function isMergeCommit(rootPath: string, commitHash: string | null): Promise<boolean> {
  if (!commitHash) {
    return false;
  }

  const parents = await safeRunGit(rootPath, ['rev-list', '--parents', '-n', '1', commitHash]);
  if (!parents) {
    return false;
  }

  return parents.trim().split(/\s+/).length > 2;
}

async function classifyChangedHead(rootPath: string, snapshot: GitSnapshot): Promise<GitActivity | null> {
  const reflogSubject = await getReflogSubject(rootPath);
  const commitCreatedAt = await getCommitTimestamp(rootPath, snapshot.head);
  const commitSubject = await getCommitSubject(rootPath, snapshot.head);
  return classifyHeadChange(snapshot, {
    reflogSubject,
    commitCreatedAt,
    commitSubject,
    isMergeCommit: await isMergeCommit(rootPath, snapshot.head)
  });
}

async function classifyGitActivity(rootPath: string, previous: GitSnapshot, snapshot: GitSnapshot): Promise<GitActivity | null> {
  const transition = classifySnapshotTransition(previous, snapshot);
  return transition === 'head_change'
    ? classifyChangedHead(rootPath, snapshot)
    : transition;
}

function isReleaseBranchPush(activity: GitActivity): boolean {
  if (activity.type !== 'git_push') {
    return false;
  }

  const branchName = String(activity.metadata?.branchName || '').trim().toLowerCase();
  return branchName.startsWith('release');
}

function getActivityInput(activity: GitActivity): ActivityEventInput {
  return {
    type: activity.type,
    source: 'git',
    label: activity.label,
    weight: 1,
    metadata: activity.metadata
  };
}

export function initializeGitIntegration(
  context: vscode.ExtensionContext,
  getState: () => GameState,
  onGitActivity: (activity: ActivityEventInput) => Promise<void>,
  onActivitySkipped?: (activity: GitActivity, skip: GitRewardSkip) => Promise<void>,
  debugLog?: (message: string) => void
): void {
  const debug = (message: string) => {
    debugLog?.(`[git-debug] ${message}`);
  };

  try {
    const ext = vscode.extensions.getExtension('vscode.git');

    const watchedRoots = new Map<string, WatchState>();

    const ensureWatchState = (rootPath: string): WatchState => {
      const existing = watchedRoots.get(rootPath);
      if (existing) {
        return existing;
      }

      const created = {
        repo: null,
        snapshot: null,
        pendingTimer: null
      };
      watchedRoots.set(rootPath, created);
      return created;
    };

    const inspectRoot = async (rootPath: string) => {
      const watchState = watchedRoots.get(rootPath);
      if (!watchState) {
        return;
      }

      try {
        const snapshot = await getSnapshot(rootPath, watchState.repo);
        if (!snapshot?.head) {
          debug(`inspect skipped for ${rootPath}: no head`);
          return;
        }

        debug(
          `inspect ${rootPath}: branch=${snapshot.branch || 'n/a'} head=${snapshot.head} ahead=${snapshot.ahead ?? 'n/a'} behind=${snapshot.behind ?? 'n/a'}`
        );

        if (!watchState.snapshot) {
          watchState.snapshot = snapshot;
          const state = getState();
          state.cooldowns.lastCommitHash = state.cooldowns.lastCommitHash || snapshot.head;
          debug(`baseline snapshot stored for ${rootPath}`);
          return;
        }

        const activity = await classifyGitActivity(rootPath, watchState.snapshot, snapshot);
        watchState.snapshot = snapshot;

        if (!activity) {
          debug(`no activity classified for ${rootPath}`);
          return;
        }

        debug(`classified ${activity.type} on ${rootPath} (${activity.label})`);

        if (isReleaseBranchPush(activity)) {
          recordReleasePush(getState());
          activity.metadata = {
            ...(activity.metadata || {}),
            releasePushCounted: true
          };
          debug(`release push counted for ${rootPath} on branch ${String(activity.metadata?.branchName || 'n/a')}`);
        }

        const state = getState();
        if (activity.type === 'git_commit' && activity.commitHash && state.cooldowns.lastCommitHash === activity.commitHash) {
          debug(`commit ignored for ${rootPath}: same commit hash ${activity.commitHash}`);
          return;
        }

        const rewardGate = applyGitRewardGate(state, activity);
        if (!rewardGate.accepted) {
          await onActivitySkipped?.(activity, rewardGate);
          debug(`activity skipped for ${rootPath}: ${rewardGate.reason}`);
          return;
        }

        debug(`dispatching ${activity.type} for ${rootPath}`);
        await onGitActivity(getActivityInput(activity));
      } catch (error) {
        debug(`error inspecting ${rootPath}: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Merge & Magic git activity trigger failed', error);
      }
    };

    const scheduleInspect = (rootPath: string) => {
      const watchState = watchedRoots.get(rootPath);
      if (!watchState) {
        return;
      }

      if (watchState.pendingTimer) {
        clearTimeout(watchState.pendingTimer);
      }

      watchState.pendingTimer = setTimeout(() => {
        watchState.pendingTimer = null;
        void inspectRoot(rootPath);
      }, INSPECT_DEBOUNCE_MS);
    };

    const watchRepository = (repo: any) => {
      const rootPath = getRepoRoot(repo);
      if (!rootPath) {
        return;
      }

      const watchState = ensureWatchState(rootPath);
      watchState.repo = repo;
      debug(`watching repository ${rootPath}`);

      try {
        repo.state.onDidChange(() => scheduleInspect(rootPath), null, context.subscriptions);
      } catch {
        // ignore
      }

      void inspectRoot(rootPath);
    };

    const discoverRepositoryRoots = async (): Promise<string[]> => {
      const folders = vscode.workspace.workspaceFolders || [];
      const roots = new Set<string>();

      for (const folder of folders) {
        const rootPath = await safeRunGit(folder.uri.fsPath, ['rev-parse', '--show-toplevel']);
        if (!rootPath) {
          continue;
        }

        roots.add(rootPath);

        const parentPath = path.dirname(rootPath);
        const entries = await fs.readdir(parentPath, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }

          const candidatePath = path.join(parentPath, entry.name);
          if (await isGitRepoRoot(candidatePath)) {
            roots.add(candidatePath);
          }
        }
      }

      return [...roots];
    };

    const watchDiscoveredRepositories = async () => {
      const roots = await discoverRepositoryRoots();
      for (const rootPath of roots) {
        ensureWatchState(rootPath);
        debug(`discovered repository ${rootPath}`);
        void inspectRoot(rootPath);
      }
    };

    const activateAndSetup = async () => {
      try {
        if (ext && !ext.isActive) {
          await ext.activate();
        }

        const api = ext && (ext.exports as any)?.getAPI ? (ext.exports as any).getAPI(1) : undefined;
        if (api) {
          try {
            api.onDidOpenRepository?.((repo: any) => watchRepository(repo), null, context.subscriptions);
            api.repositories?.forEach((repo: any) => watchRepository(repo));
          } catch {
            // ignore
          }
        }

        await watchDiscoveredRepositories();

        const pollTimer = setInterval(() => {
          try {
            api?.repositories?.forEach((repo: any) => watchRepository(repo));
            void watchDiscoveredRepositories();
            for (const rootPath of watchedRoots.keys()) {
              scheduleInspect(rootPath);
            }
          } catch {
            // ignore
          }
        }, FALLBACK_POLL_MS);
        context.subscriptions.push({ dispose: () => clearInterval(pollTimer) });
      } catch {
        // ignore activation errors
      }
    };

    void activateAndSetup();
  } catch {
    // ignore any unexpected errors to avoid breaking activation
  }
}
