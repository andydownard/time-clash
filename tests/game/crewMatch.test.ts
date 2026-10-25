// Squads S1 inside a real match: picking a helper, walking out, the bonk at the start of every
// turn (both teams' turns), Come back, shells near a dasher, go counting, and the flag.
import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/game/match';
import {
  IllegalCommandError,
  attackSpotOf,
  dasherBox,
  dasherOf,
  type Helper,
} from '../../src/game/crew';
import { CHARACTER_HEALTH, SQUADS } from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import { DEFAULT_EFFECTS, type MatchEffects } from '../../src/game/loadout';
import {
  IllegalTransitionError,
  MatchOverError,
  type MatchController,
  type MatchOptions,
  type Players,
  type Team,
} from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 5, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'reading' },
];
const WRONG = { correct: false, elapsedMs: 1000 };
const BONK = SQUADS.standBonkDamage;
const HP = CHARACTER_HEALTH.hp;
const on = (seed = 3, extra: Partial<MatchOptions> = {}): MatchController =>
  createMatch({ players: PLAYERS, seed, squads: true, ...extra });
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
const dasher = (c: MatchController, team: Team): Helper =>
  dasherOf(c.snapshot().squads!.crew, team);
const hp = (c: MatchController) => c.snapshot().baseHp;
/** The active team walks its dasher out (go 1). */
const walkOut = (c: MatchController): void => {
  const team = c.snapshot().turn.team;
  c.selectHelper(`${team}-dasher`);
  c.dash(c.helperTargets()[0]!);
};
/** Finish the turn: the launcher takes a harmless shot straight up and out, then a wrong answer. */
const shootAway = (c: MatchController): void => {
  const team = c.snapshot().turn.team;
  if (c.snapshot().squads) c.selectHelper(`${team}-launcher`);
  c.setAim({ angleDeg: 0, power: 0 });
  c.fire();
  c.shotLanded();
};
const endTurn = (c: MatchController): void => {
  while (c.snapshot().turn.phase === 'AIMING') shootAway(c);
  c.reloadDone(WRONG);
  c.pass();
};
/** An aim for the active launcher whose shell lands as `want` against the enemy dasher's box. */
function aimAtDasher(c: MatchController, want: 'direct' | 'near') {
  const s = c.snapshot();
  const team = s.turn.team;
  const foe = dasherOf(s.squads!.crew, team === 'PAST' ? 'FUTURE' : 'PAST');
  const box = dasherBox(foe.spot!, c.layout);
  for (let power = 0; power <= 100; power++) {
    for (let angleDeg = 90; angleDeg >= 0; angleDeg -= 1) {
      c.setAim({ angleDeg, power });
      const r = c.previewShot();
      if (r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout') continue;
      const got = classifyBlast(r.landing, box, {
        direct: CHARACTER_HEALTH.directScale,
        near: CHARACTER_HEALTH.nearScale,
      });
      if (got === want) return { angleDeg, power };
    }
  }
  throw new Error(`no ${want} aim at the dasher`);
}

describe('the flag', () => {
  it('is on for everyone', () => {
    expect(SQUADS.enabled).toBe(true);
    expect(createMatch({ players: PLAYERS, seed: 3 }).snapshot().squads).toBeDefined();
  });
  it('off: the snapshot has no squads and the new moves are refused', () => {
    const c = aiming(createMatch({ players: PLAYERS, seed: 3, squads: false }));
    expect(c.snapshot().squads).toBeUndefined();
    expect(reason(() => c.selectHelper('PAST-dasher'))).toBe('flag_off');
    expect(reason(() => c.dash('g3'))).toBe('flag_off');
    expect(reason(() => c.recall())).toBe('flag_off');
    expect(c.helperTargets()).toEqual([]);
  });
  it('a match that never sends a dasher plays exactly like a squads:false match', () => {
    const run = (squads: boolean) => {
      const c = createMatch({ players: PLAYERS, seed: 5, squads });
      const out: unknown[] = [];
      for (let t = 0; t < 4; t++) {
        out.push(c.ready());
        c.setAim({ angleDeg: 45, power: 80 });
        out.push(c.fire(), c.shotLanded());
        endTurn(c);
      }
      // Everything but the squad block itself must match.
      const snap = JSON.stringify(c.snapshot(), (k, v: unknown) =>
        k === 'squads' ? undefined : v,
      );
      return JSON.stringify({ out: out.filter((o) => !Array.isArray(o) || o.length), snap });
    };
    expect(run(true)).toBe(run(false));
  });
  it('on: the snapshot shows the crew, the pick, the go number and the dasher health', () => {
    const c = aiming(on());
    const sq = c.snapshot().squads;
    expect(sq?.go).toBe(1);
    expect(sq?.picked.PAST).toBe('PAST-launcher');
    expect(sq?.crew.helpers).toHaveLength(4);
    expect(sq?.maxHp).toBe(HP);
    expect(sq?.ownTurns).toEqual({ PAST: 1, FUTURE: 0 });
  });
  it('does not turn on with character health', () => {
    const c = createMatch({ players: PLAYERS, seed: 3, squads: true, characterHealth: true });
    expect(c.snapshot().squads).toBeUndefined();
    expect(c.ready()).toEqual([]);
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
  it('lists the one stop for the picked dasher only: the attack spot when the way is clear', () => {
    const c = aiming(on());
    expect(c.helperTargets()).toEqual([]);
    c.selectHelper('PAST-dasher');
    expect(c.helperTargets()).toEqual([attackSpotOf('PAST')]);
  });
  it('refuses the other side (wrong unit)', () => {
    const c = aiming(on());
    expect(reason(() => c.selectHelper('FUTURE-dasher'))).toBe('not_your_helper');
  });
  it('refuses before the turn starts (acting out of turn)', () => {
    const c = on();
    expect(() => c.selectHelper('PAST-dasher')).toThrow(IllegalTransitionError);
    expect(() => c.dash('g3')).toThrow(IllegalTransitionError);
    expect(() => c.recall()).toThrow(IllegalTransitionError);
  });
});

describe('walking out', () => {
  it('is a whole go, puts the dasher out with full health and bonks nothing yet', () => {
    const c = aiming(on());
    walkOut(c);
    const s = c.snapshot();
    expect(s.turn.phase).toBe('AIMING');
    expect(s.turn.shotsFired).toBe(1);
    expect(s.squads?.go).toBe(2);
    expect(dasher(c, 'PAST')).toMatchObject({ state: 'out', spot: 'g3', hp: HP });
    expect(hp(c).FUTURE).toBe(s.maxBaseHp.FUTURE);
  });
  it('an illegal dash changes nothing and uses no go', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    expect(reason(() => c.dash('g2'))).toBe('out_of_range');
    expect(reason(() => c.dash('g4'))).toBe('out_of_range');
    expect(c.snapshot().turn.shotsFired).toBe(0);
    expect(dasher(c, 'PAST').state).toBe('home');
  });
  it('a dasher already out cannot walk out again', () => {
    const c = aiming(on());
    walkOut(c);
    expect(c.helperTargets()).toEqual([]);
    expect(reason(() => c.dash('g3'))).toBe('already_out');
    expect(c.snapshot().turn.shotsFired).toBe(1);
  });
  it('the launcher cannot dash and the dasher cannot fire (wrong unit)', () => {
    const c = aiming(on());
    expect(reason(() => c.dash('g3'))).toBe('wrong_command');
    expect(reason(() => c.recall())).toBe('wrong_command');
    c.selectHelper('PAST-dasher');
    expect(reason(() => c.fire())).toBe('wrong_command');
    expect(c.snapshot().turn.shotsFired).toBe(0);
  });
});

describe('the bonk at the start of every turn', () => {
  it('hits the enemy base at the start of the enemy turn, and again at the start of his own', () => {
    const c = aiming(on());
    const full = c.snapshot().maxBaseHp.FUTURE;
    walkOut(c);
    endTurn(c);
    const first = c.ready();
    expect(first).toEqual([
      {
        helper: 'PAST-dasher',
        team: 'PAST',
        from: 'g3',
        to: 'g3',
        target: { kind: 'base', team: 'FUTURE', damage: BONK },
      },
    ]);
    expect(hp(c).FUTURE).toBe(full - BONK);
    endTurn(c);
    c.ready();
    expect(hp(c).FUTURE).toBe(full - 2 * BONK);
  });
  it('is seeded: the same plays give the same health', () => {
    const play = () => {
      const c = aiming(on(9));
      walkOut(c);
      endTurn(c);
      c.ready();
      walkOut(c);
      endTurn(c);
      return [c.ready(), hp(c)];
    };
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });
  it('the gate cut takes some off, but a bonk always does at least 1', () => {
    const effects: MatchEffects = {
      ...DEFAULT_EFFECTS,
      FUTURE: { ...DEFAULT_EFFECTS.FUTURE, nearCut: 5 },
    };
    const c = aiming(on(3, { effects }));
    walkOut(c);
    endTurn(c);
    expect(c.ready()[0]!.target).toMatchObject({ damage: BONK - 5 });
    const big = aiming(
      on(3, { effects: { ...effects, FUTURE: { ...effects.FUTURE, nearCut: 99 } } }),
    );
    walkOut(big);
    endTurn(big);
    expect(big.ready()[0]!.target).toMatchObject({ damage: 1 });
  });
  it('a force field blocks a bonk like a shot', () => {
    const effects: MatchEffects = {
      ...DEFAULT_EFFECTS,
      FUTURE: { ...DEFAULT_EFFECTS.FUTURE, shieldHits: 1 },
    };
    const c = aiming(on(3, { effects }));
    walkOut(c);
    endTurn(c);
    expect(c.ready()[0]!.target).toEqual({
      kind: 'base',
      team: 'FUTURE',
      damage: 0,
      blocked: true,
    });
    endTurn(c);
    expect(c.ready()[0]!.target).toMatchObject({ damage: BONK });
  });
  it('a Hoverboard Dodge makes a bonk miss like a shot', () => {
    const c = aiming(on());
    walkOut(c);
    endTurn(c);
    c.ready(); // Future's turn: the first bonk lands
    c.armEvasion();
    endTurn(c);
    const before = hp(c).FUTURE;
    expect(c.ready()[0]!.target).toEqual({ kind: 'base', team: 'FUTURE', damage: 0, dodged: true });
    expect(hp(c).FUTURE).toBe(before);
  });
  it('two dashers who meet bonk each other, not the bases, until one tumbles', () => {
    const c = aiming(on());
    walkOut(c); // Past to its attack spot
    endTurn(c);
    c.ready(); // the first bonk on Future's base
    walkOut(c); // Future guards its doorstep, right next to him
    expect(dasher(c, 'FUTURE').spot).toBe('g4');
    endTurn(c);
    const baseBefore = hp(c);
    const beats = c.ready();
    expect(beats.map((b) => b.target.kind)).toEqual(['helper', 'helper']);
    expect(hp(c)).toEqual(baseBefore);
    expect(dasher(c, 'PAST').hp).toBe(HP - SQUADS.duelBonkHp);
    expect(dasher(c, 'FUTURE').hp).toBe(HP - SQUADS.duelBonkHp);
  });
});

describe('Come back', () => {
  it('is a whole go and walks the dasher home; he is ready on his next own turn', () => {
    const c = aiming(on());
    walkOut(c);
    c.selectHelper('PAST-dasher');
    const back = c.recall();
    expect(back).toEqual({ helper: 'PAST-dasher', from: 'g3' });
    expect(c.snapshot().turn.phase).toBe('RELOAD');
    expect(dasher(c, 'PAST').state).toBe('resting');
    c.reloadDone(WRONG);
    c.pass();
    expect(c.ready()).toEqual([]); // nobody out, nobody bonks
    endTurn(c);
    c.ready();
    expect(dasher(c, 'PAST').state).toBe('home');
    c.selectHelper('PAST-dasher');
    expect(c.helperTargets()).toEqual(['g3']);
  });
  it('is refused when the dasher is not out', () => {
    const c = aiming(on());
    c.selectHelper('PAST-dasher');
    expect(reason(() => c.recall())).toBe('not_out');
    expect(c.snapshot().turn.shotsFired).toBe(0);
  });
});

describe('a turn is 2 goes, then the reload', () => {
  it('goes to reload after go 2, then a third go throws', () => {
    const c = aiming(on());
    walkOut(c);
    shootAway(c);
    expect(c.snapshot().turn.phase).toBe('RELOAD');
    expect(() => c.fire()).toThrow(IllegalTransitionError);
    expect(() => c.dash('g3')).toThrow(IllegalTransitionError);
    expect(() => c.recall()).toThrow(IllegalTransitionError);
    expect(() => c.selectHelper('PAST-dasher')).toThrow(IllegalTransitionError);
  });
  it('the same helper may go twice: out, then back', () => {
    const c = aiming(on());
    walkOut(c);
    c.recall();
    expect(c.snapshot().turn.phase).toBe('RELOAD');
  });
  it('cannot skip the reload: pass needs the reload first', () => {
    const c = aiming(on());
    walkOut(c);
    c.recall();
    expect(() => c.pass()).toThrow(IllegalTransitionError);
    c.reloadDone(WRONG);
    c.pass();
    expect(c.snapshot().turn.team).toBe('FUTURE');
  });
  it('a right answer gives the Power Shot to the launcher, even after a dash', () => {
    const c = aiming(on());
    walkOut(c);
    c.recall();
    c.reloadDone({ correct: true, elapsedMs: 1000 });
    expect(c.snapshot().turn.phase).toBe('BONUS_AIMING');
    expect(c.snapshot().squads?.picked.PAST).toBe('PAST-launcher');
    expect(() => c.dash('g3')).toThrow(IllegalTransitionError);
    expect(() => c.recall()).toThrow(IllegalTransitionError);
    expect(() => c.selectHelper('PAST-dasher')).toThrow(IllegalTransitionError);
    c.fire();
    c.shotLanded();
  });
});

describe('shells near a dasher', () => {
  /** Past walks out, then it is Future's turn with Past's dasher on the attack spot. */
  const futureFacing = (seed = 3, extra: Partial<MatchOptions> = {}) => {
    const c = aiming(on(seed, extra));
    walkOut(c);
    endTurn(c);
    c.ready();
    return c;
  };
  it('a direct hit costs directHit health', () => {
    const c = futureFacing();
    c.setAim(aimAtDasher(c, 'direct'));
    c.fire();
    const o = c.shotLanded();
    expect(o.dasher).toMatchObject({
      helper: 'PAST-dasher',
      result: 'direct',
      damage: CHARACTER_HEALTH.directHit,
      hp: HP - CHARACTER_HEALTH.directHit,
    });
    expect(dasher(c, 'PAST').hp).toBe(HP - CHARACTER_HEALTH.directHit);
  });
  it('a near miss costs nothing but he wobbles', () => {
    const c = futureFacing();
    c.setAim(aimAtDasher(c, 'near'));
    c.fire();
    expect(c.shotLanded().dasher).toMatchObject({ result: 'near', damage: 0, hp: HP });
  });
  it('a Power Shot hit costs powerHit', () => {
    const c = futureFacing();
    shootAway(c);
    shootAway(c);
    c.reloadDone({ correct: true, elapsedMs: 1000 });
    c.setAim(aimAtDasher(c, 'direct'));
    c.fire();
    expect(c.shotLanded().dasher?.damage).toBe(CHARACTER_HEALTH.powerHit);
  });
  it('at 0 he tumbles home and sits out one full own turn', () => {
    const c = futureFacing();
    for (let i = 0; i < HP && dasher(c, 'PAST').state === 'out'; i++) {
      if (c.snapshot().turn.phase !== 'AIMING') {
        c.reloadDone(WRONG);
        c.pass();
        c.ready(); // Past's turn: he bonks again
        endTurn(c);
        c.ready();
      }
      c.setAim(aimAtDasher(c, 'direct'));
      c.fire();
      const o = c.shotLanded();
      if (dasher(c, 'PAST').state !== 'out') {
        expect(o.dasher).toMatchObject({ hp: 0, tumbled: true });
        expect(o.dasher?.bubbleIndex).not.toBeNull();
      }
    }
    expect(dasher(c, 'PAST').state).toBe('resting');
    endTurn(c);
    // His next own turn is the rest turn: no walking out.
    c.ready();
    expect(dasher(c, 'PAST').state).toBe('resting');
    c.selectHelper('PAST-dasher');
    expect(c.helperTargets()).toEqual([]);
    expect(reason(() => c.dash('g3'))).toBe('resting');
    endTurn(c);
    c.ready();
    endTurn(c);
    // The own turn after that he is home and ready, with full health.
    c.ready();
    expect(dasher(c, 'PAST')).toMatchObject({ state: 'home', hp: HP });
  });
  it('his own side never hurts him', () => {
    const c = aiming(on());
    walkOut(c);
    c.selectHelper('PAST-launcher');
    // Past shells land on the Future base side, right where its own dasher stands.
    for (const aim of [
      { angleDeg: 45, power: 80 },
      { angleDeg: 50, power: 85 },
    ]) {
      if (c.snapshot().turn.phase !== 'AIMING') break;
      c.setAim(aim);
      c.fire();
      expect(c.shotLanded().dasher).toBeUndefined();
    }
    expect(dasher(c, 'PAST').hp).toBe(HP);
  });
  it('a dasher walking home cannot be hit where he stood', () => {
    const c = aiming(on());
    walkOut(c);
    endTurn(c);
    c.ready();
    const aim = aimAtDasher(c, 'direct');
    endTurn(c);
    c.ready();
    c.selectHelper('PAST-dasher');
    c.recall(); // he walks home and rests
    shootAway(c);
    c.reloadDone(WRONG);
    c.pass();
    c.ready();
    c.setAim(aim);
    c.fire();
    expect(c.shotLanded().dasher).toBeUndefined();
    expect(dasher(c, 'PAST').state).toBe('resting');
  });
});

describe('the end of the match', () => {
  it('a bonk can win, and a dasher still out when it ends stays put and does nothing more', () => {
    const effects: MatchEffects = {
      ...DEFAULT_EFFECTS,
      FUTURE: { ...DEFAULT_EFFECTS.FUTURE, maxHp: BONK },
    };
    const c = aiming(on(3, { effects }));
    walkOut(c);
    endTurn(c);
    c.ready();
    const s = c.snapshot();
    expect(s.status).toBe('OVER');
    expect(s.winner).toBe('PAST');
    expect(dasher(c, 'PAST')).toMatchObject({ state: 'out', spot: 'g3' });
    expect(() => c.ready()).toThrow(MatchOverError);
    expect(() => c.dash('g3')).toThrow(MatchOverError);
    expect(() => c.recall()).toThrow(MatchOverError);
    expect(() => c.selectHelper('FUTURE-dasher')).toThrow(MatchOverError);
  });
});
