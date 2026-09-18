import test from 'node:test';
import assert from 'node:assert/strict';

import { processActivityEvent } from './processor';
import { createInitialGameState } from '../game/state';
import { ActivityEventType } from './types';
import { getActivityReward } from './rewards';

const GIT_ACTIVITY_TYPES: ActivityEventType[] = [
  'git_commit',
  'git_branch_switch',
  'git_pull',
  'git_push',
  'git_merge',
  'git_rebase',
  'git_conflict',
  'git_stash'
];

test('every cooldown-eligible git activity has an encounter reward contract', () => {
  for (const type of GIT_ACTIVITY_TYPES) {
    assert.equal(getActivityReward(type), 'encounter', `${type} should reward an encounter`);
  }
});

for (const type of GIT_ACTIVITY_TYPES) {
  test(`${type} resolves a game reward`, async () => {
    const state = createInitialGameState();

    const encounterCountBefore = state.log.filter((entry) => entry.message.startsWith('⚔ Encounter:')).length;

    await processActivityEvent(state, {
      type,
      source: 'git',
      label: type,
      weight: 1,
      metadata: {
        branchName: 'feature/test-branch',
        commitHash: 'test-commit'
      }
    });

    const encounterCountAfter = state.log.filter((entry) => entry.message.startsWith('⚔ Encounter:')).length;

    assert.ok(encounterCountAfter > encounterCountBefore, `${type} should trigger an encounter`);
  });
}
