// Team Past's castle places (Hill Fort, Village Wall, Drawbridge): the mirror of Team Future's
// base spots. Each has its own height and its own solid shapes, every shot path stays open, and
// no place (the default, and every plan saved before these existed) is the Phase 1 castle.
import { describe, expect, it, vi } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import {
  BIOME_IDS,
  EVASION,
  FORTS,
  FORT_IDS,
  LAUNCH_ORIGINS,
  PHASE1_LAYOUT,
  SPOT_IDS,
  TEAM_FACING,
  TERRAIN,
  WORLD,
} from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import { buildLayout, normalizePlan, unitOrigin } from '../../src/game/battlefield';
import {
  fortElevation,
  fortShift,
  isFortId,
  layoutForFort,
  type FortId,
} from '../../src/game/forts';
import type { BattleLayout, Polygon, Rect, Team } from '../../src/game/types';
import { unitById, unitsOf, type UnitDef } from '../../src/game/units';
import { windForTurn } from '../../src/game/wind';

// Heavy brute-force aim searches: a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

const FORT_LIST = [...FORT_IDS] as FortId[];
const WINDS = [0, windForTurn(11, 0), windForTurn(23, 3)];
const unit = (id: string): UnitDef => unitById(id) as UnitDef;

const fire = (layout: BattleLayout, team: Team, angleDeg: number, power: number, wind: number) =>
  simulateShot({
    angleDeg,
    power,
    wind,
    origin: layout.launchOrigins[team],
    facing: TEAM_FACING[team],
    layout,
  });

const find = (layout: BattleLayout, from: Team, target: Team, wind: number, want: string) => {
  for (let power = 20; power <= 100; power += 2)
    for (let angle = 5; angle <= 85; angle += 2) {
      const r = fire(layout, from, angle, power, wind);
      if (r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout') continue;
      if (classifyBlast(r.landing, layout.bases[target]) === want) return { angle, power };
    }
  return null;
};

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const boundsOf = (poly: Polygon): Rect => {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

describe('castle place ids', () => {
  it('has three places, read high, middle, low', () => {
    expect(FORT_LIST).toEqual(['hillFort', 'villageWall', 'drawbridge']);
  });
  it('isFortId accepts only those', () => {
    expect(isFortId('drawbridge')).toBe(true);
    for (const bad of [
      '',
      'Hill Fort',
      'barricade',
      'skyscraper',
      'toString',
      '__proto__',
      null,
      3,
      {},
    ])
      expect(isFortId(bad)).toBe(false);
  });
});

describe('layoutForFort', () => {
  it('returns exactly the Phase 1 layout for null, undefined and unknown ids', () => {
    expect(layoutForFort(null)).toBe(PHASE1_LAYOUT);
    expect(layoutForFort(undefined)).toBe(PHASE1_LAYOUT);
    for (const bad of ['nope', '', 'constructor', '__proto__', 'toString', 7, {}, []])
      expect(layoutForFort(bad as never)).toBe(PHASE1_LAYOUT);
  });

  it('never changes the Future side or the Phase 1 object', () => {
    const before = JSON.stringify(PHASE1_LAYOUT);
    for (const f of FORT_LIST) {
      const l = layoutForFort(f);
      expect(l.bases.FUTURE).toEqual(PHASE1_LAYOUT.bases.FUTURE);
      expect(l.launchOrigins.FUTURE).toEqual(PHASE1_LAYOUT.launchOrigins.FUTURE);
      expect(l.terrain.ground).toBe(PHASE1_LAYOUT.terrain.ground);
      expect(l.terrain.obstacles[0]).toBe(PHASE1_LAYOUT.terrain.obstacles[0]);
      expect(l.terrain.obstacles.length).toBeGreaterThan(1);
    }
    expect(JSON.stringify(PHASE1_LAYOUT)).toBe(before);
  });

  it('each place moves the castle by its shift, sideways not at all', () => {
    for (const f of FORT_LIST) {
      const b = layoutForFort(f).bases.PAST;
      expect(b.x - PHASE1_LAYOUT.bases.PAST.x).toBe(FORTS[f].shift.x);
      expect(b.y - PHASE1_LAYOUT.bases.PAST.y).toBe(FORTS[f].shift.y);
      expect(FORTS[f].shift.x).toBe(0);
      expect(fortShift(f)).toEqual(FORTS[f].shift);
    }
    expect(fortShift(null)).toEqual({ x: 0, y: 0 });
    expect(fortShift('zzz' as never)).toEqual({ x: 0, y: 0 });
  });
});

describe('castle height', () => {
  it('is different at each place', () => {
    expect(new Set(FORT_LIST.map((f) => fortElevation(f))).size).toBe(3);
  });
  it('Hill Fort is highest, Drawbridge is lowest', () => {
    expect(fortElevation('hillFort')).toBeLessThan(fortElevation('villageWall'));
    expect(fortElevation('villageWall')).toBeLessThan(fortElevation('drawbridge'));
  });
  it('no place keeps the Phase 1 height', () => {
    expect(fortElevation(null)).toBe(LAUNCH_ORIGINS.PAST.y);
  });
});

describe('castle place geometry', () => {
  for (const f of FORT_LIST) {
    it(`${f}: everything is inside the world, on the Past side, and nothing overlaps`, () => {
      const l = layoutForFort(f);
      const b = l.bases.PAST;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.h).toBeLessThanOrEqual(TERRAIN.groundY);
      expect(overlaps(b, l.bases.FUTURE)).toBe(false);
      const hillMinX = Math.min(...TERRAIN.hill.map((p) => p.x));
      for (const poly of FORTS[f].obstacles) {
        const box = boundsOf(poly);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.h).toBeLessThanOrEqual(TERRAIN.groundY);
        // Clear of the middle hill, the castle and the Stone Wall ability.
        expect(box.x + box.w).toBeLessThan(hillMinX);
        expect(overlaps(box, b)).toBe(false);
        expect(overlaps(box, EVASION.barricade.wall)).toBe(false);
      }
      const o = l.launchOrigins.PAST;
      expect(o.x < b.x || o.x > b.x + b.w || o.y < b.y || o.y > b.y + b.h).toBe(true);
      expect(o.y).toBeLessThan(TERRAIN.groundY);
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.x).toBeLessThan(WORLD.width / 2);
    });
  }

  it('Hill Fort sits right on top of its rock', () => {
    const l = layoutForFort('hillFort');
    const rock = boundsOf(FORTS.hillFort.obstacles[0]!);
    expect(rock.y).toBe(l.bases.PAST.y + l.bases.PAST.h);
    expect(rock.y + rock.h).toBe(TERRAIN.groundY);
  });
});

describe('reachable shot paths', () => {
  for (const f of FORT_LIST) {
    for (const wind of WINDS) {
      it(`${f}: Future can score a direct hit and a near miss at wind ${wind}`, () => {
        const l = layoutForFort(f);
        expect(find(l, 'FUTURE', 'PAST', wind, 'direct')).not.toBeNull();
        expect(find(l, 'FUTURE', 'PAST', wind, 'near')).not.toBeNull();
      });
    }
    it(`${f}: the Past default fighter can reach the Future base`, () => {
      expect(find(layoutForFort(f), 'PAST', 'FUTURE', 0, 'direct')).not.toBeNull();
    });
    for (const spot of SPOT_IDS)
      it(`${f} + ${spot}: both teams can score with no wind`, () => {
        const l = buildLayout({ biome: 'aspen', spot, fort: f });
        expect(find(l, 'PAST', 'FUTURE', 0, 'direct')).not.toBeNull();
        expect(find(l, 'FUTURE', 'PAST', 0, 'direct')).not.toBeNull();
      });
    for (const biome of BIOME_IDS)
      it(`${f} in ${biome}: both teams can score in strong wind both ways`, () => {
        const l = buildLayout({ biome, spot: 'foodTruck', fort: f });
        for (const wind of [-80, 80]) {
          const past =
            find(l, 'PAST', 'FUTURE', wind, 'direct') ?? find(l, 'PAST', 'FUTURE', wind, 'near');
          const future =
            find(l, 'FUTURE', 'PAST', wind, 'direct') ?? find(l, 'FUTURE', 'PAST', wind, 'near');
          expect(past, `PAST wind ${wind}`).not.toBeNull();
          expect(future, `FUTURE wind ${wind}`).not.toBeNull();
        }
      });
  }
});

describe('cover', () => {
  /** A Future shot that hits the castle in Phase 1 but hits this place's shape instead. */
  const blocked = (fort: FortId, maxAngle: number) => {
    const l = layoutForFort(fort);
    for (let power = 30; power <= 100; power += 2)
      for (let angle = 5; angle <= maxAngle; angle += 1) {
        const open = fire(PHASE1_LAYOUT, 'FUTURE', angle, power, 0);
        const shut = fire(l, 'FUTURE', angle, power, 0);
        if (open.hit.kind === 'base' && shut.hit.kind === 'obstacle' && shut.hit.index === 1)
          return { angle, power };
      }
    return null;
  };

  it('the drawbridge stops a flat shot that hits the castle in Phase 1', () => {
    expect(blocked('drawbridge', 45)).not.toBeNull();
  });
  it('the village wall stops a shot that hits the castle in Phase 1', () => {
    expect(blocked('villageWall', 85)).not.toBeNull();
  });
  it('the Hill Fort rock stops a low shot', () => {
    const l = layoutForFort('hillFort');
    let found = false;
    for (let power = 30; power <= 100 && !found; power += 2)
      for (let angle = 5; angle <= 85 && !found; angle += 1) {
        const r = fire(l, 'FUTURE', angle, power, 0);
        if (r.hit.kind === 'obstacle' && r.hit.index === 1) found = true;
      }
    expect(found).toBe(true);
  });
});

describe('in the full battlefield', () => {
  it('no castle place is exactly the Phase 1 field', () => {
    const l = buildLayout({ biome: 'aspen', spot: null, fort: null });
    expect(l.terrain).toEqual(PHASE1_LAYOUT.terrain);
    expect(l.bases).toEqual(PHASE1_LAYOUT.bases);
    expect(l.launchOrigins).toEqual(PHASE1_LAYOUT.launchOrigins);
    expect(l.baseShift?.PAST).toEqual({ x: 0, y: 0 });
    expect(l.fort).toBeNull();
    // A plan with no fort field at all builds the same field.
    expect(buildLayout({ biome: 'aspen', spot: 'foodTruck' })).toEqual(
      buildLayout({ biome: 'aspen', spot: 'foodTruck', fort: null }),
    );
  });

  it('an unknown castle place falls back to the Phase 1 castle, never throws', () => {
    const l = buildLayout({ biome: 'aspen', spot: null, fort: 'moat' as never });
    expect(l.bases.PAST).toEqual(PHASE1_LAYOUT.bases.PAST);
    expect(l.fort).toBeNull();
  });

  it('keeps the biome first, then the spot, then the castle place', () => {
    for (const f of FORT_LIST)
      for (const spot of SPOT_IDS) {
        const l = buildLayout({ biome: 'cherry', spot, fort: f });
        const spotCount = buildLayout({ biome: 'cherry', spot }).terrain.obstacles.length;
        expect(l.terrain.obstacles.slice(spotCount)).toEqual(FORTS[f].obstacles);
        expect(l.bases.PAST).toEqual(FORTS[f].base);
        expect(l.launchOrigins.PAST).toEqual(FORTS[f].launchOrigin);
        expect(l.bases.FUTURE).toEqual(buildLayout({ biome: 'cherry', spot }).bases.FUTURE);
        expect(l.fort).toBe(f);
        expect(l.baseShift?.PAST).toEqual(FORTS[f].shift);
      }
  });

  it('the Archer rides the castle, ground fighters stay put', () => {
    const l = buildLayout({ biome: 'aspen', spot: null, fort: 'hillFort' });
    expect(unitOrigin(l, unit('B'))).toEqual({ x: 150, y: 440 - 140 });
    expect(unitOrigin(l, unit('C'))).toEqual(l.launchOrigins.PAST);
    for (const id of ['A', 'D', 'E']) expect(unitOrigin(l, unit(id))).toEqual(unit(id).origin);
  });

  it('no fighter starts inside a solid shape at any castle place', () => {
    for (const fort of FORT_LIST)
      for (const spot of SPOT_IDS)
        for (const biome of BIOME_IDS) {
          const l = buildLayout({ biome, spot, fort });
          for (const u of [...unitsOf('PAST'), ...unitsOf('FUTURE')]) {
            const r = simulateShot({
              angleDeg: 45,
              power: 0,
              wind: 0,
              origin: unitOrigin(l, u),
              facing: TEAM_FACING[u.team],
              layout: l,
            });
            expect(r.steps, `${biome} ${spot} ${fort} ${u.id}`).toBeGreaterThan(0);
          }
        }
  });
});

describe('saved plans', () => {
  it('an old plan with no castle place still loads, with no fort', () => {
    const p = normalizePlan({ biome: 'cherry', spot: 'bridge' });
    expect(p).toEqual({ biome: 'cherry', spot: 'bridge' });
    expect('fort' in p).toBe(false);
  });
  it('keeps a known castle place and drops an unknown one', () => {
    expect(normalizePlan({ biome: 'aspen', spot: 'bridge', fort: 'drawbridge' }).fort).toBe(
      'drawbridge',
    );
    for (const bad of ['moat', '', null, 4, {}, 'skyscraper'])
      expect('fort' in normalizePlan({ biome: 'aspen', spot: 'bridge', fort: bad })).toBe(false);
  });
});
