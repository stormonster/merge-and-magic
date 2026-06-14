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

const NAME_MODIFIERS: Record<Rarity, { prefixes: string[]; suffixes: string[] }> = {
  common: {
    prefixes: ['Plain', 'Worn', 'Rusted', 'Dented', 'Simple', 'Patched', 'Scuffed', 'Sturdy', 'Quick', 'Old', 'Field', 'Basic'],
    suffixes: ['of Practice', 'of Errands', 'of Small Fixes', 'of First Drafts', 'of Routine']
  },
  uncommon: {
    prefixes: ['Polished', 'Keen', 'Steady', 'Tempered', 'Tuned', 'Reinforced', 'Lucky', 'Focused', 'Balanced', 'Responsive'],
    suffixes: ['of Review', 'of Refactor', 'of Clean Builds', 'of Flow', 'of Momentum', 'of Hotfixes']
  },
  rare: {
    prefixes: ['Arcane', 'Runed', 'Gilded', 'Stormforged', 'Crystal', 'Precise', 'Moonlit', 'Sapphire', 'Emerald', 'Recursive'],
    suffixes: ['of the Compiler', 'of Deep Focus', 'of the Architect', 'of Hidden Tests', 'of the Merge', 'of Bright Errors']
  },
  epic: {
    prefixes: ['Mythic', 'Radiant', 'Ancient', 'Void-Touched', 'Dragonforged', 'Eldritch'],
    suffixes: ['of the Infinite Loop', 'of the Final Build', 'of the Silent Branch']
  },
  legendary: {
    prefixes: ['Legendary'],
    suffixes: []
  },
  mythic: {
    prefixes: ['Mythic'],
    suffixes: []
  }
};

function choose<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function createGeneratedItemName(rarity: Rarity, noun: string): string {
  const modifiers = NAME_MODIFIERS[rarity];
  const useSuffix = modifiers.suffixes.length > 0 && Math.random() < 0.32;
  const coreName = useSuffix
    ? `${noun} ${choose(modifiers.suffixes)}`
    : `${choose(modifiers.prefixes)} ${noun}`;

  return `${RARITY_LABEL[rarity]} ${coreName}`;
}

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
  const visualVariants = template.visualVariants || [];
  const visualVariant = visualVariants.length > 0 ? visualVariants[randomInt(0, visualVariants.length - 1)] : null;
  const namePrefix = visualVariant?.namePrefix || template.namePrefix;
  const noun = visualVariant?.noun || namePrefix;
  const iconPool = template.iconPool && template.iconPool.length > 0 ? template.iconPool : [template.icon];
  const icon = visualVariant?.icon || iconPool[randomInt(0, iconPool.length - 1)];
  const idBase = namePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  return {
    id: `${idBase}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: createGeneratedItemName(rarity, noun),
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
