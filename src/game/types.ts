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
  statBias: keyof PlayerStats;
};

export type BaseItemTemplate = Omit<ItemTemplate, 'id'>;

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
  level: number;
  xp: number;
  gold: number;
  baseStats: PlayerStats;
  equipment: Record<EquipmentSlotType, EquipmentSlot>;
};

export type GameLogEntry = {
  id: string;
  createdAt: string;
  type: 'encounter' | 'loot_equipped' | 'loot_missed' | 'level_up' | 'system';
  message: string;
};

export type GameState = {
  version: number;
  player: Player;
  log: GameLogEntry[];
  cooldowns: {
    lastEncounterAt: string | null;
    lastCommitHash: string | null;
  };
};
