import { GameState } from './types';

export function xpRequiredForNextLevel(level: number): number {
  return 50 + level * level * 25;
}

export function applyXp(player: GameState['player'], amount: number): string[] {
  const messages: string[] = [];
  player.xp += amount;

  while (player.xp >= xpRequiredForNextLevel(player.level)) {
    player.xp -= xpRequiredForNextLevel(player.level);
    player.level += 1;
    player.baseStats.focus += 1;
    player.baseStats.resilience += 1;
    messages.push(`⬆ Level up! You are now level ${player.level}.`);
  }

  return messages;
}
