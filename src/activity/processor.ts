import { triggerEncounter, triggerTestLoot } from '../game/engine';
import { addLogEntry, upsertLogEntryByPrefix } from '../game/state';
import { GameState } from '../game/types';
import { applyPassiveHealing, healToFull, isHealing } from '../game/health';
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
  const passiveHealing = applyPassiveHealing(state);
  const healingActive = isHealing(state);

  if (passiveHealing.completed) {
    upsertLogEntryByPrefix(
      state,
      'Recovery started.',
      'system',
      `Recovery complete. HP restored to ${state.player.hp}/${state.player.maxHp}.`
    );
  }

  if (passiveHealing.changed && options?.afterLog) {
    await options.afterLog();
  }

  if (healingActive && input.type !== 'git_commit') {
    return createActivityEvent(input);
  }

  const event = addActivityEvent(state, input);
  const activityOptions = {
    triggerLabel: event.label,
    afterLog: options?.afterLog,
    logDelayMs: options?.logDelayMs ?? DEFAULT_LOG_DELAY_MS
  };

  switch (event.type) {
    case 'manual_encounter':
    case 'git_commit':
    case 'git_branch_switch':
    case 'git_pull':
    case 'git_push':
    case 'git_merge':
    case 'git_conflict':
    case 'git_stash':
      if (event.type === 'git_commit' && healingActive) {
        healToFull(state);
        upsertLogEntryByPrefix(state, 'Recovery started.', 'system', 'Commit landed. HP restored to full.');
        if (options?.afterLog) {
          await options.afterLog();
        }
      }
      await triggerEncounter(state, activityOptions);
      break;
    case 'manual_loot':
      await triggerTestLoot(state, activityOptions);
      break;
    case 'focus_session':
      addLogEntry(state, 'system', `Focus session completed.\nTrigger: ${event.label}`);
      if (options?.afterLog) {
        await options.afterLog();
      }
      break;
    case 'tests_passed':
    case 'merge_completed':
      addLogEntry(state, 'system', `The party takes note. Rewards for this activity type are coming soon.\nTrigger: ${event.label}`);
      if (options?.afterLog) {
        await options.afterLog();
      }
      break;
  }

  return event;
}
