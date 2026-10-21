import { describe, expect, it, vi } from 'vitest';
import { createShuffleBag } from '../../src/game/bag';
import { createRng } from '../../src/game/rng';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 30_000 });

describe('createShuffleBag', () => {
  it('gives every index once before any repeats', () => {
    const bag = createShuffleBag(createRng(3), 12);
    const first = Array.from({ length: 12 }, () => bag.next());
    expect(new Set(first).size).toBe(12);
    const second = Array.from({ length: 12 }, () => bag.next());
    expect(new Set(second).size).toBe(12);
  });
  it('never shows the same line twice in a row, even when the bag refills', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const size of [2, 3, 5, 12]) {
        const bag = createShuffleBag(createRng(seed), size);
        let prev = -1;
        for (let i = 0; i < size * 6; i++) {
          const n = bag.next();
          expect(n, `seed ${seed} size ${size} pull ${i}`).not.toBe(prev);
          prev = n;
        }
      }
    }
  });
  it('repeats for the same seed', () => {
    const run = () => {
      const bag = createShuffleBag(createRng(99), 7);
      return Array.from({ length: 30 }, () => bag.next());
    };
    expect(run()).toEqual(run());
  });
  it('a bag of one just keeps giving 0, and a bag of zero throws', () => {
    const one = createShuffleBag(createRng(1), 1);
    expect([one.next(), one.next(), one.next()]).toEqual([0, 0, 0]);
    expect(() => createShuffleBag(createRng(1), 0)).toThrow(RangeError);
  });
});
