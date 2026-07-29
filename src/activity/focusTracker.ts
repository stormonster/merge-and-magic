import * as vscode from 'vscode';
import { processActivityEvent } from './processor';
import { GameState } from '../game/types';
import { isHealing } from '../game/health';

const FOCUS_TARGET_MS = 5 * 60 * 1000;
const FOCUS_TICK_MS = 15 * 1000;

type FocusTrackerOptions = {
  getState: () => GameState;
  onStateChanged: () => Promise<void>;
};

export function initializeFocusTracker(context: vscode.ExtensionContext, options: FocusTrackerOptions): void {
  let activitySeen = false;
  let processingTick = false;
  const trackedTestExecutions = new WeakSet<vscode.TaskExecution>();

  const markActivity = () => {
    activitySeen = true;
  };

  const isTestTask = (task: vscode.Task): boolean => {
    const parts = [task.name, task.source, task.definition?.type, task.definition?.script].filter(Boolean).join(' ').toLowerCase();
    return parts.includes('test');
  };

  const handleTaskEnd = async (execution: vscode.TaskExecution, exitCode: number | undefined) => {
    if (!trackedTestExecutions.has(execution) || exitCode === undefined) {
      return;
    }

    trackedTestExecutions.delete(execution);
    const state = options.getState();
    await processActivityEvent(
      state,
      {
        type: exitCode === 0 ? 'tests_passed' : 'tests_failed',
        source: 'test',
        label: exitCode === 0 ? 'Test suite passed' : 'Test suite failed',
        weight: 1,
        metadata: {
          exitCode,
          taskName: execution.task.name,
          taskSource: execution.task.source,
          taskType: execution.task.definition?.type
        }
      },
      {
        afterLog: options.onStateChanged
      }
    );
    await options.onStateChanged();
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(markActivity),
    vscode.workspace.onDidSaveTextDocument(markActivity),
    vscode.window.onDidChangeActiveTextEditor(markActivity),
    vscode.window.onDidChangeTextEditorSelection(markActivity),
    vscode.debug.onDidStartDebugSession(markActivity),
    vscode.tasks.onDidStartTask((event) => {
      markActivity();
      if (isTestTask(event.execution.task)) {
        trackedTestExecutions.add(event.execution);
      }
    }),
    vscode.tasks.onDidEndTaskProcess((event) => {
      void handleTaskEnd(event.execution, event.exitCode);
    })
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
