import { Enemy } from './types';
import { ENEMIES } from '../data/enemies';
import { randomInt } from './random';

export function pickRandomEnemy(): Enemy {
  return ENEMIES[randomInt(0, ENEMIES.length - 1)];
}
