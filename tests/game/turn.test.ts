import { describe, expect, it } from 'vitest';
import { HUD, turnBanner } from '../../src/data/copy';
import { TURN } from '../../src/game/config';
import { createTurn, transition } from '../../src/game/turn';
import { IllegalTransitionError } from '../../src/game/types';
import type { TurnEvent, TurnEventType, TurnPhase, TurnState } from '../../src/game/types';

const EVENTS: TurnEventType[] = ['READY', 'FIRE', 'SHOT_LANDED', 'RELOAD_DONE', 'PASS'];
const ev = (type: TurnEventType): TurnEvent => ({ type }) as TurnEvent;

const st = (
  phase: TurnPhase,
  shotsFired: 0 | 1 | 2,
  team: 'PAST' | 'FUTURE' = 'PAST',
  turnNumber = 0,
): TurnState => ({
  phase,
  team,
  turnNumber,
  shotsFired,
});

/** Every state in a real turn, with the one event that is allowed there. */
const LEGAL: { from: TurnState; event: TurnEventType; to: TurnState }[] = [
  { from: st('PASS_SCREEN', 0), event: 'READY', to: st('AIMING', 0) },
  { from: st('AIMING', 0), event: 'FIRE', to: st('SHOT_1', 1) },
  { from: st('SHOT_1', 1), event: 'SHOT_LANDED', to: st('AIMING', 1) },
  { from: st('AIMING', 1), event: 'FIRE', to: st('SHOT_2', 2) },
  { from: st('SHOT_2', 2), event: 'SHOT_LANDED', to: st('RELOAD', 2) },
  { from: st('RELOAD', 2), event: 'RELOAD_DONE', to: st('NEXT_PLAYER', 2) },
  { from: st('NEXT_PLAYER', 2), event: 'PASS', to: st('PASS_SCREEN', 0, 'FUTURE', 1) },
];

describe('createTurn', () => {
  it('starts in PASS_SCREEN with no shots', () => {
    expect(createTurn('FUTURE', 3)).toEqual(st('PASS_SCREEN', 0, 'FUTURE', 3));
  });
});

describe('transition: legal moves', () => {
  it.each(LEGAL)('$from.phase/$from.shotsFired + $event -> $to.phase', ({ from, event, to }) => {
    expect(transition(from, ev(event))).toEqual(to);
  });

  it('never mutates the state passed in', () => {
    const s = Object.freeze(st('AIMING', 0));
    expect(() => transition(s, ev('FIRE'))).not.toThrow();
    expect(s.phase).toBe('AIMING');
  });

  it('PASS flips the team and bumps turnNumber both ways', () => {
    expect(transition(st('NEXT_PLAYER', 2, 'FUTURE', 5), ev('PASS'))).toEqual(
      st('PASS_SCREEN', 0, 'PAST', 6),
    );
  });
});

describe('transition: every other state x event pair throws', () => {
  const legalKeys = new Set(LEGAL.map((l) => `${l.from.phase}:${l.from.shotsFired}:${l.event}`));
  const allStates: TurnState[] = [
    st('PASS_SCREEN', 0),
    st('AIMING', 0),
    st('AIMING', 1),
    st('SHOT_1', 1),
    st('SHOT_2', 2),
    st('RELOAD', 2),
    st('NEXT_PLAYER', 2),
  ];
  const illegal = allStates.flatMap((from) =>
    EVENTS.filter((e) => !legalKeys.has(`${from.phase}:${from.shotsFired}:${e}`)).map((e) => ({
      from,
      event: e,
    })),
  );

  it('covers 7 states x 5 events minus 7 legal = 28 illegal pairs', () => {
    expect(illegal).toHaveLength(28);
  });

  it.each(illegal)(
    '$from.phase/$from.shotsFired + $event throws IllegalTransitionError',
    ({ from, event }) => {
      expect(() => transition(from, ev(event))).toThrow(IllegalTransitionError);
    },
  );

  it('carries the phase and event on the error', () => {
    try {
      transition(st('RELOAD', 2), ev('FIRE'));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalTransitionError);
      expect((e as IllegalTransitionError).phase).toBe('RELOAD');
      expect((e as IllegalTransitionError).event).toBe('FIRE');
    }
  });

  it('throws on an unknown event', () => {
    expect(() => transition(st('AIMING', 0), { type: 'EXPLODE' } as unknown as TurnEvent)).toThrow(
      IllegalTransitionError,
    );
  });
});

describe('TURN.shotsPerTurn is the number of shots the machine really allows', () => {
  it('the machine accepts exactly TURN.shotsPerTurn shots, then goes to RELOAD', () => {
    let s = transition(createTurn('PAST', 0), ev('READY'));
    let accepted = 0;
    while (s.phase === 'AIMING') {
      s = transition(s, ev('FIRE'));
      accepted++;
      s = transition(s, ev('SHOT_LANDED'));
      expect(accepted).toBeLessThanOrEqual(10);
    }
    expect(s.phase).toBe('RELOAD');
    expect(accepted).toBe(TURN.shotsPerTurn);
  });
  it('the words on screen use the same number', () => {
    expect(HUD.shotsValue(1)).toBe(`1 of ${TURN.shotsPerTurn}`);
    expect(turnBanner('Alex', 1)).toContain(`OF ${TURN.shotsPerTurn}`);
  });
});

describe('transition: a turn has exactly 2 shots and cannot be skipped', () => {
  it('a third shot throws: after shot 2 lands the only way forward is RELOAD', () => {
    let s = createTurn('PAST', 0);
    s = transition(s, ev('READY'));
    s = transition(s, ev('FIRE'));
    s = transition(s, ev('SHOT_LANDED'));
    s = transition(s, ev('FIRE'));
    s = transition(s, ev('SHOT_LANDED'));
    expect(s.phase).toBe('RELOAD');
    expect(() => transition(s, ev('FIRE'))).toThrow(IllegalTransitionError);
    expect(() => transition(s, ev('READY'))).toThrow(IllegalTransitionError);
  });

  it('cannot fire while the first shot is still in the air', () => {
    expect(() => transition(st('SHOT_1', 1), ev('FIRE'))).toThrow(IllegalTransitionError);
    expect(() => transition(st('SHOT_2', 2), ev('FIRE'))).toThrow(IllegalTransitionError);
  });

  it('the reload cannot be skipped: no PASS from SHOT_2, AIMING, or RELOAD', () => {
    for (const s of [st('SHOT_2', 2), st('AIMING', 1), st('RELOAD', 2), st('SHOT_1', 1)]) {
      expect(() => transition(s, ev('PASS'))).toThrow(IllegalTransitionError);
    }
  });

  it('the turn cannot be skipped: no PASS or RELOAD_DONE straight from PASS_SCREEN', () => {
    const s = createTurn('PAST', 0);
    expect(() => transition(s, ev('PASS'))).toThrow(IllegalTransitionError);
    expect(() => transition(s, ev('RELOAD_DONE'))).toThrow(IllegalTransitionError);
  });

  it('rejects a corrupt state (AIMING with 2 shots fired)', () => {
    expect(() => transition(st('AIMING', 2), ev('FIRE'))).toThrow(IllegalTransitionError);
  });

  it('a full lap fires exactly 2 shots and alternates teams over 6 turns', () => {
    let s = createTurn('PAST', 0);
    let fires = 0;
    for (let turn = 0; turn < 6; turn++) {
      expect(s.team).toBe(turn % 2 === 0 ? 'PAST' : 'FUTURE');
      expect(s.turnNumber).toBe(turn);
      for (const e of [
        'READY',
        'FIRE',
        'SHOT_LANDED',
        'FIRE',
        'SHOT_LANDED',
        'RELOAD_DONE',
        'PASS',
      ] as const) {
        if (e === 'FIRE') fires++;
        s = transition(s, ev(e));
      }
    }
    expect(fires).toBe(12);
  });
});
