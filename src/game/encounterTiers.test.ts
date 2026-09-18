import test from 'node:test';
import assert from 'node:assert/strict';

import { processActivityEvent } from '../activity/processor';
import { RAID_BOSSES } from '../data/enemies';
import { triggerTierEncounter } from './engine';
import { createInitialGameState } from './state';

test('rebase and large git bursts resolve elite encounters', async () => {
  const rebaseState = createInitialGameState();
  const burstState = createInitialGameState();

  await processActivityEvent(rebaseState, {
    type: 'git_rebase',
    source: 'git',
    label: 'Git rebase',
    weight: 1
  });
  await processActivityEvent(burstState, {
    type: 'git_commit',
    source: 'git',
    label: 'Git burst',
    weight: 1,
    metadata: { burstCount: 3 }
  });

  assert.ok(rebaseState.log.some((entry) => entry.type === 'elite_encounter'));
  assert.ok(burstState.log.some((entry) => entry.type === 'elite_encounter'));
});

test('resolved conflicts resolve boss encounters', async () => {
  const state = createInitialGameState();

  await processActivityEvent(state, {
    type: 'git_conflict_resolved',
    source: 'git',
    label: 'Git conflict resolved',
    weight: 1
  });

  assert.ok(state.log.some((entry) => entry.type === 'boss_encounter'));
});

test('release pushes resolve raid encounters', async () => {
  const state = createInitialGameState();

  await processActivityEvent(state, {
    type: 'git_push',
    source: 'git',
    label: 'Git release push',
    weight: 1,
    metadata: { releasePush: true, releasePushCounted: true }
  });

  assert.ok(state.log.some((entry) => entry.type === 'raid_encounter'));
});

test('raid victories guarantee an empowered chest', async () => {
  const state = createInitialGameState();
  const raidBoss = RAID_BOSSES[0];

  await triggerTierEncounter(state, 'raid', {
    enemy: raidBoss,
    random: () => 0,
    triggerLabel: 'Release push'
  });

  assert.equal(state.player.level, 2);
  assert.equal(state.player.xp, raidBoss.xpReward - 75);
  assert.equal(state.player.gold, raidBoss.goldReward);
  assert.equal(state.lootChest.pending.length, 1);
  assert.ok(state.lootChest.pending[0].item.itemLevel >= state.player.level + 1);
  assert.ok(state.log.some((entry) => entry.message.includes('RAID ENCOUNTER')));
  assert.ok(state.log.some((entry) => entry.message.includes('guaranteed raid loot')));
});