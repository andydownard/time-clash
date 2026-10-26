// The silly fall of a fighter whose brick gave way: it drops with the brick, flops over, puffs
// dust, and stands up again on the lower spot. Fast (under 1.2 s), the same every time, and with
// reduced motion only a quick drop and a blink. Nobody is hurt.
import { describe, expect, it } from 'vitest';
import { BASE_RIDERS } from '../../../src/game/config';
import { RIDER_IDS } from '../../../src/game/riders';
import { unitById } from '../../../src/game/units';
import {
  RIDER_FALL_MAX_MS,
  riderFallFrame,
  riderFallPlan,
  riderPivot,
  riderPose,
} from '../../../src/scenes/battle/riderFall';
import { UNIT_BOXES, unitSpot } from '../../../src/scenes/battle/unitSpots';
import {
  createBaseFallLines,
  riderFallsFor,
  riderTail,
} from '../../../src/scenes/battle/riderFalls';
import { baseFallPool } from '../../../src/data/copy';
import { BASE_FALL_LINE_COUNT } from '../../../src/game/config';

const apply = (
  pose: { x: number; y: number; angle: number; scaleX: number; scaleY: number },
  p: { x: number; y: number },
) => {
  const r = (pose.angle * Math.PI) / 180;
  const sx = p.x * pose.scaleX;
  const sy = p.y * pose.scaleY;
  return {
    x: pose.x + sx * Math.cos(r) - sy * Math.sin(r),
    y: pose.y + sx * Math.sin(r) + sy * Math.cos(r),
  };
};

describe('rider feet match the drawings', () => {
  it('BASE_RIDERS.foot is the same as UNIT_BOXES for every rider', () => {
    for (const id of RIDER_IDS) {
      const role = unitById(id)!.role;
      const box = UNIT_BOXES[role];
      expect(BASE_RIDERS.foot[role], id).toEqual({ l: box.l, r: box.r, b: box.b });
    }
  });
});

describe('riderFallPlan', () => {
  it('is over in under 1.2 s, with or without reduced motion', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      for (const reduced of [false, true]) {
        const p = riderFallPlan(team, reduced);
        expect(p.totalMs).toBeLessThan(1200);
        expect(p.totalMs).toBeLessThanOrEqual(RIDER_FALL_MAX_MS);
      }
    }
  });

  it('flops over away from the enemy: Team Past leans left, Team Future right', () => {
    expect(riderFallPlan('PAST', false).flopAngle).toBeLessThan(0);
    expect(riderFallPlan('FUTURE', false).flopAngle).toBeGreaterThan(0);
  });

  it('reduced motion: no spin, no squash, a blink', () => {
    const p = riderFallPlan('PAST', true);
    expect(p.flopAngle).toBe(0);
    expect(p.squash).toBe(1);
    expect(p.blinks).toBeGreaterThan(0);
  });
});

describe('riderFallFrame', () => {
  it('starts at the old spot and ends standing upright on the new one', () => {
    for (const reduced of [false, true]) {
      const p = riderFallPlan('FUTURE', reduced);
      const end = riderFallFrame(p, p.totalMs, 10, 90);
      expect(end).toEqual({ dy: 90, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 });
      expect(riderFallFrame(p, p.totalMs + 500, 10, 90)).toEqual(end);
    }
    const start = riderFallFrame(riderFallPlan('PAST', false), 0, 10, 90);
    expect(start.dy).toBe(10);
    expect(start.alpha).toBe(1);
  });

  it('lands by the end of the drop, then lies flopped over and squashed', () => {
    const p = riderFallPlan('PAST', false);
    expect(riderFallFrame(p, p.dropMs, 0, 100).dy).toBeCloseTo(100, 5);
    const mid = riderFallFrame(p, p.dropMs + p.flopMs, 0, 100);
    expect(mid.angle).toBeCloseTo(p.flopAngle, 5);
    expect(mid.scaleY).toBeLessThan(1);
    expect(mid.dy).toBe(100);
  });

  it('never goes below the landing spot or above the old one', () => {
    const p = riderFallPlan('PAST', false);
    for (let t = 0; t <= p.totalMs; t += 10) {
      const f = riderFallFrame(p, t, 20, 120);
      expect(f.dy).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(f.dy).toBeLessThanOrEqual(120 + 1e-9);
    }
  });

  it('reduced motion: jumps to the landing spot at once and blinks', () => {
    const p = riderFallPlan('PAST', true);
    const f = riderFallFrame(p, 1, 0, 80);
    expect(f.dy).toBe(80);
    expect(f.angle).toBe(0);
    const alphas = Array.from({ length: 30 }, (_, i) =>
      riderFallFrame(p, (i * p.totalMs) / 30, 0, 80),
    ).map((x) => x.alpha);
    expect(Math.min(...alphas)).toBeLessThan(0.6);
  });

  it('is the same every time', () => {
    const p = riderFallPlan('FUTURE', false);
    expect(riderFallFrame(p, 333, 0, 50)).toEqual(riderFallFrame(p, 333, 0, 50));
  });
});

describe('riderPose', () => {
  it('turns and squashes round the feet, so the feet stay on the spot', () => {
    const id = 'B';
    const pivot = riderPivot(unitById(id)!);
    const shift = { x: 3, y: -140 };
    const p = riderFallPlan('PAST', false);
    for (const t of [0, p.dropMs, p.dropMs + p.flopMs, p.totalMs]) {
      const f = riderFallFrame(p, t, 0, 60);
      const pose = riderPose(f, pivot, shift);
      const feet = apply(pose, pivot);
      expect(feet.x).toBeCloseTo(pivot.x + shift.x, 6);
      expect(feet.y).toBeCloseTo(pivot.y + shift.y + f.dy, 6);
    }
  });

  it('upright with no drop is the plain shift (as the scene places it today)', () => {
    const pivot = riderPivot(unitById('5')!);
    const pose = riderPose({ dy: 0, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 }, pivot, {
      x: 0,
      y: 60,
    });
    expect(pose.x).toBeCloseTo(0, 9);
    expect(pose.y).toBeCloseTo(60, 9);
  });
});

describe('riderFallsFor', () => {
  it('lists the team’s riders that stand lower now, in roster order', () => {
    expect(riderFallsFor('PAST', { B: 10, C: 20 }, { B: 40, C: 20, '1': 99 })).toEqual([
      { id: 'B', fromDy: 10, toDy: 40 },
    ]);
    expect(riderFallsFor('FUTURE', {}, { '5': 30, '1': 12 })).toEqual([
      { id: '1', fromDy: 0, toDy: 12 },
      { id: '5', fromDy: 0, toDy: 30 },
    ]);
  });

  it('nothing moved, or a fighter rose (it never does): no fall', () => {
    expect(riderFallsFor('PAST', { B: 40 }, { B: 40 })).toEqual([]);
    expect(riderFallsFor('PAST', { B: 40 }, { B: 10 })).toEqual([]);
  });
});

describe('riderTail', () => {
  it('points just over the fallen fighter’s head, with the base shift and the drop', () => {
    const s = unitSpot(unitById('B')!);
    expect(riderTail('B', { baseShift: { PAST: { x: 0, y: -140 } } }, 50)).toEqual({
      x: s.box.x + s.box.w / 2,
      y: s.box.y - 140 + 50,
    });
  });
});

describe('createBaseFallLines', () => {
  it('each team says its own lines, all of them before any repeats, never twice in a row', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const lines = createBaseFallLines(42);
      const said = Array.from({ length: BASE_FALL_LINE_COUNT * 2 + 3 }, () => lines.next(team));
      for (const l of said) expect(baseFallPool(team)).toContain(l);
      expect(new Set(said.slice(0, BASE_FALL_LINE_COUNT)).size).toBe(BASE_FALL_LINE_COUNT);
      for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
    }
  });

  it('the same seed says the same lines', () => {
    const a = createBaseFallLines(9);
    const b = createBaseFallLines(9);
    for (let i = 0; i < 20; i++) expect(a.next('PAST')).toBe(b.next('PAST'));
  });
});
