import { describe, expect, it } from 'vitest';
import { windForTurn, windLevel } from '../../src/game/wind';
import { WIND } from '../../src/game/config';

describe('windForTurn', () => {
  it('is repeatable for the same seed and turn', () => {
    expect(windForTurn(123, 4)).toBe(windForTurn(123, 4));
  });

  it('is always an integer inside the config range', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (let turn = 0; turn < 20; turn++) {
        const w = windForTurn(seed, turn);
        expect(Number.isInteger(w)).toBe(true);
        expect(w).toBeGreaterThanOrEqual(WIND.min);
        expect(w).toBeLessThanOrEqual(WIND.max);
      }
    }
  });

  it('changes from turn to turn (not constant)', () => {
    const winds = new Set(Array.from({ length: 30 }, (_, t) => windForTurn(7, t)));
    expect(winds.size).toBeGreaterThan(15);
  });

  it('differs across seeds', () => {
    const winds = new Set(Array.from({ length: 30 }, (_, s) => windForTurn(s, 0)));
    expect(winds.size).toBeGreaterThan(15);
  });

  it('pins golden values (replay safety)', () => {
    expect([0, 1, 2, 3].map((t) => windForTurn(2024, t))).toEqual(GOLDEN_WIND);
  });

  it('reaches both signs so wind can push either way', () => {
    const winds = Array.from({ length: 200 }, (_, t) => windForTurn(99, t));
    expect(winds.some((w) => w < 0)).toBe(true);
    expect(winds.some((w) => w > 0)).toBe(true);
  });

  it('handles negative and large inputs without NaN', () => {
    expect(Number.isInteger(windForTurn(-1, 0))).toBe(true);
    expect(Number.isInteger(windForTurn(2 ** 40, 10 ** 6))).toBe(true);
  });
});

describe('windLevel', () => {
  it('names the strength: calm, breezy, windy, super windy', () => {
    expect(windLevel(0)).toBe(0);
    expect(windLevel(WIND.levels.breezy - 1)).toBe(0);
    expect(windLevel(WIND.levels.breezy)).toBe(1);
    expect(windLevel(WIND.levels.windy - 1)).toBe(1);
    expect(windLevel(WIND.levels.windy)).toBe(2);
    expect(windLevel(WIND.levels.superWindy - 1)).toBe(2);
    expect(windLevel(WIND.levels.superWindy)).toBe(3);
    expect(windLevel(WIND.max)).toBe(3);
  });
  it('treats left and right the same, and bad numbers as calm', () => {
    expect(windLevel(-WIND.levels.windy)).toBe(2);
    expect(windLevel(Number.NaN)).toBe(0);
    expect(windLevel(Infinity)).toBe(3);
  });
  it('keeps the thresholds in order and inside the wind range', () => {
    const { breezy, windy, superWindy } = WIND.levels;
    expect(0 < breezy && breezy < windy && windy < superWindy && superWindy <= WIND.max).toBe(true);
  });
});

const GOLDEN_WIND: number[] = [23, -20, -76, -79];
