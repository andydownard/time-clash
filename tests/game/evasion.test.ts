import { describe, expect, it } from 'vitest';
import { EVASION } from '../../src/game/config';
import {
  arm,
  disarm,
  endOwnTurn,
  EvasionError,
  evasionView,
  freshEvasion,
  spend,
  startOwnTurn,
  wallsFor,
  type EvasionState,
} from '../../src/game/evasion';

const reason = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EvasionError) return e.reason;
    throw e;
  }
  return 'no error';
};

describe('freshEvasion', () => {
  it('gives Team Future the Hoverboard Dodge and Team Past the Stone Barricade', () => {
    expect(freshEvasion('FUTURE').id).toBe('dodge');
    expect(freshEvasion('PAST').id).toBe('barricade');
    expect(EVASION.dodge.team).toBe('FUTURE');
    expect(EVASION.barricade.team).toBe('PAST');
  });
  it('starts ready', () => {
    expect(freshEvasion('FUTURE').phase).toBe('ready');
    expect(freshEvasion('PAST').phase).toBe('ready');
    expect(freshEvasion('PAST').usesLeft).toBe(1);
    expect(freshEvasion('FUTURE').usesLeft).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('Hoverboard Dodge', () => {
  it('arm, then it guards the next enemy turn, then recharges for 2 own turns', () => {
    let s = arm(freshEvasion('FUTURE'));
    expect(s.phase).toBe('armed');
    s = endOwnTurn(s);
    expect(s.phase).toBe('active');
    s = startOwnTurn(s); // next own turn: it was not needed
    expect(s.phase).toBe('recharging');
    expect(evasionView(s).turnsLeft).toBe(1);
    expect(() => arm(s)).toThrow(EvasionError);
    s = endOwnTurn(s);
    s = startOwnTurn(s); // two own turns after arming
    expect(s.phase).toBe('ready');
    expect(arm(s).phase).toBe('armed');
  });

  it('a dodge that is used up still waits the same 2 own turns', () => {
    let s = endOwnTurn(arm(freshEvasion('FUTURE')));
    s = spend(s);
    expect(s.phase).toBe('recharging');
    s = startOwnTurn(s);
    expect(s.phase).toBe('recharging');
    s = startOwnTurn(endOwnTurn(s));
    expect(s.phase).toBe('ready');
  });

  it('spend does nothing unless it is active', () => {
    const ready = freshEvasion('FUTURE');
    expect(spend(ready)).toEqual(ready);
    const armed = arm(ready);
    expect(spend(armed)).toEqual(armed);
  });
});

describe('Stone Barricade Wall', () => {
  it('works once per match', () => {
    let s = arm(freshEvasion('PAST'));
    expect(s.usesLeft).toBe(0);
    s = endOwnTurn(s);
    expect(s.phase).toBe('active');
    s = startOwnTurn(s);
    expect(s.phase).toBe('used');
    expect(reason(() => arm(s))).toBe('used_up');
    // Many turns later it is still used up.
    for (let i = 0; i < 5; i++) s = startOwnTurn(endOwnTurn(s));
    expect(s.phase).toBe('used');
  });

  it('stands a wall only while active', () => {
    const past = (s: EvasionState) => ({ PAST: s, FUTURE: freshEvasion('FUTURE') });
    const armed = arm(freshEvasion('PAST'));
    expect(wallsFor(past(armed))).toEqual([]);
    expect(wallsFor(past(endOwnTurn(armed)))).toEqual([EVASION.barricade.wall]);
    expect(wallsFor(past(startOwnTurn(endOwnTurn(armed))))).toEqual([]);
  });

  it('a hit does not spend the wall', () => {
    const s = endOwnTurn(arm(freshEvasion('PAST')));
    expect(spend(s)).toEqual(s);
  });
});

describe('misuse (negative paths)', () => {
  it('cannot arm twice in one turn', () => {
    expect(reason(() => arm(arm(freshEvasion('FUTURE'))))).toBe('already_armed');
    expect(reason(() => arm(arm(freshEvasion('PAST'))))).toBe('already_armed');
  });
  it('cannot arm while it is guarding', () => {
    const s = endOwnTurn(arm(freshEvasion('FUTURE')));
    expect(reason(() => arm(s))).toBe('already_armed');
  });
  it('cannot arm while recharging', () => {
    const s = startOwnTurn(endOwnTurn(arm(freshEvasion('FUTURE'))));
    expect(reason(() => arm(s))).toBe('recharging');
  });
  it('disarm only takes back an ability armed this turn, and gives the use back', () => {
    expect(reason(() => disarm(freshEvasion('PAST')))).toBe('not_armed');
    const back = disarm(arm(freshEvasion('PAST')));
    expect(back).toEqual(freshEvasion('PAST'));
    const dodgeBack = disarm(arm(freshEvasion('FUTURE')));
    expect(dodgeBack).toEqual(freshEvasion('FUTURE'));
    const active = endOwnTurn(arm(freshEvasion('PAST')));
    expect(reason(() => disarm(active))).toBe('not_armed');
  });
  it('never mutates the state it is given', () => {
    const s = freshEvasion('FUTURE');
    const copy = JSON.stringify(s);
    arm(s);
    startOwnTurn(s);
    endOwnTurn(s);
    expect(JSON.stringify(s)).toBe(copy);
  });
  it('turn steps on a ready ability change nothing', () => {
    const s = freshEvasion('PAST');
    expect(endOwnTurn(s)).toEqual(s);
    expect(startOwnTurn(s)).toEqual(s);
  });
});
