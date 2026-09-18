import { ActivityEventType } from './types';

export type EncounterTier = 'normal' | 'elite' | 'boss' | 'raid';

export function getEncounterTier(
  type: ActivityEventType,
  metadata?: Record<string, unknown>
): EncounterTier {
  if (metadata?.releasePush === true) {
    return 'raid';
  }

  const burstTypes = Array.isArray(metadata?.burstTypes)
    ? metadata.burstTypes.map(String)
    : [];
  if (type === 'git_conflict_resolved' || burstTypes.includes('git_conflict_resolved') || type === 'focus_session') {
    return 'boss';
  }

  const burstCount = Number(metadata?.burstCount || 0);
  if (type === 'git_rebase' || burstTypes.includes('git_rebase') || burstCount >= 3) {
    return 'elite';
  }

  return 'normal';
}