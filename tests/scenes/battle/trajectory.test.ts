import { describe, expect, it } from 'vitest';
import {
  AIM,
  BALLISTICS,
  LAUNCH_ORIGINS,
  PHASE1_LAYOUT,
  TEAM_FACING,
} from '../../../src/game/config';
import { simulateShot } from '../../../src/game/ballistics';
import { flightDurationMs, pointAtTime, previewDots } from '../../../src/scenes/battle/trajectory';

const shot = simulateShot({
  angleDeg: 50,
  power: 70,
  origin: LAUNCH_ORIGINS.PAST,
  facing: TEAM_FACING.PAST,
  wind: 10,
  layout: PHASE1_LAYOUT,
});
const stepMs = BALLISTICS.stepSeconds * 1000;

describe('flightDurationMs', () => {
  it('is steps times the fixed step', () => {
    expect(flightDurationMs(shot)).toBeCloseTo(shot.steps * stepMs);
  });
});

describe('pointAtTime', () => {
  it('starts at the origin and ends at the last path point', () => {
    expect(pointAtTime(shot.path, 0)).toEqual(shot.path[0]);
    expect(pointAtTime(shot.path, flightDurationMs(shot))).toEqual(shot.path[shot.path.length - 1]);
  });
  it('lands exactly on path points at whole steps', () => {
    expect(pointAtTime(shot.path, stepMs * 10)).toEqual(
      expect.objectContaining({ x: shot.path[10]!.x, y: shot.path[10]!.y }),
    );
  });
  it('interpolates halfway between two steps', () => {
    const a = shot.path[4]!;
    const b = shot.path[5]!;
    const p = pointAtTime(shot.path, stepMs * 4.5);
    expect(p.x).toBeCloseTo((a.x + b.x) / 2);
    expect(p.y).toBeCloseTo((a.y + b.y) / 2);
  });
  it('clamps before the start and after the end', () => {
    expect(pointAtTime(shot.path, -50)).toEqual(shot.path[0]);
    expect(pointAtTime(shot.path, 1e9)).toEqual(shot.path[shot.path.length - 1]);
    expect(pointAtTime(shot.path, NaN)).toEqual(shot.path[0]);
  });
  it('handles a one-point path', () => {
    expect(pointAtTime([{ x: 3, y: 4 }], 100)).toEqual({ x: 3, y: 4 });
  });
});

describe('previewDots', () => {
  it('shows a short preview, never more than AIM.previewPoints', () => {
    const dots = previewDots(shot.path);
    expect(dots.length).toBeGreaterThan(3);
    expect(dots.length).toBeLessThanOrEqual(AIM.previewPoints);
  });
  it('fades out: alpha starts high, ends low, never rises', () => {
    const dots = previewDots(shot.path);
    expect(dots[0]!.alpha).toBeGreaterThan(0.8);
    expect(dots[dots.length - 1]!.alpha).toBeLessThan(0.3);
    for (let i = 1; i < dots.length; i++)
      expect(dots[i]!.alpha).toBeLessThanOrEqual(dots[i - 1]!.alpha);
    for (const d of dots) {
      expect(d.alpha).toBeGreaterThan(0);
      expect(d.alpha).toBeLessThanOrEqual(1);
    }
  });
  it('uses real path points, and copes with a tiny path', () => {
    const dots = previewDots(shot.path);
    for (const d of dots) {
      expect(shot.path.some((p) => p.x === d.x && p.y === d.y)).toBe(true);
    }
    expect(previewDots([])).toEqual([]);
    expect(previewDots([{ x: 1, y: 2 }])).toHaveLength(1);
  });
});
