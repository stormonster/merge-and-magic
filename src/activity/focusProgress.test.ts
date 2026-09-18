import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyFocusDecay,
  FOCUS_DECAY_GRACE_MS,
  recordFocusActivity
} from './focusProgress';
import { FocusProgress } from '../game/types';

const START = Date.parse('2026-09-18T12:00:00.000Z');

function focus(activeMs = 4 * 60_000): FocusProgress {
  return {
    activeMs,
    lastActivityAt: new Date(START).toISOString(),
    decayAppliedAt: null
  };
}

test('focus progress does not decay during the one hour grace period', () => {
  const progress = focus();

  const changed = applyFocusDecay(progress, START + FOCUS_DECAY_GRACE_MS);

  assert.equal(changed, false);
  assert.equal(progress.activeMs, 4 * 60_000);
});

test('focus progress decays in real time after one hour of inactivity', () => {
  const progress = focus();

  const firstChanged = applyFocusDecay(progress, START + FOCUS_DECAY_GRACE_MS + 30_000);
  const secondChanged = applyFocusDecay(progress, START + FOCUS_DECAY_GRACE_MS + 45_000);

  assert.equal(firstChanged, true);
  assert.equal(secondChanged, true);
  assert.equal(progress.activeMs, 3 * 60_000 + 15_000);
});

test('new activity applies pending decay and starts a fresh grace period', () => {
  const progress = focus();
  const resumedAt = START + FOCUS_DECAY_GRACE_MS + 60_000;

  recordFocusActivity(progress, 15_000, resumedAt);
  const changedDuringNewGrace = applyFocusDecay(progress, resumedAt + FOCUS_DECAY_GRACE_MS);

  assert.equal(progress.activeMs, 3 * 60_000 + 15_000);
  assert.equal(progress.lastActivityAt, new Date(resumedAt).toISOString());
  assert.equal(progress.decayAppliedAt, null);
  assert.equal(changedDuringNewGrace, false);
});