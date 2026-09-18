import test from 'node:test';
import assert from 'node:assert/strict';

import { getEncounterTier } from './encounterTier';

test('ordinary git activity is normal', () => {
  assert.equal(getEncounterTier('git_commit'), 'normal');
});

test('rebases and bursts of at least three activities are elite', () => {
  assert.equal(getEncounterTier('git_rebase'), 'elite');
  assert.equal(getEncounterTier('git_commit', { burstCount: 3 }), 'elite');
});

test('focus completion and resolved conflicts are boss encounters', () => {
  assert.equal(getEncounterTier('focus_session'), 'boss');
  assert.equal(getEncounterTier('git_conflict_resolved'), 'boss');
});

test('release pushes are raids and override lower burst tiers', () => {
  assert.equal(getEncounterTier('git_commit', {
    burstCount: 4,
    releasePush: true,
    burstTypes: ['git_rebase', 'git_push']
  }), 'raid');
});