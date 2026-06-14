import * as vscode from 'vscode';
import { processActivityEvent } from './processor';
import { GameState } from '../game/types';
import { isHealing } from '../game/health';

const FOCUS_TARGET_MS = 60 * 1000;
const FOCUS_TICK_MS = 15 * 1000;

type FocusTrackerOptions = {
  getState: () => GameState;
  onStateChanged: () => Promise<void>;
};

export function initializeFocusTracker(context: vscode.ExtensionContext, options: FocusTrackerOptions): void {
  let activitySeen = false;
  let processingTick = false;

  const markActivity = () => {
    activitySeen = true;
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(markActivity),
    vscode.workspace.onDidSaveTextDocument(markActivity),
    vscode.window.onDidChangeActiveTextEditor(markActivity),
    vscode.window.onDidChangeTextEditorSelection(markActivity),
    vscode.debug.onDidStartDebugSession(markActivity),
    vscode.tasks.onDidStartTask(markActivity)
  );

  const timer = setInterval(() => {
    if (processingTick) {
      return;
    }

    processingTick = true;
    void processFocusTick(options, activitySeen)
      .finally(() => {
        activitySeen = false;
        processingTick = false;
      });
  }, FOCUS_TICK_MS);

  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

async function processFocusTick(options: FocusTrackerOptions, activitySeen: boolean): Promise<void> {
  if (!activitySeen) {
    return;
  }

  const state = options.getState();
  if (state.town.inTown || isHealing(state)) {
    return;
  }

  state.focus.activeMs += FOCUS_TICK_MS;
  await options.onStateChanged();

  if (state.focus.activeMs < FOCUS_TARGET_MS) {
    return;
  }

  state.focus.activeMs = 0;
  await processActivityEvent(
    state,
    {
      type: 'focus_session',
      source: 'timer',
      label: 'Editor focus',
      weight: 1
    },
    {
      afterLog: options.onStateChanged
    }
  );
  await options.onStateChanged();
}
