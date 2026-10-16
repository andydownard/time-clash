import { describe, expect, it } from 'vitest';
import { applyBlast, blastDamage, classifyBlast, isWipeout, winnerOf } from '../../src/game/damage';
import { BASES, DAMAGE } from '../../src/game/config';
import type { Rect, Team } from '../../src/game/types';

const BASE: Rect = { x: 100, y: 100, w: 200, h: 100 }; // spans x 100..300, y 100..200
const HP = (past: number, future: number): Record<Team, number> => ({ PAST: past, FUTURE: future });

describe('classifyBlast', () => {
  it('is direct inside the rect (distance 0)', () => {
    expect(classifyBlast({ x: 150, y: 150 }, BASE)).toBe('direct');
  });
  it('is direct on the rect edge and corner', () => {
    expect(classifyBlast({ x: 100, y: 150 }, BASE)).toBe('direct');
    expect(classifyBlast({ x: 300, y: 200 }, BASE)).toBe('direct');
  });
  it('is direct at exactly the direct radius (48 px) to the right', () => {
    expect(classifyBlast({ x: 300 + DAMAGE.directRadius, y: 150 }, BASE)).toBe('direct');
  });
  it('is near just past 48 px', () => {
    expect(classifyBlast({ x: 300 + DAMAGE.directRadius + 0.01, y: 150 }, BASE)).toBe('near');
  });
  it('is near at exactly the near radius (120 px), above', () => {
    expect(classifyBlast({ x: 200, y: 100 - DAMAGE.nearRadius }, BASE)).toBe('near');
  });
  it('is a miss just past 120 px', () => {
    expect(classifyBlast({ x: 200, y: 100 - DAMAGE.nearRadius - 0.01 }, BASE)).toBe('miss');
  });
  it('measures distance to the nearest point, so corners use the diagonal', () => {
    // 36 px right and 48 px below the corner = 60 px away: near, not direct.
    expect(classifyBlast({ x: 336, y: 248 }, BASE)).toBe('near');
    // 30 and 40 = 50 px: just outside direct.
    expect(classifyBlast({ x: 330, y: 240 }, BASE)).toBe('near');
    // 24 and 32 = 40 px: inside direct.
    expect(classifyBlast({ x: 324, y: 232 }, BASE)).toBe('direct');
  });
  it('is symmetric on all four sides', () => {
    expect(classifyBlast({ x: 100 - 48, y: 150 }, BASE)).toBe('direct');
    expect(classifyBlast({ x: 200, y: 200 + 48 }, BASE)).toBe('direct');
    expect(classifyBlast({ x: 200, y: 100 - 48 }, BASE)).toBe('direct');
    expect(classifyBlast({ x: 100 - 120, y: 150 }, BASE)).toBe('near');
    expect(classifyBlast({ x: 100 - 121, y: 150 }, BASE)).toBe('miss');
  });
  it('works against the real Phase 1 bases', () => {
    expect(classifyBlast({ x: 1100, y: 550 }, BASES.FUTURE)).toBe('direct');
    expect(classifyBlast({ x: 600, y: 600 }, BASES.FUTURE)).toBe('miss');
  });
});

describe('blastDamage', () => {
  it('maps results to the damage table', () => {
    expect(blastDamage('direct')).toBe(25);
    expect(blastDamage('near')).toBe(10);
    expect(blastDamage('miss')).toBe(0);
  });
});

describe('applyBlast', () => {
  it('subtracts from the target only', () => {
    expect(applyBlast(HP(100, 100), 'FUTURE', 'direct')).toEqual(HP(100, 75));
    expect(applyBlast(HP(100, 100), 'PAST', 'near')).toEqual(HP(90, 100));
  });
  it('does nothing on a miss', () => {
    expect(applyBlast(HP(100, 100), 'PAST', 'miss')).toEqual(HP(100, 100));
  });
  it('never goes below zero', () => {
    expect(applyBlast(HP(100, 10), 'FUTURE', 'direct')).toEqual(HP(100, 0));
    expect(applyBlast(HP(100, 0), 'FUTURE', 'direct')).toEqual(HP(100, 0));
  });
  it('never mutates the input', () => {
    const hp = HP(100, 100);
    const out = applyBlast(hp, 'PAST', 'direct');
    expect(hp).toEqual(HP(100, 100));
    expect(out).not.toBe(hp);
  });
  it('takes exactly four direct hits to reach 0 from 100', () => {
    let hp = HP(100, 100);
    for (let i = 0; i < 3; i++) {
      hp = applyBlast(hp, 'FUTURE', 'direct');
      expect(isWipeout(hp, 'FUTURE')).toBe(false);
    }
    hp = applyBlast(hp, 'FUTURE', 'direct');
    expect(hp.FUTURE).toBe(0);
    expect(isWipeout(hp, 'FUTURE')).toBe(true);
  });
});

describe('isWipeout and winnerOf', () => {
  it('flags only the team at 0', () => {
    expect(isWipeout(HP(0, 5), 'PAST')).toBe(true);
    expect(isWipeout(HP(0, 5), 'FUTURE')).toBe(false);
  });
  it('treats a negative value defensively as a wipeout', () => {
    expect(isWipeout(HP(-3, 5), 'PAST')).toBe(true);
  });
  it('names the opponent of the wiped-out team as winner', () => {
    expect(winnerOf(HP(0, 40))).toBe('FUTURE');
    expect(winnerOf(HP(40, 0))).toBe('PAST');
  });
  it('is null while both stand', () => {
    expect(winnerOf(HP(1, 1))).toBeNull();
    expect(winnerOf(HP(100, 100))).toBeNull();
  });
  it('is null in the impossible both-zero case (never picks a side)', () => {
    expect(winnerOf(HP(0, 0))).toBeNull();
  });
});
