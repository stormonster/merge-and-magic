import { GameState } from './types';
import type { AchievementId } from './achievements';

export type TitleId =
  | 'honorable'
  | 'bold'
  | 'wanderer'
  | 'unbroken'
  | 'lucky'
  | 'start_reckless'
  | 'relentless'
  | 'arcane'
  | 'unhinged'
  | 'caffeinated'
  | 'debugger'
  | 'uncommitted'
  | 'stalwart'
  | 'wayfarer'
  | 'watchful'
  | 'untamed'
  | 'resolute'
  | 'nomad'
  | 'keen'
  | 'start_persistent'
  | 'battle_hardened'
  | 'legendary'
  | 'persistent'
  | 'committed'
  | 'rebased'
  | 'bug_slain'
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
  | 'sleepless';

export type TitleDefinition = {
  id: TitleId;
  label: string;
  description: string;
  availableAtStart: boolean;
  unlockedByAchievementId?: AchievementId;
};

export type TitleMetadata = TitleDefinition;

const STARTING_TITLES: TitleDefinition[] = [
  { id: 'honorable', label: 'the Honorable', description: 'Available from the start.', availableAtStart: true },
  { id: 'bold', label: 'the Bold', description: 'Available from the start.', availableAtStart: true },
  { id: 'wanderer', label: 'the Wanderer', description: 'Available from the start.', availableAtStart: true },
  { id: 'unbroken', label: 'the Unbroken', description: 'Available from the start.', availableAtStart: true },
  { id: 'lucky', label: 'the Lucky', description: 'Available from the start.', availableAtStart: true },
  { id: 'start_reckless', label: 'the Reckless', description: 'Available from the start.', availableAtStart: true },
  { id: 'relentless', label: 'the Relentless', description: 'Available from the start.', availableAtStart: true },
  { id: 'arcane', label: 'the Arcane', description: 'Available from the start.', availableAtStart: true },
  { id: 'unhinged', label: 'the Unhinged', description: 'Available from the start.', availableAtStart: true },
  { id: 'caffeinated', label: 'the Caffeinated', description: 'Available from the start.', availableAtStart: true },
  { id: 'debugger', label: 'the Debugger', description: 'Available from the start.', availableAtStart: true },
  { id: 'uncommitted', label: 'the Uncommitted', description: 'Available from the start.', availableAtStart: true },
  { id: 'stalwart', label: 'the Stalwart', description: 'Available from the start.', availableAtStart: true },
  { id: 'wayfarer', label: 'the Wayfarer', description: 'Available from the start.', availableAtStart: true },
  { id: 'watchful', label: 'the Watchful', description: 'Available from the start.', availableAtStart: true },
  { id: 'untamed', label: 'the Untamed', description: 'Available from the start.', availableAtStart: true },
  { id: 'resolute', label: 'the Resolute', description: 'Available from the start.', availableAtStart: true },
  { id: 'nomad', label: 'the Nomad', description: 'Available from the start.', availableAtStart: true },
  { id: 'keen', label: 'the Keen', description: 'Available from the start.', availableAtStart: true },
  { id: 'start_persistent', label: 'the Persistent', description: 'Available from the start.', availableAtStart: true }
];

export const TITLE_DEFINITIONS: TitleDefinition[] = [
  ...STARTING_TITLES,
  {
    id: 'battle_hardened',
    label: 'the Battle-Hardened',
    description: 'Earned through enough encounters.',
    availableAtStart: false,
    unlockedByAchievementId: 'battle_hardened'
  },
  {
    id: 'legendary',
    label: 'the Legendary',
    description: 'Earned through legendary loot.',
    availableAtStart: false,
    unlockedByAchievementId: 'legendary'
  },
  {
    id: 'persistent',
    label: 'the Tenacious',
    description: 'Earned through repeated defeats.',
    availableAtStart: false,
    unlockedByAchievementId: 'persistent'
  },
  {
    id: 'committed',
    label: 'the Committed',
    description: 'Earned through steady commits.',
    availableAtStart: false,
    unlockedByAchievementId: 'committed'
  },
  {
    id: 'rebased',
    label: 'the Untangled',
    description: 'Earned after rebasing.',
    availableAtStart: false,
    unlockedByAchievementId: 'rebased'
  },
  {
    id: 'bug_slain',
    label: 'the Tested',
    description: 'Earned after surviving failed tests and recovering.',
    availableAtStart: false,
    unlockedByAchievementId: 'tested'
  },
  {
    id: 'refactored',
    label: 'the Refactored',
    description: 'Earned through refactor commits.',
    availableAtStart: false,
    unlockedByAchievementId: 'refactored'
  },
  {
    id: 'fast_fingered',
    label: 'the Fast-Fingered',
    description: 'Earned through rapid commit streaks.',
    availableAtStart: false,
    unlockedByAchievementId: 'fast_fingered'
  },
  {
    id: 'hotfixer',
    label: 'the Hotfixer',
    description: 'Earned through quick fix commits.',
    availableAtStart: false,
    unlockedByAchievementId: 'hotfixer'
  },
  {
    id: 'collector',
    label: 'the Collector',
    description: 'Earned through legendary gear collection.',
    availableAtStart: false,
    unlockedByAchievementId: 'collector'
  },
  {
    id: 'slotmaster',
    label: 'the Slotmaster',
    description: 'Earned through a fully unlocked, fully filled loadout.',
    availableAtStart: false,
    unlockedByAchievementId: 'slotmaster'
  },
  {
    id: 'minimalist',
    label: 'the Minimalist',
    description: 'Earned through a lean victory.',
    availableAtStart: false,
    unlockedByAchievementId: 'minimalist'
  },
  {
    id: 'maintainer',
    label: 'the Maintainer',
    description: 'Earned through multi-day commit streaks.',
    availableAtStart: false,
    unlockedByAchievementId: 'maintainer'
  },
  {
    id: 'prepared',
    label: 'the Prepared',
    description: 'Earned through release branch pushes.',
    availableAtStart: false,
    unlockedByAchievementId: 'prepared'
  },
  {
    id: 'sentinel',
    label: 'the Sentinel',
    description: 'Earned through near-death recoveries.',
    availableAtStart: false,
    unlockedByAchievementId: 'sentinel'
  },
  {
    id: 'vaulted',
    label: 'the Vaulted',
    description: 'Earned through carrying a large gold reserve.',
    availableAtStart: false,
    unlockedByAchievementId: 'vaulted'
  },
  {
    id: 'greedy',
    label: 'the Greedy',
    description: 'Earned through unlocking every slot.',
    availableAtStart: false,
    unlockedByAchievementId: 'greedy'
  },
  {
    id: 'sealed',
    label: 'the Sealed',
    description: 'Earned through locking every slot.',
    availableAtStart: false,
    unlockedByAchievementId: 'sealed'
  },
  {
    id: 'reckless',
    label: 'the Unbowed',
    description: 'Earned through surviving at max greed.',
    availableAtStart: false,
    unlockedByAchievementId: 'reckless'
  },
  {
    id: 'conflicted',
    label: 'the Conflicted',
    description: 'Earned through merge conflict resolution.',
    availableAtStart: false,
    unlockedByAchievementId: 'conflicted'
  },
  {
    id: 'sleepless',
    label: 'the Night Owl',
    description: 'Earned through late-night commits.',
    availableAtStart: false,
    unlockedByAchievementId: 'night_owl'
  }
];

export const TITLE_METADATA: TitleMetadata[] = TITLE_DEFINITIONS.map(({ id, label, description, availableAtStart, unlockedByAchievementId }) => ({
  id,
  label,
  description,
  availableAtStart,
  unlockedByAchievementId
}));

export function getTitleDefinition(titleId: TitleId | string | ''): TitleDefinition | undefined {
  return TITLE_DEFINITIONS.find((definition) => definition.id === titleId);
}

export function getTitleLabel(titleId: TitleId | string | ''): string {
  return getTitleDefinition(titleId)?.label || '';
}

export function getAvailableTitleIds(state: GameState): Set<TitleId> {
  const unlockedAchievements = new Set(state.achievements.unlockedIds);
  return new Set(
    TITLE_DEFINITIONS.filter((definition) => {
      if (definition.availableAtStart) {
        return true;
      }

      return definition.unlockedByAchievementId ? unlockedAchievements.has(definition.unlockedByAchievementId) : false;
    }).map((definition) => definition.id)
  );
}

export function normalizeSelectedTitle(state: GameState, titleId: string): TitleId | '' {
  const unlocked = getAvailableTitleIds(state);
  return unlocked.has(titleId as TitleId) ? (titleId as TitleId) : '';
}

export function formatHeroTitle(titleId: TitleId | ''): string {
  return getTitleLabel(titleId);
}

export function syncTitleUnlocks(state: GameState): boolean {
  const selected = normalizeSelectedTitle(state, state.player.titleId || '');
  if (selected !== (state.player.titleId || '')) {
    state.player.titleId = selected;
    return true;
  }

  return false;
}
