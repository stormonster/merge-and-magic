import { Item, BaseItemTemplate, Player, Rarity, UniqueItemTemplate } from './types';
import { clamp, randomInt, weightedRandom } from './random';

const BASE_RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 0.9,
  mythic: 0.1
};

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic'
};

const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.6,
  epic: 2.1,
  legendary: 2.8,
  mythic: 3.6
};

export function getGreedBonus(unlockedSlotCount: number): number {
  return unlockedSlotCount * 0.02;
}

export function getLockDebuff(lockedSlotCount: number): number {
  return lockedSlotCount * 0.01;
}

export function getAdjustedRarityWeights(lockedSlotCount: number): Record<Rarity, number> {
  const debuff = getLockDebuff(lockedSlotCount);
  const highRarityPenalty = clamp(1 - debuff, 0.5, 1);

  return {
    common: BASE_RARITY_WEIGHTS.common + lockedSlotCount,
    uncommon: BASE_RARITY_WEIGHTS.uncommon,
    rare: BASE_RARITY_WEIGHTS.rare * highRarityPenalty,
    epic: BASE_RARITY_WEIGHTS.epic * highRarityPenalty,
    legendary: BASE_RARITY_WEIGHTS.legendary * highRarityPenalty,
    mythic: BASE_RARITY_WEIGHTS.mythic * highRarityPenalty
  };
}

export function selectItemRarity(lockedSlotCount: number): Rarity {
  const weights = getAdjustedRarityWeights(lockedSlotCount);
  return weightedRandom(weights);
}

export function createItem(playerLevel: number, rarity: Rarity, template: BaseItemTemplate): Item {
  const itemLevel = Math.max(1, playerLevel + randomInt(-1, 2));
  const mainStatValue = Math.ceil(itemLevel * RARITY_MULTIPLIER[rarity]);
  const idBase = template.namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const iconPool = template.iconPool && template.iconPool.length > 0 ? template.iconPool : [template.icon];
  const icon = iconPool[randomInt(0, iconPool.length - 1)];

  return {
    id: `${idBase}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: `${RARITY_LABEL[rarity]} ${template.namePrefix}`,
    slot: template.slot,
    rarity,
    itemLevel,
    icon,
    stats: {
      [template.statBias]: mainStatValue
    }
  };
}

export function createUniqueLegendaryItem(template: UniqueItemTemplate): Item {
  return {
    id: `${template.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: template.name,
    slot: template.slot,
    rarity: 'legendary',
    itemLevel: template.itemLevel,
    icon: template.icon,
    stats: { ...template.stats }
  };
}

export type LootResult =
  | {
      type: 'equipped';
      item: Item;
      replacedItem: Item | null;
      message: string;
    }
  | {
      type: 'missed';
      item: Item;
      message: string;
    };

export function handleLootDrop(player: Player, item: Item): LootResult {
  const targetSlot = player.equipment[item.slot];

  if (!targetSlot) {
    throw new Error(`No equipment slot exists for item slot: ${item.slot}`);
  }

  if (targetSlot.locked) {
    return {
      type: 'missed',
      item,
      message: `Missed: ${item.name}.`
    };
  }

  const replacedItem = targetSlot.item;
  targetSlot.item = item;

  return {
    type: 'equipped',
    item,
    replacedItem,
    message: replacedItem
      ? `Equipped: ${item.name}. Replaced: ${replacedItem.name}.`
      : `Equipped: ${item.name}.`
  };
}
