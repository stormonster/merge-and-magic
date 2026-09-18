import { ActivityEventType } from './types';

export type ActivityReward = 'encounter' | 'boss_encounter' | 'loot' | 'none';

const ACTIVITY_REWARDS: Record<ActivityEventType, ActivityReward> = {
  manual_encounter: 'encounter',
  manual_loot: 'loot',
  git_commit: 'encounter',
  git_branch_switch: 'encounter',
  git_pull: 'encounter',
  git_push: 'encounter',
  git_merge: 'encounter',
  git_rebase: 'encounter',
  git_conflict: 'encounter',
  git_stash: 'encounter',
  tests_passed: 'none',
  tests_failed: 'none',
  merge_completed: 'none',
  focus_session: 'boss_encounter'
};

export function getActivityReward(type: ActivityEventType): ActivityReward {
  return ACTIVITY_REWARDS[type];
}