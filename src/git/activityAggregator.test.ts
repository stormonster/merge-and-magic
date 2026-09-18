import test from 'node:test';
import assert from 'node:assert/strict';

import { GitActivity } from './activityClassifier';
import {
  GIT_ACTIVITY_WINDOW_MS,
  GitActivityAggregator
} from './activityAggregator';

class FakeScheduler {
  private nextId = 1;
  readonly timers = new Map<number, { callback: () => void; delayMs: number }>();

  setTimeout = (callback: () => void, delayMs: number): NodeJS.Timeout => {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { callback, delayMs });
    return id as unknown as NodeJS.Timeout;
  };

  clearTimeout = (timer: NodeJS.Timeout): void => {
    this.timers.delete(timer as unknown as number);
  };

  run(timer: number): boolean {
    const scheduled = this.timers.get(timer);
    if (!scheduled) {
      return false;
    }

    this.timers.delete(timer);
    scheduled.callback();
    return true;
  }
}

function activity(type: GitActivity['type'], label: string, commitHash: string): GitActivity {
  return { type, label, commitHash };
}

test('each git activity resets the 30 second aggregation window', async () => {
  const scheduler = new FakeScheduler();
  let flushCount = 0;
  const aggregator = new GitActivityAggregator(async () => {
    flushCount += 1;
  }, scheduler);

  aggregator.add(activity('git_branch_switch', 'Git branch switch', 'head-1'));
  const firstTimer = [...scheduler.timers.keys()][0];
  aggregator.add(activity('git_commit', 'Git commit', 'head-2'));
  const secondTimer = [...scheduler.timers.keys()][0];

  assert.equal(GIT_ACTIVITY_WINDOW_MS, 30_000);
  assert.notEqual(secondTimer, firstTimer);
  assert.equal(scheduler.timers.size, 1);
  assert.equal(scheduler.timers.get(secondTimer)?.delayMs, GIT_ACTIVITY_WINDOW_MS);
  assert.equal(scheduler.run(firstTimer), false);
  assert.equal(scheduler.run(secondTimer), true);
  await Promise.resolve();
  assert.equal(flushCount, 1);
});

test('a burst rewards its strongest unique activity and describes the full burst', async () => {
  const batches: GitActivity[] = [];
  const aggregator = new GitActivityAggregator(async (batch) => {
    batches.push(batch.activity);
  }, new FakeScheduler());

  aggregator.add(activity('git_branch_switch', 'Git branch switch', 'head-1'));
  aggregator.add(activity('git_commit', 'Git commit', 'head-2'));
  aggregator.add(activity('git_push', 'Git push', 'head-2'));
  aggregator.add(activity('git_push', 'Git push', 'head-2'));
  await aggregator.flush();

  assert.equal(batches.length, 1);
  assert.equal(batches[0].type, 'git_commit');
  assert.equal(batches[0].label, 'Git burst: branch switch + commit + push');
  assert.deepEqual(batches[0].metadata?.burstTypes, [
    'git_branch_switch',
    'git_commit',
    'git_push'
  ]);
  assert.equal(batches[0].metadata?.burstCount, 3);
});