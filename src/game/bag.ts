import type { Rng } from './types';

/**
 * A seeded shuffle bag: every index comes out once before any repeats, and the same index never
 * comes out twice in a row, even across a refill. Used for jokes, so they stay fresh.
 */
export function createShuffleBag(rng: Rng, count: number): { next(): number } {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be 1 or more');
  let bag: number[] = [];
  let last = -1;
  return {
    next(): number {
      if (bag.length === 0) {
        bag = rng.shuffle(Array.from({ length: count }, (_, i) => i));
        // The bag is popped from the end. If that would repeat the last line, swap it away.
        if (count > 1 && bag[bag.length - 1] === last) {
          [bag[bag.length - 1], bag[0]] = [bag[0] as number, bag[bag.length - 1] as number];
        }
      }
      last = bag.pop() as number;
      return last;
    },
  };
}
