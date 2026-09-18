import { Enemy } from './types';
import { BOSSES, ELITES, ENEMIES, RAID_BOSSES } from '../data/enemies';
import { randomInt } from './random';

export function pickRandomEnemy(): Enemy {
  return ENEMIES[randomInt(0, ENEMIES.length - 1)];
}

export function pickRandomBoss(): Enemy {
  return BOSSES[randomInt(0, BOSSES.length - 1)];
}

export function pickRandomElite(): Enemy {
  return ELITES[randomInt(0, ELITES.length - 1)];
}

export function pickRandomRaidBoss(): Enemy {
  return RAID_BOSSES[randomInt(0, RAID_BOSSES.length - 1)];
}
