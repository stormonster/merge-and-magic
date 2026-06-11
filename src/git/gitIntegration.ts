import * as vscode from 'vscode';
import { GameState } from '../game/types';

const COMMIT_ENCOUNTER_COOLDOWN_MS = 5 * 60 * 1000;

export function initializeGitIntegration(
  context: vscode.ExtensionContext,
  getState: () => GameState,
  onNewCommit: (commitHash: string) => Promise<void>,
  onCommitSkipped?: (commitHash: string, reason: 'cooldown', remainingMs: number) => Promise<void>
): void {
  try {
    const ext = vscode.extensions.getExtension('vscode.git');
    if (!ext) return;

    // Activate the Git extension if needed, then wire up listeners.
    const activateAndSetup = async () => {
      try {
        if (!ext.isActive) {
          await ext.activate();
        }

        const api = (ext.exports as any)?.getAPI ? (ext.exports as any).getAPI(1) : undefined;
        if (!api) return;

        const watchRepository = (repo: any) => {
          try {
            repo.state.onDidChange(async () => {
              try {
                const head = repo.state.HEAD;
                if (!head || !head.commit) return;

                const state = getState();
                if (state.cooldowns.lastCommitHash === head.commit) return;

                const now = Date.now();
                const last = state.cooldowns.lastEncounterAt ? Date.parse(state.cooldowns.lastEncounterAt) : 0;
                const isHealing = state.cooldowns.healingStartedAt !== null && state.player.hp < state.player.maxHp;
                if (!isHealing && now - last < COMMIT_ENCOUNTER_COOLDOWN_MS) {
                  const remainingMs = COMMIT_ENCOUNTER_COOLDOWN_MS - (now - last);
                  state.cooldowns.lastCommitHash = head.commit;
                  console.log('Merge & Magic git commit trigger skipped: cooldown active');
                  await onCommitSkipped?.(head.commit, 'cooldown', remainingMs);
                  return;
                }

                state.cooldowns.lastCommitHash = head.commit;
                state.cooldowns.lastEncounterAt = new Date().toISOString();
                await onNewCommit(head.commit);
              } catch (e) {
                console.error('Merge & Magic git commit trigger failed', e);
              }
            });
          } catch (e) {
            // ignore
          }
        };

        try {
          api.onDidOpenRepository?.((repo: any) => watchRepository(repo));
          api.repositories?.forEach((repo: any) => watchRepository(repo));
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore activation errors
      }
    };

    void activateAndSetup();
  } catch (e) {
    // ignore any unexpected errors to avoid breaking activation
  }
}
