import { GameState } from './types';

export type AchievementId =
  | 'battle_hardened'
  | 'legendary'
  | 'persistent'
  | 'committed'
  | 'rebased'
  | 'tested'
  | 'refactored'
  | 'fast_fingered'
  | 'hotfixer'
  | 'collector'
  | 'slotmaster'
  | 'minimalist'
  | 'maintainer'
  | 'prepared'
  | 'sentinel'
  | 'vaulted'
  | 'greedy'
  | 'sealed'
  | 'reckless'
  | 'conflicted'
  | 'night_owl';

export type AchievementProgress = {
  encounters: number;
  defeats: number;
  commits: number;
  rebases: number;
  testPasses: number;
  testFailures: number;
  testFailureStreak: number;
  bugSuitesResolved: number;
  refactorCommits: number;
  hotfixCommits: number;
  releasePushes: number;
  fastCommitStreak: number;
  lastCommitAt: string | null;
  commitDayStreak: number;
  lastCommitDay: string | null;
  minimalistVictories: number;
  nearDeathRecoveries: number;
  legendaryItems: number;
  mergeConflicts: number;
  midnightCommits: number;
  maxGreedWins: number;
};

export type AchievementReward = {
  kind: 'title';
  id: string;
};

export type AchievementDefinition = {
  id: AchievementId;
  label: string;
  description: string;
  isUnlocked: (state: GameState) => boolean;
  rewards?: AchievementReward[];
};

const TOTAL_EQUIPMENT_SLOTS = 9;
const MIDNIGHT_COMMIT_THRESHOLD = 5;
const MIDNIGHT_COMMIT_HOUR_LIMIT = 6;
const FAST_FINGERED_THRESHOLD = 5;
const FAST_FINGERED_WINDOW_MS = 10 * 60 * 1000;
const HOTFIX_THRESHOLD = 5;
const REFACTOR_THRESHOLD = 5;
const TEST_FAILURE_STREAK_THRESHOLD = 3;
const PREPARED_RELEASE_BRANCH_PREFIX = 'release';
const MAINTAINER_DAY_STREAK_THRESHOLD = 5;
const SENTINEL_RECOVERY_THRESHOLD = 3;
const VAULTED_GOLD_THRESHOLD = 1000;

function getUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isNextUtcDay(previousDayKey: string | null, currentDate: Date): boolean {
  if (!previousDayKey) {
    return false;
  }

  const previousDate = new Date(`${previousDayKey}T00:00:00.000Z`);
  if (Number.isNaN(previousDate.getTime())) {
    return false;
  }

  const currentDayKey = getUtcDayKey(currentDate);
  const currentDateStart = new Date(`${currentDayKey}T00:00:00.000Z`);
  return currentDateStart.getTime() - previousDate.getTime() === 24 * 60 * 60 * 1000;
}

function getEquippedLegendaryCount(state: GameState): number {
  return new Set(
    Object.values(state.player.equipment)
      .filter((slot) => slot.item && (slot.item.rarity === 'legendary' || slot.item.rarity === 'mythic'))
      .map((slot) => slot.item!.id)
  ).size;
}

function getFullyEquippedSlotCount(state: GameState): number {
  return Object.values(state.player.equipment).filter((slot) => slot.item !== null).length;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'battle_hardened',
    label: 'Brought to Heel',
    description: 'Defeat 100 encounters.',
    isUnlocked: (state) => state.progress.encounters >= 100
  },
  {
    id: 'legendary',
    label: 'Shiny Things',
    description: 'Loot a legendary item.',
    isUnlocked: (state) => state.progress.legendaryItems >= 1
  },
  {
    id: 'persistent',
    label: 'Still Standing',
    description: 'Suffer 10 defeats.',
    isUnlocked: (state) => state.progress.defeats >= 10
  },
  {
    id: 'committed',
    label: 'Clocked In',
    description: 'Make 100 commits.',
    isUnlocked: (state) => state.progress.commits >= 100
  },
  {
    id: 'rebased',
    label: 'Untangling the Thread',
    description: 'Complete your first rebase.',
    isUnlocked: (state) => state.progress.rebases >= 1,
    rewards: [{ kind: 'title', id: 'rebased' }]
  },
  {
    id: 'tested',
    label: 'Back in the Green',
    description: `Recover from ${TEST_FAILURE_STREAK_THRESHOLD} failed test suites with a success.`,
    isUnlocked: (state) => state.progress.bugSuitesResolved >= 1,
    rewards: [{ kind: 'title', id: 'bug_slain' }]
  },
  {
    id: 'refactored',
    label: 'Spaghetti Surgery',
    description: `Make ${REFACTOR_THRESHOLD} commits that start with refactor.`,
    isUnlocked: (state) => state.progress.refactorCommits >= REFACTOR_THRESHOLD,
    rewards: [{ kind: 'title', id: 'refactored' }]
  },
  {
    id: 'fast_fingered',
    label: 'Commit Flurry',
    description: `Make ${FAST_FINGERED_THRESHOLD} commits within ten minutes.`,
    isUnlocked: (state) => state.progress.fastCommitStreak >= FAST_FINGERED_THRESHOLD,
    rewards: [{ kind: 'title', id: 'fast_fingered' }]
  },
  {
    id: 'hotfixer',
    label: 'Damage Control',
    description: `Make ${HOTFIX_THRESHOLD} commits that start with fix.`,
    isUnlocked: (state) => state.progress.hotfixCommits >= HOTFIX_THRESHOLD,
    rewards: [{ kind: 'title', id: 'hotfixer' }]
  },
  {
    id: 'collector',
    label: 'Museum of Wonders',
    description: 'Equip three unique legendary items at once.',
    isUnlocked: (state) => getEquippedLegendaryCount(state) >= 3,
    rewards: [{ kind: 'title', id: 'collector' }]
  },
  {
    id: 'slotmaster',
    label: 'Fully Suited',
    description: 'Unlock and fill every equipment slot.',
    isUnlocked: (state) => getUnlockedSlotCount(state) >= TOTAL_EQUIPMENT_SLOTS && getFullyEquippedSlotCount(state) >= TOTAL_EQUIPMENT_SLOTS,
    rewards: [{ kind: 'title', id: 'slotmaster' }]
  },
  {
    id: 'minimalist',
    label: 'Barely Armed',
    description: 'Defeat a foe with all but one slot locked.',
    isUnlocked: (state) => state.progress.minimalistVictories >= 1,
    rewards: [{ kind: 'title', id: 'minimalist' }]
  },
  {
    id: 'maintainer',
    label: 'Habit Formed',
    description: `Commit on ${MAINTAINER_DAY_STREAK_THRESHOLD} different days in a row.`,
    isUnlocked: (state) => state.progress.commitDayStreak >= MAINTAINER_DAY_STREAK_THRESHOLD,
    rewards: [{ kind: 'title', id: 'maintainer' }]
  },
  {
    id: 'prepared',
    label: 'Ready to Ship',
    description: `Push a branch that starts with "${PREPARED_RELEASE_BRANCH_PREFIX}".`,
    isUnlocked: (state) => state.progress.releasePushes >= 1,
    rewards: [{ kind: 'title', id: 'prepared' }]
  },
  {
    id: 'sentinel',
    label: 'Not Today',
    description: `Recover from near death ${SENTINEL_RECOVERY_THRESHOLD} times.`,
    isUnlocked: (state) => state.progress.nearDeathRecoveries >= SENTINEL_RECOVERY_THRESHOLD,
    rewards: [{ kind: 'title', id: 'sentinel' }]
  },
  {
    id: 'vaulted',
    label: 'Coin Mountain',
    description: `Carry ${VAULTED_GOLD_THRESHOLD} gold or more.`,
    isUnlocked: (state) => state.player.gold >= VAULTED_GOLD_THRESHOLD,
    rewards: [{ kind: 'title', id: 'vaulted' }]
  },
  {
    id: 'greedy',
    label: 'Unlocked Potential',
    description: 'Unlock all equipment slots.',
    isUnlocked: (state) => getUnlockedSlotCount(state) >= TOTAL_EQUIPMENT_SLOTS,
    rewards: [{ kind: 'title', id: 'greedy' }]
  },
  {
    id: 'sealed',
    label: 'Padlocked',
    description: 'Lock all equipment slots.',
    isUnlocked: (state) => getLockedSlotCount(state) >= TOTAL_EQUIPMENT_SLOTS,
    rewards: [{ kind: 'title', id: 'sealed' }]
  },
  {
    id: 'reckless',
    label: 'No Safety Net',
    description: 'Survive an encounter at max greed.',
    isUnlocked: (state) => state.progress.maxGreedWins >= 1,
    rewards: [{ kind: 'title', id: 'reckless' }]
  },
  {
    id: 'conflicted',
    label: 'Patchwork Peace',
    description: 'Resolve your first merge conflict.',
    isUnlocked: (state) => state.progress.mergeConflicts >= 1,
    rewards: [{ kind: 'title', id: 'conflicted' }]
  },
  {
    id: 'night_owl',
    label: 'After Hours',
    description: `Make ${MIDNIGHT_COMMIT_THRESHOLD} commits between midnight and 6am.`,
    isUnlocked: (state) => state.progress.midnightCommits >= MIDNIGHT_COMMIT_THRESHOLD,
    rewards: [{ kind: 'title', id: 'sleepless' }]
  }
];

export function createInitialAchievementProgress(): AchievementProgress {
  return {
    encounters: 0,
    defeats: 0,
    commits: 0,
    rebases: 0,
    testPasses: 0,
    testFailures: 0,
    testFailureStreak: 0,
    bugSuitesResolved: 0,
    refactorCommits: 0,
    hotfixCommits: 0,
    releasePushes: 0,
    fastCommitStreak: 0,
    lastCommitAt: null,
    commitDayStreak: 0,
    lastCommitDay: null,
    minimalistVictories: 0,
    nearDeathRecoveries: 0,
    legendaryItems: 0,
    mergeConflicts: 0,
    midnightCommits: 0,
    maxGreedWins: 0
  };
}

export function getUnlockedAchievementIds(state: GameState): Set<AchievementId> {
  return new Set(state.achievements.unlockedIds as AchievementId[]);
}

export function isAchievementUnlocked(state: GameState, achievementId: AchievementId | string | ''): boolean {
  if (!achievementId) {
    return false;
  }

  return getUnlockedAchievementIds(state).has(achievementId as AchievementId);
}

export function getUnlockedRewardTitleIds(state: GameState): Set<string> {
  const unlocked = getUnlockedAchievementIds(state);
  const titleIds = new Set<string>();

  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    if (!unlocked.has(achievement.id)) {
      continue;
    }

    for (const reward of achievement.rewards || []) {
      if (reward.kind === 'title') {
        titleIds.add(reward.id);
      }
    }
  }

  return titleIds;
}

export function syncAchievementUnlocks(state: GameState): string[] {
  const unlocked = new Set(state.achievements.unlockedIds);
  const newlyUnlocked: string[] = [];

  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    if (!achievement.isUnlocked(state) || unlocked.has(achievement.id)) {
      continue;
    }

    unlocked.add(achievement.id);
    newlyUnlocked.push(achievement.id);
  }

  if (newlyUnlocked.length > 0) {
    state.achievements.unlockedIds = Array.from(unlocked);
  }

  return newlyUnlocked;
}

export function recordEncounter(state: GameState): void {
  state.progress.encounters += 1;
}

export function recordDefeat(state: GameState): void {
  state.progress.defeats += 1;
}

export function recordCommit(state: GameState, createdAt = new Date(), subject = ''): void {
  state.progress.commits += 1;

  if (createdAt.getHours() < MIDNIGHT_COMMIT_HOUR_LIMIT) {
    state.progress.midnightCommits += 1;
  }

  const lastCommitAt = state.progress.lastCommitAt ? new Date(state.progress.lastCommitAt) : null;
  if (lastCommitAt && Number.isFinite(lastCommitAt.getTime()) && createdAt.getTime() - lastCommitAt.getTime() <= FAST_FINGERED_WINDOW_MS) {
    state.progress.fastCommitStreak += 1;
  } else {
    state.progress.fastCommitStreak = 1;
  }
  state.progress.lastCommitAt = createdAt.toISOString();

  const dayKey = getUtcDayKey(createdAt);
  if (!state.progress.lastCommitDay) {
    state.progress.commitDayStreak = 1;
  } else if (state.progress.lastCommitDay === dayKey) {
    // keep the current streak
  } else if (isNextUtcDay(state.progress.lastCommitDay, createdAt)) {
    state.progress.commitDayStreak += 1;
  } else {
    state.progress.commitDayStreak = 1;
  }
  state.progress.lastCommitDay = dayKey;

  const normalizedSubject = subject.trim().toLowerCase();
  if (normalizedSubject.startsWith('fix')) {
    state.progress.hotfixCommits += 1;
  }
  if (normalizedSubject.startsWith('refactor')) {
    state.progress.refactorCommits += 1;
  }
}

export function recordRebase(state: GameState): void {
  state.progress.rebases += 1;
}

export function recordTestFailure(state: GameState): void {
  state.progress.testFailures += 1;
  state.progress.testFailureStreak += 1;
}

export function recordTestPass(state: GameState): boolean {
  state.progress.testPasses += 1;

  const achievementEarned = state.progress.testFailureStreak >= TEST_FAILURE_STREAK_THRESHOLD;
  if (achievementEarned) {
    state.progress.bugSuitesResolved += 1;
  }

  state.progress.testFailureStreak = 0;
  return achievementEarned;
}

export function recordReleasePush(state: GameState): void {
  state.progress.releasePushes += 1;
}

export function recordLegendaryItem(state: GameState): void {
  state.progress.legendaryItems += 1;
}

export function recordMergeConflict(state: GameState): void {
  state.progress.mergeConflicts += 1;
}

export function recordMaxGreedVictory(state: GameState): void {
  state.progress.maxGreedWins += 1;
}

export function recordMinimalistVictory(state: GameState): void {
  state.progress.minimalistVictories += 1;
}

export function recordNearDeathRecovery(state: GameState): void {
  state.progress.nearDeathRecoveries += 1;
}

export function getLockedSlotCount(state: GameState): number {
  return Object.values(state.player.equipment).filter((slot) => slot.locked).length;
}

export function getUnlockedSlotCount(state: GameState): number {
  return Object.values(state.player.equipment).filter((slot) => !slot.locked).length;
}
