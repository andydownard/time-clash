import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/game/rng';

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('pins the first mulberry32 values for seed 1 (golden)', () => {
    const r = createRng(1);
    expect(r.next()).toBeCloseTo(0.6270739405881613, 12);
    expect(r.next()).toBeCloseTo(0.002735721180215478, 12);
  });

  it('exposes its seed', () => {
    expect(createRng(77).seed).toBe(77);
  });

  it('keeps next() in [0, 1)', () => {
    const r = createRng(9);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() is inclusive on both ends and hits both ends', () => {
    const r = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-3, 3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect(seen.size).toBe(7);
  });

  it('int(n, n) always returns n', () => {
    const r = createRng(3);
    for (let i = 0; i < 20; i++) expect(r.int(4, 4)).toBe(4);
  });

  it('int() throws RangeError when min > max', () => {
    expect(() => createRng(1).int(5, 4)).toThrow(RangeError);
  });

  it('pick() returns an item and throws RangeError on empty', () => {
    const r = createRng(8);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(items).toContain(r.pick(items));
    expect(() => r.pick([])).toThrow(RangeError);
  });

  it('shuffle() returns a permutation and never mutates the input', () => {
    const r = createRng(11);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...input];
    const out = r.shuffle(input);
    expect(input).toEqual(copy);
    expect(out).not.toBe(input);
    expect([...out].sort((a, b) => a - b)).toEqual(copy);
  });

  it('shuffle() is repeatable for the same seed and handles tiny arrays', () => {
    expect(createRng(4).shuffle([1, 2, 3, 4, 5])).toEqual(createRng(4).shuffle([1, 2, 3, 4, 5]));
    expect(createRng(4).shuffle([])).toEqual([]);
    expect(createRng(4).shuffle([9])).toEqual([9]);
  });

  it('treats seeds as unsigned 32-bit (negative and huge seeds still work)', () => {
    expect(Number.isFinite(createRng(-5).next())).toBe(true);
    expect(createRng(2 ** 32 + 7).next()).toBe(createRng(7).next());
  });
});
