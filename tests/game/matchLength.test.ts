// Match length scales full health only. Normal is today's balance.
import { describe, expect, it } from 'vitest';
import { CHARACTER_HEALTH, DAMAGE, MATCH_LENGTH } from '../../src/game/config';
import { createMatch } from '../../src/game/match';
import { isMatchLength, normalizeMatchLength, scaleHealth } from '../../src/game/matchLength';
import type { MatchLength } from '../../src/game/matchLength';
import type { Players } from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'math' },
];
const mk = (matchLength?: unknown, characterHealth = false) =>
  createMatch({
    players: PLAYERS,
    seed: 5,
    characterHealth,
    matchLength: matchLength as MatchLength,
  }).snapshot();

describe('match length helpers', () => {
  it('knows the three lengths and nothing else', () => {
    expect(MATCH_LENGTH.ids).toEqual(['short', 'normal', 'long']);
    expect(isMatchLength('short')).toBe(true);
    expect(isMatchLength('epic')).toBe(false);
    expect(isMatchLength(2)).toBe(false);
  });
  it('falls back to Normal for anything unknown', () => {
    for (const v of [undefined, null, '', 'SHORT', 'epic', 7, {}]) {
      expect(normalizeMatchLength(v)).toBe('normal');
      expect(scaleHealth(100, v)).toBe(100);
    }
  });
  it('scales whole numbers and never goes below 1', () => {
    expect(scaleHealth(100, 'short')).toBe(50);
    expect(scaleHealth(100, 'long')).toBe(150);
    expect(scaleHealth(1, 'short')).toBe(1);
    expect(scaleHealth(0, 'short')).toBe(1);
  });
});

describe('match length in a match (base health)', () => {
  it('Normal, and no choice at all, are exactly today', () => {
    for (const m of [mk(), mk('normal')]) {
      expect(m.maxBaseHp).toEqual({ PAST: DAMAGE.startingBaseHp, FUTURE: DAMAGE.startingBaseHp });
      expect(m.baseHp).toEqual(m.maxBaseHp);
      expect(m.maxUnitHp).toBe(CHARACTER_HEALTH.hp);
    }
    expect(mk('normal')).toEqual(mk());
  });
  it('Short takes fewer direct hits and Long takes more', () => {
    const full = DAMAGE.startingBaseHp;
    const { short, long } = MATCH_LENGTH.healthScale;
    expect(mk('short').maxBaseHp.PAST).toBe(full * short);
    expect(mk('short').baseHp.FUTURE).toBe(full * short);
    expect(mk('long').maxBaseHp.PAST).toBe(full * long);
    const hits = (len: string): number => Math.ceil(mk(len).maxBaseHp.PAST / DAMAGE.direct);
    expect(hits('short')).toBeLessThan(hits('normal'));
    expect(hits('long')).toBeGreaterThan(hits('normal'));
    expect(hits('short')).toBe(Math.ceil((full * short) / DAMAGE.direct));
    expect(hits('long')).toBe(Math.ceil((full * long) / DAMAGE.direct));
  });
  it('an unknown length plays as Normal', () => {
    expect(mk('epic')).toEqual(mk('normal'));
  });
  it('does not touch the turn shape', () => {
    for (const len of ['short', 'normal', 'long']) {
      const m = mk(len);
      expect(m.turn.shotsFired).toBe(mk('normal').turn.shotsFired);
      expect(m.status).toBe('PLAYING');
    }
  });
});

describe('match length in a match (fighter health)', () => {
  it('scales every fighter and the max the HUD reads', () => {
    // Whole health, rounded: four health is 2, 4 and 6.
    const lens = {
      short: Math.round(CHARACTER_HEALTH.hp * MATCH_LENGTH.healthScale.short),
      normal: CHARACTER_HEALTH.hp,
      long: Math.round(CHARACTER_HEALTH.hp * MATCH_LENGTH.healthScale.long),
    } as const;
    expect(lens.short).toBeLessThan(lens.normal);
    expect(lens.long).toBeGreaterThan(lens.normal);
    for (const len of MATCH_LENGTH.ids) {
      const m = mk(len, true);
      expect(m.maxUnitHp).toBe(lens[len]);
      expect(Object.values(m.unitHp).every((hp) => hp === lens[len])).toBe(true);
    }
  });
  it('Normal fighter health is exactly CHARACTER_HEALTH.hp', () => {
    expect(mk('normal', true).maxUnitHp).toBe(CHARACTER_HEALTH.hp);
  });
});
