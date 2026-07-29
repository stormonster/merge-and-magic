import { ActivityEvent } from '../activity/types';
import type { AchievementId } from './achievements';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type EquipmentSlotType =
  | 'helmet'
  | 'chest'
  | 'gloves'
  | 'boots'
  | 'weapon'
  | 'offhand'
  | 'amulet'
  | 'ring1'
  | 'ring2';

export type PlayerStats = {
  focus: number;
  debugging: number;
  architecture: number;
  velocity: number;
  resilience: number;
  luck: number;
};

export type Item = {
  id: string;
  name: string;
  slot: EquipmentSlotType;
  rarity: Rarity;
  itemLevel: number;
  icon: string;
  stats: Partial<PlayerStats>;
};

export type ItemTemplate = {
  id: string;
  namePrefix: string;
  slot: EquipmentSlotType;
  icon: string;
  iconPool?: string[];
  visualVariants?: {
    namePrefix: string;
    icon: string;
    noun?: string;
  }[];
  statBias: keyof PlayerStats;
};

export type BaseItemTemplate = Omit<ItemTemplate, 'id'>;

export type UniqueItemTemplate = {
  id: string;
  name: string;
  slot: EquipmentSlotType;
  icon: string;
  itemLevel: number;
  stats: Partial<PlayerStats>;
};

export type EquipmentSlot = {
  slot: EquipmentSlotType;
  locked: boolean;
  item: Item | null;
};

export type Enemy = {
  id: string;
  name: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  xpReward: number;
  goldReward: number;
  baseLootDropChance: number;
};

export type Player = {
  name: string;
  suffix: string;
  titleId: string;
  level: number;
  xp: number;
  gold: number;
  hp: number;
  maxHp: number;
  baseStats: PlayerStats;
  equipment: Record<EquipmentSlotType, EquipmentSlot>;
};

export type GameLogEntry = {
  id: string;
  createdAt: string;
  type: 'encounter' | 'loot_equipped' | 'loot_missed' | 'level_up' | 'system';
  message: string;
  highlights?: {
    text: string;
    rarity: Rarity;
  }[];
};

export type GameState = {
  version: number;
  player: Player;
  log: GameLogEntry[];
  activityLog: ActivityEvent[];
  achievements: {
    unlockedIds: AchievementId[];
  };
  progress: {
    encounters: number;
    defeats: number;
    commits: number;
    rebases: number;
    testPasses: number;
    testFailures: number;
    testFailureStreak: number;
    bugSuitesResolved: number;
    refactorCommits: number;
    hotfixCommits: number;
    releasePushes: number;
    fastCommitStreak: number;
    lastCommitAt: string | null;
    commitDayStreak: number;
    lastCommitDay: string | null;
    minimalistVictories: number;
    nearDeathRecoveries: number;
    legendaryItems: number;
    mergeConflicts: number;
    midnightCommits: number;
    maxGreedWins: number;
  };
  focus: {
    activeMs: number;
  };
  cooldowns: {
    lastEncounterAt: string | null;
    lastCommitHash: string | null;
    healingStartedAt: string | null;
    lastTownEnteredAt: string | null;
  };
  town: {
    inTown: boolean;
    enteredAt: string | null;
    purchases: number;
  };
};
