export type ActivityEventType =
  | 'manual_encounter'
  | 'manual_loot'
  | 'git_commit'
  | 'git_branch_switch'
  | 'git_pull'
  | 'git_merge'
  | 'git_conflict'
  | 'git_stash'
  | 'tests_passed'
  | 'merge_completed'
  | 'focus_session';

export type ActivityEventSource = 'command' | 'git' | 'test' | 'timer';

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  createdAt: string;
  source: ActivityEventSource;
  label: string;
  weight: number;
  metadata?: Record<string, unknown>;
};

export type ActivityEventInput = Omit<ActivityEvent, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};
