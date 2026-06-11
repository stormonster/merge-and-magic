import * as vscode from 'vscode';
import { GameState } from '../game/types';
import { BASE_PLAYER_MAX_HP, createInitialGameState } from '../game/state';

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
    player: {
      ...saved.player,
      maxHp,
      hp: saved.player.hp || maxHp
    },
    activityLog: saved.activityLog || [],
    cooldowns: {
      ...saved.cooldowns,
      healingStartedAt: saved.cooldowns.healingStartedAt || null
    }
  };
}
