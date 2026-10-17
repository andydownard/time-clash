// Picking a fighter inside a real match.
import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/game/match';
import { simulateShot } from '../../src/game/ballistics';
import { DAMAGE, PHASE1_LAYOUT, TEAM_FACING } from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import { DEFAULT_EFFECTS } from '../../src/game/loadout';
import { DEFAULT_UNIT, UNITS, unitById } from '../../src/game/units';
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
const make = (seed = 3): MatchController => createMatch({ players: PLAYERS, seed });
const FAST = { correct: true, elapsedMs: 1000 };

/** Brute-force an aim that scores `want` from the fighter now selected. */
function findAim(c: MatchController, want: BlastResult): AimInput {
  const snap = c.snapshot();
  const team = snap.turn.team;
  const u = unitById(snap.selected[team])!;
  for (let power = 100; power >= 0; power--) {
    for (let angleDeg = 0; angleDeg <= 90; angleDeg++) {
      const r = simulateShot({
        angleDeg,
        power,
        wind: snap.wind,
        origin: u.origin,
        facing: TEAM_FACING[team],
        layout: c.layout,
        speedScale: DEFAULT_EFFECTS[team].speedScale * u.speedScale,
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

describe('selected fighters in the snapshot', () => {
  it('starts with the default fighters', () => {
    expect(make().snapshot().selected).toEqual({ PAST: 'C', FUTURE: '1' });
    expect(make().snapshot().selected).toEqual(DEFAULT_UNIT);
  });

  it('hands out copies', () => {
    const c = make();
    const snap = c.snapshot();
    (snap.selected as Record<string, string>).PAST = 'A';
    expect(c.snapshot().selected.PAST).toBe('C');
  });
});

describe('selectUnit', () => {
  it('works while aiming and changes the snapshot', () => {
    const c = make();
    c.ready();
    c.selectUnit('D');
    expect(c.snapshot().selected).toEqual({ PAST: 'D', FUTURE: '1' });
  });

  it('is free: it does not count as a shot or change the phase', () => {
    const c = make();
    c.ready();
    c.selectUnit('B');
    c.selectUnit('E');
    const t = c.snapshot().turn;
    expect(t.phase).toBe('AIMING');
    expect(t.shotsFired).toBe(0);
    expect(c.snapshot().stats.PAST.shotsFired).toBe(0);
  });

  it('may be done before each shot', () => {
    const c = make();
    c.ready();
    c.selectUnit('A');
    c.fire();
    c.shotLanded();
    expect(c.snapshot().turn.phase).toBe('AIMING');
    c.selectUnit('B');
    c.fire();
    expect(c.snapshot().lastShot?.unit).toBe('B');
  });

  it('throws in PASS_SCREEN', () => {
    const c = make();
    expect(() => c.selectUnit('A')).toThrow(IllegalTransitionError);
    try {
      c.selectUnit('A');
    } catch (e) {
      expect((e as IllegalTransitionError).phase).toBe('PASS_SCREEN');
      expect((e as IllegalTransitionError).event).toBe('SELECT_UNIT');
    }
  });

  it('throws while a shot is in the air', () => {
    const c = make();
    c.ready();
    c.fire();
    expect(() => c.selectUnit('A')).toThrow(IllegalTransitionError);
  });

  it('throws in RELOAD', () => {
    const c = make();
    c.ready();
    c.fire();
    c.shotLanded();
    c.fire();
    c.shotLanded();
    expect(c.snapshot().turn.phase).toBe('RELOAD');
    expect(() => c.selectUnit('A')).toThrow(IllegalTransitionError);
  });

  it('throws in NEXT_PLAYER', () => {
    const c = make();
    c.ready();
    c.fire();
    c.shotLanded();
    c.fire();
    c.shotLanded();
    c.reloadDone(FAST);
    expect(c.snapshot().turn.phase).toBe('NEXT_PLAYER');
    expect(() => c.selectUnit('A')).toThrow(IllegalTransitionError);
  });

  it("refuses the other team's fighter", () => {
    const c = make();
    c.ready();
    expect(() => c.selectUnit('2')).toThrow(RangeError);
    expect(c.snapshot().selected.FUTURE).toBe('1');
  });

  it('refuses an unknown id', () => {
    const c = make();
    c.ready();
    expect(() => c.selectUnit('Z' as never)).toThrow(RangeError);
    expect(() => c.selectUnit('' as never)).toThrow(RangeError);
    expect(c.snapshot().selected.PAST).toBe('C');
  });

  it('throws MatchOverError after the match ends', () => {
    const c = make();
    for (let i = 0; i < 12 && c.snapshot().status === 'PLAYING'; i++) {
      c.ready();
      for (let s = 0; s < 2 && c.snapshot().status === 'PLAYING'; s++) {
        c.setAim(findAim(c, 'direct'));
        c.fire();
        c.shotLanded();
      }
      if (c.snapshot().status === 'PLAYING') {
        c.reloadDone(FAST);
        c.pass();
      }
    }
    expect(c.snapshot().status).toBe('OVER');
    expect(() => c.selectUnit('A')).toThrow(MatchOverError);
  });

  it("remembers each team's fighter across turns", () => {
    const c = make();
    c.ready();
    c.selectUnit('D');
    c.fire();
    c.shotLanded();
    c.fire();
    c.shotLanded();
    c.reloadDone(FAST);
    c.pass();
    c.ready();
    expect(c.snapshot().selected).toEqual({ PAST: 'D', FUTURE: '1' });
    c.selectUnit('5');
    c.fire();
    c.shotLanded();
    c.fire();
    c.shotLanded();
    c.reloadDone(FAST);
    c.pass();
    c.ready();
    expect(c.snapshot().turn.team).toBe('PAST');
    expect(c.snapshot().selected).toEqual({ PAST: 'D', FUTURE: '5' });
  });

  it('keeps the choice in a rematch only as the default (rematch options do not carry it)', () => {
    const c = make();
    c.ready();
    c.selectUnit('D');
    const again = createMatch(c.rematchOptions());
    expect(again.snapshot().selected).toEqual(DEFAULT_UNIT);
  });
});

describe('firing from the chosen fighter', () => {
  it.each(UNITS.map((u) => [u.id, u] as const))(
    '%s starts its flight at its own origin',
    (_id, u) => {
      // Make it the right team's turn first.
      const c = createMatch({ players: PLAYERS, seed: 5, firstTeam: u.team });
      c.ready();
      c.selectUnit(u.id);
      const r = c.fire();
      if (u.id === DEFAULT_UNIT[u.team])
        expect(r.path[0]).toEqual(PHASE1_LAYOUT.launchOrigins[u.team]);
      else expect(r.path[0]).toEqual(u.origin);
    },
  );

  it('uses the fighter speed scale on top of the weapon', () => {
    const c = make(9);
    c.ready();
    c.selectUnit('E'); // slow spearman
    c.setAim({ angleDeg: 40, power: 70 });
    const r = c.fire();
    const expected = simulateShot({
      angleDeg: 40,
      power: 70,
      wind: c.snapshot().wind,
      origin: unitById('E')!.origin,
      facing: 1,
      layout: c.layout,
      speedScale: DEFAULT_EFFECTS.PAST.speedScale * unitById('E')!.speedScale,
    });
    expect(r.path).toEqual(expected.path);
  });

  it('records the fighter on lastShot', () => {
    const c = make();
    c.ready();
    c.fire();
    expect(c.snapshot().lastShot?.unit).toBe('C');
  });
});

describe('fighter damage', () => {
  /** Score one direct hit with the given fighter on a fresh match; return the damage. */
  function directDamage(id: string, team: 'PAST' | 'FUTURE'): number {
    const c = createMatch({ players: PLAYERS, seed: 4, firstTeam: team });
    c.ready();
    c.selectUnit(id as never);
    c.setAim(findAim(c, 'direct'));
    c.fire();
    return c.shotLanded().damage;
  }

  it('scales a direct hit by the fighter damageScale', () => {
    for (const u of UNITS) {
      expect(directDamage(u.id, u.team), u.id).toBe(
        Math.max(1, Math.round(DAMAGE.direct * u.damageScale)),
      );
    }
  });

  it('never does less than 1', () => {
    for (const u of UNITS) expect(directDamage(u.id, u.team)).toBeGreaterThanOrEqual(1);
  });

  it('scales near misses too', () => {
    const c = createMatch({ players: PLAYERS, seed: 4 });
    c.ready();
    c.selectUnit('E');
    c.setAim(findAim(c, 'near'));
    c.fire();
    const o = c.shotLanded();
    expect(o.result).toBe('near');
    expect(o.damage).toBe(Math.max(1, Math.round(DAMAGE.near * unitById('E')!.damageScale)));
  });

  it('no fighter does more than 1.5 times the baseline direct hit', () => {
    for (const u of UNITS) {
      expect(Math.round(DAMAGE.direct * u.damageScale)).toBeLessThanOrEqual(DAMAGE.direct * 1.5);
    }
  });
});
