import { describe, expect, it } from 'vitest';
import { BASES, PHASE1_LAYOUT, WORLD } from '../../../src/game/config';
import { UNITS } from '../../../src/game/units';
import { characterSpot } from '../../../src/scenes/battle/geometry';
import {
  CHRONO_SCALE,
  TOKEN_RADIUS,
  chronoBox,
  overlapShare,
  rectsOverlap,
  unitAt,
  unitHitZone,
  unitSpot,
  unitSpots,
  TAP_MIN,
} from '../../../src/scenes/battle/unitSpots';

const spots = unitSpots();
const sideOf = (team: 'PAST' | 'FUTURE') => spots.filter((s) => s.team === team);

describe('unit spots', () => {
  it('gives one spot per fighter, in order, at its origin', () => {
    expect(spots.map((s) => s.id)).toEqual(UNITS.map((u) => u.id));
    spots.forEach((s, i) => expect({ x: s.x, y: s.y }).toEqual(UNITS[i]!.origin));
  });

  it('faces Past right and Future left', () => {
    expect(sideOf('PAST').every((s) => s.facing === 1)).toBe(true);
    expect(sideOf('FUTURE').every((s) => s.facing === -1)).toBe(true);
  });

  it('keeps the muzzle inside its own box', () => {
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(s.box.x);
      expect(s.x).toBeLessThanOrEqual(s.box.x + s.box.w);
      expect(s.y).toBeGreaterThanOrEqual(s.box.y);
      expect(s.y).toBeLessThanOrEqual(s.box.y + s.box.h);
    }
  });

  for (const team of ['PAST', 'FUTURE'] as const) {
    it(`${team}: no two fighters overlap by more than 20 percent`, () => {
      const side = sideOf(team);
      for (let i = 0; i < side.length; i++)
        for (let j = i + 1; j < side.length; j++)
          expect(
            overlapShare(side[i]!.box, side[j]!.box),
            `${side[i]!.id}/${side[j]!.id}`,
          ).toBeLessThanOrEqual(0.2);
    });
  }

  it('keeps every fighter off the opposing base', () => {
    for (const s of spots) {
      const other = s.team === 'PAST' ? 'FUTURE' : 'PAST';
      expect(rectsOverlap(s.box, BASES[other]), s.id).toBe(false);
    }
  });

  it('keeps every fighter and token inside the world', () => {
    for (const s of spots) {
      expect(s.box.x).toBeGreaterThanOrEqual(0);
      expect(s.box.x + s.box.w).toBeLessThanOrEqual(WORLD.width);
      expect(s.box.y + s.box.h).toBeLessThanOrEqual(WORLD.height);
      expect(s.token.x - s.token.r).toBeGreaterThanOrEqual(0);
      expect(s.token.x + s.token.r).toBeLessThanOrEqual(WORLD.width);
      expect(s.arrowTip.y).toBeGreaterThan(0);
    }
  });

  it('puts ground fighters on the ground line', () => {
    for (const id of ['D', 'E', '3', '4']) {
      const s = spots.find((p) => p.id === id)!;
      expect(s.box.y + s.box.h).toBe(620 + 2);
    }
  });

  it('uses one token size, and tokens never touch each other', () => {
    expect(new Set(spots.map((s) => s.token.r))).toEqual(new Set([TOKEN_RADIUS]));
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i]!.token;
        const b = spots[j]!.token;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * TOKEN_RADIUS);
      }
  });

  it('has unique tokens that match the fighter ids (A-E and 1-5)', () => {
    const ids = spots.map((s) => s.id);
    expect(new Set(ids).size).toBe(10);
    expect(ids.slice().sort()).toEqual(['1', '2', '3', '4', '5', 'A', 'B', 'C', 'D', 'E']);
  });

  it('mirrors a box for the Future side', () => {
    const c = unitSpot(UNITS.find((u) => u.id === '1')!);
    expect(c.box.x + c.box.w).toBeGreaterThan(c.x);
    expect(c.box.x).toBeLessThan(c.x);
  });

  it('keeps Chrono small and clear of every fighter and token (Chrono covered D and 3 before)', () => {
    expect(CHRONO_SCALE).toBeLessThan(0.7);
    for (const team of ['PAST', 'FUTURE'] as const) {
      const box = chronoBox(characterSpot(team, PHASE1_LAYOUT));
      for (const s of spots) {
        expect(rectsOverlap(box, s.box), `Chrono ${team} / ${s.id}`).toBe(false);
        const t = s.token;
        const tokenBox = { x: t.x - t.r, y: t.y - t.r, w: 2 * t.r, h: 2 * t.r };
        expect(rectsOverlap(box, tokenBox), `Chrono ${team} / token ${s.id}`).toBe(false);
      }
      expect(rectsOverlap(box, BASES[team]), `Chrono ${team} / own base`).toBe(false);
    }
  });

  it('draws every fighter big enough to read (at least 50 wide and 46 tall, the big ones 70 tall)', () => {
    for (const s of spots) {
      expect(s.box.w, s.id).toBeGreaterThanOrEqual(50);
      expect(s.box.h, s.id).toBeGreaterThanOrEqual(46);
    }
    for (const id of ['E', '4', '5', 'A']) {
      expect(spots.find((p) => p.id === id)!.box.h, id).toBeGreaterThanOrEqual(70);
    }
  });

  it('puts the cannon knight on the castle wall, below the tower roof tip', () => {
    const c = spots.find((p) => p.id === 'C')!;
    // The wall top is 30 px under the base top (see drawCastle). Feet land at the box bottom.
    const feet = c.box.y + c.box.h;
    expect(feet).toBeGreaterThan(BASES.PAST.y + 10);
    expect(feet).toBeLessThanOrEqual(BASES.PAST.y + 30);
    expect(c.x).toBe(220);
    expect(c.y).toBe(450);
  });
});

describe('tapping a fighter in the picture', () => {
  it('picks the fighter when the tap lands on its drawing or its tag', () => {
    for (const s of spots) {
      const mid = { x: s.box.x + s.box.w / 2, y: s.box.y + s.box.h / 2 };
      expect(unitAt(mid, s.team)).toBe(s.id);
      expect(unitAt({ x: s.token.x, y: s.token.y }, s.team)).toBe(s.id);
    }
  });

  it('only picks from the team asked (the other side never answers)', () => {
    const f = sideOf('FUTURE')[0]!;
    expect(unitAt({ x: f.token.x, y: f.token.y }, 'PAST')).toBeNull();
  });

  it('a tap on empty sky picks nothing', () => {
    expect(unitAt({ x: 640, y: 20 }, 'PAST')).toBeNull();
    expect(unitAt({ x: -50, y: -50 }, 'FUTURE')).toBeNull();
  });

  it('every hit zone is at least the tap minimum on both sides, and holds box and tag', () => {
    for (const s of spots) {
      const z = unitHitZone(s);
      expect(z.w).toBeGreaterThanOrEqual(TAP_MIN);
      expect(z.h).toBeGreaterThanOrEqual(TAP_MIN);
      expect(z.x).toBeLessThanOrEqual(s.box.x);
      expect(z.x + z.w).toBeGreaterThanOrEqual(s.box.x + s.box.w);
      expect(z.y).toBeLessThanOrEqual(s.token.y - s.token.r);
      expect(z.y + z.h).toBeGreaterThanOrEqual(s.box.y + s.box.h);
    }
  });

  it('where two zones overlap, the nearest fighter centre wins, and the answer is stable', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      for (const s of sideOf(team)) {
        const p = { x: s.box.x + s.box.w / 2, y: s.box.y + s.box.h / 2 };
        expect(unitAt(p, team)).toBe(s.id);
        expect(unitAt(p, team)).toBe(unitAt(p, team));
      }
    }
  });

  it('the TAP_MIN is 56px at the narrowest supported width (768 of 1280)', () => {
    expect(TAP_MIN * (768 / WORLD.width)).toBeGreaterThanOrEqual(56);
  });
});
