import { GameState, EquipmentSlotType } from './types';
import { addLogEntry, createInitialGameState } from './state';
import { getTotalStats } from './combat';
import { applyXp } from './progression';
import { handleLootDrop, createItem, selectItemRarity, getGreedBonus } from './loot';
import { pickRandomEnemy } from './encounters';
import { randomInt } from './random';
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

function getTriggerLabel(options?: ActivityTriggerOptions): string {
  return options?.triggerLabel || 'Manual trigger';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function addTimedLogEntry(
  state: GameState,
  type: GameState['log'][0]['type'],
  message: string,
  options?: ActivityTriggerOptions
): Promise<void> {
  addLogEntry(state, type, message);
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
  const result = handleLootDrop(state.player, item);
  await addTimedLogEntry(
    state,
    result.type === 'equipped' ? 'loot_equipped' : 'loot_missed',
    `${result.message}\nTrigger: ${getTriggerLabel(options)}`,
    options
  );
}

export async function triggerEncounter(state: GameState, options?: ActivityTriggerOptions): Promise<void> {
  const enemy = pickRandomEnemy();
  const chance = calculateWinChance(state.player, enemy);
  const won = Math.random() <= chance;
  await addTimedLogEntry(state, 'encounter', `⚔ Encounter: ${enemy.name} appeared.\nTrigger: ${getTriggerLabel(options)}`, options);

  if (!won) {
    await addTimedLogEntry(state, 'system', `❌ Defeat: ${enemy.name} avoided permanent loss.`, options);
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
  const lootResult = handleLootDrop(state.player, item);
  await addTimedLogEntry(
    state,
    lootResult.type === 'equipped' ? 'loot_equipped' : 'loot_missed',
    `${lootResult.message}\nTrigger: ${getTriggerLabel(options)}`,
    options
  );
}

function calculateWinChance(player: GameState['player'], enemy: { level: number; hp: number; attack: number; defense: number }) {
  const stats = getTotalStats(player);
  const playerPower =
    player.level * 5 +
    stats.focus * 1.2 +
    stats.debugging * 1.5 +
    stats.architecture * 1.1 +
    stats.velocity * 1.0 +
    stats.resilience * 1.3 +
    stats.luck * 0.8;

  const enemyPower = enemy.level * 5 + enemy.hp * 0.5 + enemy.attack * 2 + enemy.defense;
  return Math.min(0.9, Math.max(0.1, playerPower / (playerPower + enemyPower)));
}
