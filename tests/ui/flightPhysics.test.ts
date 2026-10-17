// A flight in the pictures must obey real physics: no hand-drawn zigzags.
import { describe, expect, it } from 'vitest';
import { BALLISTICS } from '../../src/game/config';
import {
  PICTURE_GRAVITY,
  PICTURE_SCALE,
  flightTransform,
  launchVelocity,
  poseAt,
  type Flight,
} from '../../src/ui/flightPhysics';

const arrow: Flight = {
  from: { x: 0, y: 0 },
  to: { x: 1060, y: -60 },
  seconds: 1.85,
  delay: 0.16,
  period: 4,
};
const left: Flight = { ...arrow, to: { x: -860, y: -30 } };
const at = (f: Flight, t: number) => poseAt(f, f.delay + t);

describe('gravity', () => {
  it('is the game gravity, scaled to the picture size', () => {
    expect(PICTURE_SCALE).toBe(1.25);
    expect(PICTURE_GRAVITY).toBe(BALLISTICS.gravity * 1.25);
  });
});

describe('a flight', () => {
  it('starts at its start point and lands exactly on its target', () => {
    const start = at(arrow, 0);
    expect(start.x).toBeCloseTo(0, 6);
    expect(start.y).toBeCloseTo(0, 6);
    const end = at(arrow, arrow.seconds);
    expect(end.x).toBeCloseTo(1060, 4);
    expect(end.y).toBeCloseTo(-60, 4);
  });

  it('moves sideways at a constant speed (nothing pushes it sideways)', () => {
    const step = 0.2;
    const xs = [0, 1, 2, 3, 4].map((i) => at(arrow, i * step).x);
    const dxs = xs.slice(1).map((x, i) => x - xs[i]!);
    for (const d of dxs) expect(d).toBeCloseTo(dxs[0]!, 6);
    expect(dxs[0]! / step).toBeCloseTo(launchVelocity(arrow).x, 6);
  });

  it('speeds up downward at exactly gravity (the second difference of height is g times dt squared)', () => {
    const dt = 0.1;
    const ys = [0, 1, 2, 3].map((i) => at(arrow, 0.3 + i * dt).y);
    const d1 = ys.slice(1).map((y, i) => y - ys[i]!);
    const d2 = d1.slice(1).map((d, i) => d - d1[i]!);
    for (const d of d2) expect(d / (dt * dt)).toBeCloseTo(PICTURE_GRAVITY, 4);
  });

  it('rises, peaks, then falls (a true arc, never a straight line)', () => {
    const ys = Array.from({ length: 19 }, (_, i) => at(arrow, (i / 18) * arrow.seconds).y);
    const peak = Math.min(...ys);
    const peakIndex = ys.indexOf(peak);
    expect(peak).toBeLessThan(-100);
    expect(peakIndex).toBeGreaterThan(2);
    expect(peakIndex).toBeLessThan(16);
    for (let i = 1; i <= peakIndex; i++) expect(ys[i]!).toBeLessThanOrEqual(ys[i - 1]!);
    for (let i = peakIndex + 1; i < ys.length; i++)
      expect(ys[i]!).toBeGreaterThanOrEqual(ys[i - 1]!);
  });

  it('points the way it is going: up at the start, level at the top, down at the end', () => {
    expect(at(arrow, 0).heading).toBeLessThan(-30);
    const apexT = -launchVelocity(arrow).y / PICTURE_GRAVITY;
    expect(Math.abs(at(arrow, apexT).heading)).toBeLessThan(0.5);
    expect(at(arrow, arrow.seconds).heading).toBeGreaterThan(20);
  });

  it('its heading always matches its real velocity', () => {
    for (const t of [0.1, 0.5, 0.9, 1.3, 1.8]) {
      const p = at(arrow, t);
      expect(Math.tan((p.heading * Math.PI) / 180)).toBeCloseTo(p.vy / p.vx, 6);
    }
  });

  it('flies the other way for a flight to the left, and its nose turns with it', () => {
    expect(at(left, 0.5).x).toBeLessThan(0);
    expect(Math.abs(at(left, 0.5).heading)).toBeGreaterThan(90);
    expect(at(left, left.seconds).x).toBeCloseTo(-860, 4);
  });

  it('is hidden before it fires, after it lands, and between loops', () => {
    expect(poseAt(arrow, 0.05).flying).toBe(false);
    expect(poseAt(arrow, arrow.delay + arrow.seconds + 0.2).flying).toBe(false);
    expect(poseAt(arrow, 3.99).flying).toBe(false);
  });

  it('repeats every loop, and a time before zero works too', () => {
    const a = poseAt(arrow, 1.2);
    const b = poseAt(arrow, 1.2 + arrow.period * 3);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(poseAt(arrow, 1.2 - arrow.period).x).toBeCloseTo(a.x, 6);
  });

  it.each([Number.NaN, Infinity, -Infinity])('never throws for a bad time (%s)', (t) => {
    expect(poseAt(arrow, t).flying).toBe(false);
  });
  it('never throws for a flight that cannot happen (no time in the air)', () => {
    expect(poseAt({ ...arrow, seconds: 0 }, 1).flying).toBe(false);
    expect(poseAt({ ...arrow, period: 0 }, 1).flying).toBe(false);
  });
});

describe('flightTransform', () => {
  it('is null while hidden', () => {
    expect(flightTransform(arrow, poseAt(arrow, 0.05), 0)).toBeNull();
  });
  it('moves from the start point and turns by heading minus the way the picture faces', () => {
    const pose = at(arrow, 0.5);
    const t = flightTransform(arrow, pose, -17);
    const turn = Math.round((pose.heading + 17) * 100) / 100;
    expect(t).toBe(
      `translate(${Math.round(pose.x * 100) / 100} ${Math.round(pose.y * 100) / 100}) rotate(${turn})`,
    );
  });
  it('turns a picture that points left by half a turn compared with one that points right', () => {
    const pose = at(left, 0.5);
    const right = flightTransform(left, pose, 0)!;
    const flipped = flightTransform(left, pose, 180)!;
    const deg = (s: string) => Number(/rotate\((-?[\d.]+)\)/.exec(s)![1]);
    expect(Math.abs(deg(right) - deg(flipped))).toBeCloseTo(180, 1);
  });
});
