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

export const BOSSES: Enemy[] = [
  {
    id: 'build_breaker_colossus',
    name: 'Build-Breaker Colossus',
    level: 3,
    hp: 30,
    attack: 6,
    defense: 3,
    xpReward: 45,
    goldReward: 15,
    baseLootDropChance: 0.7
  },
  {
    id: 'dependency_hydra',
    name: 'Dependency Hydra',
    level: 4,
    hp: 38,
    attack: 7,
    defense: 4,
    xpReward: 55,
    goldReward: 18,
    baseLootDropChance: 0.72
  },
  {
    id: 'production_incident',
    name: 'The Production Incident',
    level: 5,
    hp: 46,
    attack: 9,
    defense: 4,
    xpReward: 70,
    goldReward: 24,
    baseLootDropChance: 0.75
  }
];
