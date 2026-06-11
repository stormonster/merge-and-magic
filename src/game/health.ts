import { Enemy, GameState } from './types';
import { getTotalStats } from './combat';
import { clamp } from './random';

export const HEALING_DURATION_MS = 3 * 60 * 1000;
const MIN_RECOVERY_HP = 1;

export type PassiveHealingResult = {
  changed: boolean;
  completed: boolean;
};

export function applyPassiveHealing(state: GameState, now = Date.now()): PassiveHealingResult {
  const healingStartedAt = state.cooldowns.healingStartedAt;
  if (!healingStartedAt) {
    return { changed: false, completed: false };
  }

  const startedAt = Date.parse(healingStartedAt);
  if (!Number.isFinite(startedAt)) {
    state.cooldowns.healingStartedAt = new Date(now).toISOString();
    state.player.hp = Math.max(MIN_RECOVERY_HP, state.player.hp);
    return { changed: true, completed: false };
  }

  const elapsed = now - startedAt;
  if (elapsed >= HEALING_DURATION_MS) {
    state.player.hp = state.player.maxHp;
    state.cooldowns.healingStartedAt = null;
    return { changed: true, completed: true };
  }

  const progress = clamp(elapsed / HEALING_DURATION_MS, 0, 1);
  const recoveredHp = MIN_RECOVERY_HP + Math.floor(progress * (state.player.maxHp - MIN_RECOVERY_HP));
  const nextHp = clamp(Math.max(state.player.hp, recoveredHp), MIN_RECOVERY_HP, state.player.maxHp);
  const changed = nextHp !== state.player.hp;
  state.player.hp = nextHp;
  return { changed, completed: false };
}

export function isHealing(state: GameState): boolean {
  return state.cooldowns.healingStartedAt !== null && state.player.hp < state.player.maxHp;
}

export function startHealingIfNeeded(state: GameState, now = Date.now()): boolean {
  if (state.player.hp > MIN_RECOVERY_HP) {
    return false;
  }

  state.player.hp = MIN_RECOVERY_HP;
  if (state.cooldowns.healingStartedAt) {
    return false;
  }

  state.cooldowns.healingStartedAt = new Date(now).toISOString();
  return true;
}

export function healToFull(state: GameState): void {
  state.player.hp = state.player.maxHp;
  state.cooldowns.healingStartedAt = null;
}

export function calculateDefeatDamage(state: GameState, enemy: Enemy): number {
  const stats = getTotalStats(state.player);
  const mitigation = Math.floor(stats.resilience / 4);
  const rawDamage = enemy.attack + Math.ceil(enemy.level * 1.5) - mitigation;
  return clamp(rawDamage, 2, Math.max(2, state.player.maxHp - MIN_RECOVERY_HP));
}
