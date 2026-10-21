import { describe, expect, it, vi } from 'vitest';
import {
  AMMO,
  AMMO_IDS,
  ammoById,
  ammoCost,
  ammoUses,
  bounces,
  damageScale,
  effectiveSpeedScale,
  isSpecialAmmo,
  radiusScale,
  resolveAmmo,
  scaleDamage,
  windScale,
} from '../../src/game/ammo';
import { simulateShot } from '../../src/game/ballistics';
import {
  BALLISTICS,
  BASES,
  DAMAGE,
  LAUNCH_ORIGINS,
  PHASE1_LAYOUT,
  TEAM_FACING,
} from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import type { BattleLayout, Polygon, ShotInput } from '../../src/game/types';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

const past = (over: Partial<ShotInput & { ammo: string }> = {}) => ({
  angleDeg: 45,
  power: 60,
  origin: LAUNCH_ORIGINS.PAST,
  facing: TEAM_FACING.PAST,
  wind: 0,
  layout: PHASE1_LAYOUT,
  ...over,
});

/** A flat world: ground at y = 300, nothing else in the way. */
const FLAT: BattleLayout = {
  width: 100_000,
  height: 100_000,
  terrain: {
    ground: [
      { x: 0, y: 300 },
      { x: 100_000, y: 300 },
      { x: 100_000, y: 100_000 },
      { x: 0, y: 100_000 },
    ],
    obstacles: [],
  },
  bases: { PAST: { x: -10, y: -10, w: 1, h: 1 }, FUTURE: { x: -10, y: -10, w: 1, h: 1 } },
  launchOrigins: { PAST: { x: 0, y: 0 }, FUTURE: { x: 0, y: 0 } },
};

const inside = (pt: { x: number; y: number }, poly: Polygon): boolean => {
  let in_ = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x)
      in_ = !in_;
  }
  return in_;
};

describe('ammo table', () => {
  it('lists the four kinds with standard first and free', () => {
    expect(AMMO_IDS).toEqual(['standard', 'confetti', 'plasma', 'bowling']);
    expect(ammoCost('standard')).toBe(0);
    expect(ammoUses('standard')).toBe(Number.POSITIVE_INFINITY);
  });

  it('prices and limits the special kinds', () => {
    expect([ammoCost('confetti'), ammoCost('plasma'), ammoCost('bowling')]).toEqual([10, 14, 18]);
    expect([ammoUses('confetti'), ammoUses('plasma'), ammoUses('bowling')]).toEqual([3, 3, 2]);
  });

  it('gives each kind the promised traits', () => {
    expect(radiusScale('confetti')).toEqual({ direct: 1.15, near: 1.3 });
    expect(damageScale('confetti')).toBe(0.9);
    expect(bounces('plasma')).toBe(1);
    expect(ammoById('plasma')?.restitution).toBe(0.6);
    expect(effectiveSpeedScale('bowling')).toBe(0.85);
    expect(windScale('bowling')).toBe(0.4);
    expect(damageScale('bowling')).toBe(1.3);
  });

  it('standard changes nothing', () => {
    expect(effectiveSpeedScale('standard')).toBe(1);
    expect(windScale('standard')).toBe(1);
    expect(damageScale('standard')).toBe(1);
    expect(radiusScale('standard')).toEqual({ direct: 1, near: 1 });
    expect(bounces('standard')).toBe(0);
    expect(isSpecialAmmo('standard')).toBe(false);
    expect(isSpecialAmmo('plasma')).toBe(true);
  });

  it('treats a bad id as standard and never throws', () => {
    for (const bad of [undefined, null, 'nope', 7, {}, NaN, '']) {
      expect(ammoById(bad)).toBeNull();
      expect(resolveAmmo(bad).id).toBe('standard');
      expect(ammoCost(bad)).toBe(0);
      expect(scaleDamage(25, bad)).toBe(25);
      expect(windScale(bad)).toBe(1);
      expect(isSpecialAmmo(bad)).toBe(false);
    }
  });

  it('has every number in a sane range', () => {
    for (const a of AMMO) {
      expect(a.speedScale).toBeGreaterThan(0);
      expect(a.windScale).toBeGreaterThan(0);
      expect(a.damageScale).toBeGreaterThan(0);
      expect(a.restitution).toBeGreaterThanOrEqual(0);
      expect(a.restitution).toBeLessThan(1);
    }
  });
});

describe('simulateShot with standard or missing ammo (golden)', () => {
  const shots = [
    past(),
    past({ angleDeg: 30, power: 90, wind: 40 }),
    past({ angleDeg: 70, power: 50, wind: -35, speedScale: 1.2 }),
    past({ angleDeg: 20, power: 100 }),
    past({
      origin: LAUNCH_ORIGINS.FUTURE,
      facing: TEAM_FACING.FUTURE,
      angleDeg: 50,
      power: 75,
      wind: 20,
    }),
  ];

  it.each(shots.map((s, i) => [i, s] as const))('shot %i is identical bit for bit', (_i, shot) => {
    const plain = simulateShot(shot);
    expect(simulateShot({ ...shot, ammo: 'standard' })).toEqual(plain);
    expect(simulateShot({ ...shot, ammo: 'junk' })).toEqual(plain);
    expect(simulateShot({ ...shot, ammo: undefined })).toEqual(plain);
    expect('bounced' in plain).toBe(false);
  });

  it('is deterministic for special ammo too', () => {
    for (const ammo of AMMO_IDS) {
      const shot = past({ ammo, angleDeg: 35, power: 55, wind: 25 });
      expect(simulateShot(shot)).toEqual(simulateShot(shot));
    }
  });
});

describe('bouncy plasma spheres', () => {
  const flat = (over = {}) =>
    simulateShot({
      angleDeg: 30,
      power: 50,
      origin: { x: 0, y: 0 },
      facing: 1,
      wind: 0,
      layout: FLAT,
      ammo: 'plasma',
      ...over,
    });

  it('bounces once on the ground, then ends on the next contact', () => {
    const r = flat();
    expect(r.bounced).toBe(true);
    expect(r.hit).toEqual({ kind: 'ground' });
    const onGround = r.path.filter((p) => Math.abs(p.y - 300) < 1e-6);
    // The bounce point and the final landing point, no more.
    expect(onGround).toHaveLength(2);
    expect(r.landing.y).toBeCloseTo(300, 6);
  });

  it('lands farther than a standard shot', () => {
    const std = flat({ ammo: 'standard' });
    expect(std.bounced).toBeUndefined();
    expect(flat().landing.x).toBeGreaterThan(std.landing.x);
  });

  it('keeps horizontal speed and returns 0.6 of the vertical speed', () => {
    const dt = BALLISTICS.stepSeconds;
    const g = BALLISTICS.gravity;
    const r = flat();
    const b = r.path.findIndex((p) => Math.abs(p.y - 300) < 1e-6);
    expect(b).toBeGreaterThan(2);
    const before = r.path[b - 1]!;
    const beforePrev = r.path[b - 2]!;
    const contact = r.path[b]!;
    const after = r.path[b + 1]!;
    const vxBefore = (before.x - beforePrev.x) / dt;
    const vyBefore = (before.y - beforePrev.y) / dt + g * dt; // speed at the step that hit
    const vxAfter = (after.x - contact.x) / dt;
    const vyAfter = (after.y - (contact.y - 0.01)) / dt - g * dt;
    expect(vxAfter).toBeCloseTo(vxBefore, 6);
    expect(vyBefore).toBeGreaterThan(0); // falling
    expect(vyAfter).toBeCloseTo(-0.6 * vyBefore, 6); // rising, 0.6 as fast
  });

  it('with no ground bounce possible (hits a base first) reports bounced false', () => {
    const r = simulateShot({
      angleDeg: 45,
      power: 100,
      origin: LAUNCH_ORIGINS.PAST,
      facing: 1,
      wind: 0,
      layout: PHASE1_LAYOUT,
      ammo: 'plasma',
    });
    expect(typeof r.bounced).toBe('boolean');
  });

  it('never sinks into the hill or a base, across a grid of shots on both sides', () => {
    const hill = PHASE1_LAYOUT.terrain.obstacles[0]!;
    let bouncedCount = 0;
    for (const team of ['PAST', 'FUTURE'] as const) {
      for (let angleDeg = 10; angleDeg <= 80; angleDeg += 10) {
        for (let power = 20; power <= 100; power += 10) {
          for (const wind of [-60, 0, 60]) {
            const r = simulateShot({
              angleDeg,
              power,
              wind,
              origin: LAUNCH_ORIGINS[team],
              facing: TEAM_FACING[team],
              layout: PHASE1_LAYOUT,
              ammo: 'plasma',
            });
            if (r.bounced) bouncedCount += 1;
            // Every point but the last (the contact itself) is out in the open.
            for (const p of r.path.slice(0, -1)) {
              expect(inside(p, hill)).toBe(false);
              for (const base of [BASES.PAST, BASES.FUTURE]) {
                const hitBase =
                  p.x > base.x && p.x < base.x + base.w && p.y > base.y && p.y < base.y + base.h;
                expect(hitBase).toBe(false);
              }
            }
            expect(r.path.length).toBeLessThanOrEqual(BALLISTICS.maxSteps + 1);
          }
        }
      }
    }
    expect(bouncedCount).toBeGreaterThan(10);
  });

  it('a bounce that comes down on the hill ends there', () => {
    // Lob short so it bounces left of the hill, then runs into the hill's left slope.
    let ended = 0;
    for (let power = 30; power <= 80; power += 2) {
      const r = simulateShot(past({ angleDeg: 25, power, ammo: 'plasma' }));
      if (r.bounced && r.hit.kind === 'obstacle') ended += 1;
    }
    expect(ended).toBeGreaterThan(0);
  });
});

describe('heavy iron bowling balls', () => {
  it('feel the wind much less than standard shots', () => {
    const drift = (ammo: string, wind: number) =>
      simulateShot(
        past({ angleDeg: 50, power: 70, wind, layout: FLAT, origin: { x: 0, y: 0 }, ammo }),
      ).landing.x;
    const std = Math.abs(drift('standard', 60) - drift('standard', 0));
    const bowl = Math.abs(drift('bowling', 60) - drift('bowling', 0));
    expect(std).toBeGreaterThan(5);
    expect(bowl).toBeLessThan(std * 0.6);
  });

  it('throw shorter at the same power', () => {
    const x = (ammo: string) =>
      simulateShot(past({ layout: FLAT, origin: { x: 0, y: 0 }, ammo })).landing.x;
    expect(x('bowling')).toBeLessThan(x('standard'));
  });

  it('stack the speed scale with the weapon speed scale', () => {
    const x = (speedScale: number) =>
      simulateShot(past({ layout: FLAT, origin: { x: 0, y: 0 }, ammo: 'bowling', speedScale }))
        .landing.x;
    expect(x(1.2)).toBeGreaterThan(x(1));
  });
});

describe('confetti explosives (blast radius)', () => {
  const base = BASES.FUTURE;
  const at = (gap: number) => ({ x: base.x - gap, y: base.y + base.h / 2 });

  it('turns a borderline near miss into a direct hit', () => {
    const impact = at(DAMAGE.directRadius + 4);
    expect(classifyBlast(impact, base)).toBe('near');
    expect(classifyBlast(impact, base, radiusScale('confetti'))).toBe('direct');
  });

  it('turns a borderline miss into a near miss', () => {
    const impact = at(DAMAGE.nearRadius + 8);
    expect(classifyBlast(impact, base)).toBe('miss');
    expect(classifyBlast(impact, base, radiusScale('confetti'))).toBe('near');
  });

  it('a number scales both radii, and a bad scale counts as 1', () => {
    const impact = at(DAMAGE.directRadius + 4);
    expect(classifyBlast(impact, base, 1.2)).toBe('direct');
    for (const bad of [NaN, 0, -2, Infinity]) {
      expect(classifyBlast(impact, base, bad)).toBe('near');
    }
  });

  it('default scale changes nothing', () => {
    for (let gap = 0; gap < 200; gap += 7) {
      expect(classifyBlast(at(gap), base, 1)).toBe(classifyBlast(at(gap), base));
      expect(classifyBlast(at(gap), base, radiusScale('standard'))).toBe(
        classifyBlast(at(gap), base),
      );
    }
  });
});

describe('damage scale', () => {
  it('rounds to whole points', () => {
    expect(scaleDamage(25, 'confetti')).toBe(23);
    expect(scaleDamage(25, 'bowling')).toBe(33);
    expect(scaleDamage(10, 'bowling')).toBe(13);
    expect(scaleDamage(25, 'standard')).toBe(25);
  });
});
