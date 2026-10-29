// The Computer player's walking helper (Squads S1): when it walks him out and calls him home.
// It uses the same match goes a child has, so it can never do what a child cannot.
import { describe, expect, it } from 'vitest';
import { chooseHelperGo, helperPlanOf, profileOf } from '../../src/game/bot';
import { playBotMatch } from '../../src/game/botPlay';
import {
  BOT_LEVELS,
  PRACTICE_BOT,
  type BotHelperPlan,
  type BotLevel,
  type BotProfile,
} from '../../src/game/config';
import { dasherOf, helperId, type Helper } from '../../src/game/crew';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import type { Match, MatchController, Players, Team } from '../../src/game/types';

const players: Players = [
  { name: 'Knight', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Rocket', team: 'FUTURE', grade: 3, subject: 'math' },
];
type DasherPatch = Partial<Pick<Helper, 'state' | 'spot' | 'hp' | 'readyAt'>>;
/** A snapshot with the dashers moved by hand, for boards that take many turns to reach. */
const withDashers = (s: Match, patch: Partial<Record<Team, DasherPatch>>): Match => ({
  ...s,
  squads: {
    ...s.squads!,
    crew: {
      ...s.squads!.crew,
      helpers: s.squads!.crew.helpers.map((h) =>
        h.kind === 'dasher' && patch[h.team] ? { ...h, ...patch[h.team] } : h,
      ),
    },
  },
});
const ALWAYS: BotHelperPlan = { dashChance: 1, replyChance: 1, recallChance: 1, bonkChance: 0 };
const NEVER: BotHelperPlan = { dashChance: 0, replyChance: 0, recallChance: 0, bonkChance: 0 };

/** A squads match on Team Past's first go. */
const start = (seed = 4): MatchController => {
  const m = createMatch({ players, seed, firstTeam: 'PAST', squads: true, disturbances: false });
  m.ready();
  return m;
};

/** Fire one plain shot that lands far short (no hit). */
const shortShot = (m: MatchController): void => {
  const team = m.snapshot().turn.team;
  if (m.snapshot().squads?.picked[team] !== helperId(team, 'launcher'))
    m.selectHelper(helperId(team, 'launcher'));
  m.setAim({ angleDeg: 80, power: 20 });
  m.fire();
  m.shotLanded();
};

/** End the turn: second go a short shot, a wrong reload, pass, and the next team gets ready. */
const endTurn = (m: MatchController): void => {
  if (m.snapshot().turn.phase === 'AIMING') shortShot(m);
  if (m.snapshot().turn.phase === 'AIMING') shortShot(m);
  m.reloadDone({ correct: false, elapsedMs: 5000, kind: 'choice', grade: 3 });
  m.pass();
  m.ready();
};

describe('chooseHelperGo', () => {
  it('walks out to the one stop on go 1 when the helper is home and ready', () => {
    const m = start();
    const go = chooseHelperGo(m.snapshot(), 'PAST', ALWAYS, createRng(1));
    expect(go).toEqual({ kind: 'dash', to: 'g3' });
    // The match accepts it as an ordinary go.
    m.selectHelper(helperId('PAST', 'dasher'));
    m.dash((go as { to: string }).to);
    expect(dasherOf(m.snapshot().squads!.crew, 'PAST').state).toBe('out');
    expect(m.snapshot().turn.shotsFired).toBe(1);
  });

  it('never walks out with a plan of zero, and draws no random number for it', () => {
    const m = start();
    const rng = createRng(1);
    const before = createRng(1).next();
    expect(chooseHelperGo(m.snapshot(), 'PAST', NEVER, rng)).toBeNull();
    expect(rng.next()).toBe(before);
  });

  it('decides only on go 1: never on go 2, never on the Power Shot (a third go)', () => {
    const m = start();
    shortShot(m);
    expect(m.snapshot().turn.shotsFired).toBe(1);
    expect(chooseHelperGo(m.snapshot(), 'PAST', ALWAYS, createRng(1))).toBeNull();
    shortShot(m);
    m.reloadDone({ correct: true, elapsedMs: 2000, kind: 'choice', grade: 3 });
    expect(m.snapshot().turn.phase).toBe('BONUS_AIMING');
    expect(chooseHelperGo(m.snapshot(), 'PAST', ALWAYS, createRng(1))).toBeNull();
  });

  it('never for the other side, and never when squads are off', () => {
    const m = start();
    expect(chooseHelperGo(m.snapshot(), 'FUTURE', ALWAYS, createRng(1))).toBeNull();
    const plain = createMatch({ players, seed: 4, firstTeam: 'PAST', squads: false });
    plain.ready();
    expect(chooseHelperGo(plain.snapshot(), 'PAST', ALWAYS, createRng(1))).toBeNull();
  });

  it('never walks out a helper who is already out', () => {
    const m = start();
    m.selectHelper(helperId('PAST', 'dasher'));
    m.dash('g3');
    endTurn(m); // Team Future's turn
    endTurn(m); // Team Past again, helper out with full health
    expect(dasherOf(m.snapshot().squads!.crew, 'PAST').state).toBe('out');
    // Full health and no bonk-off: no dash (he is out) and no call home (he is not hurt).
    expect(chooseHelperGo(m.snapshot(), 'PAST', ALWAYS, createRng(1))).toBeNull();
  });

  it('never walks out a helper who is resting after a bonk', () => {
    const s = withDashers(start().snapshot(), {
      PAST: { state: 'resting', spot: null, readyAt: 9 },
    });
    expect(chooseHelperGo(s, 'PAST', ALWAYS, createRng(1))).toBeNull();
  });

  it('never walks out when there is no free spot in front', () => {
    // A board the rules would not make by themselves: Team Past's helper on Team Future's doorstep.
    const s = withDashers(start().snapshot(), { PAST: { state: 'out', spot: 'g4', hp: 4 } });
    const future = { ...s, turn: { ...s.turn, team: 'FUTURE' as const } };
    expect(chooseHelperGo(future, 'FUTURE', ALWAYS, createRng(1))).toBeNull();
  });

  it('walks out to meet an enemy helper who is out, stopping in front of him', () => {
    const s = withDashers(start().snapshot(), { FUTURE: { state: 'out', spot: 'g1', hp: 4 } });
    expect(chooseHelperGo(s, 'PAST', { ...NEVER, replyChance: 1 }, createRng(1))).toEqual({
      kind: 'dash',
      to: 'g0',
    });
    // The plain walk-out chance does not count when the enemy helper is out.
    expect(chooseHelperGo(s, 'PAST', { ...NEVER, dashChance: 1 }, createRng(1))).toBeNull();
  });

  it('calls a hurt helper home when the enemy helper next to him has more health', () => {
    const s = withDashers(start().snapshot(), {
      PAST: { state: 'out', spot: 'g3', hp: 1 },
      FUTURE: { state: 'out', spot: 'g4', hp: 3 },
    });
    expect(chooseHelperGo(s, 'PAST', { ...NEVER, recallChance: 1 }, createRng(1))).toEqual({
      kind: 'recall',
    });
    // The plan says never: he stays out.
    expect(chooseHelperGo(s, 'PAST', NEVER, createRng(1))).toBeNull();
    // Not hurt: he stays out.
    const healthy = withDashers(s, { PAST: { hp: 3 } });
    expect(chooseHelperGo(healthy, 'PAST', ALWAYS, createRng(1))).toBeNull();
    // Hurt but even with the enemy: he stays and bonks (both tumble together).
    const even = withDashers(s, { FUTURE: { hp: 1 } });
    expect(chooseHelperGo(even, 'PAST', ALWAYS, createRng(1))).toBeNull();
    // Hurt with nobody next to him: he stays and bonks the base.
    const alone = withDashers(s, { FUTURE: { state: 'home', spot: null, hp: 4 } });
    expect(chooseHelperGo(alone, 'PAST', ALWAYS, createRng(1))).toBeNull();
  });

  it('the match refuses what the rule never offers (a walk-out while out, a call home while home)', () => {
    const m = start();
    m.selectHelper(helperId('PAST', 'dasher'));
    expect(() => m.recall()).toThrow(/not_out/);
    m.dash('g3');
    endTurn(m);
    endTurn(m);
    expect(chooseHelperGo(m.snapshot(), 'PAST', ALWAYS, createRng(1))).toBeNull();
    m.selectHelper(helperId('PAST', 'dasher'));
    expect(() => m.dash('g3')).toThrow(/already_out/);
  });

  it('meets an enemy helper who is out more often than it walks out on an empty field', () => {
    for (const level of BOT_LEVELS) {
      const plan = helperPlanOf(level);
      expect(plan.replyChance).toBeGreaterThanOrEqual(plan.dashChance);
    }
  });

  it('a harder level uses its helper at least as much as an easier one', () => {
    for (let i = 1; i < BOT_LEVELS.length; i++) {
      const easier = helperPlanOf(BOT_LEVELS[i - 1] as BotLevel);
      const harder = helperPlanOf(BOT_LEVELS[i] as BotLevel);
      expect(harder.dashChance).toBeGreaterThanOrEqual(easier.dashChance);
      expect(harder.replyChance).toBeGreaterThanOrEqual(easier.replyChance);
      expect(harder.recallChance).toBeGreaterThanOrEqual(easier.recallChance);
    }
    for (const level of BOT_LEVELS) {
      const plan = PRACTICE_BOT.helper.levels[level];
      for (const v of Object.values(plan)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rejects an unknown level', () => {
    expect(() => helperPlanOf('nope' as BotLevel)).toThrow(RangeError);
  });

  it('is the same for the same seed, and Easy answers a walk-out only some of the time', () => {
    const s = withDashers(start().snapshot(), { FUTURE: { state: 'out', spot: 'g1', hp: 4 } });
    const plan = helperPlanOf('easy');
    const a = Array.from({ length: 20 }, (_, i) => chooseHelperGo(s, 'PAST', plan, createRng(i)));
    const b = Array.from({ length: 20 }, (_, i) => chooseHelperGo(s, 'PAST', plan, createRng(i)));
    expect(a).toEqual(b);
    expect(a.some((g) => g !== null)).toBe(true);
    expect(a.some((g) => g === null)).toBe(true);
  });

  it('goes while the way is clear when the enemy helper is resting', () => {
    const s = withDashers(start().snapshot(), {
      FUTURE: { state: 'resting', spot: null, readyAt: 9 },
    });
    expect(chooseHelperGo(s, 'PAST', { ...NEVER, replyChance: 1 }, createRng(1))).toEqual({
      kind: 'dash',
      to: 'g3',
    });
  });
});

describe('chooseHelperGo: Bonk!', () => {
  const BONKS: BotHelperPlan = { ...NEVER, bonkChance: 1 };
  /** Team Past's helper on its attack spot, Team Future's home. */
  const atBase = (): Match =>
    withDashers(start().snapshot(), { PAST: { state: 'out', spot: 'g3', hp: 4 } });

  it('Bonk!s the base from the attack spot, and the match accepts it as a go', () => {
    const m = start();
    m.selectHelper(helperId('PAST', 'dasher'));
    m.dash('g3');
    const go = chooseHelperGo(m.snapshot(), 'PAST', BONKS, createRng(1));
    expect(go).toEqual({ kind: 'bonk', target: 'base' });
    m.bonk('base');
    expect(m.snapshot().turn.shotsFired).toBe(2);
  });

  it('may Bonk! on go 2 as well as go 1, but never on the Power Shot', () => {
    const m = start();
    m.selectHelper(helperId('PAST', 'dasher'));
    m.dash('g3');
    expect(m.snapshot().turn.shotsFired).toBe(1);
    expect(chooseHelperGo(m.snapshot(), 'PAST', BONKS, createRng(1))).not.toBeNull();
    m.selectHelper(helperId('PAST', 'launcher'));
    m.setAim({ angleDeg: 80, power: 20 });
    m.fire();
    m.shotLanded();
    m.reloadDone({ correct: true, elapsedMs: 2000, kind: 'choice', grade: 3 });
    expect(m.snapshot().turn.phase).toBe('BONUS_AIMING');
    expect(chooseHelperGo(m.snapshot(), 'PAST', BONKS, createRng(1))).toBeNull();
  });

  it('Bonk!s the enemy helper next to him before the base', () => {
    const s = withDashers(atBase(), { FUTURE: { state: 'out', spot: 'g4', hp: 4 } });
    expect(chooseHelperGo(s, 'PAST', BONKS, createRng(1))).toEqual({
      kind: 'bonk',
      target: 'helper',
    });
  });

  it('does not Bonk! with a plan of zero (and draws no random number), at home, resting, or in the middle of the field', () => {
    const rng = createRng(1);
    const before = createRng(1).next();
    expect(chooseHelperGo(atBase(), 'PAST', NEVER, rng)).toBeNull();
    expect(rng.next()).toBe(before);
    expect(chooseHelperGo(start().snapshot(), 'PAST', BONKS, createRng(1))).toBeNull();
    const dizzy = withDashers(atBase(), { PAST: { state: 'resting', spot: null, readyAt: 9 } });
    expect(chooseHelperGo(dizzy, 'PAST', BONKS, createRng(1))).toBeNull();
    const middle = withDashers(atBase(), { PAST: { spot: 'g1' } });
    expect(chooseHelperGo(middle, 'PAST', BONKS, createRng(1))).toBeNull();
  });

  it('harder levels Bonk! at least as often as easier ones', () => {
    for (let i = 1; i < BOT_LEVELS.length; i++) {
      const easier = helperPlanOf(BOT_LEVELS[i - 1] as BotLevel);
      const harder = helperPlanOf(BOT_LEVELS[i] as BotLevel);
      expect(harder.bonkChance).toBeGreaterThanOrEqual(easier.bonkChance);
    }
  });

  it('a whole match: the Computer player Bonk!s as a go and the match ends with a winner', () => {
    const r = playBotMatch({
      seed: 11,
      profiles: { PAST: profileOf('hard'), FUTURE: PRACTICE_BOT.scriptedHuman },
      helpers: { PAST: { ...helperPlanOf('hard'), dashChance: 1 } },
    });
    expect(r.ended).toBe(true);
    expect(r.winner).not.toBeNull();
  });
});

describe('playBotMatch with helpers', () => {
  const sides = (bot: Team): Record<Team, BotProfile> =>
    ({
      [bot]: profileOf('hard'),
      [bot === 'PAST' ? 'FUTURE' : 'PAST']: PRACTICE_BOT.scriptedHuman,
    }) as Record<Team, BotProfile>;

  it('every match ends with a winner when both sides walk helpers out', () => {
    let dashes = 0;
    let recalls = 0;
    for (let i = 0; i < 40; i++) {
      const bot: Team = i % 2 === 0 ? 'PAST' : 'FUTURE';
      const r = playBotMatch({
        seed: 700 + i,
        profiles: sides(bot),
        helpers: { PAST: helperPlanOf('hard'), FUTURE: ALWAYS },
      });
      expect(r.ended).toBe(true);
      expect(r.winner).not.toBeNull();
      dashes += r.dashes?.PAST ?? 0;
      recalls += r.recalls?.PAST ?? 0;
    }
    expect(dashes).toBeGreaterThan(0);
    expect(recalls).toBeGreaterThanOrEqual(0);
  });

  it('a side with no plan never walks its helper', () => {
    const r = playBotMatch({
      seed: 3,
      profiles: sides('PAST'),
      helpers: { PAST: helperPlanOf('hard') },
    });
    expect(r.dashes?.FUTURE ?? 0).toBe(0);
    expect(r.recalls?.FUTURE ?? 0).toBe(0);
  });

  it('is the same for the same seed', () => {
    const opts = {
      seed: 9,
      profiles: sides('FUTURE'),
      helpers: { FUTURE: helperPlanOf('medium'), PAST: ALWAYS },
    };
    expect(playBotMatch(opts)).toEqual(playBotMatch(opts));
  });
});
