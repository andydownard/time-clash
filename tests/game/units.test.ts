// The ten fighters: five per side, mirrored for fairness.
import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import {
  AIM,
  BASES,
  DAMAGE,
  LAUNCH_ORIGINS,
  TEAM_FACING,
  TERRAIN,
  WORLD,
} from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import { DEFAULT_UNIT, UNITS, firingOrigin, unitById, unitsOf } from '../../src/game/units';
import { TEAMS, otherTeam } from '../../src/game/types';
import { windForTurn } from '../../src/game/wind';

const PAIRS: Array<[string, string]> = [
  ['A', '2'],
  ['B', '5'],
  ['C', '1'],
  ['D', '3'],
  ['E', '4'],
];

describe('the roster', () => {
  it('has five fighters per side with the board ids', () => {
    expect(unitsOf('PAST').map((u) => u.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(unitsOf('FUTURE').map((u) => u.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(UNITS).toHaveLength(10);
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(10);
  });

  it('has the right roles', () => {
    const roles = Object.fromEntries(UNITS.map((u) => [u.id, u.role]));
    expect(roles).toEqual({
      A: 'balloon',
      B: 'archer',
      C: 'cannon',
      D: 'catapult',
      E: 'spear',
      '1': 'tank',
      '2': 'helicopter',
      '3': 'bunker',
      '4': 'saber',
      '5': 'laserGun',
    });
  });

  it('defaults to the cannon knight and the tank', () => {
    expect(DEFAULT_UNIT).toEqual({ PAST: 'C', FUTURE: '1' });
  });

  it('default fighters use the old launchers exactly, with no change to range or damage', () => {
    for (const t of TEAMS) {
      const u = unitById(DEFAULT_UNIT[t]);
      expect(u?.origin).toEqual(LAUNCH_ORIGINS[t]);
      expect(u?.speedScale).toBe(1);
      expect(u?.damageScale).toBe(1);
    }
  });

  it('looks fighters up and returns null for a stranger', () => {
    expect(unitById('B')?.name).toBe('Archer');
    expect(unitById('Z')).toBeNull();
    expect(unitById('')).toBeNull();
  });

  it('gives every fighter a name a child can read and no scary words', () => {
    for (const u of UNITS) {
      expect(u.name.length).toBeGreaterThan(0);
      expect(u.name).not.toMatch(/kill|die|dead|blood|gore|defeat|buy|price/i);
    }
  });

  it.each(PAIRS)('mirror pair %s and %s have equal stats', (a, b) => {
    const ua = unitById(a)!;
    const ub = unitById(b)!;
    expect(ua.team).not.toBe(ub.team);
    expect(ua.speedScale).toBe(ub.speedScale);
    expect(ua.damageScale).toBe(ub.damageScale);
  });

  it.each(UNITS.map((u) => [u.id, u] as const))(
    '%s starts outside both bases and above ground',
    (_id, u) => {
      expect(u.origin.y).toBeLessThan(TERRAIN.groundY);
      expect(u.origin.x).toBeGreaterThan(0);
      expect(u.origin.x).toBeLessThan(WORLD.width);
      for (const t of TEAMS) {
        const r = BASES[t];
        const inside =
          u.origin.x >= r.x &&
          u.origin.x <= r.x + r.w &&
          u.origin.y >= r.y &&
          u.origin.y <= r.y + r.h;
        expect(inside, `${u.id} inside ${t} base`).toBe(false);
      }
    },
  );

  it('keeps every fighter on its own half of the field', () => {
    for (const u of UNITS) {
      if (u.team === 'PAST') expect(u.origin.x).toBeLessThan(WORLD.width / 2);
      else expect(u.origin.x).toBeGreaterThan(WORLD.width / 2);
    }
  });
});

describe('every fighter can score a direct hit on the enemy base', () => {
  it.each(UNITS.map((u) => [u.id, u] as const))('%s', (_id, u) => {
    const target = BASES[otherTeam(u.team)];
    // Try a few winds, including the strongest against the shot.
    const winds = [0, windForTurn(1, 0), windForTurn(2, 1)];
    for (const wind of winds) {
      let found = false;
      for (let power = 100; power >= 0 && !found; power--) {
        for (let angleDeg = AIM.angleMinDeg; angleDeg <= AIM.angleMaxDeg && !found; angleDeg++) {
          const r = simulateShot({
            angleDeg,
            power,
            wind,
            origin: u.origin,
            facing: TEAM_FACING[u.team],
            layout: {
              width: WORLD.width,
              height: WORLD.height,
              terrain: { ground: TERRAIN.ground, obstacles: [TERRAIN.hill] },
              bases: BASES,
              launchOrigins: LAUNCH_ORIGINS,
            },
            speedScale: u.speedScale,
          });
          if (r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout') continue;
          if (classifyBlast(r.landing, target) === 'direct') found = true;
        }
      }
      expect(found, `${u.id} at wind ${wind}`).toBe(true);
    }
    expect(DAMAGE.directRadius).toBeGreaterThan(0);
  });
});

describe('firingOrigin', () => {
  const layout = { launchOrigins: LAUNCH_ORIGINS };
  it('gives the default fighter the layout launcher, even if the layout moves it', () => {
    for (const team of TEAMS) {
      expect(firingOrigin(team, DEFAULT_UNIT[team], layout)).toEqual(LAUNCH_ORIGINS[team]);
      const moved = { launchOrigins: { ...LAUNCH_ORIGINS, [team]: { x: 7, y: 9 } } };
      expect(firingOrigin(team, DEFAULT_UNIT[team], moved)).toEqual({ x: 7, y: 9 });
    }
  });
  it('gives every other fighter its own spot (balloon, archer, catapult, spear, helicopter, bunkers, saber, laser)', () => {
    for (const u of UNITS) {
      if (u.id === DEFAULT_UNIT[u.team]) continue;
      expect(firingOrigin(u.team, u.id, layout)).toEqual(u.origin);
    }
  });
  it('keeps the mirrored facing: Past fires from the left half, Future from the right', () => {
    for (const u of UNITS) {
      const o = firingOrigin(u.team, u.id, layout);
      expect(TEAM_FACING[u.team] === 1 ? o.x < WORLD.width / 2 : o.x > WORLD.width / 2).toBe(true);
    }
  });
  it('falls back to the launcher for an unknown fighter or one from the other team', () => {
    expect(firingOrigin('PAST', 'nope', layout)).toEqual(LAUNCH_ORIGINS.PAST);
    expect(firingOrigin('PAST', '2', layout)).toEqual(LAUNCH_ORIGINS.PAST);
  });
});
