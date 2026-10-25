// The walking dasher's drawing data: feet on the ground, a ground-line walk that obstacles never
// move, a bonk swing, and health pips that never rest on color alone.
import { describe, expect, it } from 'vitest';
import { SQUADS, PHASE1_LAYOUT } from '../../../src/game/config';
import { buildLayout } from '../../../src/game/battlefield';
import { dasherHomePoint, groundSpotPoint } from '../../../src/game/crew';
import {
  BONK_CONTACT,
  DASHER_HEIGHT,
  LUNGE_PX,
  STANDING,
  STEP_BOB,
  bonkFrame,
  dasherShapes,
  healthPips,
  swingAngle,
  walkDurationMs,
  walkFrame,
} from '../../../src/scenes/battle/dasherArt';
import type { ArtShape } from '../../../src/scenes/battle/obstacleArt';

const ys = (shapes: ArtShape[]): number[] =>
  shapes.flatMap((s) => {
    switch (s.op) {
      case 'poly':
      case 'outline':
        return s.pts.map((p) => p.y);
      case 'rect':
        return [s.y, s.y + s.h];
      case 'circle':
        return [s.y - s.r, s.y + s.r];
      case 'line':
        return [s.a.y, s.b.y];
    }
  });
const colors = (shapes: ArtShape[]): Set<number> =>
  new Set(shapes.flatMap((s) => ('color' in s ? [s.color] : [])));

describe('dasherShapes', () => {
  it('stands on the ground: nothing below a few px of the feet, nothing above his height', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const all = ys(dasherShapes(team, STANDING));
      expect(Math.max(...all)).toBeLessThanOrEqual(6);
      expect(Math.min(...all)).toBeGreaterThanOrEqual(-DASHER_HEIGHT - 4);
    }
  });
  it('is the same every time for the same pose', () => {
    expect(dasherShapes('PAST', STANDING)).toEqual(dasherShapes('PAST', STANDING));
  });
  it('looks different for each side', () => {
    const past = colors(dasherShapes('PAST', STANDING));
    const future = colors(dasherShapes('FUTURE', STANDING));
    expect([...past].some((c) => !future.has(c))).toBe(true);
  });
  it('moves the toy when the swing changes', () => {
    expect(dasherShapes('PAST', { ...STANDING, swing: 0 })).not.toEqual(
      dasherShapes('PAST', { ...STANDING, swing: 1 }),
    );
    expect(swingAngle(0)).toBeLessThan(swingAngle(1));
  });
});

describe('the walk', () => {
  const from = dasherHomePoint('PAST', PHASE1_LAYOUT);
  const to = groundSpotPoint('g3', PHASE1_LAYOUT);
  it('takes longer for a longer walk, and longer still when dizzy', () => {
    const d = walkDurationMs(from, to);
    expect(d).toBe(Math.round(((to.x - from.x) / SQUADS.walkPxPerSec) * 1000));
    expect(walkDurationMs(from, to, true)).toBeGreaterThan(d);
  });
  it('starts at home, ends on the spot, and faces the way he walks', () => {
    expect(walkFrame(0, from, to)).toMatchObject({ x: from.x, facing: 1 });
    const end = walkFrame(walkDurationMs(from, to), from, to);
    expect(end).toMatchObject({ x: to.x, y: to.y, facing: 1 });
    expect(walkFrame(0, to, from).facing).toBe(-1);
  });
  it('follows the ground line over the middle obstacle on every field (feet within a bob)', () => {
    for (const biome of ['aspen', 'cherry', 'temple'] as const) {
      const layout = buildLayout({ biome, spot: null });
      const a = dasherHomePoint('PAST', layout);
      const b = groundSpotPoint('g3', layout);
      const total = walkDurationMs(a, b);
      for (let ms = 0; ms <= total; ms += 25) {
        const f = walkFrame(ms, a, b);
        expect(f.y).toBeLessThanOrEqual(a.y);
        expect(f.y).toBeGreaterThanOrEqual(a.y - STEP_BOB);
      }
    }
  });
  it('sways only on a dizzy walk', () => {
    const mid = walkDurationMs(from, to, true) / 3;
    expect(walkFrame(mid, from, to, false).pose.lean).toBe(0);
    expect(walkFrame(mid, from, to, true).pose.lean).not.toBe(0);
  });
});

describe('the bonk', () => {
  it('winds up, swings down hard at contact, lunges, then settles', () => {
    expect(bonkFrame(0).lunge).toBe(0);
    expect(bonkFrame(BONK_CONTACT).pose.swing).toBe(1);
    const peak = Math.max(...Array.from({ length: 21 }, (_, i) => bonkFrame(i / 20).lunge));
    expect(peak).toBeLessThanOrEqual(LUNGE_PX);
    expect(peak).toBeGreaterThan(0);
    expect(bonkFrame(1).lunge).toBeCloseTo(0, 5);
  });
});

describe('healthPips', () => {
  it('draws a heart and one pip per health point: full pips filled, empty pips hollow', () => {
    const shapes = healthPips(2, 4);
    const full = shapes.filter((s) => s.op === 'circle');
    const hollow = shapes.filter((s) => s.op === 'outline').length - 1; // minus the heart edge
    expect(full).toHaveLength(2);
    expect(hollow).toBe(2);
    expect(shapes.some((s) => s.op === 'poly')).toBe(true);
  });
  it('clamps silly numbers', () => {
    expect(healthPips(9, 3).filter((s) => s.op === 'circle')).toHaveLength(3);
    expect(healthPips(-2, 3).filter((s) => s.op === 'circle')).toHaveLength(0);
  });
});
