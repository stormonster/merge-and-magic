import { EquipmentSlotType, EquipmentSlot, GameState, PlayerStats } from './types';
import { GameLogEntry } from './types';
import { createInitialAchievementProgress } from './achievements';

const EQUIPMENT_SLOTS: EquipmentSlotType[] = [
  'helmet',
  'chest',
  'gloves',
  'boots',
  'weapon',
  'offhand',
  'amulet',
  'ring1',
  'ring2'
];

const BASE_PLAYER_STATS: PlayerStats = {
  focus: 5,
  debugging: 5,
  architecture: 5,
  velocity: 5,
  resilience: 5,
  luck: 5
};

export const BASE_PLAYER_MAX_HP = 20;

export function createInitialEquipment(): Record<EquipmentSlotType, EquipmentSlot> {
  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, { slot, locked: false, item: null }])
  ) as Record<EquipmentSlotType, EquipmentSlot>;
}

export function createInitialGameState(): GameState {
  return {
    version: 3,
    player: {
      name: '',
      suffix: '',
      titleId: '',
      level: 1,
      xp: 0,
      gold: 0,
      hp: BASE_PLAYER_MAX_HP,
      maxHp: BASE_PLAYER_MAX_HP,
      baseStats: { ...BASE_PLAYER_STATS },
      equipment: createInitialEquipment()
    },
    log: [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: 'system',
        message: 'Adventure started. Lock to protect. Unlock to gamble.'
      }
    ],
    activityLog: [],
    achievements: {
      unlockedIds: []
    },
    progress: createInitialAchievementProgress(),
    focus: {
      activeMs: 0
    },
    cooldowns: {
      lastEncounterAt: null,
      lastCommitHash: null,
      healingStartedAt: null,
      lastTownEnteredAt: null
    },
    town: {
      inTown: false,
      enteredAt: null,
      purchases: 0
    },
    lootChest: {
      pending: []
    }
  };
}

export function addLogEntry(
  state: GameState,
  type: GameState['log'][0]['type'],
  message: string,
  highlights?: GameLogEntry['highlights']
) {
  state.log.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    type,
    message,
    highlights
  });
  state.log = state.log.slice(0, 100);
}

export function upsertLogEntryByPrefix(
  state: GameState,
  prefix: string,
  type: GameState['log'][0]['type'],
  message: string
) {
  const existingIndex = state.log.findIndex((entry) => entry.message.startsWith(prefix));
  const existing = state.log[existingIndex];
  if (existing) {
    existing.createdAt = new Date().toISOString();
    existing.type = type;
    existing.message = message;
    state.log.splice(existingIndex, 1);
    state.log.unshift(existing);
    return;
  }

  addLogEntry(state, type, message);
}
