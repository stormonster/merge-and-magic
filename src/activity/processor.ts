import { triggerEncounter, triggerTestLoot } from '../game/engine';
import { addLogEntry } from '../game/state';
import { GameState } from '../game/types';
import { ActivityEvent, ActivityEventInput } from './types';

const ACTIVITY_LOG_LIMIT = 100;
const DEFAULT_LOG_DELAY_MS = 1000;

type ProcessActivityOptions = {
  afterLog?: () => Promise<void>;
  logDelayMs?: number;
};

function createActivityEvent(input: ActivityEventInput): ActivityEvent {
  return {
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function addActivityEvent(state: GameState, input: ActivityEventInput): ActivityEvent {
  const event = createActivityEvent(input);
  state.activityLog.unshift(event);
  state.activityLog = state.activityLog.slice(0, ACTIVITY_LOG_LIMIT);
  return event;
}

export async function processActivityEvent(
  state: GameState,
  input: ActivityEventInput,
  options?: ProcessActivityOptions
): Promise<ActivityEvent> {
  const event = addActivityEvent(state, input);
  const activityOptions = {
    triggerLabel: event.label,
    afterLog: options?.afterLog,
    logDelayMs: options?.logDelayMs ?? DEFAULT_LOG_DELAY_MS
  };

  switch (event.type) {
    case 'manual_encounter':
    case 'git_commit':
      await triggerEncounter(state, activityOptions);
      break;
    case 'manual_loot':
      await triggerTestLoot(state, activityOptions);
      break;
    case 'tests_passed':
    case 'merge_completed':
    case 'focus_session':
      addLogEntry(state, 'system', `The party takes note. Rewards for this activity type are coming soon.\nTrigger: ${event.label}`);
      if (options?.afterLog) {
        await options.afterLog();
      }
      break;
  }

  return event;
}
