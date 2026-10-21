import { describe, expect, it, vi } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import { classifyBlast } from '../../src/game/damage';
import {
  LAUNCH_ORIGINS,
  PHASE1_LAYOUT,
  SPOT_IDS,
  TEAM_FACING,
  TERRAIN,
  WORLD,
} from '../../src/game/config';
import { isSpotId, layoutForSpot, shiftForSpot, spotElevation } from '../../src/game/spots';
import type { SpotId } from '../../src/game/spots';
import type { BattleLayout, Rect, Team } from '../../src/game/types';
import { windForTurn } from '../../src/game/wind';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 30_000 });

const SPOTS = [...SPOT_IDS] as SpotId[];
const WINDS = [0, windForTurn(11, 0), windForTurn(23, 3)];

const fire = (layout: BattleLayout, team: Team, angleDeg: number, power: number, wind: number) =>
  simulateShot({
    angleDeg,
    power,
    wind,
    origin: layout.launchOrigins[team],
    facing: TEAM_FACING[team],
    layout,
  });

/** Brute-force search for an aim whose landing is classified `want` against `target`. */
const find = (layout: BattleLayout, from: Team, target: Team, wind: number, want: string) => {
  for (let power = 20; power <= 100; power += 2)
    for (let angle = 5; angle <= 85; angle += 2) {
      const r = fire(layout, from, angle, power, wind);
      if (classifyBlast(r.landing, layout.bases[target]) === want) return { angle, power };
    }
  return null;
};

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('layoutForSpot', () => {
  it('returns exactly the Phase 1 layout for null, undefined and unknown ids', () => {
    expect(layoutForSpot(null)).toEqual(PHASE1_LAYOUT);
    expect(layoutForSpot(null)).toBe(PHASE1_LAYOUT);
    expect(layoutForSpot(undefined)).toBe(PHASE1_LAYOUT);
    for (const bad of ['nope', '', 'constructor', '__proto__', 'toString', 7, {}, []])
      expect(layoutForSpot(bad as never)).toBe(PHASE1_LAYOUT);
  });

  it('never changes the Past side or the Phase 1 object', () => {
    const before = JSON.stringify(PHASE1_LAYOUT);
    for (const s of SPOTS) {
      const l = layoutForSpot(s);
      expect(l.bases.PAST).toEqual(PHASE1_LAYOUT.bases.PAST);
      expect(l.launchOrigins.PAST).toEqual(PHASE1_LAYOUT.launchOrigins.PAST);
      expect(l.terrain.ground).toBe(PHASE1_LAYOUT.terrain.ground);
      expect(l.terrain.obstacles[0]).toBe(PHASE1_LAYOUT.terrain.obstacles[0]);
    }
    expect(JSON.stringify(PHASE1_LAYOUT)).toBe(before);
  });

  it('recognises only the three Austin spots', () => {
    expect(SPOTS).toEqual(['skyscraper', 'bridge', 'foodTruck']);
    expect(isSpotId('bridge')).toBe(true);
    expect(isSpotId('hill')).toBe(false);
    expect(isSpotId(null)).toBe(false);
  });
});

describe('spot elevation', () => {
  it('is distinct for the three spots', () => {
    expect(new Set(SPOTS.map((s) => spotElevation(s))).size).toBe(3);
  });
  it('skyscraper is highest, bridge is lowest', () => {
    expect(spotElevation('skyscraper')).toBeLessThan(spotElevation('foodTruck'));
    expect(spotElevation('foodTruck')).toBeLessThan(spotElevation('bridge'));
  });
  it('no spot gives the Phase 1 height except the plain default', () => {
    expect(spotElevation(null)).toBe(LAUNCH_ORIGINS.FUTURE.y);
  });
});

describe('spot geometry', () => {
  for (const s of SPOTS) {
    it(`${s}: everything is inside the world and nothing overlaps`, () => {
      const l = layoutForSpot(s);
      const b = l.bases.FUTURE;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(WORLD.width);
      expect(b.y + b.h).toBeLessThanOrEqual(TERRAIN.groundY);
      expect(overlaps(b, l.bases.PAST)).toBe(false);
      for (const poly of l.terrain.obstacles)
        for (const p of poly) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(WORLD.width);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(TERRAIN.groundY);
        }
      const hillMaxX = Math.max(...TERRAIN.hill.map((p) => p.x));
      expect(b.x).toBeGreaterThan(hillMaxX);
      const o = l.launchOrigins.FUTURE;
      expect(o.x < b.x || o.x > b.x + b.w || o.y < b.y || o.y > b.y + b.h).toBe(true);
      expect(o.y).toBeLessThan(TERRAIN.groundY);
      expect(o.x).toBeLessThanOrEqual(WORLD.width);
    });
  }
});

describe('reachable shot paths', () => {
  for (const s of SPOTS) {
    for (const wind of WINDS) {
      it(`${s}: Past can score a direct hit and a near miss at wind ${wind}`, () => {
        const l = layoutForSpot(s);
        expect(find(l, 'PAST', 'FUTURE', wind, 'direct')).not.toBeNull();
        expect(find(l, 'PAST', 'FUTURE', wind, 'near')).not.toBeNull();
      });
    }
    it(`${s}: the Future default fighter can reach the Past base`, () => {
      expect(find(layoutForSpot(s), 'FUTURE', 'PAST', 0, 'direct')).not.toBeNull();
    });
  }
});

describe('cover', () => {
  it('the bridge deck stops a flat shot that hits in Phase 1', () => {
    const bridge = layoutForSpot('bridge');
    let found: { angle: number; power: number } | null = null;
    for (let power = 40; power <= 100 && !found; power += 2)
      for (let angle = 5; angle <= 60 && !found; angle += 1) {
        const open = fire(PHASE1_LAYOUT, 'PAST', angle, power, 0);
        const shut = fire(bridge, 'PAST', angle, power, 0);
        if (open.hit.kind === 'base' && shut.hit.kind === 'obstacle' && shut.hit.index === 1)
          found = { angle, power };
      }
    expect(found).not.toBeNull();
    const { angle, power } = found as { angle: number; power: number };
    expect(fire(bridge, 'PAST', angle, power, 0).hit).toEqual({ kind: 'obstacle', index: 1 });
  });

  it('the food truck wall stops a shot that hits the base in Phase 1', () => {
    const truck = layoutForSpot('foodTruck');
    let found = false;
    for (let power = 30; power <= 100 && !found; power += 2)
      for (let angle = 5; angle <= 85 && !found; angle += 1) {
        const a = fire(PHASE1_LAYOUT, 'PAST', angle, power, 0);
        const b = fire(truck, 'PAST', angle, power, 0);
        if (a.hit.kind === 'base' && b.hit.kind === 'obstacle' && b.hit.index === 1) found = true;
      }
    expect(found).toBe(true);
  });

  it('the skyscraper has only the hill and its tower', () => {
    expect(layoutForSpot('skyscraper').terrain.obstacles).toHaveLength(2);
  });
});

describe('shiftForSpot', () => {
  it('moves a point the same way the base moved', () => {
    for (const s of SPOTS) {
      const moved = shiftForSpot(s, { x: 1100, y: 600 });
      const base = layoutForSpot(s).bases.FUTURE;
      expect(moved.x - 1100).toBe(base.x - PHASE1_LAYOUT.bases.FUTURE.x);
      expect(moved.y - 600).toBe(base.y - PHASE1_LAYOUT.bases.FUTURE.y);
    }
  });
  it('leaves the point alone for null and unknown ids, and does not mutate', () => {
    const p = { x: 5, y: 6 };
    expect(shiftForSpot(null, p)).toEqual(p);
    expect(shiftForSpot('zzz' as never, p)).toEqual(p);
    expect(shiftForSpot('skyscraper', p)).not.toBe(p);
    expect(p).toEqual({ x: 5, y: 6 });
  });
});
