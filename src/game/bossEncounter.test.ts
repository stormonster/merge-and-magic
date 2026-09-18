import test from 'node:test';
import assert from 'node:assert/strict';

import { processActivityEvent } from '../activity/processor';
import { BOSSES } from '../data/enemies';
import { triggerBossEncounter } from './engine';
import { getAdjustedRarityWeights, getBossRarityWeights } from './loot';
import { createInitialGameState } from './state';
import { BOSS_MINIMUM_LOOT_CHANCE } from './engine';

test('focus completion resolves a boss encounter', async () => {
  const state = createInitialGameState();

  await processActivityEvent(state, {
    type: 'focus_session',
    source: 'timer',
    label: 'Editor focus',
    weight: 1
  });

  assert.ok(state.log.some((entry) => entry.type === 'boss_encounter'));
});

test('boss victory has heightened rewards and at least an 80 percent loot chance', async () => {
  const state = createInitialGameState();
  const boss = BOSSES[0];

  await triggerBossEncounter(state, {
    enemy: boss,
    random: () => 0,
    triggerLabel: 'Editor focus'
  });

  assert.equal(state.player.xp, boss.xpReward);
  assert.equal(state.player.gold, boss.goldReward);
  assert.equal(state.lootChest.pending.length, 1);
  assert.ok(state.log.some((entry) => entry.message.includes('BOSS ENCOUNTER')));
  assert.ok(state.log.some((entry) => entry.message.includes('boss loot chance')));
  assert.equal(BOSS_MINIMUM_LOOT_CHANCE, 0.8);
});

test('boss rarity weights favor uncommon and better loot', () => {
  const regular = getAdjustedRarityWeights(0);
  const boss = getBossRarityWeights(0);

  assert.ok(boss.common < regular.common);
  assert.ok(boss.rare > regular.rare);
  assert.ok(boss.epic > regular.epic);
  assert.ok(boss.legendary > regular.legendary);
  assert.ok(boss.mythic > regular.mythic);
});