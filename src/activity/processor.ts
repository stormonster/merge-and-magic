import { triggerEncounter, triggerTestLoot } from '../game/engine';
import { addLogEntry, upsertLogEntryByPrefix } from '../game/state';
import { GameState } from '../game/types';
import { applyPassiveHealing, healToFull, isHealing } from '../game/health';
import {
  recordCommit,
  recordMergeConflict,
  recordRebase,
  recordReleasePush,
  recordTestFailure,
  recordTestPass
} from '../game/achievements';
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

  if (state.town.inTown) {
    return createActivityEvent(input);
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
    case 'git_pull':
    case 'git_push':
    case 'git_merge':
    case 'git_rebase':
    case 'git_conflict':
    case 'git_stash':
      if (event.type === 'git_commit') {
        const commitCreatedAt = event.metadata?.commitCreatedAt ? new Date(String(event.metadata.commitCreatedAt)) : new Date(event.createdAt);
        recordCommit(state, commitCreatedAt, String(event.metadata?.commitSubject || ''));
      }
      if (event.type === 'git_rebase') {
        recordRebase(state);
      }
      if (event.type === 'git_conflict') {
        recordMergeConflict(state);
      }
      if (event.type === 'git_push') {
        const branchName = String(event.metadata?.branchName || '').trim().toLowerCase();
        if (branchName.startsWith('release') && event.metadata?.releasePushCounted !== true) {
          recordReleasePush(state);
        }
      }
      if (event.type === 'git_commit' && healingActive) {
        healToFull(state);
        upsertLogEntryByPrefix(state, 'Recovery started.', 'system', 'Commit landed. HP restored to full.');
        if (options?.afterLog) {
          await options.afterLog();
        }
      }
      await triggerEncounter(state, activityOptions);
      break;
    case 'git_branch_switch':
      addLogEntry(state, 'system', `🔀 Branch switch: ${event.metadata?.branchName ? String(event.metadata.branchName) : 'updated'}\nTrigger: ${event.label}`);
      if (options?.afterLog) {
        await options.afterLog();
      }
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
      if (recordTestPass(state)) {
        addLogEntry(state, 'system', `🏆 Tested: tests failed, then passed again.\nTrigger: ${event.label}`);
      } else {
        addLogEntry(state, 'system', `✅ Test suite passed.\nTrigger: ${event.label}`);
      }
      if (options?.afterLog) {
        await options.afterLog();
      }
      break;
    case 'tests_failed':
      recordTestFailure(state);
      addLogEntry(state, 'system', `❌ Test suite failed.\nTrigger: ${event.label}`);
      if (options?.afterLog) {
        await options.afterLog();
      }
      break;
    case 'merge_completed':
      addLogEntry(state, 'system', `The party takes note. Rewards for this activity type are coming soon.\nTrigger: ${event.label}`);
      if (options?.afterLog) {
        await options.afterLog();
      }
      break;
  }

  return event;
}
