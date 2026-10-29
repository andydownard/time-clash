// Built bases are drawn big (owner reports, 2026-10-28: "still too small"), so every castle place
// and Austin spot gets a room for the base and a footing under it (BUILT_PLACES in config.ts).
// This file checks the places as a whole: the shapes keep their pictures, no fighter starts inside
// a shape, every side can still reach the other base, and perfect aim still needs five turns.
import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../src/game/battlefield';
import { fitLayout } from '../../src/game/builtBase';
import { playBotMatch } from '../../src/game/botPlay';
import { PRACTICE_BOT, type BotProfile } from '../../src/game/config';
import { createMatch } from '../../src/game/match';
import { unitOrigin } from '../../src/game/battlefield';
import { UNITS } from '../../src/game/units';
import type { BattleLayout, Team } from '../../src/game/types';
import { insidePolygon, obstacleKinds } from '../../src/scenes/battle/obstacleArt';
import { SIZES } from '../helpers/builtBases';
import { PLAYERS } from '../scenes/battle/flowHarness';

const PLANS = [
  { biome: 'aspen', fort: null, spot: null },
  { biome: 'aspen', fort: 'hillFort', spot: 'skyscraper' },
  { biome: 'cherry', fort: 'villageWall', spot: 'foodTruck' },
  { biome: 'temple', fort: 'drawbridge', spot: 'bridge' },
] as const;

const both = { PAST: true, FUTURE: true } as const;

describe('every place with a built base', () => {
  for (const plan of PLANS) {
    const name = `${plan.fort ?? 'phase 1'} and ${plan.spot ?? 'phase 1'}`;
    const flat = buildLayout(plan);
    const fitted = fitLayout(flat, both);

    it(`${name}: the shapes keep their pictures and their number`, () => {
      expect(obstacleKinds(fitted)).toEqual(obstacleKinds(flat));
      expect(fitted.terrain.obstacles).toHaveLength(flat.terrain.obstacles.length);
      // The middle shape and the ground are never touched.
      expect(fitted.terrain.obstacles[0]).toEqual(flat.terrain.obstacles[0]);
      expect(fitted.terrain.ground).toEqual(flat.terrain.ground);
    });

    it(`${name}: no fighter starts inside a shape`, () => {
      for (const u of UNITS) {
        const o = unitOrigin(fitted, u);
        for (const shape of fitted.terrain.obstacles) {
          expect(insidePolygon(shape, o), `${u.id}`).toBe(false);
        }
      }
    });

    it(`${name}: no shape reaches into either base's room`, () => {
      for (const team of ['PAST', 'FUTURE'] as const) {
        const r = fitted.bases[team];
        for (const shape of fitted.terrain.obstacles.slice(1)) {
          const xs = shape.map((p) => p.x);
          const ys = shape.map((p) => p.y);
          // The rock and the tower start at the room's bottom edge: that is standing on them.
          const touches =
            Math.min(...xs) < r.x + r.w &&
            Math.max(...xs) > r.x &&
            Math.min(...ys) < r.y + r.h - 1e-6 &&
            Math.max(...ys) > r.y;
          expect(touches, `${team}`).toBe(false);
        }
      }
    });
  }
});

/** Hits on the other base from one fighter over a coarse sweep of aims (no wind noise). */
function hitsFrom(
  layout: BattleLayout,
  team: Team,
  unit: string,
  size: keyof typeof SIZES,
): number {
  let hits = 0;
  for (let power = 20; power <= 100; power += 10) {
    for (let angle = 10; angle <= 80; angle += 10) {
      const m = createMatch({
        players: PLAYERS,
        seed: 3,
        disturbances: false,
        squads: false,
        characterHealth: false,
        baseInBattle: true,
        firstTeam: team,
        layout,
        bases: { PAST: SIZES[size]('PAST'), FUTURE: SIZES[size]('FUTURE') },
      });
      m.ready();
      m.selectUnit(unit as never);
      m.setAim({ angleDeg: angle, power });
      m.fire();
      if ((m.shotLanded().built?.brickHits.length ?? 0) > 0) hits++;
    }
  }
  return hits;
}

describe('shots can still reach the other base', () => {
  for (const plan of PLANS) {
    for (const size of ['typical', 'huge'] as const) {
      it(`${plan.fort ?? 'phase 1'} and ${plan.spot ?? 'phase 1'}, ${size}: at least three fighters of each team hit it`, () => {
        const layout = buildLayout(plan);
        for (const team of ['PAST', 'FUTURE'] as const) {
          const ids = team === 'PAST' ? ['A', 'B', 'C', 'D', 'E'] : ['1', '2', '3', '4', '5'];
          const able = ids.filter((id) => hitsFrom(layout, team, id, size) > 0);
          expect(able.length, `${team} ${able.join('')}`).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }
});

// Pace (owner rule, 2026-10-24): perfect aim needs five turns of its own, so at least 9 in all.
const PERFECT: BotProfile = {
  angleSpreadDeg: 0,
  powerSpreadPct: 0,
  windSkill: 1,
  reloadAccuracy: 1,
  thinkScale: 1,
};

describe('pace at every place, with a tiny, a typical and a huge base on both sides', () => {
  for (const plan of PLANS) {
    for (const [sname, size] of Object.entries(SIZES)) {
      it(`${plan.fort ?? 'phase 1'} and ${plan.spot ?? 'phase 1'}, ${sname}: no win before turn 9, every match ends`, () => {
        const layout = buildLayout(plan);
        for (const profile of [PERFECT, PRACTICE_BOT.scriptedHuman]) {
          const results = Array.from({ length: 12 }, (_, i) =>
            playBotMatch({
              seed: i + 1,
              firstTeam: (i + 1) % 2 ? 'PAST' : 'FUTURE',
              grade: 3,
              characterHealth: false,
              baseInBattle: true,
              bases: { PAST: size('PAST'), FUTURE: size('FUTURE') },
              layout,
              profiles: { PAST: profile, FUTURE: profile },
            }),
          );
          for (const r of results) expect(r.ended).toBe(true);
          expect(Math.min(...results.map((r) => r.turns))).toBeGreaterThanOrEqual(9);
        }
      }, 120_000);
    }
  }
});
