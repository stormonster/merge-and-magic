import { GameState, EquipmentSlotType } from './types';
import { addLogEntry, createInitialGameState } from './state';
import { getTotalStats } from './combat';
import { applyXp } from './progression';
import { handleLootDrop, createItem, selectItemRarity, getGreedBonus } from './loot';
import { pickRandomEnemy } from './encounters';
import { randomInt } from './random';
import { ITEM_TEMPLATES } from '../data/itemTemplates';

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

export function triggerTestLoot(state: GameState) {
  const rarity = selectItemRarity(Object.values(state.player.equipment).filter((slot) => slot.locked).length);
  const template = ITEM_TEMPLATES[randomInt(0, ITEM_TEMPLATES.length - 1)];
  const item = createItem(state.player.level, rarity, template);
  const result = handleLootDrop(state.player, item);
  addLogEntry(state, result.type === 'equipped' ? 'loot_equipped' : 'loot_missed', result.message);
}

export function triggerEncounter(state: GameState) {
  const enemy = pickRandomEnemy();
  const chance = calculateWinChance(state.player, enemy);
  const won = Math.random() <= chance;
  addLogEntry(state, 'encounter', `⚔ Encounter: ${enemy.name} appeared.`);

  if (!won) {
    addLogEntry(state, 'system', `❌ Defeat: ${enemy.name} avoided permanent loss.`);
    return;
  }

  state.player.gold += enemy.goldReward;
  const xpMessages = applyXp(state.player, enemy.xpReward);
  addLogEntry(state, 'system', `✅ Victory: Defeated ${enemy.name}. Gained ${enemy.xpReward} XP and ${enemy.goldReward} gold.`);
  xpMessages.forEach((message) => addLogEntry(state, 'level_up', message));

  const unlockedSlots = Object.values(state.player.equipment).filter((slot) => !slot.locked).length;
  const greedBonus = getGreedBonus(unlockedSlots);
  const lootChance = Math.min(0.95, Math.max(0.05, enemy.baseLootDropChance + greedBonus));

  addLogEntry(state, 'system', `🎲 Greed Bonus: ${unlockedSlots} unlocked slots gave +${Math.round(greedBonus * 100)}% loot chance.`);

  if (Math.random() > lootChance) {
    addLogEntry(state, 'system', `🗡 No loot dropped from ${enemy.name}.`);
    return;
  }

  const rarity = selectItemRarity(Object.values(state.player.equipment).filter((slot) => slot.locked).length);
  const template = ITEM_TEMPLATES[randomInt(0, ITEM_TEMPLATES.length - 1)];
  const item = createItem(state.player.level, rarity, template);
  const lootResult = handleLootDrop(state.player, item);
  addLogEntry(state, lootResult.type === 'equipped' ? 'loot_equipped' : 'loot_missed', lootResult.message);
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
