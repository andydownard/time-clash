// Fighters who stood on the old castle stand on the top brick of a built base (owner,
// 2026-10-25: "Lower them onto the top brick"). When the brick under them falls, they land on
// whatever is below. The shot always leaves from where the fighter stands.
import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../src/game/battlefield';
import { fitLayout } from '../../src/game/builtBase';
import { ARROW_RISE, unitSpot } from '../../src/scenes/battle/unitSpots';
import { BASE_RIDERS, PHASE1_LAYOUT } from '../../src/game/config';
import { chooseShotWith } from '../../src/game/bot';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import {
  RIDER_IDS,
  riderBricks,
  riderDrop,
  riderDrops,
  riderFeet,
  riderOrigin,
  type RiderBrick,
} from '../../src/game/riders';
import type { BattleLayout, MatchOptions, Rect, Team } from '../../src/game/types';
import { UNITS, firingOrigin, ridesBase, unitById } from '../../src/game/units';
import { TINY, TYPICAL, baseOf, brick } from '../helpers/builtBases';
import { PLAYERS } from '../scenes/battle/flowHarness';

const brickAt = (team: Team, box: Rect, alive = true): RiderBrick => ({ team, box, alive });
const floorOf = (layout: BattleLayout, team: Team): number =>
  layout.bases[team].y + layout.bases[team].h;

/** The Archer's foot span, so a test can put a brick right under it. */
function footSpan(id: string, layout: BattleLayout = PHASE1_LAYOUT): { x: number; w: number } {
  const f = riderFeet(unitById(id)!.team, id, layout)!;
  return { x: f.left, w: f.right - f.left };
}

const opts = (bases: MatchOptions['bases']): MatchOptions => ({
  players: PLAYERS,
  seed: 7,
  characterHealth: false,
  baseInBattle: true,
  squads: false,
  disturbances: false,
  bases,
});

describe('who rides the base', () => {
  it('the Archer and Cannon Knight for Team Past, the Tank and Laser Gun Robot for Team Future', () => {
    expect([...RIDER_IDS].sort()).toEqual(['1', '5', 'B', 'C']);
    for (const u of UNITS) expect(RIDER_IDS.includes(u.id)).toBe(ridesBase(u));
  });

  it('every rider has feet in BASE_RIDERS', () => {
    for (const id of RIDER_IDS) expect(BASE_RIDERS.foot[unitById(id)!.role]).toBeDefined();
  });

  it('fliers and ground fighters never move: Balloon, Catapult, Spearman, Helicopter and friends', () => {
    const bricks = [brickAt('PAST', { x: 0, y: 600, w: 1280, h: 20 })];
    for (const u of UNITS.filter((x) => !ridesBase(x))) {
      expect(riderDrop(u.team, u.id, PHASE1_LAYOUT, bricks), u.name).toBe(0);
    }
  });
});

describe('riderDrop: standing on the top brick', () => {
  const L = PHASE1_LAYOUT;

  it('no built base (null bricks): every fighter stands exactly where it did (flat 400)', () => {
    for (const u of UNITS) {
      expect(riderDrop(u.team, u.id, L, null)).toBe(0);
      expect(riderOrigin(u.team, u.id, L, null)).toEqual(firingOrigin(u.team, u.id, L));
    }
  });

  it('stands on the top of the brick under its feet', () => {
    const span = footSpan('B');
    const top = 580;
    const bricks = [brickAt('PAST', { x: span.x, y: top, w: span.w, h: 40 })];
    const o = riderOrigin('PAST', 'B', L, bricks);
    expect(o.x).toBe(firingOrigin('PAST', 'B', L).x);
    expect(o.y + BASE_RIDERS.foot.archer!.b).toBe(top);
  });

  it('picks the highest of the bricks under it, in any order', () => {
    const span = footSpan('B');
    const low = brickAt('PAST', { x: span.x, y: 600, w: span.w, h: 20 });
    const high = brickAt('PAST', { x: span.x + 4, y: 560, w: 10, h: 40 });
    const a = riderDrop('PAST', 'B', L, [low, high]);
    const b = riderDrop('PAST', 'B', L, [high, low]);
    expect(a).toBe(b);
    expect(riderOrigin('PAST', 'B', L, [low, high]).y + BASE_RIDERS.foot.archer!.b).toBe(560);
  });

  it('a brick beside its feet does not hold it up', () => {
    const span = footSpan('B');
    const beside = brickAt('PAST', { x: span.x + span.w + 1, y: 500, w: 30, h: 120 });
    expect(riderOrigin('PAST', 'B', L, [beside]).y + BASE_RIDERS.foot.archer!.b).toBe(
      floorOf(L, 'PAST'),
    );
  });

  it('no brick under it: it stands on the ground under the base', () => {
    for (const id of RIDER_IDS) {
      const team = unitById(id)!.team;
      const o = riderOrigin(team, id, L, []);
      expect(o.y + BASE_RIDERS.foot[unitById(id)!.role]!.b, id).toBe(floorOf(L, team));
    }
  });

  it('the other side’s bricks and fallen bricks never hold it up', () => {
    const span = footSpan('B');
    const theirs = brickAt('FUTURE', { x: span.x, y: 560, w: span.w, h: 60 });
    const fallen = brickAt('PAST', { x: span.x, y: 560, w: span.w, h: 60 }, false);
    expect(riderDrop('PAST', 'B', L, [theirs, fallen])).toBe(riderDrop('PAST', 'B', L, []));
  });

  it('stands on a tall base, up to BASE_RIDERS.maxRise higher than on the old castle', () => {
    const span = footSpan('B');
    const feet = riderFeet('PAST', 'B', L)!;
    const tall = brickAt('PAST', { x: span.x, y: feet.y - 100, w: span.w, h: 150 });
    expect(riderDrop('PAST', 'B', L, [tall])).toBeCloseTo(-100, 6);
    expect(riderOrigin('PAST', 'B', L, [tall]).y).toBeCloseTo(
      firingOrigin('PAST', 'B', L).y - 100,
      6,
    );
    const tower = brickAt('PAST', { x: span.x, y: 0, w: span.w, h: 600 });
    expect(riderDrop('PAST', 'B', L, [tower])).toBe(-BASE_RIDERS.maxRise);
  });

  it('on the tallest base of every place the fighter and its tag stay under the team cards', () => {
    // The cards end about y 126 in world px. A rider stands on the top of its room at most.
    const cardBottom = 126;
    const fort = ['hillFort', 'villageWall', 'drawbridge', null] as const;
    const spot = ['skyscraper', 'foodTruck', 'bridge', null] as const;
    for (const [i, f] of fort.entries()) {
      const l = fitLayout(buildLayout({ biome: 'aspen', fort: f, spot: spot[i]! }), {
        PAST: true,
        FUTURE: true,
      });
      for (const id of RIDER_IDS) {
        const team = unitById(id)!.team;
        const room = l.bases[team];
        const feet = riderFeet(team, id, l)!;
        const top = {
          team,
          box: { x: feet.left - 5, y: room.y, w: feet.right - feet.left + 10, h: 50 },
          alive: true,
        };
        const d = riderDrop(team, id, l, [top]);
        expect(d, `${f} ${id}`).toBeGreaterThanOrEqual(-BASE_RIDERS.maxRise);
        const spotBox = unitSpot(unitById(id)!);
        // The token and the selected arrow sit above the drawing, which stands `d` lower.
        const arrowTop = spotBox.arrowTip.y - ARROW_RISE + d;
        expect(arrowTop, `${f} ${id}`).toBeGreaterThanOrEqual(cardBottom);
      }
    }
  });

  it('moves with the castle place and the Austin spot', () => {
    for (const plan of [
      { biome: 'aspen' as const, spot: 'skyscraper' as const, fort: 'hillFort' as const },
      { biome: 'aspen' as const, spot: 'bridge' as const, fort: 'drawbridge' as const },
    ]) {
      const l = buildLayout(plan);
      for (const id of RIDER_IDS) {
        const team = unitById(id)!.team;
        const o = riderOrigin(team, id, l, []);
        expect(o.y + BASE_RIDERS.foot[unitById(id)!.role]!.b, `${plan.fort} ${id}`).toBe(
          floorOf(l, team),
        );
        expect(o.x).toBe(firingOrigin(team, id, l).x);
      }
    }
  });

  it('a brick that falls drops it to the brick below (the fall target)', () => {
    const span = footSpan('B');
    const lower = brickAt('PAST', { x: span.x, y: 600, w: span.w, h: 20 });
    const upper = brickAt('PAST', { x: span.x, y: 570, w: span.w, h: 30 });
    const before = riderDrop('PAST', 'B', L, [lower, upper]);
    const after = riderDrop('PAST', 'B', L, [lower, { ...upper, alive: false }]);
    expect(after - before).toBe(30);
  });
});

describe('riderBricks and riderDrops from a match', () => {
  it('only in base health mode with a built base', () => {
    const plain = createMatch({ players: PLAYERS, seed: 7, characterHealth: false });
    expect(riderBricks(plain.snapshot(), 'PAST')).toBeNull();
    expect(riderDrops(plain.snapshot(), plain.layout)).toEqual({});
    const built = createMatch(opts({ PAST: TINY('PAST') }));
    expect(riderBricks(built.snapshot(), 'PAST')!.length).toBe(1);
    expect(riderBricks(built.snapshot(), 'FUTURE')).toBeNull();
    const ch = createMatch({ ...opts({ PAST: TINY('PAST') }), characterHealth: true });
    expect(riderBricks(ch.snapshot(), 'PAST')).toBeNull();
  });

  it('a small base lowers its riders; the other side stays put', () => {
    const m = createMatch(opts({ PAST: TINY('PAST') }));
    const drops = riderDrops(m.snapshot(), m.layout);
    expect(drops.B).toBeGreaterThan(0);
    expect(drops.C).toBeGreaterThan(0);
    expect(drops['1']).toBeUndefined();
    expect(drops['5']).toBeUndefined();
  });

  it('is the same every time (deterministic)', () => {
    const a = createMatch(opts({ PAST: TYPICAL('PAST'), FUTURE: TYPICAL('FUTURE') }));
    const b = createMatch(opts({ PAST: TYPICAL('PAST'), FUTURE: TYPICAL('FUTURE') }));
    expect(riderDrops(a.snapshot(), a.layout)).toEqual(riderDrops(b.snapshot(), b.layout));
  });
});

describe('the shot leaves from where the rider stands', () => {
  it('the default Cannon Knight on a small base fires from the plank top', () => {
    const m = createMatch(opts({ PAST: TINY('PAST') }));
    m.ready();
    const want = riderOrigin('PAST', 'C', m.layout, riderBricks(m.snapshot(), 'PAST'));
    expect(want.y).toBeGreaterThan(firingOrigin('PAST', 'C', m.layout).y);
    expect(m.previewShot().path[0]).toEqual(want);
    expect(m.fire().path[0]).toEqual(want);
  });

  it('the Laser Gun Robot on Team Future’s base, too', () => {
    const m = createMatch({ ...opts({ FUTURE: TINY('FUTURE') }), firstTeam: 'FUTURE' });
    m.ready();
    m.selectUnit('5');
    const want = riderOrigin('FUTURE', '5', m.layout, riderBricks(m.snapshot(), 'FUTURE'));
    expect(m.fire().path[0]).toEqual(want);
  });

  it('after its brick falls, the next shot leaves from the lower spot', () => {
    // Two thin bricks stacked under the Cannon Knight: knock the top one out by hand-made damage.
    const bases = {
      PAST: baseOf([brick('plank', 10, 10, 10), brick('plank', 10, 9, 10)]),
    };
    const m = createMatch(opts(bases));
    const bricks = riderBricks(m.snapshot(), 'PAST')!;
    const top = [...bricks].sort((a, b) => a.box.y - b.box.y)[0]!;
    const before = riderOrigin('PAST', 'C', m.layout, bricks);
    const after = riderOrigin(
      'PAST',
      'C',
      m.layout,
      bricks.map((b) => (b === top ? { ...b, alive: false } : b)),
    );
    expect(after.y).toBeGreaterThanOrEqual(before.y);
  });

  it('no built base: the shot starts at the layout launcher, as before', () => {
    const m = createMatch({ players: PLAYERS, seed: 7, characterHealth: false });
    m.ready();
    expect(m.fire().path[0]).toEqual(PHASE1_LAYOUT.launchOrigins.PAST);
  });
});

describe('the Computer player aims from where the rider stands', () => {
  it('a perfect shot from a lowered Cannon Knight lands on the bricks, not the middle hill', () => {
    // Regression: the bot read the rider's spot on its flight copy of the field (base boxes moved
    // away), aimed from the old castle spot, and every shot hit the middle shape.
    const perfect = {
      angleSpreadDeg: 0,
      powerSpreadPct: 0,
      windSkill: 1,
      reloadAccuracy: 1,
      thinkScale: 1,
    };
    for (let seed = 1; seed <= 5; seed++) {
      const m = createMatch({
        ...opts({ PAST: TYPICAL('PAST'), FUTURE: TYPICAL('FUTURE') }),
        seed,
      });
      m.ready();
      const shot = chooseShotWith(m.snapshot(), 'PAST', perfect, createRng(seed));
      m.setAim(shot);
      const r = m.fire();
      expect(r.hit.kind, `seed ${seed}`).not.toBe('obstacle');
      expect(m.shotLanded().result, `seed ${seed}`).not.toBe('miss');
    }
  });
});
