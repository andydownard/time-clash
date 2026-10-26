// Pace (owner, 2026-10-24): "perfect aim should take about five turns; right now you can lose
// everything in one or two turns." A player who never misses and answers every reload right
// still needs five turns of their own to win, so a match is never over in one or two turns.
// `turns` counts the turns of both teams, so the first mover winning on its fifth turn is 9.
import { describe, expect, it } from 'vitest';
import { answerReloadWith, chooseShotWith } from '../../src/game/bot';
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
import { createRng } from '../../src/game/rng';
import { UNITS, unitById, type UnitId } from '../../src/game/units';
import { SIZES, STRONGEST, TINY, TYPICAL, armed } from '../helpers/builtBases';
import type { ChosenBase, Team } from '../../src/game/types';

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

// Every fighter (owner pace rule, 2026-10-24). The default fighters are not the only ones a child
// can pick, so the perfect shooter plays each mirror pair (A~2, B~5, C~1, D~3, E~4), picked every
// go. Before this check the Spearman and Saber Robot did 33 + 33 + 50 = 116 a perfect turn and
// could win on their fourth turn.

/** The most a fighter's perfect turn can do: two direct hits and a Power Shot, plain ammo. */
const perfectTurnOf = (damageScale: number): number => {
  const direct = Math.max(1, Math.round(DAMAGE.direct * damageScale));
  return 2 * direct + Math.round(direct * BONUS.damageMultiplier);
};

const MIRROR_PAIRS: readonly (readonly [UnitId, UnitId])[] = [
  ['A', '2'],
  ['B', '5'],
  ['C', '1'],
  ['D', '3'],
  ['E', '4'],
];
/** A smaller seeded sample than the default fighters get, so the file stays quick. */
const FIGHTER_SEEDS = 12;

/** Like playBotMatch, but each team picks its own fighter at the start of every turn. */
const playWithFighters = (
  seed: number,
  units: Record<Team, UnitId>,
  bases?: Record<Team, ChosenBase>,
): SimResult => {
  const firstTeam: Team = seed % 2 ? 'PAST' : 'FUTURE';
  const match = createMatch({
    players: [
      { name: 'Knight', team: 'PAST', grade: GRADE, subject: 'math' },
      { name: 'Rocket', team: 'FUTURE', grade: GRADE, subject: 'math' },
    ],
    seed,
    firstTeam,
    characterHealth: false,
    ...(bases ? { baseInBattle: true, bases } : {}),
  });
  const rng = createRng((seed ^ 0x626f74) >>> 0);
  const shoot = (team: Team): boolean => {
    const shot = chooseShotWith(match.snapshot(), team, PERFECT, rng);
    // The bases here have no weapon spots, so the shot is always the picked fighter's.
    match.setAim(shot);
    match.fire();
    match.shotLanded();
    return match.snapshot().status === 'OVER';
  };
  const done = (turns: number): SimResult => ({
    winner: match.snapshot().winner,
    turns,
    ended: true,
  });
  for (let turns = 0; turns < PRACTICE_BOT.maxSimTurns; turns++) {
    const team = match.snapshot().turn.team;
    match.ready();
    match.selectUnit(units[team]);
    if (shoot(team) || shoot(team)) return done(turns + 1);
    const answer = answerReloadWith(
      { grade: GRADE, kind: 'choice', choices: ['a', 'b', 'c', 'd'], answer: 'a' },
      PERFECT,
      rng,
    );
    match.reloadDone({
      correct: answer.correct,
      elapsedMs: answer.delayMs,
      kind: 'choice',
      grade: GRADE,
    });
    if (answer.correct && shoot(team)) return done(turns + 1);
    match.pass();
  }
  return { winner: null, turns: PRACTICE_BOT.maxSimTurns, ended: false };
};

describe('pace with every fighter', () => {
  it('no fighter does more in a perfect turn than four turns can take from a base', () => {
    // Four perfect turns must leave the flat base and the smallest foundation standing.
    const foundation = 0.9 * DAMAGE.startingBaseHp;
    for (const u of UNITS) {
      expect(4 * perfectTurnOf(u.damageScale), u.name).toBeLessThan(foundation);
    }
  });

  it.each(MIRROR_PAIRS)(
    'perfect aim with %s against %s never wins before its fifth turn',
    (past, future) => {
      for (let seed = 1; seed <= FIGHTER_SEEDS; seed++) {
        const r = playWithFighters(seed, { PAST: past, FUTURE: future });
        expect(r.ended, `seed ${seed}`).toBe(true);
        expect(r.turns, `seed ${seed}`).toBeGreaterThanOrEqual(MIN_TOTAL_TURNS);
      }
    },
    60_000,
  );

  it('the hardest-hitting fighters still need five turns against the smallest built base', () => {
    const top = Math.max(...UNITS.map((u) => u.damageScale));
    // The hardest hitters today, plus the two pairs that once hit hardest (Catapult, Spearman).
    const heaviest = MIRROR_PAIRS.filter(
      ([p]) => unitById(p)!.damageScale === top || p === 'D' || p === 'E',
    );
    expect(heaviest.length).toBeGreaterThan(0);
    for (const [past, future] of heaviest) {
      for (let seed = 1; seed <= FIGHTER_SEEDS; seed++) {
        const r = playWithFighters(
          seed,
          { PAST: past, FUTURE: future },
          { PAST: TINY('PAST'), FUTURE: TINY('FUTURE') },
        );
        expect(r.ended, `${past} ${future} seed ${seed}`).toBe(true);
        expect(r.turns, `${past} ${future} seed ${seed}`).toBeGreaterThanOrEqual(MIN_TOTAL_TURNS);
      }
    }
  }, 60_000);
});
