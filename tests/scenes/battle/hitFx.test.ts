import { describe, expect, it } from 'vitest';
import { HIT_FX } from '../../../src/game/config';
import {
  createFlashLimiter,
  damagePipText,
  hitBurstPlan,
  hitBurstColors,
  pipAnchor,
} from '../../../src/scenes/battle/hitFx';

describe('hitBurstPlan', () => {
  it('has about 14 flying particles, a flash, a ring and a puff of smoke', () => {
    const p = hitBurstPlan('PAST', 1, 3);
    expect(p.particles).toHaveLength(HIT_FX.particleCount);
    expect(HIT_FX.particleCount).toBe(14);
    expect(p.flash.radius).toBeGreaterThan(0);
    expect(p.ring.radius).toBeGreaterThan(0);
    expect(p.smoke.radius).toBeGreaterThan(0);
  });
  it('is deterministic for the same seed and different for another', () => {
    expect(hitBurstPlan('FUTURE', 1, 9)).toEqual(hitBurstPlan('FUTURE', 1, 9));
    expect(hitBurstPlan('FUTURE', 1, 9)).not.toEqual(hitBurstPlan('FUTURE', 1, 10));
  });
  it('is over in under 0.9 seconds, every piece counted', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      for (const scale of [0.6, 1, 1.4, 1e9, NaN]) {
        const p = hitBurstPlan(team, scale, 5);
        const ends = [
          p.flash.delayMs + p.flash.durationMs,
          p.ring.delayMs + p.ring.durationMs,
          p.smoke.delayMs + p.smoke.durationMs,
          ...p.particles.map((q) => q.delayMs + q.durationMs),
        ];
        expect(Math.max(...ends)).toBeLessThan(900);
      }
    }
  });
  it('throws particles in every direction, spread around the circle', () => {
    const angles = hitBurstPlan('PAST', 1, 4).particles.map((q) => q.angle);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(Math.PI);
    for (const q of hitBurstPlan('PAST', 1, 4).particles) {
      expect(q.dist).toBeGreaterThanOrEqual(HIT_FX.particleMinDist);
      expect(q.size).toBeGreaterThan(0);
    }
  });
  it('Past is fire and Future is cool cyan and white', () => {
    const past = hitBurstColors('PAST');
    const future = hitBurstColors('FUTURE');
    expect(past).not.toEqual(future);
    const warm = (c: number): boolean => ((c >> 16) & 0xff) > (c & 0xff);
    const cool = (c: number): boolean => (c & 0xff) >= ((c >> 16) & 0xff);
    expect(past.particles.some(warm)).toBe(true);
    expect(future.particles.every(cool)).toBe(true);
    const plan = hitBurstPlan('FUTURE', 1, 2);
    for (const q of plan.particles) expect(future.particles).toContain(q.color);
  });
});

describe('createFlashLimiter', () => {
  it('allows at most 3 flashes in any one second', () => {
    const lim = createFlashLimiter(3);
    const allowed: number[] = [];
    for (let t = 0; t < 3000; t += 50) if (lim.allow(t)) allowed.push(t);
    for (const start of allowed) {
      expect(allowed.filter((t) => t >= start && t < start + 1000).length).toBeLessThanOrEqual(3);
    }
    expect(allowed.length).toBeGreaterThanOrEqual(8);
  });
  it('lets the first flash through, and blocks a burst of four', () => {
    const lim = createFlashLimiter(3);
    expect([0, 1, 2, 3].map((t) => lim.allow(t))).toEqual([true, true, true, false]);
  });
  it('lets a flash through again after a second', () => {
    const lim = createFlashLimiter(3);
    [0, 1, 2].forEach((t) => lim.allow(t));
    expect(lim.allow(500)).toBe(false);
    expect(lim.allow(1001)).toBe(true);
  });
  it('survives a clock that goes backward and NaN', () => {
    const lim = createFlashLimiter(3);
    expect(lim.allow(NaN)).toBe(false);
    lim.allow(5000);
    expect(() => lim.allow(10)).not.toThrow();
  });
});

describe('damage pip', () => {
  it('shows a minus and the whole number', () => {
    expect(damagePipText(25)).toBe('-25');
    expect(damagePipText(9.6)).toBe('-10');
  });
  it('shows nothing for no damage or junk', () => {
    expect(damagePipText(0)).toBeNull();
    expect(damagePipText(-4)).toBeNull();
    expect(damagePipText(NaN)).toBeNull();
  });
  it('sits over the middle of the base, above its roof', () => {
    const a = pipAnchor({ x: 100, y: 300, w: 200, h: 220 });
    expect(a.x).toBe(200);
    expect(a.y).toBeLessThan(300);
  });
});
