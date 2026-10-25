import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import {
  BIOME_IDS,
  BIOMES,
  DEFAULT_PLAN,
  EVASION,
  PHASE1_LAYOUT,
  SPOT_IDS,
  TEAM_FACING,
  WORLD,
} from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import {
  buildLayout,
  isBiomeId,
  normalizePlan,
  ridesBase,
  unitOrigin,
  withWalls,
} from '../../src/game/battlefield';
import { layoutForSpot } from '../../src/game/spots';
import type { BattleLayout, Rect, Team } from '../../src/game/types';
import { unitById, unitsOf, type UnitDef } from '../../src/game/units';

const unit = (id: string): UnitDef => unitById(id) as UnitDef;

/** Coarse search for an aim that scores `want` from the team's default launcher. */
const canScore = (layout: BattleLayout, from: Team, wind: number, want = 'direct'): boolean => {
  const target: Team = from === 'PAST' ? 'FUTURE' : 'PAST';
  for (let power = 20; power <= 100; power += 2)
    for (let angle = 5; angle <= 85; angle += 2) {
      const r = simulateShot({
        angleDeg: angle,
        power,
        wind,
        origin: layout.launchOrigins[from],
        facing: TEAM_FACING[from],
        layout,
      });
      if (r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout') continue;
      if (classifyBlast(r.landing, layout.bases[target]) === want) return true;
    }
  return false;
};

const inside = (r: Rect) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= WORLD.width && r.y + r.h <= WORLD.height;

describe('biome ids', () => {
  it('has the three places from the spec', () => {
    expect([...BIOME_IDS]).toEqual(['aspen', 'cherry', 'temple']);
  });
  it('isBiomeId accepts only those', () => {
    expect(isBiomeId('cherry')).toBe(true);
    for (const bad of ['', 'Aspen', 'toString', '__proto__', null, 3, {}]) {
      expect(isBiomeId(bad)).toBe(false);
    }
  });
  it('each biome has a different middle obstacle', () => {
    const shapes = BIOME_IDS.map((b) => JSON.stringify(BIOMES[b].obstacle));
    expect(new Set(shapes).size).toBe(3);
  });
});

describe('normalizePlan', () => {
  it('fills anything missing or wrong from the default plan', () => {
    expect(normalizePlan(null)).toEqual(DEFAULT_PLAN);
    expect(normalizePlan({ biome: 'moon', spot: 'roof' })).toEqual(DEFAULT_PLAN);
    expect(normalizePlan({ biome: 'temple' })).toEqual({ ...DEFAULT_PLAN, biome: 'temple' });
    expect(normalizePlan({ biome: 'cherry', spot: 'bridge' })).toEqual({
      biome: 'cherry',
      spot: 'bridge',
      fort: 'villageWall',
    });
  });
});

describe('buildLayout', () => {
  it('aspen with no spot is the Phase 1 field', () => {
    const l = buildLayout({ biome: 'aspen', spot: null });
    expect(l.terrain).toEqual(PHASE1_LAYOUT.terrain);
    expect(l.bases).toEqual(PHASE1_LAYOUT.bases);
    expect(l.launchOrigins).toEqual(PHASE1_LAYOUT.launchOrigins);
    expect(l.biome).toBe('aspen');
  });

  it('unknown ids fall back to aspen and no spot, never throw', () => {
    const l = buildLayout({ biome: 'moon' as never, spot: 'roof' as never });
    expect(l.terrain).toEqual(PHASE1_LAYOUT.terrain);
    expect(l.biome).toBe('aspen');
    expect(l.spot).toBeNull();
  });

  it('swaps only the middle obstacle for the biome, and keeps the spot obstacles', () => {
    for (const biome of BIOME_IDS)
      for (const spot of SPOT_IDS) {
        const l = buildLayout({ biome, spot });
        const bySpot = layoutForSpot(spot);
        expect(l.terrain.obstacles[0]).toEqual(BIOMES[biome].obstacle);
        expect(l.terrain.obstacles.slice(1)).toEqual(bySpot.terrain.obstacles.slice(1));
        expect(l.bases).toEqual(bySpot.bases);
        expect(l.launchOrigins).toEqual(bySpot.launchOrigins);
        expect(l.biome).toBe(biome);
        expect(l.spot).toBe(spot);
      }
  });

  it('never changes the Phase 1 object', () => {
    const before = JSON.stringify(PHASE1_LAYOUT);
    for (const biome of BIOME_IDS) for (const spot of SPOT_IDS) buildLayout({ biome, spot });
    expect(JSON.stringify(PHASE1_LAYOUT)).toBe(before);
  });

  for (const biome of BIOME_IDS)
    for (const spot of SPOT_IDS) {
      it(`${biome} + ${spot}: both teams can score a direct hit with no wind`, () => {
        const l = buildLayout({ biome, spot });
        expect(canScore(l, 'PAST', 0)).toBe(true);
        expect(canScore(l, 'FUTURE', 0)).toBe(true);
      });
      it(`${biome} + ${spot}: both teams can score in strong wind both ways`, () => {
        const l = buildLayout({ biome, spot });
        for (const wind of [-80, 80]) {
          expect(canScore(l, 'PAST', wind, 'direct') || canScore(l, 'PAST', wind, 'near')).toBe(
            true,
          );
          expect(canScore(l, 'FUTURE', wind, 'direct') || canScore(l, 'FUTURE', wind, 'near')).toBe(
            true,
          );
        }
      });
    }
});

describe('fighters that ride the base', () => {
  it('only the Future fighters standing on the base ride it', () => {
    expect(
      unitsOf('FUTURE')
        .filter(ridesBase)
        .map((u) => u.id),
    ).toEqual(['1', '5']);
  });

  it('the default fighter always uses the layout launcher', () => {
    const l = buildLayout({ biome: 'aspen', spot: 'skyscraper' });
    expect(unitOrigin(l, unit('1'))).toEqual(l.launchOrigins.FUTURE);
    expect(unitOrigin(l, unit('C'))).toEqual(l.launchOrigins.PAST);
  });

  it('a rider moves with the base, a ground fighter stays put', () => {
    const l = buildLayout({ biome: 'aspen', spot: 'skyscraper' });
    expect(unitOrigin(l, unit('5'))).toEqual({ x: 1130, y: 440 - 160 });
    expect(unitOrigin(l, unit('3'))).toEqual(unit('3').origin);
    expect(unitOrigin(l, unit('4'))).toEqual(unit('4').origin);
    expect(unitOrigin(l, unit('B'))).toEqual(unit('B').origin);
  });

  it('with no spot, every fighter keeps its own origin', () => {
    for (const u of [...unitsOf('PAST'), ...unitsOf('FUTURE')]) {
      if (u.id === 'C' || u.id === '1') continue;
      expect(unitOrigin(PHASE1_LAYOUT, u)).toEqual(u.origin);
    }
  });

  it('no fighter starts inside a solid shape at any spot', () => {
    for (const spot of SPOT_IDS)
      for (const biome of BIOME_IDS) {
        const l = buildLayout({ biome, spot });
        for (const u of [...unitsOf('PAST'), ...unitsOf('FUTURE')]) {
          const r = simulateShot({
            angleDeg: 45,
            power: 0,
            wind: 0,
            origin: unitOrigin(l, u),
            facing: TEAM_FACING[u.team],
            layout: l,
          });
          // Power 0 drops straight down. It must not start buried (zero steps).
          expect(r.steps, `${biome} ${spot} ${u.id}`).toBeGreaterThan(0);
        }
      }
  });
});

describe('withWalls', () => {
  it('adds a wall as one more obstacle and changes nothing else', () => {
    const wall = EVASION.barricade.wall;
    const l = withWalls(PHASE1_LAYOUT, [wall]);
    expect(l.terrain.obstacles).toHaveLength(PHASE1_LAYOUT.terrain.obstacles.length + 1);
    expect(l.bases).toBe(PHASE1_LAYOUT.bases);
    expect(withWalls(PHASE1_LAYOUT, [])).toBe(PHASE1_LAYOUT);
  });

  it('the barricade wall sits inside the world, clear of both bases', () => {
    const wall = EVASION.barricade.wall;
    expect(inside(wall)).toBe(true);
    for (const t of ['PAST', 'FUTURE'] as const) {
      const b = PHASE1_LAYOUT.bases[t];
      expect(wall.x + wall.w <= b.x || b.x + b.w <= wall.x).toBe(true);
    }
  });
});
