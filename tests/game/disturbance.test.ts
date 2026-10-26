// Birds, gusts and recoil (DISTURBANCE in config.ts). Pure functions of the seed, the turn and time.
import { describe, expect, it } from 'vitest';
import { AIM, DISTURBANCE, WORLD } from '../../src/game/config';
import {
  birdAt,
  birdsForTurn,
  gustForTurn,
  gustPushAt,
  gustStartMs,
  kickAim,
  levelForTurn,
  levelScale,
  recoilFor,
  recoilLimit,
  type DisturbanceLevel,
} from '../../src/game/disturbance';
import { UNITS } from '../../src/game/units';

const B = DISTURBANCE.birds;
const G = DISTURBANCE.gust;
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 3);

describe('birdsForTurn', () => {
  it('is the same for the same seed and turn', () => {
    expect(birdsForTurn(42, 3)).toEqual(birdsForTurn(42, 3));
  });

  it('changes from turn to turn', () => {
    const turns = Array.from({ length: 8 }, (_, t) => JSON.stringify(birdsForTurn(42, t)));
    expect(new Set(turns).size).toBeGreaterThan(4);
  });

  it('has one to three birds (as many as the level allows), in the sky band at a gentle speed', () => {
    const counts = new Set<number>();
    for (const seed of SEEDS) {
      for (let turn = 0; turn < 6; turn++) {
        const birds = birdsForTurn(seed, turn);
        const [lo, hi] = DISTURBANCE.levels[levelForTurn(seed, turn)].birdCount;
        counts.add(birds.length);
        expect(birds.length).toBeGreaterThanOrEqual(Math.max(B.minCount, lo));
        expect(birds.length).toBeLessThanOrEqual(Math.min(B.maxCount, hi));
        for (const b of birds) {
          expect(b.y0).toBeGreaterThanOrEqual(B.minY);
          expect(b.y0).toBeLessThanOrEqual(B.maxY);
          expect(Math.abs(b.vx)).toBeGreaterThanOrEqual(B.minSpeed);
          expect(Math.abs(b.vx)).toBeLessThanOrEqual(B.maxSpeed);
        }
      }
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
  });

  it('flies both ways, about as often (fair to both teams)', () => {
    let right = 0;
    let all = 0;
    for (const seed of SEEDS)
      for (let turn = 0; turn < 10; turn++)
        for (const b of birdsForTurn(seed, turn)) {
          all += 1;
          if (b.vx > 0) right += 1;
        }
    expect(right / all).toBeGreaterThan(0.4);
    expect(right / all).toBeLessThan(0.6);
  });

  it('birds in one turn all start apart, even three of them', () => {
    let threes = 0;
    for (const seed of SEEDS)
      for (let turn = 0; turn < 6; turn++) {
        const birds = birdsForTurn(seed, turn, 'high');
        if (birds.length === 3) threes += 1;
        for (const a of birds) {
          expect(a.x0).toBeGreaterThanOrEqual(-B.edgeMarginPx);
          expect(a.x0).toBeLessThanOrEqual(WORLD.width + B.edgeMarginPx);
          for (const b of birds)
            if (a !== b) expect(Math.abs(a.x0 - b.x0)).toBeGreaterThanOrEqual(B.minGapPx);
        }
      }
    expect(threes).toBeGreaterThan(0);
  });

  it('bad seeds or turns still give birds', () => {
    expect(birdsForTurn(Number.NaN, 0).length).toBeGreaterThan(0);
    expect(birdsForTurn(1, -5).length).toBeGreaterThan(0);
  });
});

describe('birdAt', () => {
  const bird = birdsForTurn(7, 0)[0]!;

  it('starts where the path starts (plus its bob)', () => {
    const p = birdAt(bird, 0);
    expect(p.x).toBeCloseTo(bird.x0, 6);
    expect(Math.abs(p.y - bird.y0)).toBeLessThanOrEqual(B.bobPx + 1e-9);
  });

  it('moves at its speed and stays inside the band and the wrap span', () => {
    for (let ms = 0; ms < 60_000; ms += 250) {
      const p = birdAt(bird, ms);
      expect(p.x).toBeGreaterThanOrEqual(-B.edgeMarginPx);
      expect(p.x).toBeLessThanOrEqual(WORLD.width + B.edgeMarginPx);
      expect(p.y).toBeGreaterThanOrEqual(B.minY - B.bobPx);
      expect(p.y).toBeLessThanOrEqual(B.maxY + B.bobPx);
    }
    const a = birdAt(bird, 1000);
    const b = birdAt(bird, 1100);
    // A short step away from the wrap edge moves vx / 10 px.
    if (Math.abs(b.x - a.x) < 100) expect(b.x - a.x).toBeCloseTo(bird.vx / 10, 6);
  });

  it('wraps around and comes back (a bird is always flying somewhere)', () => {
    const span = WORLD.width + 2 * B.edgeMarginPx;
    const period = (span / Math.abs(bird.vx)) * 1000;
    expect(birdAt(bird, period).x).toBeCloseTo(birdAt(bird, 0).x, 3);
  });

  it('treats a bad time as the start', () => {
    expect(birdAt(bird, Number.NaN)).toEqual(birdAt(bird, 0));
    expect(birdAt(bird, -10)).toEqual(birdAt(bird, 0));
  });
});

describe('gustForTurn', () => {
  it('is the same for the same seed and turn, and is inside the config window', () => {
    expect(gustForTurn(9, 2)).toEqual(gustForTurn(9, 2));
    for (const seed of SEEDS)
      for (let turn = 0; turn < 6; turn++) {
        const g = gustForTurn(seed, turn);
        const k = DISTURBANCE.levels[levelForTurn(seed, turn)].push;
        expect(g.level).toBe(levelForTurn(seed, turn));
        expect(g.startShare).toBeGreaterThanOrEqual(G.earliestShare);
        expect(g.startShare).toBeLessThanOrEqual(G.latestShare);
        expect(g.durationMs).toBe(G.durationMs);
        expect(Math.abs(g.push)).toBeGreaterThanOrEqual(G.minPush * k - 1e-9);
        expect(Math.abs(g.push)).toBeLessThanOrEqual(G.maxPush * k + 1e-9);
      }
  });

  it('blows both ways about as often (fair to both teams)', () => {
    let right = 0;
    let all = 0;
    for (const seed of SEEDS)
      for (let turn = 0; turn < 10; turn++) {
        all += 1;
        if (gustForTurn(seed, turn).push > 0) right += 1;
      }
    expect(right / all).toBeGreaterThan(0.4);
    expect(right / all).toBeLessThan(0.6);
  });

  it('starts a share of the way through the flight, and pushes only while it blows', () => {
    const g = gustForTurn(9, 2);
    const flight = 2000;
    const start = gustStartMs(g, flight);
    expect(start).toBeCloseTo(g.startShare * flight, 9);
    expect(gustPushAt(g, start - 1, flight)).toBe(0);
    expect(gustPushAt(g, start, flight)).toBe(g.push);
    expect(gustPushAt(g, start + g.durationMs - 1, flight)).toBe(g.push);
    expect(gustPushAt(g, start + g.durationMs, flight)).toBe(0);
    expect(gustPushAt(null, start, flight)).toBe(0);
  });

  it('a fast flat shot meets the gust as surely as a lob: the start scales with the flight', () => {
    const g = gustForTurn(9, 2);
    expect(gustStartMs(g, 1000)).toBeLessThan(gustStartMs(g, 3000));
    expect(gustStartMs(g, 1000)).toBeLessThan(1000 * G.latestShare + 1e-9);
    expect(gustStartMs(g, Number.NaN)).toBe(0);
  });
});

describe('recoil', () => {
  it('has a row for every fighter role, and mirror pairs share it', () => {
    for (const u of UNITS) expect(DISTURBANCE.recoil[u.role], u.role).toBeDefined();
    const pairs = [
      ['balloon', 'helicopter'],
      ['archer', 'laserGun'],
      ['cannon', 'tank'],
      ['catapult', 'bunker'],
      ['spear', 'saber'],
    ] as const;
    for (const [a, b] of pairs) expect(DISTURBANCE.recoil[a]).toEqual(DISTURBANCE.recoil[b]);
  });

  it('heavy weapons kick more than the archer, about 3 degrees and 5 power at most (low level)', () => {
    const r = DISTURBANCE.recoil;
    expect(r.catapult.angleDeg).toBeGreaterThan(r.archer.angleDeg);
    expect(r.catapult.power).toBeGreaterThan(r.archer.power);
    for (const v of Object.values(r)) {
      expect(v.angleDeg).toBeLessThanOrEqual(3);
      expect(v.power).toBeLessThanOrEqual(5);
    }
  });

  it('is seeded: same seed, turn, shot and role, same kick', () => {
    expect(recoilFor(5, 1, 0, 'cannon')).toEqual(recoilFor(5, 1, 0, 'cannon'));
  });

  it('stays inside the role limits, in whole steps, and spreads both ways', () => {
    const seen = new Set<number>();
    for (const seed of SEEDS)
      for (let shot = 0; shot < 3; shot++) {
        const k = recoilFor(seed, 2, shot, 'catapult');
        const limit = recoilLimit('catapult', levelForTurn(seed, 2))!;
        expect(Number.isInteger(k.angleDeg)).toBe(true);
        expect(Number.isInteger(k.power)).toBe(true);
        expect(Math.abs(k.angleDeg)).toBeLessThanOrEqual(limit.angleDeg);
        expect(Math.abs(k.power)).toBeLessThanOrEqual(limit.power);
        seen.add(Math.sign(k.power));
      }
    expect(seen.has(1) && seen.has(-1)).toBe(true);
  });

  it('kicks the heavy catapult more on average than the archer', () => {
    const mean = (role: 'catapult' | 'archer') =>
      SEEDS.reduce((s, seed) => {
        const k = recoilFor(seed, 0, 0, role);
        return s + Math.abs(k.angleDeg) + Math.abs(k.power);
      }, 0) / SEEDS.length;
    expect(mean('catapult')).toBeGreaterThan(mean('archer') * 2);
  });

  it('an unknown role gives no kick', () => {
    expect(recoilFor(5, 1, 0, 'nope' as never)).toEqual({ angleDeg: 0, power: 0 });
  });

  it('kickAim always stays inside the AIM limits', () => {
    expect(kickAim({ angleDeg: 89, power: 99 }, { angleDeg: 3, power: 5 })).toEqual({
      angleDeg: AIM.angleMaxDeg,
      power: AIM.powerMax,
    });
    expect(kickAim({ angleDeg: 1, power: 2 }, { angleDeg: -3, power: -5 })).toEqual({
      angleDeg: AIM.angleMinDeg,
      power: AIM.powerMin,
    });
    expect(kickAim({ angleDeg: 45, power: 60 }, { angleDeg: 2, power: -3 })).toEqual({
      angleDeg: 47,
      power: 57,
    });
  });
});

describe('the turn level (low, medium or high)', () => {
  const LEVELS = DISTURBANCE.levelOrder;

  it('is the same for the same seed and turn', () => {
    for (const seed of SEEDS)
      for (let turn = 0; turn < 6; turn++)
        expect(levelForTurn(seed, turn)).toBe(levelForTurn(seed, turn));
  });

  it('is low, medium or high a third of the time each (3,000 seeds, within 5%)', () => {
    const counts: Record<DisturbanceLevel, number> = { low: 0, medium: 0, high: 0 };
    for (let seed = 1; seed <= 3000; seed++) counts[levelForTurn(seed, 0)] += 1;
    for (const lv of LEVELS) {
      expect(counts[lv], lv).toBeGreaterThanOrEqual(1000 * 0.95);
      expect(counts[lv], lv).toBeLessThanOrEqual(1000 * 1.05);
    }
    // And over the turns of one match too.
    const byTurn: Record<DisturbanceLevel, number> = { low: 0, medium: 0, high: 0 };
    for (let turn = 0; turn < 3000; turn++) byTurn[levelForTurn(777, turn)] += 1;
    for (const lv of LEVELS) {
      expect(byTurn[lv], lv).toBeGreaterThanOrEqual(1000 * 0.95);
      expect(byTurn[lv], lv).toBeLessThanOrEqual(1000 * 1.05);
    }
  });

  it('changes from turn to turn', () => {
    const seen = new Set(Array.from({ length: 12 }, (_, t) => levelForTurn(42, t)));
    expect(seen.size).toBe(3);
  });

  it('bad seeds or turns still give a level', () => {
    expect(LEVELS).toContain(levelForTurn(Number.NaN, 0));
    expect(LEVELS).toContain(levelForTurn(1, -5));
  });

  it('low is the old mild setting, medium clearly stronger, high strongest', () => {
    const L = DISTURBANCE.levels;
    expect(L.low.nudge).toBe(1);
    expect(L.low.recoil).toBe(1);
    expect(L.low.push).toBeLessThanOrEqual(1.2);
    for (const key of ['push', 'nudge', 'recoil'] as const) {
      expect(L.medium[key], key).toBeGreaterThanOrEqual(L.low[key] * 1.5);
      expect(L.high[key], key).toBeGreaterThan(L.medium[key]);
    }
    expect(L.high.birdCount[1]).toBeGreaterThan(L.low.birdCount[0]);
    expect(levelScale(undefined)).toEqual(L.low);
  });

  it('the gust push grows with the level, same start and way', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const g = Object.fromEntries(LEVELS.map((lv) => [lv, gustForTurn(seed, 3, lv)]));
      for (const lv of LEVELS) {
        expect(g[lv]!.level).toBe(lv);
        expect(g[lv]!.startShare).toBe(g.low!.startShare);
        expect(Math.sign(g[lv]!.push)).toBe(Math.sign(g.low!.push));
        expect(Math.abs(g[lv]!.push)).toBeCloseTo(
          (Math.abs(g.low!.push) / DISTURBANCE.levels.low.push) * DISTURBANCE.levels[lv].push,
          6,
        );
      }
    }
  });

  it('the bird nudge grows with the level, and the count stays inside the level range', () => {
    for (const lv of LEVELS) {
      const [lo, hi] = DISTURBANCE.levels[lv].birdCount;
      for (const seed of SEEDS) {
        const birds = birdsForTurn(seed, 1, lv);
        expect(birds.length).toBeGreaterThanOrEqual(lo);
        expect(birds.length).toBeLessThanOrEqual(hi);
        for (const b of birds)
          expect(b.nudgeDeg).toBeCloseTo(B.nudgeDeg * DISTURBANCE.levels[lv].nudge, 9);
      }
    }
  });

  it('the recoil limits grow with the level, whole numbers, and the kick stays inside them', () => {
    for (const u of UNITS) {
      const low = recoilLimit(u.role, 'low')!;
      const high = recoilLimit(u.role, 'high')!;
      expect(low).toEqual(DISTURBANCE.recoil[u.role]);
      expect(high.angleDeg).toBeGreaterThan(low.angleDeg);
      expect(high.power).toBeGreaterThan(low.power);
      for (const lv of LEVELS) {
        const lim = recoilLimit(u.role, lv)!;
        expect(Number.isInteger(lim.angleDeg) && Number.isInteger(lim.power)).toBe(true);
        for (const seed of SEEDS.slice(0, 15)) {
          const k = recoilFor(seed, 0, 1, u.role, lv);
          expect(Math.abs(k.angleDeg)).toBeLessThanOrEqual(lim.angleDeg);
          expect(Math.abs(k.power)).toBeLessThanOrEqual(lim.power);
        }
      }
    }
    expect(recoilLimit('nope' as never, 'high')).toBeNull();
  });

  it('the default level is the turn level, for birds, gust and recoil alike', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const lv = levelForTurn(seed, 4);
      expect(birdsForTurn(seed, 4)).toEqual(birdsForTurn(seed, 4, lv));
      expect(gustForTurn(seed, 4)).toEqual(gustForTurn(seed, 4, lv));
      expect(recoilFor(seed, 4, 1, 'cannon')).toEqual(recoilFor(seed, 4, 1, 'cannon', lv));
    }
  });
});
