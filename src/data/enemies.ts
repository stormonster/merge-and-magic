import { Enemy } from '../game/types';

export const ENEMIES: Enemy[] = [
  {
    id: 'bug_goblin',
    name: 'Bug Goblin',
    level: 1,
    hp: 12,
    attack: 3,
    defense: 1,
    xpReward: 10,
    goldReward: 3,
    baseLootDropChance: 0.35
  },
  {
    id: 'merge_conflict_wraith',
    name: 'Merge Conflict Wraith',
    level: 3,
    hp: 26,
    attack: 6,
    defense: 2,
    xpReward: 25,
    goldReward: 8,
    baseLootDropChance: 0.45
  },
  {
    id: 'null_pointer_imp',
    name: 'Null Pointer Imp',
    level: 2,
    hp: 18,
    attack: 4,
    defense: 2,
    xpReward: 15,
    goldReward: 5,
    baseLootDropChance: 0.38
  },
  {
    id: 'legacy_code_golem',
    name: 'Legacy Code Golem',
    level: 4,
    hp: 34,
    attack: 7,
    defense: 3,
    xpReward: 32,
    goldReward: 10,
    baseLootDropChance: 0.42
  }
];
