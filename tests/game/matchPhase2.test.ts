// Phase 2 inside a real match: the battlefield, special ammo and evasion abilities.
import { describe, expect, it } from 'vitest';
import { AMMO, ammoUses, type AmmoId } from '../../src/game/ammo';
import { simulateShot } from '../../src/game/ballistics';
import { buildLayout } from '../../src/game/battlefield';
import { DAMAGE, EVASION, TEAM_FACING } from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import { EvasionError } from '../../src/game/evasion';
import { createMatch } from '../../src/game/match';
import {
  IllegalTransitionError,
  MatchOverError,
  otherTeam,
  type AimInput,
  type BlastResult,
  type MatchController,
  type MatchOptions,
  type Players,
} from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 5, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'reading' },
];

const make = (extra: Partial<MatchOptions> = {}): MatchController =>
  createMatch({ disturbances: false, players: PLAYERS, seed: 31, ...extra });

/** An aim that scores `want` for the team now aiming, on the field as it stands now. */
function findAim(c: MatchController, want: BlastResult, ammo?: AmmoId): AimInput {
  const s = c.snapshot();
  const team = s.turn.team;
  const layout = c.currentLayout();
  for (let power = 100; power >= 10; power -= 1)
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += 1) {
      const r = simulateShot({
        angleDeg,
        power,
        wind: s.wind,
        origin: layout.launchOrigins[team],
        facing: TEAM_FACING[team],
        layout,
        ammo: ammo ?? s.ammo[team],
      });
      const scored =
        r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout'
          ? 'miss'
          : classifyBlast(
              r.landing,
              layout.bases[otherTeam(team)],
              AMMO.find((a) => a.id === (ammo ?? s.ammo[team]))?.radiusScale,
            );
      if (scored === want) return { angleDeg, power };
    }
  throw new Error(`no ${want} aim found`);
}

const shoot = (c: MatchController, want: BlastResult) => {
  c.setAim(findAim(c, want));
  c.fire();
  return c.shotLanded();
};

/** Plays the rest of a turn with misses and a wrong answer, then passes. */
const finishTurn = (c: MatchController) => {
  while (c.snapshot().turn.phase === 'AIMING') shoot(c, 'miss');
  c.reloadDone({ correct: false, elapsedMs: 1000 });
  c.pass();
};

const fullMissTurn = (c: MatchController) => {
  c.ready();
  finishTurn(c);
};

describe('battlefield in a match', () => {
  it('uses the layout it is given, and a rematch keeps it', () => {
    const layout = buildLayout({ biome: 'temple', spot: 'bridge' });
    const c = make({ layout });
    expect(c.layout).toBe(layout);
    expect(c.rematchOptions().layout).toBe(layout);
  });

  it('a fighter on the base shoots from where the base moved to', () => {
    const layout = buildLayout({ biome: 'aspen', spot: 'skyscraper' });
    const c = make({ layout, firstTeam: 'FUTURE' });
    c.ready();
    c.selectUnit('5');
    const r = c.fire();
    expect(r.path[0]).toEqual({ x: 1130, y: 280 });
  });
});

describe('special ammo', () => {
  it('a fresh match has Standard loaded and no special ammo', () => {
    const s = make().snapshot();
    expect(s.ammo).toEqual({ PAST: 'standard', FUTURE: 'standard' });
    expect(s.ammoLeft).toEqual({ PAST: {}, FUTURE: {} });
  });

  it('owned kinds start with their uses per match', () => {
    const s = make({ ammo: { PAST: ['confetti', 'bowling'] } }).snapshot();
    expect(s.ammoLeft.PAST).toEqual({
      confetti: ammoUses('confetti'),
      bowling: ammoUses('bowling'),
    });
    expect(s.ammoLeft.FUTURE).toEqual({});
  });

  it('ignores junk and Standard in the owned list', () => {
    const s = make({
      ammo: { PAST: ['standard', 'nope' as AmmoId, 'plasma', 'plasma'] },
    }).snapshot();
    expect(s.ammoLeft.PAST).toEqual({ plasma: ammoUses('plasma') });
  });

  it('firing a special kind uses one and records it on the shot', () => {
    const c = make({ ammo: { PAST: ['bowling'] } });
    c.ready();
    c.selectAmmo('bowling');
    expect(c.snapshot().ammo.PAST).toBe('bowling');
    c.fire();
    expect(c.snapshot().lastShot?.ammo).toBe('bowling');
    expect(c.snapshot().ammoLeft.PAST.bowling).toBe(ammoUses('bowling') - 1);
  });

  it('goes back to Standard when the last shot of a kind is fired', () => {
    const c = make({ ammo: { PAST: ['bowling'] } });
    c.ready();
    c.selectAmmo('bowling');
    c.fire();
    c.shotLanded();
    c.selectAmmo('bowling');
    c.fire();
    expect(c.snapshot().ammoLeft.PAST.bowling).toBe(0);
    expect(c.snapshot().ammo.PAST).toBe('standard');
    c.shotLanded();
    c.reloadDone({ correct: true, elapsedMs: 1000 });
    expect(() => c.selectAmmo('bowling')).toThrow(RangeError);
  });

  it('bowling balls hit harder, confetti a little softer, on a direct hit', () => {
    const direct = (ammo: AmmoId) => {
      const c = make({ ammo: { PAST: [ammo] } });
      c.ready();
      c.selectAmmo(ammo);
      c.setAim(findAim(c, 'direct'));
      c.fire();
      return c.shotLanded();
    };
    const plain = (() => {
      const c = make();
      c.ready();
      return shoot(c, 'direct');
    })();
    expect(plain.damage).toBe(DAMAGE.direct);
    expect(direct('bowling').damage).toBe(Math.round(DAMAGE.direct * 1.3));
    expect(direct('confetti').damage).toBe(Math.round(DAMAGE.direct * 0.9));
  });

  it('the loaded kind is remembered between turns, and Standard is the same as Phase 1', () => {
    const c = make({ ammo: { PAST: ['confetti'] } });
    c.ready();
    c.selectAmmo('confetti');
    c.selectAmmo('standard');
    expect(c.snapshot().ammo.PAST).toBe('standard');
    c.selectAmmo('confetti');
    finishTurn(c);
    expect(c.snapshot().ammo.PAST).toBe('confetti');
  });

  it('a rematch gives fresh uses of the same kinds', () => {
    const c = make({ ammo: { PAST: ['plasma'] } });
    expect(c.rematchOptions().ammo).toEqual({ PAST: ['plasma'], FUTURE: [] });
  });

  describe('misuse', () => {
    it('cannot load a kind the team does not own', () => {
      const c = make({ ammo: { FUTURE: ['confetti'] } });
      c.ready();
      expect(() => c.selectAmmo('confetti')).toThrow(RangeError);
      expect(() => c.selectAmmo('nope' as AmmoId)).toThrow(RangeError);
      expect(c.snapshot().ammo.PAST).toBe('standard');
    });
    it('cannot load ammo outside aiming', () => {
      const c = make({ ammo: { PAST: ['confetti'] } });
      expect(() => c.selectAmmo('confetti')).toThrow(IllegalTransitionError);
      c.ready();
      c.setAim({ angleDeg: 45, power: 10 });
      c.fire();
      expect(() => c.selectAmmo('confetti')).toThrow(IllegalTransitionError);
    });
    it('special ammo never adds a third shot', () => {
      const c = make({ ammo: { PAST: ['confetti'] } });
      c.ready();
      c.selectAmmo('confetti');
      shoot(c, 'miss');
      shoot(c, 'miss');
      expect(c.snapshot().turn.phase).toBe('RELOAD');
      expect(() => c.fire()).toThrow(IllegalTransitionError);
      expect(() => c.selectAmmo('standard')).toThrow(IllegalTransitionError);
    });
  });
});

describe('Stone Barricade Wall (Team Past)', () => {
  it('stands for Team Future’s next turn only, then never again', () => {
    const c = make();
    c.ready();
    c.armEvasion();
    expect(c.snapshot().evasion.PAST.phase).toBe('armed');
    // Armed is not up yet: Past's own shots still fly over an empty field.
    expect(c.currentLayout()).toBe(c.layout);
    finishTurn(c);
    expect(c.snapshot().evasion.PAST.phase).toBe('active');
    expect(c.currentLayout().terrain.obstacles).toHaveLength(c.layout.terrain.obstacles.length + 1);
    fullMissTurn(c); // Future's turn ends, Past's starts
    expect(c.snapshot().evasion.PAST.phase).toBe('used');
    expect(c.currentLayout()).toBe(c.layout);
    c.ready();
    expect(() => c.armEvasion()).toThrow(EvasionError);
  });

  it('blocks the flattest shot that would hit the castle on an open field', () => {
    const c = make();
    c.ready();
    c.armEvasion();
    finishTurn(c);
    c.ready();
    const open = c.layout;
    const wind = c.snapshot().wind;
    let flat: AimInput | null = null;
    for (let angleDeg = 0; angleDeg <= 90 && !flat; angleDeg++)
      for (let power = 10; power <= 100 && !flat; power++) {
        const r = simulateShot({
          angleDeg,
          power,
          wind,
          origin: open.launchOrigins.FUTURE,
          facing: -1,
          layout: open,
        });
        const landed = r.hit.kind !== 'out_of_bounds' && r.hit.kind !== 'timeout';
        if (landed && classifyBlast(r.landing, open.bases.PAST) === 'direct')
          flat = { angleDeg, power };
      }
    expect(flat).not.toBeNull();
    c.setAim(flat as AimInput);
    c.fire();
    const out = c.shotLanded();
    expect(out.result).not.toBe('direct');
    expect(c.snapshot().baseHp.PAST).toBe(DAMAGE.startingBaseHp);
  });

  it('a lob still gets over the wall, so Team Future is never shut out', () => {
    const c = make();
    c.ready();
    c.armEvasion();
    finishTurn(c);
    c.ready();
    const out = shoot(c, 'direct');
    expect(out.result).toBe('direct');
    expect(out.damage).toBeGreaterThan(0);
  });
});

describe('Hoverboard Dodge (Team Future)', () => {
  const armedFuture = () => {
    const c = make({ firstTeam: 'FUTURE' });
    c.ready();
    c.armEvasion();
    finishTurn(c);
    c.ready();
    return c;
  };

  it('the first damaging hit misses, the next one lands', () => {
    const c = armedFuture();
    const first = shoot(c, 'direct');
    expect(first.dodged).toBe(true);
    expect(first.damage).toBe(0);
    expect(c.snapshot().baseHp.FUTURE).toBe(DAMAGE.startingBaseHp);
    expect(c.snapshot().evasion.FUTURE.phase).toBe('recharging');
    const second = shoot(c, 'direct');
    expect(second.dodged).toBeUndefined();
    expect(second.damage).toBe(DAMAGE.direct);
  });

  it('a miss does not use up the dodge', () => {
    const c = armedFuture();
    const out = shoot(c, 'miss');
    expect(out.dodged).toBeUndefined();
    expect(c.snapshot().evasion.FUTURE.phase).toBe('active');
  });

  it('is ready again two of Team Future’s turns after it was armed', () => {
    const c = armedFuture(); // Past's turn 1 (Future armed on its turn 0)
    finishTurn(c);
    c.ready(); // Future's next turn: recharging
    expect(c.snapshot().evasion.FUTURE).toMatchObject({ phase: 'recharging', turnsLeft: 1 });
    expect(() => c.armEvasion()).toThrow(EvasionError);
    finishTurn(c);
    fullMissTurn(c); // Past
    c.ready(); // Future again
    expect(c.snapshot().evasion.FUTURE.phase).toBe('ready');
    c.armEvasion();
  });

  it('dodges before the force field, so the shield is kept', () => {
    const effects = createMatch({ disturbances: false, players: PLAYERS, seed: 31 }).rematchOptions().effects;
    const shielded = {
      PAST: effects!.PAST,
      FUTURE: { ...effects!.FUTURE, shieldHits: 1 },
    };
    const c = make({ firstTeam: 'FUTURE', effects: shielded });
    c.ready();
    c.armEvasion();
    finishTurn(c);
    c.ready();
    expect(shoot(c, 'direct')).toMatchObject({ dodged: true, damage: 0 });
    expect(shoot(c, 'direct')).toMatchObject({ blocked: true, damage: 0 });
  });
});

describe('evasion misuse (negative paths)', () => {
  it('cannot arm outside aiming', () => {
    const c = make();
    expect(() => c.armEvasion()).toThrow(IllegalTransitionError);
    c.ready();
    c.setAim({ angleDeg: 45, power: 10 });
    c.fire();
    expect(() => c.armEvasion()).toThrow(IllegalTransitionError);
    c.shotLanded();
    shoot(c, 'miss');
    expect(c.snapshot().turn.phase).toBe('RELOAD');
    expect(() => c.armEvasion()).toThrow(IllegalTransitionError);
  });

  it('cannot arm twice, and taking it back frees it', () => {
    const c = make();
    c.ready();
    c.armEvasion();
    expect(() => c.armEvasion()).toThrow(EvasionError);
    c.disarmEvasion();
    expect(c.snapshot().evasion.PAST.phase).toBe('ready');
    expect(() => c.disarmEvasion()).toThrow(EvasionError);
    c.armEvasion();
  });

  it('arming is free: it is not a shot and the turn still has exactly two', () => {
    const c = make();
    c.ready();
    c.armEvasion();
    expect(c.snapshot().turn.shotsFired).toBe(0);
    shoot(c, 'miss');
    shoot(c, 'miss');
    expect(c.snapshot().turn.phase).toBe('RELOAD');
  });

  it('a skipped reload cannot pass the turn, armed or not', () => {
    const c = make();
    c.ready();
    c.armEvasion();
    shoot(c, 'miss');
    shoot(c, 'miss');
    expect(() => c.pass()).toThrow(IllegalTransitionError);
    expect(c.snapshot().evasion.PAST.phase).toBe('armed');
  });

  it('can arm during the Power Shot', () => {
    const c = make();
    c.ready();
    shoot(c, 'miss');
    shoot(c, 'miss');
    c.reloadDone({ correct: true, elapsedMs: 1000 });
    expect(c.snapshot().turn.phase).toBe('BONUS_AIMING');
    c.armEvasion();
    expect(c.snapshot().evasion.PAST.phase).toBe('armed');
  });

  it('nothing works after the match is over', () => {
    const c = make({ firstTeam: 'PAST' });
    // Knock Future down to 0 with direct hits over several turns.
    let guard = 0;
    while (c.snapshot().status === 'PLAYING' && guard++ < 60) {
      c.ready();
      const team = c.snapshot().turn.team;
      while (c.snapshot().status === 'PLAYING' && c.snapshot().turn.phase === 'AIMING') {
        shoot(c, team === 'PAST' ? 'direct' : 'miss');
      }
      if (c.snapshot().status !== 'PLAYING') break;
      c.reloadDone({ correct: false, elapsedMs: 1000 });
      c.pass();
    }
    expect(c.snapshot().status).toBe('OVER');
    expect(() => c.armEvasion()).toThrow(MatchOverError);
    expect(() => c.selectAmmo('standard')).toThrow(MatchOverError);
  });

  it('the barricade wall is the one from config', () => {
    const c = make();
    c.ready();
    c.armEvasion();
    finishTurn(c);
    const extra = c.currentLayout().terrain.obstacles.at(-1);
    const w = EVASION.barricade.wall;
    expect(extra).toEqual([
      { x: w.x, y: w.y },
      { x: w.x + w.w, y: w.y },
      { x: w.x + w.w, y: w.y + w.h },
      { x: w.x, y: w.y + w.h },
    ]);
  });
});
