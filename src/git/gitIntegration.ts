import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as util from 'util';
import * as vscode from 'vscode';
import { ActivityEventInput, ActivityEventType } from '../activity/types';
import { GameState } from '../game/types';

const execFile = util.promisify(cp.execFile);
const GIT_ENCOUNTER_COOLDOWN_MS = 5 * 60 * 1000;
const INSPECT_DEBOUNCE_MS = 400;
const FALLBACK_POLL_MS = 10 * 1000;

type GitSnapshot = {
  branch: string | null;
  head: string | null;
  mergeInProgress: boolean;
  hasConflicts: boolean;
  stashHash: string | null;
  ahead: number | null;
  behind: number | null;
};

type GitActivity = {
  type: ActivityEventType;
  label: string;
  metadata?: Record<string, unknown>;
  commitHash?: string | null;
};

type RepoWatchState = {
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

function hasConflictStatus(statusOutput: string | null): boolean {
  if (!statusOutput) {
    return false;
  }

  return statusOutput
    .split('\n')
    .some((line) => /^(DD|AU|UD|UA|DU|AA|UU) /.test(line));
}

function parseUpstreamDistance(output: string | null): { ahead: number | null; behind: number | null } {
  if (!output) {
    return { ahead: null, behind: null };
  }

  const [behindText, aheadText] = output.trim().split(/\s+/);
  const behind = Number.parseInt(behindText, 10);
  const ahead = Number.parseInt(aheadText, 10);

  return {
    ahead: Number.isFinite(ahead) ? ahead : null,
    behind: Number.isFinite(behind) ? behind : null
  };
}

async function getSnapshot(repo: any): Promise<GitSnapshot | null> {
  const rootPath = getRepoRoot(repo);
  if (!rootPath) {
    return null;
  }

  const head = repo.state?.HEAD?.commit || (await safeRunGit(rootPath, ['rev-parse', '--verify', 'HEAD']));
  const branch = repo.state?.HEAD?.name || (await safeRunGit(rootPath, ['branch', '--show-current'])) || null;
  const status = await safeRunGit(rootPath, ['status', '--porcelain=v1']);
  const stashHash = await safeRunGit(rootPath, ['rev-parse', '--verify', '-q', 'refs/stash']);
  const mergeInProgress = await gitPathExists(rootPath, 'MERGE_HEAD');
  const upstreamDistance = parseUpstreamDistance(await safeRunGit(rootPath, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']));

  return {
    branch,
    head,
    mergeInProgress,
    hasConflicts: hasConflictStatus(status),
    stashHash,
    ahead: upstreamDistance.ahead,
    behind: upstreamDistance.behind
  };
}

async function getReflogSubject(rootPath: string): Promise<string> {
  return (await safeRunGit(rootPath, ['reflog', '-1', '--format=%gs'])) || '';
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

async function classifyHeadChange(rootPath: string, snapshot: GitSnapshot): Promise<GitActivity> {
  const reflogSubject = await getReflogSubject(rootPath);
  const normalized = reflogSubject.toLowerCase();

  if (normalized.startsWith('pull')) {
    return {
      type: 'git_pull',
      label: 'Git pull',
      commitHash: snapshot.head,
      metadata: { reflog: reflogSubject }
    };
  }

  if (normalized.startsWith('merge') || (await isMergeCommit(rootPath, snapshot.head))) {
    return {
      type: 'git_merge',
      label: 'Git merge',
      commitHash: snapshot.head,
      metadata: { reflog: reflogSubject }
    };
  }

  return {
    type: 'git_commit',
    label: 'Git commit',
    commitHash: snapshot.head,
    metadata: { commitHash: snapshot.head }
  };
}

async function classifyGitActivity(repo: any, previous: GitSnapshot, snapshot: GitSnapshot): Promise<GitActivity | null> {
  const rootPath = getRepoRoot(repo);
  if (!rootPath) {
    return null;
  }

  if (!previous.hasConflicts && snapshot.hasConflicts) {
    return {
      type: 'git_conflict',
      label: 'Git conflict',
      commitHash: snapshot.head
    };
  }

  if (previous.stashHash !== snapshot.stashHash) {
    return {
      type: 'git_stash',
      label: 'Git stash',
      commitHash: snapshot.head
    };
  }

  if (previous.head === snapshot.head && previous.ahead !== null && snapshot.ahead !== null && previous.ahead > snapshot.ahead) {
    return {
      type: 'git_push',
      label: 'Git push',
      commitHash: snapshot.head,
      metadata: {
        previousAhead: previous.ahead,
        ahead: snapshot.ahead
      }
    };
  }

  if (previous.mergeInProgress && !snapshot.mergeInProgress && previous.head !== snapshot.head) {
    return {
      type: 'git_merge',
      label: 'Git merge',
      commitHash: snapshot.head
    };
  }

  if (previous.branch !== snapshot.branch) {
    return {
      type: 'git_branch_switch',
      label: 'Git branch switch',
      commitHash: snapshot.head
    };
  }

  if (previous.head !== snapshot.head) {
    return classifyHeadChange(rootPath, snapshot);
  }

  return null;
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

async function shouldSkipForCooldown(
  state: GameState,
  activity: GitActivity,
  onActivitySkipped?: (activity: GitActivity, remainingMs: number) => Promise<void>
): Promise<boolean> {
  const now = Date.now();
  const last = state.cooldowns.lastEncounterAt ? Date.parse(state.cooldowns.lastEncounterAt) : 0;
  const isHealing = state.cooldowns.healingStartedAt !== null && state.player.hp < state.player.maxHp;

  if (state.town.inTown) {
    return true;
  }

  if (isHealing && activity.type !== 'git_commit') {
    return true;
  }

  if (activity.type === 'git_commit' && activity.commitHash) {
    state.cooldowns.lastCommitHash = activity.commitHash;
  }

  if (!isHealing && now - last < GIT_ENCOUNTER_COOLDOWN_MS) {
    const remainingMs = GIT_ENCOUNTER_COOLDOWN_MS - (now - last);
    await onActivitySkipped?.(activity, remainingMs);
    return true;
  }

  state.cooldowns.lastEncounterAt = new Date().toISOString();
  return false;
}

export function initializeGitIntegration(
  context: vscode.ExtensionContext,
  getState: () => GameState,
  onGitActivity: (activity: ActivityEventInput) => Promise<void>,
  onActivitySkipped?: (activity: GitActivity, remainingMs: number) => Promise<void>
): void {
  try {
    const ext = vscode.extensions.getExtension('vscode.git');
    if (!ext) return;

    const watchedRepos = new WeakMap<object, RepoWatchState>();

    const inspectRepository = async (repo: any) => {
      const watchState = watchedRepos.get(repo);
      if (!watchState) {
        return;
      }

      try {
        const snapshot = await getSnapshot(repo);
        if (!snapshot?.head) {
          return;
        }

        if (!watchState.snapshot) {
          watchState.snapshot = snapshot;
          const state = getState();
          state.cooldowns.lastCommitHash = state.cooldowns.lastCommitHash || snapshot.head;
          return;
        }

        const activity = await classifyGitActivity(repo, watchState.snapshot, snapshot);
        watchState.snapshot = snapshot;

        if (!activity) {
          return;
        }

        const state = getState();
        if (activity.type === 'git_commit' && activity.commitHash && state.cooldowns.lastCommitHash === activity.commitHash) {
          return;
        }

        if (await shouldSkipForCooldown(state, activity, onActivitySkipped)) {
          return;
        }

        await onGitActivity(getActivityInput(activity));
      } catch (error) {
        console.error('Merge & Magic git activity trigger failed', error);
      }
    };

    const scheduleInspect = (repo: any) => {
      const watchState = watchedRepos.get(repo);
      if (!watchState) {
        return;
      }

      if (watchState.pendingTimer) {
        clearTimeout(watchState.pendingTimer);
      }

      watchState.pendingTimer = setTimeout(() => {
        watchState.pendingTimer = null;
        void inspectRepository(repo);
      }, INSPECT_DEBOUNCE_MS);
    };

    const watchRepository = (repo: any) => {
      if (watchedRepos.has(repo)) {
        return;
      }

      watchedRepos.set(repo, {
        snapshot: null,
        pendingTimer: null
      });

      try {
        repo.state.onDidChange(() => scheduleInspect(repo), null, context.subscriptions);
      } catch {
        // ignore
      }

      void inspectRepository(repo);
    };

    const activateAndSetup = async () => {
      try {
        if (!ext.isActive) {
          await ext.activate();
        }

        const api = (ext.exports as any)?.getAPI ? (ext.exports as any).getAPI(1) : undefined;
        if (!api) return;

        try {
          api.onDidOpenRepository?.((repo: any) => watchRepository(repo), null, context.subscriptions);
          api.repositories?.forEach((repo: any) => watchRepository(repo));
        } catch {
          // ignore
        }

        const pollTimer = setInterval(() => {
          try {
            api.repositories?.forEach((repo: any) => scheduleInspect(repo));
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
