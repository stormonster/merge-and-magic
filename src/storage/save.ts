import * as vscode from 'vscode';
import { GameState } from '../game/types';
import { createInitialGameState } from '../game/state';

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

  return {
    ...saved,
    activityLog: saved.activityLog || []
  };
}
