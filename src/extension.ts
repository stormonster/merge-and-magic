import * as vscode from 'vscode';
import { GameState, EquipmentSlotType } from './game/types';
import { createInitialGameState } from './game/state';
import { loadGameState, saveGameState } from './storage/save';
import { RpgWebviewPanel } from './ui/webviewPanel';
import { initializeGitIntegration } from './git/gitIntegration';
import { resetGameState, triggerEncounter, triggerTestLoot, toggleEquipmentSlotLock } from './game/engine';

let currentState: GameState;
let panel: RpgWebviewPanel | undefined;

async function updateState(context: vscode.ExtensionContext) {
  await saveGameState(context, currentState);
  panel?.postState(currentState);
}

function handleWebviewMessage(message: unknown, context: vscode.ExtensionContext) {
  if (typeof message !== 'object' || message === null) {
    return;
  }

  const payload = message as { type?: string; slot?: EquipmentSlotType };

  switch (payload.type) {
    case 'toggleSlotLock':
      if (!payload.slot) {
        return;
      }
      toggleEquipmentSlotLock(currentState.player, payload.slot);
      currentState.log.unshift({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: 'system',
        message: `🔐 ${payload.slot} ${currentState.player.equipment[payload.slot].locked ? 'locked' : 'unlocked'}.`
      });
      currentState.log = currentState.log.slice(0, 100);
      updateState(context);
      break;
    case 'triggerEncounter':
      triggerEncounter(currentState);
      updateState(context);
      break;
    case 'dropTestLoot':
      triggerTestLoot(currentState);
      updateState(context);
      break;
    case 'resetSave':
      currentState = resetGameState();
      updateState(context);
      break;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  currentState = await loadGameState(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('mergeMagic.openPanel', async () => {
      panel = RpgWebviewPanel.createOrShow(context.extensionUri, context, currentState, (message) => handleWebviewMessage(message, context));
    }),
    vscode.commands.registerCommand('mergeMagic.triggerEncounter', async () => {
      currentState = currentState || createInitialGameState();
      triggerEncounter(currentState);
      updateState(context);
      panel?.reveal();
    }),
    vscode.commands.registerCommand('mergeMagic.dropTestLoot', async () => {
      currentState = currentState || createInitialGameState();
      triggerTestLoot(currentState);
      updateState(context);
      panel?.reveal();
    }),
    vscode.commands.registerCommand('mergeMagic.resetSave', async () => {
      currentState = resetGameState();
      updateState(context);
      panel?.reveal();
    })
  );

  panel = RpgWebviewPanel.createOrShow(context.extensionUri, context, currentState, (message) => handleWebviewMessage(message, context));
  initializeGitIntegration(context, currentState, async () => {
    triggerEncounter(currentState);
    await updateState(context);
  });
}

export function deactivate() {
  // Nothing to clean up currently.
}
