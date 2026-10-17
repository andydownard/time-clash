import { describe, expect, it } from 'vitest';
import { damageMarks, damageStage } from '../../../src/scenes/battle/damageArt';

const base = { x: 100, y: 300, w: 200, h: 220 };

describe('damageStage', () => {
  it('is 0 for a fresh base and 3 for a badly scarred one', () => {
    expect(damageStage(100, 100)).toBe(0);
    expect(damageStage(70, 100)).toBe(1);
    expect(damageStage(50, 100)).toBe(2);
    expect(damageStage(10, 100)).toBe(3);
    expect(damageStage(0, 100)).toBe(3);
  });
  it('never goes below 0 or above 3, even for bad input', () => {
    expect(damageStage(500, 100)).toBe(0);
    expect(damageStage(-40, 100)).toBe(3);
    expect(damageStage(NaN, 100)).toBe(0);
    expect(damageStage(50, 0)).toBe(0);
    expect(damageStage(50, Infinity)).toBe(0);
  });
  it('never drops as health falls', () => {
    let last = 0;
    for (let hp = 100; hp >= 0; hp -= 1) {
      const s = damageStage(hp, 100);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
  it('scales with a raised max health', () => {
    expect(damageStage(150, 150)).toBe(0);
    expect(damageStage(100, 150)).toBe(2);
  });
});

describe('damageMarks', () => {
  it('draws nothing at stage 0 and more at each stage', () => {
    const count = (s: 0 | 1 | 2 | 3) => {
      const m = damageMarks(s, base);
      return m.scorches.length + m.breaches.length + m.smoke.length;
    };
    expect(count(0)).toBe(0);
    expect(count(1)).toBeGreaterThan(0);
    expect(count(2)).toBeGreaterThan(count(1));
    expect(count(3)).toBeGreaterThan(count(2));
  });
  it('adds a ragged breach from stage 2 and a little smoke', () => {
    expect(damageMarks(1, base).breaches).toHaveLength(0);
    expect(damageMarks(2, base).breaches).toHaveLength(1);
    expect(damageMarks(3, base).smoke.length).toBeLessThanOrEqual(2);
  });
  it('is deterministic and stays inside the base', () => {
    expect(damageMarks(3, base)).toEqual(damageMarks(3, base));
    const m = damageMarks(3, base);
    for (const s of m.scorches) {
      expect(s.x).toBeGreaterThanOrEqual(base.x);
      expect(s.x).toBeLessThanOrEqual(base.x + base.w);
      expect(s.y).toBeGreaterThanOrEqual(base.y);
      expect(s.y).toBeLessThanOrEqual(base.y + base.h);
    }
    for (const b of m.breaches) {
      for (let i = 0; i < b.points.length; i += 2) {
        expect(b.points[i]).toBeGreaterThanOrEqual(base.x);
        expect(b.points[i]).toBeLessThanOrEqual(base.x + base.w);
      }
    }
  });
});
