import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialGameState } from '../game/state';
import { applyGitRewardGate } from './rewardGate';

test('accepted git activity consumes cooldown only when it has a reward', () => {
  const state = createInitialGameState();
  const now = Date.parse('2026-09-18T12:00:00.000Z');

  const result = applyGitRewardGate(state, { type: 'git_branch_switch' }, now);

  assert.deepEqual(result, { accepted: true, reward: 'encounter' });
  assert.equal(state.cooldowns.lastEncounterAt, new Date(now).toISOString());
});

test('active cooldown returns its remaining time without moving the cooldown', () => {
  const state = createInitialGameState();
  const now = Date.parse('2026-09-18T12:00:00.000Z');
  state.cooldowns.lastEncounterAt = new Date(now - 60_000).toISOString();

  const result = applyGitRewardGate(state, { type: 'git_push' }, now);

  assert.deepEqual(result, { accepted: false, reason: 'cooldown', remainingMs: 60_000 });
  assert.equal(state.cooldowns.lastEncounterAt, new Date(now - 60_000).toISOString());
});

test('town and recovery return explicit skip reasons without consuming cooldown', () => {
  const townState = createInitialGameState();
  townState.town.inTown = true;
  const healingState = createInitialGameState();
  healingState.player.hp = 1;
  healingState.cooldowns.healingStartedAt = '2026-09-18T11:59:00.000Z';
  const now = Date.parse('2026-09-18T12:00:00.000Z');

  assert.deepEqual(applyGitRewardGate(townState, { type: 'git_stash' }, now), {
    accepted: false,
    reason: 'town'
  });
  assert.deepEqual(applyGitRewardGate(healingState, { type: 'git_pull' }, now), {
    accepted: false,
    reason: 'healing'
  });
  assert.equal(townState.cooldowns.lastEncounterAt, null);
  assert.equal(healingState.cooldowns.lastEncounterAt, null);
});

test('commit bypasses recovery and records the latest commit hash', () => {
  const state = createInitialGameState();
  state.player.hp = 1;
  state.cooldowns.healingStartedAt = '2026-09-18T11:59:00.000Z';
  const now = Date.parse('2026-09-18T12:00:00.000Z');

  const result = applyGitRewardGate(state, { type: 'git_commit', commitHash: 'abc123' }, now);

  assert.deepEqual(result, { accepted: true, reward: 'encounter' });
  assert.equal(state.cooldowns.lastCommitHash, 'abc123');
  assert.equal(state.cooldowns.lastEncounterAt, new Date(now).toISOString());
});