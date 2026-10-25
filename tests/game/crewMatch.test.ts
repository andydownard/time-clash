// Squads S1 inside a real match: picking a helper, dashing, go counting, and flag off.
import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/game/match';
import { IllegalCommandError } from '../../src/game/crew';
import { DAMAGE, SQUADS } from '../../src/game/config';
import { IllegalTransitionError, type MatchController, type Players } from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 5, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'reading' },
];
const on = (seed = 3): MatchController => createMatch({ players: PLAYERS, seed, squads: true });
const aiming = (c: MatchController): MatchController => {
  c.ready();
  return c;
};
const reason = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (e) {
    if (e instanceof IllegalCommandError) return e.reason;
    throw e;
  }
  return null;
};

describe('the flag', () => {
  it('is off by default', () => {
    expect(SQUADS.enabled).toBe(false);
  });
  it('off: the snapshot has no squads and the new moves are refused', () => {
    const c = aiming(createMatch({ players: PLAYERS, seed: 3 }));
    expect(c.snapshot().squads).toBeUndefined();
    expect(reason(() => c.selectHelper('PAST-dasher'))).toBe('flag_off');
    expect(reason(() => c.dash('g2'))).toBe('flag_off');
    expect(c.helperTargets()).toEqual([]);
  });
  it('off equals today: a flag-off match and an explicit squads:false match play the same', () => {
    const run = (opts: { squads?: boolean }) => {
      const c = createMatch({ players: PLAYERS, seed: 5, ...opts });
      c.ready();
      c.setAim({ angleDeg: 45, power: 80 });
      const shot = c.fire();
      c.shotLanded();
      return JSON.stringify({ shot, snap: c.snapshot() });
    };
    expect(run({})).toBe(run({ squads: false }));
  });
  it('on: the snapshot shows the crew, the pick and the go number', () => {
    const c = aiming(on());
    const sq = c.snapshot().squads;
    expect(sq?.go).toBe(1);
    expect(sq?.picked.PAST).toBe('PAST-launcher');
    expect(sq?.crew.helpers).toHaveLength(4);
  });
  it('does not turn on with character health', () => {
    const c = createMatch({ players: PLAYERS, seed: 3, squads: true, characterHealth: true });
    expect(c.snapshot().squads).toBeUndefined();
  });
  it('survives a rematch option', () => {
    expect(on().rematchOptions().squads).toBe(true);
  });
});

describe('picking a helper', () => {
  it('is free and does not use a go', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    c.selectHelper('PAST-launcher');
    expect(c.snapshot().turn.shotsFired).toBe(0);
    expect(c.snapshot().squads?.go).toBe(1);
  });
  it('lists dash targets for the picked dasher only', () => {
    const c = aiming(on());
    expect(c.helperTargets()).toEqual([]);
    c.selectHelper('PAST-dasher');
    expect(c.helperTargets()).toEqual(['g2']);
  });
  it('refuses the other side (wrong unit)', () => {
    const c = aiming(on());
    expect(reason(() => c.selectHelper('FUTURE-dasher'))).toBe('not_your_helper');
  });
  it('refuses before the turn starts (acting out of turn)', () => {
    const c = on();
    expect(() => c.selectHelper('PAST-dasher')).toThrow(IllegalTransitionError);
    expect(() => c.dash('g2')).toThrow(IllegalTransitionError);
  });
  it('remembers the pick into the next turn', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    c.dash('g2');
    c.selectHelper('PAST-dasher');
    expect(c.snapshot().squads?.picked.PAST).toBe('PAST-dasher');
  });
});

describe('a dash go', () => {
  it('counts as a go and moves the dasher', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    const out = c.dash('g2');
    expect(out.to).toBe('g2');
    const s = c.snapshot();
    expect(s.turn.phase).toBe('AIMING');
    expect(s.turn.shotsFired).toBe(1);
    expect(s.squads?.go).toBe(2);
  });
  it('goes to reload after go 2, then a third go throws', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    c.dash('g2');
    c.selectHelper('PAST-launcher');
    c.setAim({ angleDeg: 45, power: 80 });
    c.fire();
    c.shotLanded();
    expect(c.snapshot().turn.phase).toBe('RELOAD');
    expect(() => c.fire()).toThrow(IllegalTransitionError);
    expect(() => c.dash('g1')).toThrow(IllegalTransitionError);
    expect(() => c.selectHelper('PAST-dasher')).toThrow(IllegalTransitionError);
  });
  it('the same helper may go twice', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    c.dash('g2');
    c.dash('g1');
    expect(c.snapshot().turn.phase).toBe('RELOAD');
  });
  it('cannot skip the reload: pass needs the reload first', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    c.dash('g2');
    c.dash('g1');
    expect(() => c.pass()).toThrow(IllegalTransitionError);
    c.reloadDone({ correct: false, elapsedMs: 1000 });
    c.pass();
    expect(c.snapshot().turn.team).toBe('FUTURE');
  });
  it('a wrong answer still passes the turn and the crew is picked again next turn', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    c.dash('g2');
    c.dash('g1');
    c.reloadDone({ correct: false, elapsedMs: 1000 });
    c.pass();
    c.ready();
    expect(c.snapshot().turn.phase).toBe('AIMING');
    expect(c.snapshot().squads?.go).toBe(1);
  });
  it('a right answer gives the Power Shot to the launcher, even after a dash', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    c.dash('g2');
    c.dash('g1');
    c.reloadDone({ correct: true, elapsedMs: 1000 });
    expect(c.snapshot().turn.phase).toBe('BONUS_AIMING');
    expect(c.snapshot().squads?.picked.PAST).toBe('PAST-launcher');
    expect(() => c.dash('g2')).toThrow(IllegalTransitionError);
    expect(() => c.selectHelper('PAST-dasher')).toThrow(IllegalTransitionError);
    c.fire();
    c.shotLanded();
  });
  it('the launcher cannot dash and the dasher cannot fire (wrong unit)', () => {
    const c = aiming(on());
    expect(reason(() => c.dash('g2'))).toBe('wrong_command');
    c.selectHelper('PAST-dasher');
    expect(reason(() => c.fire())).toBe('wrong_command');
    expect(c.snapshot().turn.shotsFired).toBe(0);
  });
  it('an illegal dash changes nothing and uses no go', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    expect(reason(() => c.dash('g0'))).toBe('own_doorstep');
    expect(reason(() => c.dash('g3'))).toBe('spot_taken');
    expect(c.snapshot().turn.shotsFired).toBe(0);
    expect(c.snapshot().squads?.crew.helpers.find((h) => h.id === 'PAST-dasher')?.spot).toBe('g1');
  });
});

describe('a dash to the doorstep', () => {
  /** Past dashes in, Future answers, and so on until the Past dasher can reach g4. */
  it('hurts the base by the dash bonk and is seeded', () => {
    const play = (): number[] => {
      const c = aiming(on(9));
      c.selectHelper('PAST-dasher');
      c.dash('g2'); // bonks the Future dasher next door (it stays home on g3)
      c.dash('g1');
      c.reloadDone({ correct: false, elapsedMs: 1000 });
      c.pass();
      c.ready();
      c.selectHelper('FUTURE-dasher');
      c.dash('g2'); // Future dasher leaves g3 for g2
      c.dash('g3');
      c.reloadDone({ correct: false, elapsedMs: 1000 });
      c.pass();
      c.ready();
      c.selectHelper('PAST-dasher');
      c.dash('g2');
      c.dash('g4');
      return [c.snapshot().baseHp.FUTURE, c.snapshot().baseHp.PAST];
    };
    const a = play();
    expect(a).toEqual([DAMAGE.startingBaseHp - SQUADS.dashBonkDamage, DAMAGE.startingBaseHp]);
    expect(play()).toEqual(a);
  });
});
