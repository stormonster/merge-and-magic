import { ITEM_TEMPLATES } from '../data/itemTemplates';
import { createItem, handleLootDrop } from './loot';
import { randomInt, weightedRandom } from './random';
import { GameState, Rarity } from './types';
import { addLogEntry } from './state';
import { isHealing } from './health';

const TOWN_RARITY_WEIGHTS: Record<Extract<Rarity, 'common' | 'uncommon' | 'rare'>, number> = {
  common: 58,
  uncommon: 32,
  rare: 10
};

const TOWN_PRICE_RANGES: Record<Extract<Rarity, 'common' | 'uncommon' | 'rare'>, { min: number; max: number; levelMin: number; levelMax: number }> = {
  common: { min: 8, max: 18, levelMin: 2, levelMax: 4 },
  uncommon: { min: 18, max: 40, levelMin: 4, levelMax: 7 },
  rare: { min: 40, max: 85, levelMin: 8, levelMax: 12 }
};
const TOWN_HEAL_PER_TICK = 2;

export type TownPurchaseResult =
  | {
      type: 'purchased';
    }
  | {
      type: 'skipped_locked';
    }
  | {
      type: 'too_expensive';
    }
  | {
      type: 'not_in_town';
    };

export type EnterTownResult = 'entered' | 'already_in_town' | 'healing';

export function enterTown(state: GameState): EnterTownResult {
  if (state.town.inTown) {
    return 'already_in_town';
  }

  if (isHealing(state)) {
    addLogEntry(state, 'system', '🏘 The road to town is closed while recovering. A commit restores you immediately.');
    return 'healing';
  }

  state.town = {
    inTown: true,
    enteredAt: new Date().toISOString(),
    purchases: 0
  };
  addLogEntry(state, 'system', `🏘 Entered town. Resting at the inn while shopping.`);
  return 'entered';
}

export function leaveTown(state: GameState, reason = 'Left town.'): void {
  if (!state.town.inTown) {
    return;
  }

  state.town = {
    inTown: false,
    enteredAt: null,
    purchases: 0
  };
  addLogEntry(state, 'system', `🏘 ${reason}`);
}

export function selectTownRarity(): Extract<Rarity, 'common' | 'uncommon' | 'rare'> {
  return weightedRandom(TOWN_RARITY_WEIGHTS);
}

export function getTownItemCost(playerLevel: number, rarity: Extract<Rarity, 'common' | 'uncommon' | 'rare'>): number {
  const range = TOWN_PRICE_RANGES[rarity];
  return randomInt(range.min + playerLevel * range.levelMin, range.max + playerLevel * range.levelMax);
}

export function applyTownHealing(state: GameState): boolean {
  const nextHp = Math.min(state.player.maxHp, state.player.hp + TOWN_HEAL_PER_TICK);
  const changed = nextHp !== state.player.hp;
  state.player.hp = nextHp;
  return changed;
}

export function processTownPurchase(state: GameState): TownPurchaseResult {
  if (!state.town.inTown) {
    return { type: 'not_in_town' };
  }

  applyTownHealing(state);

  const rarity = selectTownRarity();
  const template = ITEM_TEMPLATES[randomInt(0, ITEM_TEMPLATES.length - 1)];
  const item = createItem(state.player.level, rarity, template);
  const cost = getTownItemCost(state.player.level, rarity);
  const targetSlot = state.player.equipment[item.slot];

  if (targetSlot.locked) {
    addLogEntry(state, 'loot_missed', `🛒 Skipped locked slot: ${item.name}.`);
    return { type: 'skipped_locked' };
  }

  if (cost > state.player.gold) {
    leaveTown(state, `Left town. ${item.name} cost ${cost} gold, but you only had ${state.player.gold}.`);
    return { type: 'too_expensive' };
  }

  const result = handleLootDrop(state.player, item);

  if (result.type === 'missed') {
    addLogEntry(state, 'loot_missed', `🛒 Skipped locked slot: ${item.name}.`);
    return { type: 'skipped_locked' };
  }

  state.player.gold -= cost;
  state.town.purchases += 1;
  addLogEntry(
    state,
    'loot_equipped',
    result.replacedItem
      ? `🛒 Bought ${item.name} for ${cost} gold. Replaced: ${result.replacedItem.name}.`
      : `🛒 Bought ${item.name} for ${cost} gold.`
  );

  return { type: 'purchased' };
}
