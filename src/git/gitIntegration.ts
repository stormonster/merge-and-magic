import * as vscode from 'vscode';
import { GameState } from '../game/types';

const COMMIT_ENCOUNTER_COOLDOWN_MS = 5 * 60 * 1000;

export function initializeGitIntegration(
  context: vscode.ExtensionContext,
  state: GameState,
  onNewCommit: () => Promise<void>
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

                if (state.cooldowns.lastCommitHash === head.commit) return;

                const now = Date.now();
                const last = state.cooldowns.lastEncounterAt ? Date.parse(state.cooldowns.lastEncounterAt) : 0;
                if (now - last < COMMIT_ENCOUNTER_COOLDOWN_MS) return;

                state.cooldowns.lastCommitHash = head.commit;
                state.cooldowns.lastEncounterAt = new Date().toISOString();
                await onNewCommit();
              } catch (e) {
                // swallow errors from handlers
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
