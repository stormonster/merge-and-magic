import { Enemy, GameState, PlayerStats } from './types';
import { clamp } from './random';

export function getTotalStats(player: GameState['player']): PlayerStats {
  const total: PlayerStats = { ...player.baseStats };

  for (const slot of Object.values(player.equipment)) {
    if (!slot.item) {
      continue;
    }

    for (const [stat, value] of Object.entries(slot.item.stats)) {
      if (typeof value !== 'number') {
        continue;
      }
      const key = stat as keyof PlayerStats;
      total[key] += value;
    }
  }

  return total;
}

export function calculateWinChance(player: GameState['player'], enemy: Enemy): number {
  const stats = getTotalStats(player);
  const effectiveEnemyLevel = Math.max(enemy.level, player.level);
  const playerPower =
    player.level * 5 +
    stats.focus * 1.2 +
    stats.debugging * 1.5 +
    stats.architecture * 1.1 +
    stats.velocity * 1.0 +
    stats.resilience * 1.3 +
    stats.luck * 0.8;

  const enemyPower = (effectiveEnemyLevel * 7 + enemy.hp * 0.65 + enemy.attack * 2.6 + enemy.defense * 1.5) * 1.15;
  return clamp(playerPower / (playerPower + enemyPower), 0.2, 0.8);
}
