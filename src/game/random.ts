export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function weightedRandom<T extends string | number | symbol>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const threshold = Math.random() * total;
  let running = 0;

  for (const [key, weight] of entries) {
    running += weight;
    if (threshold <= running) {
      return key;
    }
  }

  return entries[entries.length - 1][0];
}
