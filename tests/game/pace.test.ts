// Pace (owner, 2026-10-24): "perfect aim should take about five turns; right now you can lose
// everything in one or two turns." A player who never misses and answers every reload right
// still needs five turns of their own to win, so a match is never over in one or two turns.
// `turns` counts the turns of both teams, so the first mover winning on its fifth turn is 9.
import { describe, expect, it } from 'vitest';
import { playBotMatch, type SimResult } from '../../src/game/botPlay';
import { SPOT_WEAPONS } from '../../src/game/baseBuilder';
import { createBuilt, mountScale } from '../../src/game/builtBase';
import {
  BASE_IN_BATTLE,
  BONUS,
  DAMAGE,
  PHASE1_LAYOUT,
  PRACTICE_BOT,
  WORKSHOP,
  type BotProfile,
} from '../../src/game/config';
import { customMountDef } from '../../src/game/customMounts';
import { createMatch } from '../../src/game/match';
import { SIZES, STRONGEST, TINY, TYPICAL, armed } from '../helpers/builtBases';
import type { Team } from '../../src/game/types';

/** No aim error, reads the wind fully, and always answers right (the reload ceiling still applies). */
const PERFECT: BotProfile = {
  angleSpreadDeg: 0,
  powerSpreadPct: 0,
  windSkill: 1,
  reloadAccuracy: 1,
  thinkScale: 1,
};

/** Five turns of the winner's own, plus the four turns the other team had in between. */
const OWN_TURNS_TO_WIN = 5;
const MIN_TOTAL_TURNS = 2 * OWN_TURNS_TO_WIN - 1;
const SEEDS = 40;
const GRADE = 3;

const play = (profile: BotProfile, characterHealth: boolean): SimResult[] =>
  Array.from({ length: SEEDS }, (_, i) => {
    const seed = i + 1;
    const firstTeam: Team = seed % 2 ? 'PAST' : 'FUTURE';
    return playBotMatch({
      seed,
      firstTeam,
      grade: GRADE,
      characterHealth,
      profiles: { PAST: profile, FUTURE: profile },
    });
  });

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

// Built bases (on for everyone, 2026-10-25): the bricks are the base health. A base of any size
// still needs five turns of perfect aim, and still ends.
describe.each(Object.entries(SIZES))('pace with a %s built base on both sides', (_n, size) => {
  it('perfect aim never wins before its fifth turn, and every match ends', () => {
    const results = Array.from({ length: SEEDS }, (_, i) =>
      playBotMatch({
        seed: i + 1,
        firstTeam: (i + 1) % 2 ? 'PAST' : 'FUTURE',
        grade: GRADE,
        characterHealth: false,
        baseInBattle: true,
        bases: { PAST: size('PAST'), FUTURE: size('FUTURE') },
        profiles: { PAST: PERFECT, FUTURE: PERFECT },
      }),
    );
    for (const [i, r] of results.entries()) {
      expect(r.ended, `seed ${i + 1}`).toBe(true);
      expect(r.winner, `seed ${i + 1}`).not.toBeNull();
    }
    expect(Math.min(...results.map((r) => r.turns))).toBeGreaterThanOrEqual(MIN_TOTAL_TURNS);
  }, 300_000);

  it('even a shooter who only hits the foundation with every shot needs five turns', () => {
    // The worst case: every shot of four perfect turns lands on a foundation brick as a direct
    // hit, with no overkill wasted. The foundation must still stand.
    for (const team of ['PAST', 'FUTURE'] as const) {
      const built = createBuilt(
        { [team]: size(team) },
        {
          layout: PHASE1_LAYOUT,
          flatHp: { PAST: DAMAGE.startingBaseHp, FUTURE: DAMAGE.startingBaseHp },
        },
      );
      const foundation = built[team].bricks
        .filter((b) => b.grounded)
        .reduce((a, b) => a + b.maxHp, 0);
      const perfectTurn = 2 * DAMAGE.direct + Math.round(DAMAGE.direct * BONUS.damageMultiplier);
      expect(foundation).toBeGreaterThan((OWN_TURNS_TO_WIN - 1) * perfectTurn);
    }
  });
});

// Weapons on the pads (2026-10-25): the strongest legal four weapons on both bases. A go from a
// weapon is capped at a fighter's standard shot, so perfect aim still needs five turns.
describe.each([
  ['tiny', TINY],
  ['typical', TYPICAL],
] as const)('pace with four strong weapons on a %s base on both sides', (_n, size) => {
  const bases = {
    PAST: armed(size('PAST'), STRONGEST.PAST),
    FUTURE: armed(size('FUTURE'), STRONGEST.FUTURE),
  };

  it('perfect aim never wins before its fifth turn, and every match ends', () => {
    const results = Array.from({ length: SEEDS }, (_, i) =>
      playBotMatch({
        seed: i + 1,
        firstTeam: (i + 1) % 2 ? 'PAST' : 'FUTURE',
        grade: GRADE,
        characterHealth: false,
        baseInBattle: true,
        bases,
        profiles: { PAST: PERFECT, FUTURE: PERFECT },
      }),
    );
    for (const [i, r] of results.entries()) {
      expect(r.ended, `seed ${i + 1}`).toBe(true);
      expect(r.winner, `seed ${i + 1}`).not.toBeNull();
    }
    expect(Math.min(...results.map((r) => r.turns))).toBeGreaterThanOrEqual(MIN_TOTAL_TURNS);
  }, 300_000);

  it('the weapons really fire in these matches', () => {
    const s = createMatch({
      players: [
        { name: 'A', team: 'PAST', grade: 3, subject: 'math' },
        { name: 'B', team: 'FUTURE', grade: 3, subject: 'math' },
      ],
      seed: 1,
      characterHealth: false,
      baseInBattle: true,
      bases,
    }).snapshot();
    expect(s.mounts?.PAST.filter((m) => m.canFire)).toHaveLength(4);
    expect(s.mounts?.FUTURE.filter((m) => m.canFire)).toHaveLength(4);
  });
});

describe('the worst case with weapons', () => {
  it('no weapon on a pad, catalog or your own, does more than 88 in a perfect turn', () => {
    const perfectTurn = 2 * DAMAGE.direct + Math.round(DAMAGE.direct * BONUS.damageMultiplier);
    expect(perfectTurn).toBe(88);
    const weapons = [
      ...SPOT_WEAPONS,
      ...(
        [
          'royalSword',
          'elderLongbow',
          'ironCannon',
          'plasmaBlade',
          'laserRifle',
          'railCannon',
        ] as const
      ).map((base) =>
        customMountDef(
          { id: 'custom:P:1', base, name: 'Max', power: WORKSHOP.maxPoints, reach: 3, splash: 2 },
          'PAST',
        ),
      ),
    ];
    for (const w of weapons) {
      const shells = w.role === 'volley' ? BASE_IN_BATTLE.volley.shots : 1;
      const s = mountScale(w) / shells;
      const go = shells * Math.round(DAMAGE.direct * s);
      const power = shells * Math.round(Math.round(DAMAGE.direct * s) * BONUS.damageMultiplier);
      expect(2 * go + power, w.id).toBeLessThanOrEqual(perfectTurn);
    }
  });
});

describe.each([
  ['base health', false],
  ['fighter health', true],
] as const)('pace with %s', (_label, characterHealth) => {
  it('perfect aim on both sides never wins before its fifth turn', () => {
    const results = play(PERFECT, characterHealth);
    for (const [i, r] of results.entries()) {
      expect(r.ended, `seed ${i + 1}`).toBe(true);
      expect(r.winner, `seed ${i + 1}`).not.toBeNull();
    }
    expect(Math.min(...results.map((r) => r.turns))).toBeGreaterThanOrEqual(MIN_TOTAL_TURNS);
  }, 300_000);

  it('a realistic player (the scripted human) takes at least as long, at the median', () => {
    const results = play(PRACTICE_BOT.scriptedHuman, characterHealth);
    for (const r of results) expect(r.ended).toBe(true);
    expect(median(results.map((r) => r.turns))).toBeGreaterThanOrEqual(MIN_TOTAL_TURNS);
  }, 300_000);
});
