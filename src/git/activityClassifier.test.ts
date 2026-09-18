import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyHeadChange,
  classifySnapshotTransition,
  GitSnapshot
} from './activityClassifier';

function snapshot(overrides: Partial<GitSnapshot> = {}): GitSnapshot {
  return {
    branch: 'main',
    head: 'head-1',
    remoteHead: 'head-1',
    mergeInProgress: false,
    rebaseInProgress: false,
    hasConflicts: false,
    stashHash: null,
    ahead: 0,
    behind: 0,
    ...overrides
  };
}

test('branch switch includes the destination branch', () => {
  const result = classifySnapshotTransition(
    snapshot({ branch: 'main', head: 'head-1' }),
    snapshot({ branch: 'feature/rewards', head: 'head-2' })
  );

  assert.deepEqual(result, {
    type: 'git_branch_switch',
    label: 'Git branch switch',
    commitHash: 'head-2',
    metadata: { branchName: 'feature/rewards' }
  });
});

test('push requires the remote to reach the unchanged local head', () => {
  const result = classifySnapshotTransition(
    snapshot({ head: 'head-2', remoteHead: 'head-1' }),
    snapshot({ head: 'head-2', remoteHead: 'head-2' })
  );

  assert.equal(typeof result, 'object');
  assert.equal(result && result !== 'head_change' ? result.type : null, 'git_push');
});

test('rebase rewards completion, not merely entering rebase state', () => {
  const started = classifySnapshotTransition(
    snapshot(),
    snapshot({ rebaseInProgress: true })
  );
  const completed = classifySnapshotTransition(
    snapshot({ rebaseInProgress: true, head: 'head-1' }),
    snapshot({ rebaseInProgress: false, head: 'head-2' })
  );

  assert.equal(started, null);
  assert.equal(completed && completed !== 'head_change' ? completed.type : null, 'git_rebase');
});

test('conflict detection takes precedence over other snapshot changes', () => {
  const result = classifySnapshotTransition(
    snapshot(),
    snapshot({ branch: 'feature/conflict', head: 'head-2', hasConflicts: true })
  );

  assert.equal(result && result !== 'head_change' ? result.type : null, 'git_conflict');
});

test('conflict resolution is classified separately from conflict detection', () => {
  const result = classifySnapshotTransition(
    snapshot({ hasConflicts: true }),
    snapshot({ hasConflicts: false, head: 'head-2' })
  );

  assert.equal(result && result !== 'head_change' ? result.type : null, 'git_conflict_resolved');
});

test('stash changes and completed merges are classified', () => {
  const stash = classifySnapshotTransition(
    snapshot({ stashHash: null }),
    snapshot({ stashHash: 'stash-1' })
  );
  const merge = classifySnapshotTransition(
    snapshot({ mergeInProgress: true, head: 'head-1' }),
    snapshot({ mergeInProgress: false, head: 'head-2' })
  );

  assert.equal(stash && stash !== 'head_change' ? stash.type : null, 'git_stash');
  assert.equal(merge && merge !== 'head_change' ? merge.type : null, 'git_merge');
});

test('head classifier recognizes pull, merge, and rebase reflogs', () => {
  const changed = snapshot({ head: 'head-2' });
  const baseDetails = {
    commitCreatedAt: '2026-09-18T12:00:00.000Z',
    commitSubject: 'updated head',
    isMergeCommit: false
  };

  assert.equal(classifyHeadChange(changed, {
    ...baseDetails,
    reflogSubject: 'pull origin main: Fast-forward'
  })?.type, 'git_pull');
  assert.equal(classifyHeadChange(changed, {
    ...baseDetails,
    reflogSubject: 'merge feature/rewards: Merge made by the ort strategy.'
  })?.type, 'git_merge');
  assert.equal(classifyHeadChange(changed, {
    ...baseDetails,
    reflogSubject: 'rebase (finish): returning to refs/heads/main'
  })?.type, 'git_rebase');
});

test('head classifier accepts known commit reflogs and rejects resets', () => {
  const commit = classifyHeadChange(snapshot({ head: 'head-2' }), {
    reflogSubject: 'commit: fix trigger rewards',
    commitCreatedAt: '2026-09-18T12:00:00.000Z',
    commitSubject: 'fix trigger rewards',
    isMergeCommit: false
  });
  const reset = classifyHeadChange(snapshot({ head: 'head-3' }), {
    reflogSubject: 'reset: moving to HEAD~1',
    commitCreatedAt: '2026-09-18T12:01:00.000Z',
    commitSubject: 'previous commit',
    isMergeCommit: false
  });

  assert.equal(commit?.type, 'git_commit');
  assert.equal(reset, null);
});