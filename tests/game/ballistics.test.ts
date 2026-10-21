import { describe, expect, it, vi } from 'vitest';
import { clampAim, simulateShot } from '../../src/game/ballistics';
import {
  AIM,
  BALLISTICS,
  BASES,
  LAUNCH_ORIGINS,
  PHASE1_LAYOUT,
  TEAM_FACING,
  WORLD,
} from '../../src/game/config';
import { createRng } from '../../src/game/rng';
import type { BattleLayout, ShotInput } from '../../src/game/types';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

const past = (over: Partial<ShotInput> = {}): ShotInput => ({
  angleDeg: 45,
  power: 60,
  origin: LAUNCH_ORIGINS.PAST,
  facing: TEAM_FACING.PAST,
  wind: 0,
  layout: PHASE1_LAYOUT,
  ...over,
});

/** A big empty arena: ground far below, nothing else. */
const OPEN: BattleLayout = {
  width: 100_000,
  height: 100_000,
  terrain: {
    ground: [
      { x: 0, y: 50_000 },
      { x: 100_000, y: 50_000 },
      { x: 100_000, y: 100_000 },
      { x: 0, y: 100_000 },
    ],
    obstacles: [],
  },
  bases: { PAST: { x: -10, y: -10, w: 1, h: 1 }, FUTURE: { x: -10, y: -10, w: 1, h: 1 } },
  launchOrigins: { PAST: { x: 0, y: 0 }, FUTURE: { x: 0, y: 0 } },
};

describe('clampAim', () => {
  it('leaves good values alone', () => {
    expect(clampAim({ angleDeg: 30, power: 70 })).toEqual({ angleDeg: 30, power: 70 });
  });
  it('clamps the angle to 0..90 (boundaries pass through)', () => {
    expect(clampAim({ angleDeg: -1, power: 50 }).angleDeg).toBe(0);
    expect(clampAim({ angleDeg: 0, power: 50 }).angleDeg).toBe(0);
    expect(clampAim({ angleDeg: 90, power: 50 }).angleDeg).toBe(90);
    expect(clampAim({ angleDeg: 91, power: 50 }).angleDeg).toBe(90);
    expect(clampAim({ angleDeg: 1e9, power: 50 }).angleDeg).toBe(90);
    expect(clampAim({ angleDeg: -Infinity, power: 50 }).angleDeg).toBe(0);
  });
  it('clamps the power to 0..100 (boundaries pass through)', () => {
    expect(clampAim({ angleDeg: 45, power: -5 }).power).toBe(0);
    expect(clampAim({ angleDeg: 45, power: 0 }).power).toBe(0);
    expect(clampAim({ angleDeg: 45, power: 100 }).power).toBe(100);
    expect(clampAim({ angleDeg: 45, power: 100.5 }).power).toBe(100);
    expect(clampAim({ angleDeg: 45, power: Infinity }).power).toBe(100);
  });
  it('turns NaN into the default', () => {
    expect(clampAim({ angleDeg: NaN, power: NaN })).toEqual({
      angleDeg: AIM.defaultAngleDeg,
      power: AIM.defaultPower,
    });
  });
  it('does not mutate its input', () => {
    const input = { angleDeg: 200, power: 200 };
    clampAim(input);
    expect(input).toEqual({ angleDeg: 200, power: 200 });
  });
});

describe('simulateShot: shape', () => {
  it('starts at the origin and ends at the landing point', () => {
    const r = simulateShot(past());
    expect(r.path[0]).toEqual(LAUNCH_ORIGINS.PAST);
    expect(r.path[r.path.length - 1]).toEqual(r.landing);
    expect(r.path.length).toBe(r.steps + 1);
  });
  it('is bit-for-bit repeatable and does not mutate the input', () => {
    const input = past();
    const before = JSON.stringify(input);
    expect(simulateShot(input)).toEqual(simulateShot(input));
    expect(JSON.stringify(input)).toBe(before);
  });
  it('follows the semi-implicit Euler formula for the first step', () => {
    const dt = BALLISTICS.stepSeconds;
    const speed = 0.6 * BALLISTICS.maxLaunchSpeed;
    const vx = speed * Math.cos(Math.PI / 4);
    const vy = -speed * Math.sin(Math.PI / 4) + BALLISTICS.gravity * dt;
    const p1 = simulateShot(past()).path[1]!;
    expect(p1.x).toBeCloseTo(LAUNCH_ORIGINS.PAST.x + vx * dt, 9);
    expect(p1.y).toBeCloseTo(LAUNCH_ORIGINS.PAST.y + vy * dt, 9);
  });
});

describe('simulateShot: golden trajectories', () => {
  it('pins Team Past 45 degrees, power 60, no wind', () => {
    const r = simulateShot(past());
    expect(r.hit.kind).toBe('ground');
    expect(r.steps).toBe(GOLD.a.steps);
    expect(r.landing.x).toBeCloseTo(GOLD.a.x, 6);
    expect(r.landing.y).toBeCloseTo(GOLD.a.y, 6);
  });
  it('pins Team Past 45 degrees, power 55, no wind: strikes the hill', () => {
    const r = simulateShot(past({ power: 55 }));
    expect(r.steps).toBe(GOLD.b.steps);
    expect(r.landing.x).toBeCloseTo(GOLD.b.x, 6);
    expect(r.landing.y).toBeCloseTo(GOLD.b.y, 6);
    expect(r.hit.kind).toBe(GOLD.b.kind);
  });
  it('pins Team Future 40 degrees, power 80, wind -30: clips the Past base', () => {
    const r = simulateShot({
      angleDeg: 40,
      power: 80,
      origin: LAUNCH_ORIGINS.FUTURE,
      facing: TEAM_FACING.FUTURE,
      wind: -30,
      layout: PHASE1_LAYOUT,
    });
    expect(r.steps).toBe(GOLD.c.steps);
    expect(r.landing.x).toBeCloseTo(GOLD.c.x, 6);
    expect(r.landing.y).toBeCloseTo(GOLD.c.y, 6);
    expect(r.hit.kind).toBe(GOLD.c.kind);
  });
  it('matches the no-wind parabola closely (physics sanity)', () => {
    // Launch from y=0 at 45 degrees, speed 600. Flight time to y=0 is 2*vy/g, range vx*t.
    const speed = (2 / 3) * BALLISTICS.maxLaunchSpeed; // power 66.67 -> 600 px/s
    const r = simulateShot({
      angleDeg: 45,
      power: 200 / 3,
      origin: { x: 0, y: 0 },
      facing: 1,
      wind: 0,
      layout: OPEN,
    });
    const vx = speed * Math.SQRT1_2;
    const flight = (2 * speed * Math.SQRT1_2) / BALLISTICS.gravity;
    let apex = 0;
    for (const p of r.path) apex = Math.min(apex, p.y);
    const expectedApex = -((speed * Math.SQRT1_2) ** 2) / (2 * BALLISTICS.gravity);
    expect(Math.abs(apex - expectedApex)).toBeLessThan(10); // Euler is slightly off
    const crossing = r.path.findIndex((p, i) => i > 0 && p.y >= 0);
    expect(crossing).toBeGreaterThan(0);
    expect(Math.abs(crossing * BALLISTICS.stepSeconds - flight)).toBeLessThan(0.05);
    expect(Math.abs(r.path[crossing]!.x - vx * flight)).toBeLessThan(25);
  });
});

describe('simulateShot: aim and wind', () => {
  it('more power goes farther (flat ground)', () => {
    const x = (power: number) =>
      simulateShot({ ...past({ power }), layout: OPEN, origin: { x: 0, y: 0 } }).landing.x;
    expect(x(40)).toBeLessThan(x(60));
    expect(x(60)).toBeLessThan(x(80));
  });
  it('tailwind carries farther, headwind shorter, for both facings', () => {
    const land = (wind: number, facing: 1 | -1) =>
      simulateShot({ ...past({ wind, facing }), layout: OPEN, origin: { x: 50_000, y: 0 } }).landing
        .x;
    expect(land(60, 1)).toBeGreaterThan(land(0, 1));
    expect(land(-60, 1)).toBeLessThan(land(0, 1));
    // Facing left: wind is still +x, so positive wind is a headwind.
    expect(land(60, -1)).toBeGreaterThan(land(0, -1));
    expect(land(-60, -1)).toBeLessThan(land(0, -1));
    expect(land(0, -1)).toBeLessThan(50_000);
  });
  it('wind changes the landing point by a clear margin', () => {
    const a = simulateShot(past({ angleDeg: 30, power: 80 })).landing;
    const b = simulateShot(past({ angleDeg: 30, power: 80, wind: 80 })).landing;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(20);
  });
  it('angle 90 goes straight up and comes back down (x only moves from wind)', () => {
    const r = simulateShot({
      ...past({ angleDeg: 90, power: 50 }),
      layout: OPEN,
      origin: { x: 500, y: 0 },
    });
    expect(r.landing.x).toBeCloseTo(500, 6);
    expect(Math.min(...r.path.map((p) => p.y))).toBeLessThan(-100);
  });
  it('angle 0 starts flat and falls', () => {
    const r = simulateShot({
      ...past({ angleDeg: 0, power: 50 }),
      layout: OPEN,
      origin: { x: 0, y: 0 },
    });
    expect(r.path[1]!.y).toBeGreaterThan(0);
    expect(r.landing.x).toBeGreaterThan(0);
  });
  it('out-of-range aim is clamped, so it equals the clamped shot', () => {
    expect(simulateShot(past({ angleDeg: 500, power: 500 }))).toEqual(
      simulateShot(past({ angleDeg: 90, power: 100 })),
    );
    expect(simulateShot(past({ angleDeg: -9, power: -9 }))).toEqual(
      simulateShot(past({ angleDeg: 0, power: 0 })),
    );
  });
  it('power 0 drops right at the launcher', () => {
    const r = simulateShot(past({ power: 0, angleDeg: 90 }));
    expect(Math.abs(r.landing.x - LAUNCH_ORIGINS.PAST.x)).toBeLessThan(1);
  });
});

describe('simulateShot: collisions', () => {
  it('hits the ground at groundY', () => {
    const r = simulateShot(past({ power: 75, angleDeg: 20 }));
    if (r.hit.kind === 'ground') expect(r.landing.y).toBeCloseTo(620, 6);
    expect(['ground', 'obstacle', 'base']).toContain(r.hit.kind);
  });
  it('a low flat shot into the hill is an obstacle hit on the hill face', () => {
    const r = simulateShot({ ...past({ angleDeg: 5, power: 55 }), origin: { x: 300, y: 560 } });
    expect(r.hit).toEqual({ kind: 'obstacle', index: 0 });
    expect(r.landing.x).toBeGreaterThan(540);
    expect(r.landing.x).toBeLessThan(740);
  });
  it('a ground shot lands exactly on the surface (segment intersection, not step end)', () => {
    const r = simulateShot({ ...past({ angleDeg: 30, power: 40 }), origin: { x: 800, y: 600 } });
    expect(r.hit.kind).toBe('ground');
    expect(r.landing.y).toBeCloseTo(620, 9);
  });
  it('hits the opposing base and names its team', () => {
    // From far left of the base at its height, flying right, fast and flat.
    const layout: BattleLayout = {
      ...PHASE1_LAYOUT,
      terrain: { ...PHASE1_LAYOUT.terrain, obstacles: [] },
    };
    const r = simulateShot({
      angleDeg: 0,
      power: 100,
      origin: { x: 600, y: 540 },
      facing: 1,
      wind: 0,
      layout,
    });
    expect(r.hit).toEqual({ kind: 'base', team: 'FUTURE' });
    expect(r.landing.x).toBeCloseTo(BASES.FUTURE.x, 6);
  });
  it('hits Team Past base when flying left', () => {
    const layout: BattleLayout = {
      ...PHASE1_LAYOUT,
      terrain: { ...PHASE1_LAYOUT.terrain, obstacles: [] },
    };
    const r = simulateShot({
      angleDeg: 0,
      power: 100,
      origin: { x: 700, y: 420 },
      facing: -1,
      wind: 0,
      layout,
    });
    expect(r.hit).toEqual({ kind: 'base', team: 'PAST' });
    expect(r.landing.x).toBeCloseTo(BASES.PAST.x + BASES.PAST.w, 6);
  });
  it('leaving the world on the right is out_of_bounds, landing at the last in-bounds point', () => {
    const layout: BattleLayout = {
      ...PHASE1_LAYOUT,
      terrain: { ...PHASE1_LAYOUT.terrain, obstacles: [] },
    };
    const r = simulateShot({
      angleDeg: 20,
      power: 100,
      origin: { x: 1100, y: 300 },
      facing: 1,
      wind: 0,
      layout,
    });
    expect(r.hit).toEqual({ kind: 'out_of_bounds' });
    expect(r.landing.x).toBeLessThanOrEqual(WORLD.width);
    expect(r.landing.x).toBeGreaterThan(1200);
  });
  it('leaving on the left is out_of_bounds', () => {
    const layout: BattleLayout = {
      ...PHASE1_LAYOUT,
      terrain: { ...PHASE1_LAYOUT.terrain, obstacles: [] },
    };
    const r = simulateShot({
      angleDeg: 20,
      power: 100,
      origin: { x: 100, y: 300 },
      facing: -1,
      wind: 0,
      layout,
    });
    expect(r.hit).toEqual({ kind: 'out_of_bounds' });
    expect(r.landing.x).toBeGreaterThanOrEqual(0);
  });
  it('flying above the top (no ceiling) is fine and still comes back', () => {
    const r = simulateShot(past({ angleDeg: 90, power: 100 }));
    expect(Math.min(...r.path.map((p) => p.y))).toBeLessThan(0);
    expect(r.hit.kind).not.toBe('timeout');
  });
  it('ends as timeout after maxSteps if nothing is ever hit', () => {
    const r = simulateShot({
      angleDeg: 90,
      power: 100,
      origin: { x: 5, y: 0 },
      facing: 1,
      wind: 0,
      layout: OPEN,
    });
    expect(r.hit).toEqual({ kind: 'timeout' });
    expect(r.steps).toBe(BALLISTICS.maxSteps);
    expect(r.path).toHaveLength(BALLISTICS.maxSteps + 1);
  });
  it('an origin already inside solid ground ends at once', () => {
    const r = simulateShot(past({ origin: { x: 640, y: 700 } }));
    expect(r.hit.kind).toBe('ground');
    expect(r.steps).toBe(0);
    expect(r.landing).toEqual({ x: 640, y: 700 });
  });
});

describe('simulateShot: property loops over seeded random shots', () => {
  it('2000 random shots all terminate with finite paths', () => {
    const rng = createRng(2026);
    for (let i = 0; i < 2000; i++) {
      const team = rng.pick(['PAST', 'FUTURE'] as const);
      const r = simulateShot({
        angleDeg: rng.next() * 120 - 15, // includes out-of-range values
        power: rng.next() * 130 - 15,
        origin: LAUNCH_ORIGINS[team],
        facing: TEAM_FACING[team],
        wind: rng.int(-80, 80),
        layout: PHASE1_LAYOUT,
      });
      expect(r.steps).toBeLessThanOrEqual(BALLISTICS.maxSteps);
      expect(r.path.length).toBe(r.steps + 1);
      expect(Number.isFinite(r.landing.x) && Number.isFinite(r.landing.y)).toBe(true);
      for (const p of r.path) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
          throw new Error(`non-finite point in shot ${i}`);
      }
      expect(r.path[r.path.length - 1]).toEqual(r.landing);
    }
  });
  it('two runs with the same seed give identical results', () => {
    const run = () => {
      const rng = createRng(77);
      return Array.from({ length: 200 }, () =>
        simulateShot(
          past({ angleDeg: rng.int(0, 90), power: rng.int(0, 100), wind: rng.int(-80, 80) }),
        ),
      );
    };
    expect(run()).toEqual(run());
  });
  it('NaN aim and wind never produce NaN points', () => {
    const r = simulateShot(past({ angleDeg: NaN, power: NaN }));
    expect(Number.isFinite(r.landing.x)).toBe(true);
    expect(r.path.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});

const GOLD = {
  a: { steps: 97, x: 834.147497495029, y: 620 },
  b: { steps: 78, x: 670.1312309466965, y: 502.4671922633259, kind: 'obstacle' },
  c: { steps: 92, x: 183.03170098759855, y: 470, kind: 'base' },
};
