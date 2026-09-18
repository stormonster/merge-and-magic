import { FocusProgress } from '../game/types';

export const FOCUS_DECAY_GRACE_MS = 60 * 60 * 1000;

export function applyFocusDecay(focus: FocusProgress, now = Date.now()): boolean {
  if (focus.activeMs <= 0 || !focus.lastActivityAt) {
    return false;
  }

  const lastActivityAt = Date.parse(focus.lastActivityAt);
  if (!Number.isFinite(lastActivityAt)) {
    return false;
  }

  const decayStartsAt = lastActivityAt + FOCUS_DECAY_GRACE_MS;
  const previousDecayAt = focus.decayAppliedAt ? Date.parse(focus.decayAppliedAt) : decayStartsAt;
  const decayFrom = Number.isFinite(previousDecayAt)
    ? Math.max(decayStartsAt, previousDecayAt)
    : decayStartsAt;
  if (now <= decayFrom) {
    return false;
  }

  const previousActiveMs = focus.activeMs;
  focus.activeMs = Math.max(0, focus.activeMs - (now - decayFrom));
  focus.decayAppliedAt = new Date(now).toISOString();
  return focus.activeMs !== previousActiveMs;
}

export function recordFocusActivity(
  focus: FocusProgress,
  activeMs: number,
  now = Date.now()
): void {
  applyFocusDecay(focus, now);
  focus.activeMs += activeMs;
  focus.lastActivityAt = new Date(now).toISOString();
  focus.decayAppliedAt = null;
}