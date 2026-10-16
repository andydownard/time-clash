import { describe, expect, it } from 'vitest';
import { fastWindowMs, scoreReload } from '../../src/game/reload';
import { RELOAD } from '../../src/game/config';

describe('scoreReload', () => {
  it('gives 2 scrap for a correct answer under 8 seconds', () => {
    expect(scoreReload({ correct: true, elapsedMs: 3000 })).toEqual({ scrap: 2, fast: true });
    expect(scoreReload({ correct: true, elapsedMs: 0 })).toEqual({ scrap: 2, fast: true });
  });
  it('boundary: 7999 ms is fast, exactly 8000 ms is slow', () => {
    expect(scoreReload({ correct: true, elapsedMs: RELOAD.fastMs - 1 }).scrap).toBe(2);
    expect(scoreReload({ correct: true, elapsedMs: RELOAD.fastMs })).toEqual({
      scrap: 1,
      fast: false,
    });
  });
  it('gives 1 scrap for a correct but slow answer, with no penalty for being very slow', () => {
    expect(scoreReload({ correct: true, elapsedMs: 60_000 }).scrap).toBe(1);
    expect(scoreReload({ correct: true, elapsedMs: 3_600_000 }).scrap).toBe(1);
  });
  it('gives 0 scrap for a wrong answer, fast or slow, and never flags it fast', () => {
    expect(scoreReload({ correct: false, elapsedMs: 100 })).toEqual({ scrap: 0, fast: false });
    expect(scoreReload({ correct: false, elapsedMs: 99999 })).toEqual({ scrap: 0, fast: false });
  });
  it.each([NaN, -1, -5000, Infinity, -Infinity])(
    'treats bad elapsedMs %s as slow and never throws',
    (ms) => {
      expect(() => scoreReload({ correct: true, elapsedMs: ms })).not.toThrow();
      expect(scoreReload({ correct: true, elapsedMs: ms })).toEqual({ scrap: 1, fast: false });
      expect(scoreReload({ correct: false, elapsedMs: ms })).toEqual({ scrap: 0, fast: false });
    },
  );
});

describe('the fast window depends on the kind of question and the age, never on scrap', () => {
  it('uses a longer window for vocab than for a math fact, and the longest for a passage', () => {
    expect(fastWindowMs('numeric', 5)).toBe(8000);
    expect(fastWindowMs('sightword', 2)).toBe(8000);
    expect(fastWindowMs('vocab', 5)).toBe(12000);
    expect(fastWindowMs('mainidea', 9)).toBe(20000);
    expect(fastWindowMs('mainidea', 9)).toBeGreaterThan(fastWindowMs('vocab', 9));
    expect(fastWindowMs('vocab', 9)).toBeGreaterThan(fastWindowMs('numeric', 9));
  });
  it('gives kindergarten and first grade extra time', () => {
    expect(fastWindowMs('numeric', 0)).toBe(8000 + RELOAD.earlyGradeExtraMs);
    expect(fastWindowMs('sightword', 1)).toBe(8000 + RELOAD.earlyGradeExtraMs);
    expect(fastWindowMs('sightword', 2)).toBe(8000);
  });
  it('falls back to the base window for an unknown or missing kind', () => {
    expect(fastWindowMs(undefined, undefined)).toBe(RELOAD.fastMs);
    expect(fastWindowMs('poem', 5)).toBe(RELOAD.fastMs);
  });
  it('scores a passage answer at 15 s as fast, but a math fact at 15 s as slow', () => {
    expect(scoreReload({ correct: true, elapsedMs: 15_000, kind: 'mainidea', grade: 9 }).fast).toBe(
      true,
    );
    expect(scoreReload({ correct: true, elapsedMs: 15_000, kind: 'numeric', grade: 9 }).fast).toBe(
      false,
    );
  });
  it('boundary is strict for every kind', () => {
    for (const kind of ['numeric', 'choice', 'sightword', 'vocab', 'grammar', 'mainidea']) {
      const w = fastWindowMs(kind, 6);
      expect(scoreReload({ correct: true, elapsedMs: w - 1, kind, grade: 6 }).fast).toBe(true);
      expect(scoreReload({ correct: true, elapsedMs: w, kind, grade: 6 }).fast).toBe(false);
    }
  });
  it('scrap never depends on grade or kind beyond the time window', () => {
    for (const grade of [0, 3, 7, 12]) {
      for (const kind of ['numeric', 'vocab', 'mainidea']) {
        const w = fastWindowMs(kind, grade);
        expect(scoreReload({ correct: true, elapsedMs: w - 1, kind, grade }).scrap).toBe(2);
        expect(scoreReload({ correct: true, elapsedMs: w, kind, grade }).scrap).toBe(1);
        expect(scoreReload({ correct: false, elapsedMs: 1, kind, grade }).scrap).toBe(0);
      }
    }
  });
});
