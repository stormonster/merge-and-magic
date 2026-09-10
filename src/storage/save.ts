import * as vscode from 'vscode';
import { GameState } from '../game/types';
import { BASE_PLAYER_MAX_HP, createInitialGameState } from '../game/state';
import { createInitialAchievementProgress } from '../game/achievements';

const SAVE_KEY = 'mergeMagic.gameState';

export async function saveGameState(context: vscode.ExtensionContext, state: GameState): Promise<void> {
  await context.globalState.update(SAVE_KEY, state);
}

export async function loadGameState(context: vscode.ExtensionContext): Promise<GameState> {
  const saved = context.globalState.get<GameState>(SAVE_KEY);
  if (!saved) {
    const initial = createInitialGameState();
    await saveGameState(context, initial);
    return initial;
  }

  const maxHp = saved.player.maxHp || BASE_PLAYER_MAX_HP;

  return {
    ...saved,
    version: Math.max(saved.version || 0, 3),
    player: {
      ...saved.player,
      name: saved.player.name || '',
      suffix: '',
      titleId: saved.player.titleId || '',
      maxHp,
      hp: saved.player.hp || maxHp
    },
    achievements: {
      unlockedIds: saved.achievements?.unlockedIds || []
    },
    activityLog: saved.activityLog || [],
    progress: {
      ...createInitialAchievementProgress(),
      ...(saved.progress || {})
    },
    focus: saved.focus || {
      activeMs: 0
    },
    cooldowns: {
      ...saved.cooldowns,
      healingStartedAt: saved.cooldowns.healingStartedAt || null,
      lastTownEnteredAt: saved.cooldowns.lastTownEnteredAt || null
    },
    town: saved.town || {
      inTown: false,
      enteredAt: null,
      purchases: 0
    },
    lootChest: saved.lootChest || {
      pending: []
    }
  };
}
