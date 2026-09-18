import { ActivityEventType } from '../activity/types';

export type GitSnapshot = {
  branch: string | null;
  head: string | null;
  remoteHead: string | null;
  mergeInProgress: boolean;
  rebaseInProgress: boolean;
  hasConflicts: boolean;
  stashHash: string | null;
  ahead: number | null;
  behind: number | null;
};

export type GitActivity = {
  type: ActivityEventType;
  label: string;
  metadata?: Record<string, unknown>;
  commitHash?: string | null;
};

export type HeadChangeDetails = {
  reflogSubject: string;
  commitCreatedAt: string | null;
  commitSubject: string | null;
  isMergeCommit: boolean;
};

export type SnapshotTransition = GitActivity | 'head_change' | null;

export function classifyHeadChange(
  snapshot: GitSnapshot,
  details: HeadChangeDetails
): GitActivity | null {
  const normalized = details.reflogSubject.trim().toLowerCase();

  if (normalized.includes('rebase')) {
    return {
      type: 'git_rebase',
      label: 'Git rebase',
      commitHash: snapshot.head,
      metadata: { reflog: details.reflogSubject }
    };
  }

  if (normalized.startsWith('pull')) {
    return {
      type: 'git_pull',
      label: 'Git pull',
      commitHash: snapshot.head,
      metadata: { reflog: details.reflogSubject }
    };
  }

  if (normalized.startsWith('merge') || details.isMergeCommit) {
    return {
      type: 'git_merge',
      label: 'Git merge',
      commitHash: snapshot.head,
      metadata: { reflog: details.reflogSubject }
    };
  }

  if (!/^commit(?: \([^)]*\))?:/.test(normalized)) {
    return null;
  }

  return {
    type: 'git_commit',
    label: 'Git commit',
    commitHash: snapshot.head,
    metadata: {
      commitHash: snapshot.head,
      commitCreatedAt: details.commitCreatedAt,
      commitSubject: details.commitSubject
    }
  };
}

export function classifySnapshotTransition(
  previous: GitSnapshot,
  snapshot: GitSnapshot
): SnapshotTransition {
  if (!previous.hasConflicts && snapshot.hasConflicts) {
    return {
      type: 'git_conflict',
      label: 'Git conflict',
      commitHash: snapshot.head
    };
  }

  if (previous.hasConflicts && !snapshot.hasConflicts) {
    return {
      type: 'git_conflict_resolved',
      label: 'Git conflict resolved',
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

  if (
    previous.head === snapshot.head &&
    previous.remoteHead !== null &&
    snapshot.remoteHead !== null &&
    previous.remoteHead !== snapshot.remoteHead &&
    snapshot.remoteHead === snapshot.head
  ) {
    return {
      type: 'git_push',
      label: 'Git push',
      commitHash: snapshot.head,
      metadata: {
        previousRemoteHead: previous.remoteHead,
        remoteHead: snapshot.remoteHead,
        branchName: snapshot.branch
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

  if (previous.rebaseInProgress && !snapshot.rebaseInProgress) {
    return previous.head !== snapshot.head
      ? { type: 'git_rebase', label: 'Git rebase', commitHash: snapshot.head }
      : null;
  }

  if (snapshot.rebaseInProgress) {
    return null;
  }

  if (previous.branch !== snapshot.branch) {
    return {
      type: 'git_branch_switch',
      label: 'Git branch switch',
      commitHash: snapshot.head,
      metadata: { branchName: snapshot.branch }
    };
  }

  return previous.head !== snapshot.head ? 'head_change' : null;
}