import { describe, expect, it } from 'vitest';
import { BASES, WORLD } from '../../../src/game/config';
import { UNITS } from '../../../src/game/units';
import {
  TOKEN_RADIUS,
  overlapShare,
  rectsOverlap,
  unitSpot,
  unitSpots,
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
});
