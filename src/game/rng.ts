import type { CreateRng, Rng } from './types';

/** mulberry32. Same seed, same sequence. The only randomness allowed in src/game/. */
export const createRng: CreateRng = (seed: number): Rng => {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => {
    if (min > max) throw new RangeError(`int: min ${min} is greater than max ${max}`);
    return Math.floor(next() * (max - min + 1)) + min;
  };
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('pick: cannot pick from an empty list');
    return items[Math.floor(next() * items.length)] as T;
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };
  return { seed, next, int, pick, shuffle };
};
