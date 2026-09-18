import { Enemy, GameLogEntry, GameState, EquipmentSlotType, Item, Rarity } from './types';
import { addLogEntry, createInitialGameState } from './state';
import { calculateWinChance } from './combat';
import { applyXp } from './progression';
import { handleLootDrop, createItem, selectBossItemRarity, selectItemRarity, getGreedBonus } from './loot';
import { pickRandomBoss, pickRandomEnemy } from './encounters';
import { randomInt } from './random';
import { calculateDefeatDamage, startHealingIfNeeded } from './health';
import {
  recordDefeat,
  recordEncounter,
  recordLegendaryItem,
  recordMaxGreedVictory,
  recordMinimalistVictory,
  recordNearDeathRecovery
} from './achievements';
import { ITEM_TEMPLATES } from '../data/itemTemplates';

type ActivityTriggerOptions = {
  triggerLabel?: string;
  afterLog?: () => Promise<void>;
  logDelayMs?: number;
};

type EncounterTriggerOptions = ActivityTriggerOptions & {
  enemy?: Enemy;
  random?: () => number;
};

export const BOSS_MINIMUM_LOOT_CHANCE = 0.8;

type LootChestOpenOptions = {
  onReveal?: (item: Item, index: number, total: number) => Promise<void>;
  afterItem?: () => Promise<void>;
  revealDurationMs?: number;
  itemDelayMs?: number;
};

export function resetGameState(): GameState {
  return createInitialGameState();
}

export function toggleEquipmentSlotLock(player: GameState['player'], slot: EquipmentSlotType) {
  const target = player.equipment[slot];
  if (!target) {
    return;
  }
  target.locked = !target.locked;
}

function getDebugEquipSlot(state: GameState, item: Item): EquipmentSlotType {
  if (item.slot !== 'ring1') {
    return item.slot;
  }

  if (!state.player.equipment.ring1.item) {
    return 'ring1';
  }

  if (!state.player.equipment.ring2.item) {
    return 'ring2';
  }

  return 'ring1';
}

export function equipDebugItem(state: GameState, item: Item): { item: Item; replacedItem: Item | null } {
  const targetSlot = getDebugEquipSlot(state, item);
  const slot = state.player.equipment[targetSlot];
  const equippedItem = { ...item, slot: targetSlot };
  const replacedItem = slot.item;

  slot.item = equippedItem;

  return {
    item: equippedItem,
    replacedItem
  };
}

function getTriggerLabel(options?: ActivityTriggerOptions): string {
  return options?.triggerLabel || 'Manual trigger';
}

function queueLootDrop(state: GameState, item: Item, options?: ActivityTriggerOptions): void {
  state.lootChest.pending.push({
    id: crypto.randomUUID(),
    item,
    triggerLabel: getTriggerLabel(options),
    createdAt: new Date().toISOString()
  });
}

export async function openLootChest(state: GameState, options?: LootChestOpenOptions): Promise<void> {
  const total = state.lootChest.pending.length;

  for (let index = 0; index < total; index += 1) {
    const pendingItem = state.lootChest.pending.shift();
    if (!pendingItem) {
      break;
    }

    if (options?.onReveal) {
      await options.onReveal(pendingItem.item, index, total);
    }
    await delay(options?.revealDurationMs ?? 1100);

    if (pendingItem.item.rarity === 'legendary' || pendingItem.item.rarity === 'mythic') {
      recordLegendaryItem(state);
    }
    const result = handleLootDrop(state.player, pendingItem.item);
    addLogEntry(
      state,
      result.type === 'equipped' ? 'loot_equipped' : 'loot_missed',
      `${result.message}\nTrigger: ${pendingItem.triggerLabel}`,
      [
        { text: result.item.name, rarity: result.item.rarity },
        ...(result.type === 'equipped' && result.replacedItem
          ? [{ text: result.replacedItem.name, rarity: result.replacedItem.rarity }]
          : [])
      ]
    );

    if (options?.afterItem) {
      await options.afterItem();
    }
    if (index < total - 1) {
      await delay(options?.itemDelayMs ?? 250);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function addTimedLogEntry(
  state: GameState,
  type: GameState['log'][0]['type'],
  message: string,
  options?: ActivityTriggerOptions,
  highlights?: GameLogEntry['highlights']
): Promise<void> {
  addLogEntry(state, type, message, highlights);
  if (!options?.afterLog) {
    return;
  }

  await options.afterLog();
  await delay(options.logDelayMs ?? 1000);
}

export async function triggerTestLoot(state: GameState, options?: ActivityTriggerOptions): Promise<void> {
  const rarity = selectItemRarity(Object.values(state.player.equipment).filter((slot) => slot.locked).length);
  const template = ITEM_TEMPLATES[randomInt(0, ITEM_TEMPLATES.length - 1)];
  const item = createItem(state.player.level, rarity, template);
  queueLootDrop(state, item, options);
  await addTimedLogEntry(
    state,
    'loot_chest',
    `A loot chest appeared! Open it to reveal what's inside.\nTrigger: ${getTriggerLabel(options)}`,
    options
  );
}

async function resolveEncounter(
  state: GameState,
  options: EncounterTriggerOptions | undefined,
  boss: boolean
): Promise<void> {
  const enemy = options?.enemy || (boss ? pickRandomBoss() : pickRandomEnemy());
  const chance = calculateWinChance(state.player, enemy);
  const random = options?.random || Math.random;
  const won = random() <= chance;
  recordEncounter(state);
  await addTimedLogEntry(
    state,
    boss ? 'boss_encounter' : 'encounter',
    boss
      ? `🔥 BOSS ENCOUNTER: ${enemy.name} has emerged!\nTrigger: ${getTriggerLabel(options)}`
      : `⚔ Encounter: ${enemy.name} appeared.\nTrigger: ${getTriggerLabel(options)}`,
    options
  );

  if (!won) {
    recordDefeat(state);
    const damage = calculateDefeatDamage(state, enemy);
    state.player.hp = Math.max(1, state.player.hp - damage);
    await addTimedLogEntry(
      state,
      'system',
      boss
        ? `☠ BOSS DEFEAT: ${enemy.name} dealt ${damage} damage.`
        : `❌ Defeat: ${enemy.name} dealt ${damage} damage.`,
      options
    );
    if (startHealingIfNeeded(state)) {
      recordNearDeathRecovery(state);
      await addTimedLogEntry(state, 'system', 'Recovery started. Activities pause while HP returns. A commit restores you immediately.', options);
    }
    return;
  }

  state.player.gold += enemy.goldReward;
  const xpMessages = applyXp(state.player, enemy.xpReward);
  await addTimedLogEntry(
    state,
    'system',
    boss
      ? `🏆 BOSS DEFEATED: ${enemy.name}. Claimed ${enemy.xpReward} XP and ${enemy.goldReward} gold!`
      : `✅ Victory: Defeated ${enemy.name}. Gained ${enemy.xpReward} XP and ${enemy.goldReward} gold.`,
    options
  );
  for (const message of xpMessages) {
    await addTimedLogEntry(state, 'level_up', message, options);
  }

  const unlockedSlots = Object.values(state.player.equipment).filter((slot) => !slot.locked).length;
  const greedBonus = getGreedBonus(unlockedSlots);
  const lootChance = boss
    ? Math.min(0.98, Math.max(BOSS_MINIMUM_LOOT_CHANCE, enemy.baseLootDropChance + greedBonus))
    : Math.min(0.95, Math.max(0.05, enemy.baseLootDropChance + greedBonus));

  if (unlockedSlots >= Object.values(state.player.equipment).length) {
    recordMaxGreedVictory(state);
  }
  if (unlockedSlots === 1) {
    recordMinimalistVictory(state);
  }

  await addTimedLogEntry(
    state,
    'system',
    boss
      ? `🎲 Boss Reward: ${Math.round(lootChance * 100)}% boss loot chance with upgraded rarity odds.`
      : `🎲 Greed Bonus: ${unlockedSlots} unlocked slots gave +${Math.round(greedBonus * 100)}% loot chance.`,
    options
  );

  if (random() > lootChance) {
    await addTimedLogEntry(
      state,
      'system',
      boss
        ? `🗡 ${enemy.name} guarded its hoard this time.`
        : `🗡 No loot dropped from ${enemy.name}.`,
      options
    );
    return;
  }

  const lockedSlotCount = Object.values(state.player.equipment).filter((slot) => slot.locked).length;
  const rarity: Rarity = boss
    ? selectBossItemRarity(lockedSlotCount)
    : selectItemRarity(lockedSlotCount);
  const template = ITEM_TEMPLATES[randomInt(0, ITEM_TEMPLATES.length - 1)];
  const item = createItem(state.player.level + (boss ? 1 : 0), rarity, template);
  queueLootDrop(state, item, options);
  await addTimedLogEntry(
    state,
    'loot_chest',
    boss
      ? `${enemy.name} dropped a radiant boss chest! Open it to claim your reward.\nTrigger: ${getTriggerLabel(options)}`
      : `${enemy.name} dropped a loot chest! Open it to reveal your reward.\nTrigger: ${getTriggerLabel(options)}`,
    options
  );
}

export async function triggerEncounter(state: GameState, options?: ActivityTriggerOptions): Promise<void> {
  await resolveEncounter(state, options, false);
}

export async function triggerBossEncounter(state: GameState, options?: EncounterTriggerOptions): Promise<void> {
  await resolveEncounter(state, options, true);
}
