import { getActivityReward, ActivityReward } from '../activity/rewards';
import { ActivityEventType } from '../activity/types';
import { GameState } from '../game/types';

export const GIT_ENCOUNTER_COOLDOWN_MS = 5 * 60 * 1000;

type GitRewardActivity = {
  type: ActivityEventType;
  commitHash?: string | null;
};

export type GitRewardSkip =
  | { accepted: false; reason: 'cooldown'; remainingMs: number }
  | { accepted: false; reason: 'town' | 'healing' | 'no_reward' };

export type GitRewardGateResult =
  | { accepted: true; reward: Exclude<ActivityReward, 'none'> }
  | GitRewardSkip;

export function applyGitRewardGate(
  state: GameState,
  activity: GitRewardActivity,
  now = Date.now()
): GitRewardGateResult {
  const reward = getActivityReward(activity.type);
  if (reward === 'none') {
    return { accepted: false, reason: 'no_reward' };
  }

  if (state.town.inTown) {
    return { accepted: false, reason: 'town' };
  }

  const isHealing = state.cooldowns.healingStartedAt !== null && state.player.hp < state.player.maxHp;
  if (isHealing && activity.type !== 'git_commit') {
    return { accepted: false, reason: 'healing' };
  }

  if (activity.type === 'git_commit' && activity.commitHash) {
    state.cooldowns.lastCommitHash = activity.commitHash;
  }

  const lastEncounterAt = state.cooldowns.lastEncounterAt
    ? Date.parse(state.cooldowns.lastEncounterAt)
    : 0;
  if (!isHealing && now - lastEncounterAt < GIT_ENCOUNTER_COOLDOWN_MS) {
    return {
      accepted: false,
      reason: 'cooldown',
      remainingMs: GIT_ENCOUNTER_COOLDOWN_MS - (now - lastEncounterAt)
    };
  }

  state.cooldowns.lastEncounterAt = new Date(now).toISOString();
  return { accepted: true, reward };
}