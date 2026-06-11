import * as vscode from 'vscode';
import { GameState, EquipmentSlotType } from './game/types';
import { createInitialGameState } from './game/state';
import { loadGameState, saveGameState } from './storage/save';
import { RpgWebviewPanel } from './ui/webviewPanel';
import { SidebarViewProvider } from './ui/sidebarView';
import { initializeGitIntegration } from './git/gitIntegration';
import { processActivityEvent } from './activity/processor';
import { resetGameState, triggerTestLoot, toggleEquipmentSlotLock } from './game/engine';

let currentState: GameState;
let panel: RpgWebviewPanel | undefined;
let sidebarProvider: SidebarViewProvider | undefined;

async function updateState(context: vscode.ExtensionContext) {
  await saveGameState(context, currentState);
  panel?.postState(currentState);
  sidebarProvider?.refresh(currentState);
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
      processActivityEvent(currentState, {
        type: 'manual_encounter',
        source: 'command',
        label: 'Manual encounter triggered',
        weight: 1
      });
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
  console.log('Merge & Magic activating');
  currentState = await loadGameState(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('mergeMagic.openPanel', async () => {
      panel = RpgWebviewPanel.createOrShow(context.extensionUri, context, currentState, (message) => handleWebviewMessage(message, context));
    }),
    vscode.commands.registerCommand('mergeMagic.triggerEncounter', async () => {
      currentState = currentState || createInitialGameState();
      processActivityEvent(currentState, {
        type: 'manual_encounter',
        source: 'command',
        label: 'Manual encounter triggered',
        weight: 1
      });
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
    ,
    vscode.commands.registerCommand('mergeMagic.openSidebar', async () => {
      console.log('mergeMagic.openSidebar command invoked');
      await vscode.commands.executeCommand('workbench.view.extension.mergeMagicContainer');
    })
  );

  // Do not auto-open the full webview panel on activation — user may prefer sidebar only.
  // The panel will be created when the user runs the `mergeMagic.openPanel` command.

  // Register sidebar provider for the Explorer view
  sidebarProvider = new SidebarViewProvider(context.extensionUri, currentState, (message) => handleWebviewMessage(message, context));
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('mergeMagic.sidebarView', sidebarProvider));

  initializeGitIntegration(context, currentState, async (commitHash) => {
    processActivityEvent(currentState, {
      type: 'git_commit',
      source: 'git',
      label: 'Git commit detected',
      weight: 1,
      metadata: {
        commitHash
      }
    });
    await updateState(context);
  });
}

export function deactivate() {
  // Nothing to clean up currently.
}
