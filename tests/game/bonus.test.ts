// The Power Shot: a right reload answer earns one extra, stronger shot. Never a wrong answer.
import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import { BONUS, DAMAGE, TEAM_FACING, TURN } from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import {
  effectsFor,
  freshLoadout,
  type MatchEffects,
  type TeamLoadout,
} from '../../src/game/loadout';
import { createMatch } from '../../src/game/match';
import {
  IllegalTransitionError,
  MatchOverError,
  otherTeam,
  type AimInput,
  type BlastResult,
  type MatchController,
  type Players,
} from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 5, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'reading' },
];
const RIGHT_FAST = { correct: true, elapsedMs: 1000 };
const RIGHT_SLOW = { correct: true, elapsedMs: 60_000 };
const WRONG = { correct: false, elapsedMs: 1000 };

const effectsWith = (
  past: Partial<TeamLoadout> = {},
  future: Partial<TeamLoadout> = {},
): MatchEffects => ({
  PAST: effectsFor('PAST', { ...freshLoadout('PAST'), ...past }),
  FUTURE: effectsFor('FUTURE', { ...freshLoadout('FUTURE'), ...future }),
});

function findAim(
  c: MatchController,
  effects: MatchEffects | undefined,
  want: BlastResult,
): AimInput {
  const snap = c.snapshot();
  const team = snap.turn.team;
  for (let power = 100; power >= 0; power -= 1) {
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += 1) {
      const r = simulateShot({
        angleDeg,
        power,
        wind: snap.wind,
        origin: c.layout.launchOrigins[team],
        facing: TEAM_FACING[team],
        layout: c.layout,
        speedScale: effects?.[team].speedScale,
      });
      const scored =
        r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout'
          ? 'miss'
          : classifyBlast(r.landing, c.layout.bases[otherTeam(team)]);
      if (scored === want) return { angleDeg, power };
    }
  }
  throw new Error(`no ${want} aim found`);
}

const shoot = (c: MatchController, effects: MatchEffects | undefined, want: BlastResult) => {
  c.setAim(findAim(c, effects, want));
  c.fire();
  return c.shotLanded();
};

/** Ready, two shots that score `want`, then the reload with `answer`. */
function toBonus(
  c: MatchController,
  answer = RIGHT_FAST,
  want: BlastResult = 'miss',
  effects?: MatchEffects,
) {
  c.ready();
  shoot(c, effects, want);
  shoot(c, effects, want);
  return c.reloadDone(answer);
}

const make = (seed = 5, effects?: MatchEffects) => createMatch({ disturbances: false, players: PLAYERS, seed, effects });

describe('the Power Shot is offered', () => {
  it('after a fast right answer', () => {
    const c = make();
    expect(toBonus(c, RIGHT_FAST)).toMatchObject({ bonus: true, scrap: 2, fast: true });
    expect(c.snapshot().turn).toMatchObject({ phase: 'BONUS_AIMING', bonus: true });
  });
  it('after a slow right answer (a right answer is enough)', () => {
    const c = make();
    expect(toBonus(c, RIGHT_SLOW)).toMatchObject({ bonus: true, scrap: 1, fast: false });
    expect(c.snapshot().turn.phase).toBe('BONUS_AIMING');
  });
  it('never after a wrong answer, which just moves on (Gate 2)', () => {
    const c = make();
    expect(toBonus(c, WRONG)).toMatchObject({ bonus: false, scrap: 0 });
    expect(c.snapshot().turn).toMatchObject({ phase: 'NEXT_PLAYER', bonus: false });
    c.pass();
    expect(c.snapshot().turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'FUTURE', bonus: false });
  });
  it('never when the question was lost (the flow reports it as not correct)', () => {
    const c = make();
    expect(toBonus(c, { correct: false, elapsedMs: Infinity })).toMatchObject({ bonus: false });
    expect(c.snapshot().turn.phase).toBe('NEXT_PLAYER');
  });
});

describe('the Power Shot is bounded', () => {
  it('is not shot 3: shotsFired stays 2, and the stats count the extra shot', () => {
    const c = make();
    toBonus(c);
    shoot(c, undefined, 'direct');
    const s = c.snapshot();
    expect(s.turn.shotsFired).toBe(2);
    expect(s.stats.PAST.shotsFired).toBe(3);
    expect(s.stats.PAST.directHits).toBe(1);
    expect(s.turn.phase).toBe('NEXT_PLAYER');
  });
  it('cannot be fired twice', () => {
    const c = make();
    toBonus(c);
    shoot(c, undefined, 'miss');
    expect(() => c.fire()).toThrow(IllegalTransitionError);
    expect(() => c.reloadDone(RIGHT_FAST)).toThrow(IllegalTransitionError);
  });
  it('cannot be skipped by passing, and has no question of its own', () => {
    const c = make();
    toBonus(c);
    expect(() => c.pass()).toThrow(IllegalTransitionError);
    expect(() => c.reloadDone(RIGHT_FAST)).toThrow(IllegalTransitionError);
    expect(() => c.ready()).toThrow(IllegalTransitionError);
    expect(c.snapshot().turn.phase).toBe('BONUS_AIMING');
  });
  it('cannot land before it flies, and cannot fire or aim while in the air', () => {
    const c = make();
    toBonus(c);
    expect(() => c.shotLanded()).toThrow(IllegalTransitionError);
    c.fire();
    expect(() => c.fire()).toThrow(IllegalTransitionError);
    expect(() => c.setAim({ angleDeg: 5, power: 5 })).toThrow(IllegalTransitionError);
    c.shotLanded();
    expect(() => c.shotLanded()).toThrow(IllegalTransitionError);
  });
  it('lets the player aim in BONUS_AIMING', () => {
    const c = make();
    toBonus(c);
    expect(c.setAim({ angleDeg: 33, power: 44 })).toEqual({ angleDeg: 33, power: 44 });
  });
  it('lets the player pick a fighter in BONUS_AIMING', () => {
    const c = make();
    toBonus(c);
    const id = c.snapshot().selected.PAST;
    expect(() => c.selectUnit(id)).not.toThrow();
  });
  it('the next turn starts clean: no bonus carried over', () => {
    const c = make();
    toBonus(c);
    shoot(c, undefined, 'miss');
    c.pass();
    expect(c.snapshot().turn).toMatchObject({ team: 'FUTURE', shotsFired: 0, bonus: false });
  });
});

describe('Power Shot damage', () => {
  it('is the multiplier times the hit, rounded', () => {
    expect(BONUS.damageMultiplier).toBe(1.5);
    const direct = make(5);
    toBonus(direct);
    expect(shoot(direct, undefined, 'direct').damage).toBe(
      Math.round(DAMAGE.direct * BONUS.damageMultiplier),
    );
    const near = make(5);
    toBonus(near);
    expect(shoot(near, undefined, 'near').damage).toBe(
      Math.round(DAMAGE.near * BONUS.damageMultiplier),
    );
  });
  it('a miss still does nothing', () => {
    const c = make();
    toBonus(c);
    expect(shoot(c, undefined, 'miss').damage).toBe(0);
    expect(c.snapshot().baseHp.FUTURE).toBe(DAMAGE.startingBaseHp);
  });
  it('a wall cuts the Power Shot after the boost, never below 1', () => {
    const e = effectsWith({}, { upgrades: { wall: 3 } });
    const c = make(5, e);
    toBonus(c, RIGHT_FAST, 'miss', e);
    expect(shoot(c, e, 'direct').damage).toBe(
      Math.max(1, Math.round(e.PAST.direct * BONUS.damageMultiplier) - e.FUTURE.directCut),
    );
    const huge: MatchEffects = { ...e, FUTURE: { ...e.FUTURE, directCut: 999 } };
    const d = make(5, huge);
    toBonus(d, RIGHT_FAST, 'miss', huge);
    expect(shoot(d, huge, 'direct').damage).toBe(1);
  });
  it('a force field blocks the Power Shot too', () => {
    const e = effectsWith({}, { upgrades: { forceField: 1 } });
    const c = make(5, e);
    toBonus(c, RIGHT_FAST, 'miss', e);
    const out = shoot(c, e, 'direct');
    expect(out).toMatchObject({ damage: 0, blocked: true });
    expect(c.snapshot().baseHp.FUTURE).toBe(e.FUTURE.maxHp);
  });
  it('a whole turn (2 shots plus the Power Shot) stays under 2.5x a plain two-shot turn', () => {
    const plain = DAMAGE.direct * TURN.shotsPerTurn;
    const c = make();
    c.ready();
    shoot(c, undefined, 'direct');
    shoot(c, undefined, 'direct');
    c.reloadDone(RIGHT_FAST);
    shoot(c, undefined, 'direct');
    const dealt = DAMAGE.startingBaseHp - c.snapshot().baseHp.FUTURE;
    expect(dealt).toBe(plain + Math.round(DAMAGE.direct * BONUS.damageMultiplier));
    expect(dealt).toBeLessThanOrEqual(plain * 2.5);
    expect(dealt).toBeGreaterThan(plain);
  });
});

describe('the match can end on the Power Shot', () => {
  it('sets OVER and the winner, and then every action throws MatchOverError', () => {
    const c = make(5);
    const power = Math.round(DAMAGE.direct * BONUS.damageMultiplier);
    // Past lands direct hits until one Power Shot is enough to finish Future, then only misses.
    // Future only misses. Nobody answers right, so no Power Shot comes early.
    const hp = (): number => c.snapshot().baseHp.FUTURE;
    for (let guard = 0; hp() > power && guard < DAMAGE.startingBaseHp; guard++) {
      c.ready();
      shoot(c, undefined, hp() > power ? 'direct' : 'miss');
      shoot(c, undefined, hp() > power ? 'direct' : 'miss');
      c.reloadDone(WRONG);
      c.pass();
      c.ready();
      shoot(c, undefined, 'miss');
      shoot(c, undefined, 'miss');
      c.reloadDone(WRONG);
      c.pass();
    }
    expect(hp()).toBeGreaterThan(0);
    expect(hp()).toBeLessThanOrEqual(power);
    expect(c.snapshot().status).toBe('PLAYING');
    toBonus(c, RIGHT_SLOW);
    shoot(c, undefined, 'direct');
    const s = c.snapshot();
    expect(s.baseHp.FUTURE).toBe(0);
    expect(s.status).toBe('OVER');
    expect(s.winner).toBe('PAST');
    expect(() => c.pass()).toThrow(MatchOverError);
    expect(() => c.fire()).toThrow(MatchOverError);
  });
});
