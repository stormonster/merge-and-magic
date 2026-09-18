import { Enemy } from './types';
import { BOSSES, ENEMIES } from '../data/enemies';
import { randomInt } from './random';

export function pickRandomEnemy(): Enemy {
  return ENEMIES[randomInt(0, ENEMIES.length - 1)];
}

export function pickRandomBoss(): Enemy {
  return BOSSES[randomInt(0, BOSSES.length - 1)];
}
