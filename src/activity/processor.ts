import { triggerEncounter } from '../game/engine';
import { addLogEntry } from '../game/state';
import { GameState } from '../game/types';
import { ActivityEvent, ActivityEventInput } from './types';

const ACTIVITY_LOG_LIMIT = 100;

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

export function processActivityEvent(state: GameState, input: ActivityEventInput): ActivityEvent {
  const event = addActivityEvent(state, input);
  addLogEntry(state, 'system', `Activity: ${event.label}.`);

  switch (event.type) {
    case 'manual_encounter':
    case 'git_commit':
      triggerEncounter(state);
      break;
    case 'tests_passed':
    case 'merge_completed':
    case 'focus_session':
      addLogEntry(state, 'system', 'The party takes note. Rewards for this activity type are coming soon.');
      break;
  }

  return event;
}
