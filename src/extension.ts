import * as vscode from 'vscode';
import { GameState, EquipmentSlotType } from './game/types';
import { addLogEntry, upsertLogEntryByPrefix } from './game/state';
import { loadGameState, saveGameState } from './storage/save';
import { SidebarViewProvider } from './ui/sidebarView';
import { initializeGitIntegration } from './git/gitIntegration';
import { processActivityEvent } from './activity/processor';
import { ActivityEventInput } from './activity/types';
import { initializeFocusTracker } from './activity/focusTracker';
import { resetGameState, toggleEquipmentSlotLock, openLootChest } from './game/engine';
import { applyPassiveHealing } from './game/health';
import { enterTown, leaveTown, processTownPurchase } from './game/town';

let currentState: GameState;
let sidebarProvider: SidebarViewProvider | undefined;
let activityStatusItem: vscode.StatusBarItem;
let unseenActivityUpdates = 0;
let statusSuppressedUntil = 0;
const GIT_COOLDOWN_LOG_PREFIX = 'Git activity detected.\nEncounter cooldown active:';

async function updateState(context: vscode.ExtensionContext) {
  await saveGameState(context, currentState);
  sidebarProvider?.refresh(currentState);
  markActivityUpdate();
}

function markGameViewSeen() {
  unseenActivityUpdates = 0;
  statusSuppressedUntil = Date.now() + 3000;
  activityStatusItem?.hide();
}

function markActivityUpdate() {
  if (!activityStatusItem || Date.now() < statusSuppressedUntil) {
    return;
  }

  unseenActivityUpdates += 1;
  activityStatusItem.text = `$(sparkle) Merge & Magic: ${unseenActivityUpdates} new`;
  activityStatusItem.tooltip = 'Open Merge & Magic to view recent activity';
  activityStatusItem.command = 'mergeMagic.openActivityViewInternal';
  activityStatusItem.show();
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function upsertGitCooldownLog(state: GameState, label: string, remainingMs: number) {
  const message = `${GIT_COOLDOWN_LOG_PREFIX} ${formatDuration(remainingMs)} remaining.\nLast trigger: ${label}.`;
  const existingIndex = state.log.findIndex((entry) => entry.message.startsWith(GIT_COOLDOWN_LOG_PREFIX));
  const existing = state.log[existingIndex];
  if (existing) {
    existing.createdAt = new Date().toISOString();
    existing.message = message;
    state.log.splice(existingIndex, 1);
    state.log.unshift(existing);
    return;
  }

  addLogEntry(state, 'system', message);
}

async function handleWebviewMessage(message: unknown, context: vscode.ExtensionContext) {
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
      await updateState(context);
      break;
    case 'resetSave':
      currentState = resetGameState();
      await updateState(context);
      break;
    case 'enterTown':
      enterTown(currentState);
      await updateState(context);
      break;
    case 'leaveTown':
      leaveTown(currentState);
      await updateState(context);
      break;
    case 'openLootChest':
      openLootChest(currentState);
      await updateState(context);
      break;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('Merge & Magic activating');
  currentState = await loadGameState(context);
  const initialHealing = applyPassiveHealing(currentState);
  if (initialHealing.completed) {
    upsertLogEntryByPrefix(
      currentState,
      'Recovery started.',
      'system',
      `Recovery complete. HP restored to ${currentState.player.hp}/${currentState.player.maxHp}.`
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('mergeMagic.openActivityViewInternal', async () => {
      markGameViewSeen();
      await vscode.commands.executeCommand('workbench.view.extension.mergeMagicContainer');
    }),
    vscode.commands.registerCommand('mergeMagic.resetSave', async () => {
      currentState = resetGameState();
      await updateState(context);
    })
  );

  activityStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(activityStatusItem);

  sidebarProvider = new SidebarViewProvider(
    context.extensionUri,
    currentState,
    (message) => handleWebviewMessage(message, context),
    markGameViewSeen
  );
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('mergeMagic.sidebarView', sidebarProvider));

  initializeGitIntegration(
    context,
    () => currentState,
    async (activity: ActivityEventInput) => {
      await processActivityEvent(
        currentState,
        activity,
        {
          afterLog: () => updateState(context)
        }
      );
      await updateState(context);
    },
    async (activity, remainingMs) => {
      upsertGitCooldownLog(currentState, activity.label, remainingMs);
      await updateState(context);
    }
  );

  const healingTimer = setInterval(() => {
    if (!currentState) {
      return;
    }
    const passiveHealing = applyPassiveHealing(currentState);
    if (passiveHealing.completed) {
      upsertLogEntryByPrefix(
        currentState,
        'Recovery started.',
        'system',
        `Recovery complete. HP restored to ${currentState.player.hp}/${currentState.player.maxHp}.`
      );
    }
    if (!passiveHealing.changed) {
      return;
    }
    void updateState(context);
  }, 10 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(healingTimer) });

  const townTimer = setInterval(() => {
    if (!currentState?.town.inTown) {
      return;
    }

    processTownPurchase(currentState);
    void updateState(context);
  }, 3 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(townTimer) });

  initializeFocusTracker(context, {
    getState: () => currentState,
    onStateChanged: () => updateState(context)
  });
}

export function deactivate() {
  // Nothing to clean up currently.
}
