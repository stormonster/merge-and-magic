import * as vscode from 'vscode';
import { GameState } from '../game/types';

const COMMIT_ENCOUNTER_COOLDOWN_MS = 5 * 60 * 1000;

export function initializeGitIntegration(
  context: vscode.ExtensionContext,
  state: GameState,
  onNewCommit: () => Promise<void>
): void {
  const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
  if (!gitExtension) {
    return;
  }

  const api = gitExtension.getAPI(1);
  if (!api) {
    return;
  }

  api.onDidOpenRepository((repo: any) => watchRepository(repo, state, onNewCommit), null, context.subscriptions);
  api.repositories.forEach((repo: any) => watchRepository(repo, state, onNewCommit));
}

function watchRepository(repo: any, state: GameState, onNewCommit: () => Promise<void>) {
  const repository = repo;

  repository.state.onDidChange(async () => {
    const head = repository.state.HEAD;
    if (!head || !head.commit) {
      return;
    }

    if (state.cooldowns.lastCommitHash === head.commit) {
      return;
    }

    const now = Date.now();
    const last = state.cooldowns.lastEncounterAt ? Date.parse(state.cooldowns.lastEncounterAt) : 0;
    if (now - last < COMMIT_ENCOUNTER_COOLDOWN_MS) {
      return;
    }

    state.cooldowns.lastCommitHash = head.commit;
    state.cooldowns.lastEncounterAt = new Date().toISOString();
    await onNewCommit();
  });
}
