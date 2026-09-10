import { GameLogEntry, GameState, EquipmentSlotType, Item } from './types';
import { addLogEntry, createInitialGameState } from './state';
import { calculateWinChance } from './combat';
import { applyXp } from './progression';
import { handleLootDrop, createItem, selectItemRarity, getGreedBonus } from './loot';
import { pickRandomEnemy } from './encounters';
import { randomInt } from './random';
import { calculateDefeatDamage, startHealingIfNeeded } from './health';
import { ITEM_TEMPLATES } from '../data/itemTemplates';

type ActivityTriggerOptions = {
  triggerLabel?: string;
  afterLog?: () => Promise<void>;
  logDelayMs?: number;
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

export function openLootChest(state: GameState): void {
  const pending = state.lootChest.pending;
  state.lootChest.pending = [];

  for (const pendingItem of pending) {
    const result = handleLootDrop(state.player, pendingItem.item);
    addLogEntry(
      state,
      result.type === 'equipped' ? 'loot_equipped' : 'loot_missed',
      `${result.message}\nTrigger: ${pendingItem.triggerLabel}`,
      [
        { text: result.item.name, rarity: result.item.rarity },
        ...(result.type === 'equipped' && result.replacedItem ? [{ text: result.replacedItem.name, rarity: result.replacedItem.rarity }] : [])
      ]
    );
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
    `🎁 A loot chest appeared! Open it to reveal what's inside.\nTrigger: ${getTriggerLabel(options)}`,
    options
  );
}

export async function triggerEncounter(state: GameState, options?: ActivityTriggerOptions): Promise<void> {
  const enemy = pickRandomEnemy();
  const chance = calculateWinChance(state.player, enemy);
  const won = Math.random() <= chance;
  await addTimedLogEntry(state, 'encounter', `⚔ Encounter: ${enemy.name} appeared.\nTrigger: ${getTriggerLabel(options)}`, options);

  if (!won) {
    const damage = calculateDefeatDamage(state, enemy);
    state.player.hp = Math.max(1, state.player.hp - damage);
    await addTimedLogEntry(
      state,
      'system',
      `❌ Defeat: ${enemy.name} dealt ${damage} damage.`,
      options
    );
    if (startHealingIfNeeded(state)) {
      await addTimedLogEntry(state, 'system', 'Recovery started. Activities pause while HP returns. A commit restores you immediately.', options);
    }
    return;
  }

  state.player.gold += enemy.goldReward;
  const xpMessages = applyXp(state.player, enemy.xpReward);
  await addTimedLogEntry(state, 'system', `✅ Victory: Defeated ${enemy.name}. Gained ${enemy.xpReward} XP and ${enemy.goldReward} gold.`, options);
  for (const message of xpMessages) {
    await addTimedLogEntry(state, 'level_up', message, options);
  }

  const unlockedSlots = Object.values(state.player.equipment).filter((slot) => !slot.locked).length;
  const greedBonus = getGreedBonus(unlockedSlots);
  const lootChance = Math.min(0.95, Math.max(0.05, enemy.baseLootDropChance + greedBonus));

  await addTimedLogEntry(state, 'system', `🎲 Greed Bonus: ${unlockedSlots} unlocked slots gave +${Math.round(greedBonus * 100)}% loot chance.`, options);

  if (Math.random() > lootChance) {
    await addTimedLogEntry(state, 'system', `🗡 No loot dropped from ${enemy.name}.`, options);
    return;
  }

  const rarity = selectItemRarity(Object.values(state.player.equipment).filter((slot) => slot.locked).length);
  const template = ITEM_TEMPLATES[randomInt(0, ITEM_TEMPLATES.length - 1)];
  const item = createItem(state.player.level, rarity, template);
  queueLootDrop(state, item, options);
  await addTimedLogEntry(
    state,
    'loot_chest',
    `🎁 ${enemy.name} dropped a loot chest! Open it to reveal your reward.\nTrigger: ${getTriggerLabel(options)}`,
    options
  );
}
