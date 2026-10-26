// simulateShot with birds and a gust (an optional input). Still pure and repeatable.
import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import { BALLISTICS, DISTURBANCE, PHASE1_LAYOUT, TEAM_FACING } from '../../src/game/config';
import type { BirdPath, FlightDisturbance } from '../../src/game/disturbance';
import { pointAtTime } from '../../src/scenes/battle/trajectory';
import type { ShotInput } from '../../src/game/types';

const base: ShotInput = {
  angleDeg: 50,
  power: 65,
  origin: PHASE1_LAYOUT.launchOrigins.PAST,
  facing: TEAM_FACING.PAST,
  wind: 0,
  layout: PHASE1_LAYOUT,
};
const plain = simulateShot(base);
const STEP_MS = BALLISTICS.stepSeconds * 1000;

/** A bird that hovers in place (vx 0) at the shell's spot `ms` after launch. */
const birdOnPath = (ms: number, dy = -4): BirdPath => {
  const p = pointAtTime(plain.path, ms);
  // Pick the bob phase so the bob is at its middle at that time: the bird sits at y0 then.
  const bobPhase = 1 - ((ms / DISTURBANCE.birds.bobPeriodMs) % 1);
  return { id: 0, x0: p.x, y0: p.y + dy, vx: 0, bobPhase };
};
const calm: FlightDisturbance = { birds: [], birdMs: 0, gust: null };

describe('simulateShot with disturbances', () => {
  it('no birds and no gust fly the plain path', () => {
    const r = simulateShot({ ...base, disturbance: calm });
    expect(r.path).toEqual(plain.path);
    expect(r.landing).toEqual(plain.landing);
    expect(r.bumps).toEqual([]);
    expect(r.gust).toBeUndefined();
  });

  it('a shot without the input has no disturbance fields at all', () => {
    expect(plain).not.toHaveProperty('bumps');
    expect(plain).not.toHaveProperty('gust');
  });

  it('a gust shoves the shell its way, and says when it blew', () => {
    const right = simulateShot({
      ...base,
      disturbance: { ...calm, gust: { startShare: 0.25, durationMs: 400, push: 200 } },
    });
    const left = simulateShot({
      ...base,
      disturbance: { ...calm, gust: { startShare: 0.25, durationMs: 400, push: -200 } },
    });
    expect(right.landing.x).toBeGreaterThan(plain.landing.x + 20);
    expect(left.landing.x).toBeLessThan(plain.landing.x - 20);
    expect(right.gust).toBeDefined();
    expect(right.gust!.push).toBe(200);
    expect(right.gust!.fromStep * STEP_MS).toBeGreaterThanOrEqual(
      0.25 * plain.steps * STEP_MS - 1e-6,
    );
    expect((right.gust!.toStep - right.gust!.fromStep + 1) * STEP_MS).toBeCloseTo(400, 0);
    // Before the gust the path is the plain one.
    expect(right.path.slice(0, right.gust!.fromStep)).toEqual(
      plain.path.slice(0, right.gust!.fromStep),
    );
    expect(right.path[right.gust!.fromStep]).not.toEqual(plain.path[right.gust!.fromStep]);
  });

  it('a gust that would start after the shell lands never blew', () => {
    const late = 1.2;
    const r = simulateShot({
      ...base,
      disturbance: { ...calm, gust: { startShare: late, durationMs: 400, push: 200 } },
    });
    expect(r.gust).toBeUndefined();
    expect(r.landing).toEqual(plain.landing);
  });

  it('a bird on the path bumps the shell once, and the shot lands somewhere else', () => {
    const bird = birdOnPath(800);
    const r = simulateShot({ ...base, disturbance: { ...calm, birds: [bird] } });
    expect(r.bumps).toHaveLength(1);
    expect(r.bumps![0]!.bird).toBe(0);
    expect(r.bumps![0]!.step * STEP_MS).toBeGreaterThan(600);
    expect(r.bumps![0]!.step * STEP_MS).toBeLessThan(1000);
    expect(Math.abs(r.landing.x - plain.landing.x)).toBeGreaterThan(15);
    // The path passes through where it was bumped.
    expect(r.path[r.bumps![0]!.step]).toEqual(r.bumps![0]!.at);
  });

  it('skimming over a bird kicks the shell up (longer), clipping under kicks it down (shorter)', () => {
    const over = simulateShot({ ...base, disturbance: { ...calm, birds: [birdOnPath(800, 12)] } });
    const under = simulateShot({
      ...base,
      disturbance: { ...calm, birds: [birdOnPath(800, -12)] },
    });
    expect(over.bumps).toHaveLength(1);
    expect(under.bumps).toHaveLength(1);
    expect(over.landing.x).toBeGreaterThan(under.landing.x);
  });

  it('a bird at the muzzle never bumps (launch grace)', () => {
    const bird = birdOnPath(DISTURBANCE.birds.launchGraceMs / 2);
    const r = simulateShot({ ...base, disturbance: { ...calm, birds: [bird] } });
    expect(r.bumps).toEqual([]);
    expect(r.landing).toEqual(plain.landing);
  });

  it('a bird far from the path changes nothing', () => {
    const far: BirdPath = { id: 0, x0: 1200, y0: 100, vx: 0, bobPhase: 0 };
    const r = simulateShot({ ...base, disturbance: { ...calm, birds: [far] } });
    expect(r.bumps).toEqual([]);
    expect(r.path).toEqual(plain.path);
  });

  it('the bird clock at launch moves where a flying bird meets the shell', () => {
    const p = pointAtTime(plain.path, 800);
    // Flies right at 50 px/s. At birdMs 0 it is in the way; 4 s later it is 200 px further on.
    const bird: BirdPath = { id: 0, x0: p.x - 40, y0: p.y, vx: 50, bobPhase: 0 };
    const now = simulateShot({ ...base, disturbance: { ...calm, birds: [bird] } });
    const later = simulateShot({ ...base, disturbance: { ...calm, birds: [bird], birdMs: 4000 } });
    expect(now.bumps).toHaveLength(1);
    expect(later.bumps).toEqual([]);
  });

  it('is deterministic with birds and a gust together', () => {
    const d: FlightDisturbance = {
      birds: [birdOnPath(700), { id: 1, x0: 900, y0: 300, vx: -60, bobPhase: 0.3 }],
      birdMs: 1234,
      gust: { startShare: 0.3, durationMs: 400, push: -180 },
    };
    expect(simulateShot({ ...base, disturbance: d })).toEqual(
      simulateShot({ ...base, disturbance: d }),
    );
  });

  it('two birds can each bump the same shell once', () => {
    const d: FlightDisturbance = {
      birds: [birdOnPath(500), { ...birdOnPath(1200), id: 1 }],
      birdMs: 0,
      gust: null,
    };
    const r = simulateShot({ ...base, disturbance: d });
    // The first bump moves the shell, so the second bird may or may not still be on the new path.
    expect(r.bumps!.length).toBeGreaterThanOrEqual(1);
    expect(new Set(r.bumps!.map((b) => b.bird)).size).toBe(r.bumps!.length);
  });

  it('a stronger level nudges harder: a bigger bird turn sends the shell farther off', () => {
    const bird = birdOnPath(700);
    const mild = simulateShot({ ...base, disturbance: { ...calm, birds: [bird] } });
    const hard = simulateShot({
      ...base,
      disturbance: { ...calm, birds: [{ ...bird, nudgeDeg: DISTURBANCE.birds.nudgeDeg * 2.5 }] },
    });
    expect(mild.bumps).toHaveLength(1);
    expect(hard.bumps).toHaveLength(1);
    expect(Math.abs(hard.landing.x - plain.landing.x)).toBeGreaterThan(
      Math.abs(mild.landing.x - plain.landing.x),
    );
    // A bird with no nudgeDeg uses the low setting.
    const low = simulateShot({
      ...base,
      disturbance: { ...calm, birds: [{ ...bird, nudgeDeg: DISTURBANCE.birds.nudgeDeg }] },
    });
    expect(low).toEqual(mild);
  });

  it('the gust it reports carries the turn level, so the cue can match it', () => {
    const r = simulateShot({
      ...base,
      disturbance: {
        ...calm,
        gust: { startShare: 0.25, durationMs: 400, push: 400, level: 'high' },
      },
    });
    expect(r.gust!.level).toBe('high');
    const old = simulateShot({
      ...base,
      disturbance: { ...calm, gust: { startShare: 0.25, durationMs: 400, push: 400 } },
    });
    expect(old.gust).not.toHaveProperty('level');
  });
});
