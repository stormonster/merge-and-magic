import { GitActivity } from './activityClassifier';

export const GIT_ACTIVITY_WINDOW_MS = 30 * 1000;

const ACTIVITY_PRIORITY: Record<GitActivity['type'], number> = {
  git_conflict: 80,
  git_merge: 70,
  git_rebase: 70,
  git_commit: 60,
  git_pull: 50,
  git_push: 50,
  git_stash: 40,
  git_branch_switch: 30,
  manual_encounter: 0,
  manual_loot: 0,
  tests_passed: 0,
  tests_failed: 0,
  merge_completed: 0,
  focus_session: 0
};

type Scheduler = {
  setTimeout(callback: () => void, delayMs: number): NodeJS.Timeout;
  clearTimeout(timer: NodeJS.Timeout): void;
};

export type GitActivityBatch = {
  activity: GitActivity;
  activities: GitActivity[];
};

const defaultScheduler: Scheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (timer) => clearTimeout(timer)
};

function getActivityKey(activity: GitActivity): string {
  return `${activity.type}:${activity.commitHash || ''}:${JSON.stringify(activity.metadata || {})}`;
}

function getBurstActivity(activities: GitActivity[]): GitActivity {
  const strongest = activities.reduce((best, candidate) =>
    ACTIVITY_PRIORITY[candidate.type] > ACTIVITY_PRIORITY[best.type] ? candidate : best
  );
  const labels = activities.map((activity) => activity.label.replace(/^Git /, '').toLowerCase());

  return {
    ...strongest,
    label: `Git burst: ${labels.join(' + ')}`,
    metadata: {
      ...(strongest.metadata || {}),
      burstTypes: activities.map((activity) => activity.type),
      burstCount: activities.length
    }
  };
}

export class GitActivityAggregator {
  private readonly activities = new Map<string, GitActivity>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly onFlush: (batch: GitActivityBatch) => Promise<void>,
    private readonly scheduler: Scheduler = defaultScheduler
  ) {}

  add(activity: GitActivity): void {
    this.activities.set(getActivityKey(activity), activity);

    if (this.timer) {
      this.scheduler.clearTimeout(this.timer);
    }
    this.timer = this.scheduler.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, GIT_ACTIVITY_WINDOW_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      this.scheduler.clearTimeout(this.timer);
      this.timer = null;
    }

    const activities = [...this.activities.values()];
    this.activities.clear();
    if (activities.length === 0) {
      return;
    }

    await this.onFlush({
      activity: getBurstActivity(activities),
      activities
    });
  }

  dispose(): void {
    if (this.timer) {
      this.scheduler.clearTimeout(this.timer);
      this.timer = null;
    }
    this.activities.clear();
  }
}