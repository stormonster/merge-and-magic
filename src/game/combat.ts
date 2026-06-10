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
  const playerPower =
    player.level * 5 +
    stats.focus * 1.2 +
    stats.debugging * 1.5 +
    stats.architecture * 1.1 +
    stats.velocity * 1.0 +
    stats.resilience * 1.3 +
    stats.luck * 0.8;

  const enemyPower = enemy.level * 5 + enemy.hp * 0.5 + enemy.attack * 2 + enemy.defense;
  return clamp(playerPower / (playerPower + enemyPower), 0.1, 0.9);
}
