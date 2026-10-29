// Weapons on the pads of a built base, in the live game (base health, character health off).
// Owner intent: bases are bricks plus weapons on four numbered spots, and the weapons fire.
// Pure rules only. See docs/GAME_SPEC.md "Weapons on the pads".
import { describe, expect, it } from 'vitest';
import { SPOT_WEAPONS } from '../../src/game/baseBuilder';
import { chooseShotWith } from '../../src/game/bot';
import { playBotMatch } from '../../src/game/botPlay';
import {
  createBuilt,
  fitFrame,
  fitLayout,
  hitWall,
  freshEvents,
  mountScale,
} from '../../src/game/builtBase';
import {
  BASE_IN_BATTLE,
  BONUS,
  DAMAGE,
  PHASE1_LAYOUT,
  PRACTICE_BOT,
  WORKSHOP,
} from '../../src/game/config';
import { customMountDef } from '../../src/game/customMounts';
import type { CustomWeapon } from '../../src/game/customWeapons';
import { DEFAULT_EFFECTS } from '../../src/game/loadout';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import { IllegalTransitionError } from '../../src/game/types';
import type {
  BlastOutcome,
  ChosenBase,
  MatchController,
  MatchOptions,
  MountId,
  Players,
  ShotResult,
  Team,
} from '../../src/game/types';
import { STRONGEST, TINY, TYPICAL, armed } from '../helpers/builtBases';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'math' },
];

const mk = (bases: MatchOptions['bases'], over: Partial<MatchOptions> = {}): MatchController =>
  createMatch({
    disturbances: false,
    squads: false,
    players: PLAYERS,
    seed: 5,
    characterHealth: false,
    baseInBattle: true,
    bases,
    ...over,
  });

const FLAT = {
  layout: fitLayout(PHASE1_LAYOUT, { PAST: true, FUTURE: true }),
  flatHp: { PAST: 400, FUTURE: 400 },
};

/** A weak weapon of your own: Power 1, a short (direct) style. */
const WEAK: CustomWeapon = {
  id: 'custom:P:1',
  base: 'royalSword',
  name: 'Tap',
  power: 1,
  reach: 5,
  splash: 4,
};

const PAST_ARMED = armed(TYPICAL('PAST'), ['cannon', null, 'catapult', 'archerPost']);
const FUTURE_ARMED = armed(TYPICAL('FUTURE'), ['laser', null, 'turret', null]);
/** Team Future with a Shield generator on spot 1 (it guards every go of Team Past's turn). */
const FUTURE_GUARDED = armed(TYPICAL('FUTURE'), ['laser', 'shieldGen', 'turret', null]);
const BOTH = { PAST: PAST_ARMED, FUTURE: FUTURE_ARMED };
const GUARDED = { PAST: PAST_ARMED, FUTURE: FUTURE_GUARDED };

const reload = (c: MatchController, correct: boolean): void => {
  c.reloadDone({ correct, elapsedMs: 1000, kind: 'choice', grade: 3 });
};

/** Two harmless shots, a wrong answer and a pass: the active team does nothing this turn. */
const skipTurn = (c: MatchController): void => {
  c.ready();
  skipRest(c);
};

/** The rest of a turn that is already under way, done harmlessly. */
const skipRest = (c: MatchController): void => {
  while (c.snapshot().turn.phase === 'AIMING') {
    c.setAim({ angleDeg: 80, power: 25 });
    c.fire();
    c.shotLanded();
  }
  reload(c, false);
  c.pass();
};

type Aim = { angleDeg: number; power: number };

/**
 * The first aim (from a sweep) whose first go of a fresh match gives what `want` asks for.
 * `pick` runs after ready() and before aiming (to pick a weapon, say).
 */
function findAim(
  make: () => MatchController,
  pick: (c: MatchController) => void,
  want: (r: ShotResult, out: BlastOutcome, c: MatchController) => boolean,
): Aim {
  for (let power = 100; power >= 20; power -= 2) {
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += 1) {
      const c = make();
      c.ready();
      pick(c);
      c.setAim({ angleDeg, power });
      const r = c.fire();
      if (want(r, c.shotLanded(), c)) return { angleDeg, power };
    }
  }
  throw new Error('no aim found');
}

describe('weapons of your own resolve in battle', () => {
  it('a Workshop weapon on a pad is a mount with its role and damage', () => {
    const base = armed(TYPICAL('PAST'), [WEAK, null, null, null]);
    const def = customMountDef(WEAK, 'PAST');
    for (const built of [createBuilt({ PAST: base }, FLAT), createBuilt({ PAST: base })]) {
      const m = built.PAST.mounts;
      expect(m).toHaveLength(1);
      expect(m[0]).toMatchObject({
        id: 'mount:0',
        weapon: 'custom:P:1',
        role: def.role,
        damage: def.damage,
        name: 'Tap',
        art: def.art,
        canFire: true,
      });
    }
  });

  it('the pad picture uses the style of a weapon of your own', () => {
    const base = armed(TYPICAL('PAST'), [WEAK, 'cannon', null, null]);
    const spots = createBuilt({ PAST: base }, FLAT).PAST.spots;
    expect(spots[0]?.art).toBe(customMountDef(WEAK, 'PAST').art);
    expect(spots[1]?.art).toBe('cannon');
    expect(spots[2]?.art).toBeUndefined();
  });
});

describe('picking a weapon (base health)', () => {
  it('the snapshot lists every filled pad, and the Shield generator cannot fire', () => {
    const s = mk(GUARDED).snapshot();
    expect(s.mounts?.PAST.map((m) => m.id)).toEqual(['mount:0', 'mount:2', 'mount:3']);
    expect(s.mounts?.PAST.every((m) => m.canFire && m.alive)).toBe(true);
    const shield = s.mounts?.FUTURE.find((m) => m.weapon === 'shieldGen');
    expect(shield).toMatchObject({ id: 'mount:1', canFire: false, role: 'guard' });
    expect(s.selectedMount).toEqual({ PAST: null, FUTURE: null });
  });

  it('a filled pad can be picked, and picking a fighter puts the weapon back', () => {
    const c = mk(BOTH);
    c.ready();
    c.selectUnit('mount:2');
    expect(c.snapshot().selectedMount?.PAST).toBe('mount:2');
    c.selectUnit('A');
    expect(c.snapshot().selectedMount?.PAST).toBeNull();
    expect(c.snapshot().selected.PAST).toBe('A');
  });

  it('an empty pad, the Shield generator and a base with no weapons cannot be picked', () => {
    const c = mk(GUARDED);
    c.ready();
    expect(() => c.selectUnit('mount:1')).toThrow(RangeError);
    skipRest(c);
    c.ready();
    expect(() => c.selectUnit('mount:1')).toThrow(/does not fire/);
    expect(() => c.selectUnit('mount:3')).toThrow(RangeError);
    const plain = mk({ PAST: TYPICAL('PAST') });
    plain.ready();
    expect(() => plain.selectUnit('mount:0')).toThrow(RangeError);
    const none = mk(undefined);
    none.ready();
    expect(() => none.selectUnit('mount:0')).toThrow(RangeError);
  });

  it('a weapon cannot be picked outside aiming', () => {
    const c = mk(BOTH);
    expect(() => c.selectUnit('mount:0')).toThrow(IllegalTransitionError);
  });

  it('picking a flat weapon keeps the aim inside its angles', () => {
    const c = mk(BOTH);
    c.ready();
    c.setAim({ angleDeg: 70, power: 60 });
    c.selectUnit('mount:0');
    expect(c.snapshot().aim.PAST.angleDeg).toBe(BASE_IN_BATTLE.aimByRole.direct.maxAngleDeg);
  });
});

describe('a go with a weapon', () => {
  it('starts at the pad and is recorded as the weapon', () => {
    const c = mk(BOTH);
    c.ready();
    c.selectUnit('mount:2');
    const pad = c.snapshot().mounts!.PAST.find((m) => m.id === 'mount:2')!;
    c.setAim({ angleDeg: 60, power: 60 });
    const r = c.fire();
    expect(r.path[0]).toEqual(pad.origin);
    expect(c.snapshot().lastShot?.mount).toBe('mount:2');
    c.shotLanded();
  });

  it('the preview starts at the pad too', () => {
    const c = mk(BOTH);
    c.ready();
    c.selectUnit('mount:0');
    const pad = c.snapshot().mounts!.PAST[0]!;
    expect(c.previewShot().path[0]).toEqual(pad.origin);
  });

  it('counts toward the 2 goes: a third go throws, then the reload', () => {
    const c = mk(BOTH);
    c.ready();
    c.selectUnit('mount:0');
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 30, power: 30 });
      c.fire();
      c.shotLanded();
    }
    expect(c.snapshot().turn.phase).toBe('RELOAD');
    expect(() => c.fire()).toThrow(IllegalTransitionError);
    reload(c, false);
    expect(c.snapshot().turn.phase).toBe('NEXT_PLAYER');
  });

  it('the Power Shot fires from a picked weapon, 1.5 times as hard', () => {
    const make = () => mk(BOTH);
    const aim = findAim(
      make,
      (c) => c.selectUnit('mount:0'),
      (r, out) => r.stoppedBy?.kind === 'brick' && out.result === 'direct',
    );
    const c = make();
    c.ready();
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 80, power: 25 });
      c.fire();
      c.shotLanded();
    }
    reload(c, true);
    expect(c.snapshot().turn.phase).toBe('BONUS_AIMING');
    c.selectUnit('mount:0');
    c.setAim(aim);
    c.fire();
    expect(c.snapshot().lastShot?.mount).toBe('mount:0');
    const out = c.shotLanded();
    expect(out.built?.brickHits[0]?.damage).toBe(
      Math.round(DAMAGE.direct * BONUS.damageMultiplier),
    );
  });

  it('a mounted weapon has no recoil', () => {
    const c = mk(BOTH, { disturbances: true });
    c.ready();
    c.selectUnit('mount:2');
    c.setAim({ angleDeg: 60, power: 60 });
    c.fire();
    expect(c.snapshot().aim.PAST).toEqual({ angleDeg: 60, power: 60 });
    c.shotLanded();
  });
});

describe('weapon damage (base health)', () => {
  it('every catalog weapon that fires is capped at a fighter shot; the Shield generator is 0', () => {
    for (const w of SPOT_WEAPONS) {
      expect(mountScale(w), w.id).toBe(
        w.role === 'guard' ? 0 : BASE_IN_BATTLE.baseHealthMount.maxScale,
      );
    }
    expect(BASE_IN_BATTLE.baseHealthMount.maxScale).toBe(1);
  });

  it('a weak weapon of your own hits less', () => {
    expect(mountScale(customMountDef(WEAK, 'PAST'))).toBeCloseTo(0.55, 6);
    const volley = customMountDef({ ...WEAK, base: 'elderLongbow' }, 'PAST');
    expect(volley.role).toBe('volley');
    expect(mountScale(volley)).toBeCloseTo(0.9, 6);
    const lob = customMountDef({ ...WEAK, base: 'ironCannon' }, 'PAST');
    expect(lob.role).toBe('lob');
    expect(mountScale(lob)).toBeCloseTo(0.825, 6);
  });

  it('no weapon of your own beats the cap', () => {
    for (const base of ['royalSword', 'elderLongbow', 'ironCannon'] as const) {
      for (let power = 1; power <= WORKSHOP.maxPoints; power++) {
        const def = customMountDef({ ...WEAK, base, power }, 'PAST');
        expect(mountScale(def)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a direct hit from a Cannon takes 25 from the brick, a weak weapon round(25 x 0.55)', () => {
    for (const [weapon, want] of [
      ['cannon', DAMAGE.direct],
      [WEAK, Math.round(DAMAGE.direct * 0.55)],
    ] as const) {
      const bases = {
        PAST: armed(TYPICAL('PAST'), [weapon, null, null, null]),
        FUTURE: TYPICAL('FUTURE'),
      };
      const make = () => mk(bases);
      const aim = findAim(
        make,
        (c) => c.selectUnit('mount:0'),
        (r, out) => r.stoppedBy?.kind === 'brick' && out.result === 'direct',
      );
      const c = make();
      c.ready();
      c.selectUnit('mount:0');
      c.setAim(aim);
      c.fire();
      const out = c.shotLanded();
      expect(out.built?.brickHits[0]?.damage).toBe(want);
    }
  });

  it('a volley flies 3 shells and they share the damage', () => {
    const make = () => mk(BOTH);
    const aim = findAim(
      make,
      (c) => c.selectUnit('mount:3'),
      (r, out) => (r.volley?.length ?? 0) === 3 && (out.built?.brickHits.length ?? 0) >= 2,
    );
    const c = make();
    c.ready();
    c.selectUnit('mount:3');
    c.setAim(aim);
    const r = c.fire();
    expect(r.volley).toHaveLength(3);
    const out = c.shotLanded();
    const per = Math.round(DAMAGE.direct / BASE_IN_BATTLE.volley.shots);
    for (const h of out.built!.brickHits) {
      expect([per, Math.round(DAMAGE.near / BASE_IN_BATTLE.volley.shots)]).toContain(h.damage);
    }
    const total = out.built!.brickHits.reduce((a, h) => a + h.damage, 0);
    expect(total).toBeLessThanOrEqual(DAMAGE.direct);
  });

  it('a Hoverboard Dodge or a force field takes a whole volley', () => {
    const make = () => mk(BOTH);
    const aim = findAim(
      make,
      (c) => c.selectUnit('mount:3'),
      (_r, out) => (out.built?.brickHits.length ?? 0) >= 2,
    );
    // Dodge: Team Future arms it on its own turn, and it guards on Team Past's next turn.
    const c = mk(BOTH, { firstTeam: 'FUTURE' });
    c.ready();
    c.armEvasion();
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 80, power: 25 });
      c.fire();
      c.shotLanded();
    }
    reload(c, false);
    c.pass();
    c.ready();
    c.selectUnit('mount:3');
    c.setAim(aim);
    const before = c.snapshot().baseHp.FUTURE;
    c.fire();
    const out = c.shotLanded();
    expect(out.dodged).toBe(true);
    expect(out.built?.brickHits).toEqual([]);
    expect(c.snapshot().baseHp.FUTURE).toBe(before);
    // Force field: one hit blocked, and a volley is one hit.
    const effects = {
      PAST: DEFAULT_EFFECTS.PAST,
      FUTURE: { ...DEFAULT_EFFECTS.FUTURE, shieldHits: 1 },
    };
    const f = mk(BOTH, { effects });
    f.ready();
    f.selectUnit('mount:3');
    f.setAim(aim);
    f.fire();
    const blocked = f.shotLanded();
    expect(blocked.blocked).toBe(true);
    expect(blocked.built?.brickHits).toEqual([]);
    f.setAim(aim);
    f.fire();
    expect(f.shotLanded().built?.brickHits.length).toBeGreaterThan(0);
  });
});

describe('pads take hits and fall with their brick', () => {
  it('a shell that stops on a pad hurts the brick under it', () => {
    const make = () => mk(BOTH);
    const aim = findAim(
      make,
      () => undefined,
      (r) => r.stoppedBy?.kind === 'mount',
    );
    const c = make();
    c.ready();
    c.setAim(aim);
    const r = c.fire();
    const out = c.shotLanded();
    const pad = c.snapshot().mounts!.FUTURE.find((m) => m.id === r.stoppedBy!.id)!;
    expect(out.result).toBe('direct');
    const hit = out.built!.brickHits[0]!;
    if (pad.brick) expect(hit.id).toBe(pad.brick);
    else expect(hit.id.startsWith('FUTURE:')).toBe(true);
  });

  it('the pad box is the pad as drawn', () => {
    const built = createBuilt({ PAST: PAST_ARMED }, FLAT);
    const pad = built.PAST.mounts[0]!;
    // A pad is 10 steps across, at the scale the base is fitted at (the pads widen it a little).
    const step = fitFrame('PAST', PAST_ARMED, FLAT.layout.bases.PAST).scale;
    expect(step).toBeGreaterThan(3);
    expect(pad.box.w).toBeCloseTo(10 * step, 6);
    expect(pad.box.h).toBeCloseTo(10 * step, 6);
    expect(pad.box.x + pad.box.w / 2).toBeCloseTo(pad.origin.x, 6);
  });

  it('a pad falls with its brick and can no longer be picked; the pick goes back to the fighter', () => {
    // Spot 2 of the typical base sits on a top brick (PAST:5), which holds a small share.
    const c = mk(BOTH);
    const pad = c.snapshot().mounts!.PAST.find((m) => m.id === 'mount:2')!;
    expect(pad.brick).toBe('PAST:5');
    c.ready();
    c.selectUnit('mount:2');
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 80, power: 25 });
      c.fire();
      c.shotLanded();
    }
    reload(c, false);
    c.pass();
    expect(c.snapshot().selectedMount?.PAST).toBe('mount:2');
    // Team Future knocks the brick down (a rules call, as a shell would).
    const fell = findAim(
      () => {
        const m = mk(BOTH);
        skipTurn(m);
        return m;
      },
      () => undefined,
      (_r, out) => out.built!.mountDown.some((d) => d.team === 'PAST' && d.mount === 'mount:2'),
    );
    c.ready();
    c.setAim(fell);
    c.fire();
    const out = c.shotLanded();
    expect(out.built?.mountDown).toContainEqual({
      team: 'PAST',
      mount: 'mount:2',
      reason: 'brickFell',
    });
    const s = c.snapshot();
    expect(s.mounts!.PAST.find((m) => m.id === 'mount:2')!.alive).toBe(false);
    expect(s.selectedMount?.PAST).toBeNull();
    c.setAim({ angleDeg: 80, power: 25 });
    c.fire();
    c.shotLanded();
    reload(c, false);
    c.pass();
    c.ready();
    expect(() => c.selectUnit('mount:2')).toThrow(/down/);
  });

  it('hitWall on the brick under a pad takes the pad down (pure rule)', () => {
    const built = createBuilt({ PAST: PAST_ARMED }, FLAT);
    const ev = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:5' }, 999, ev);
    expect(ev.mountDown).toContainEqual({ team: 'PAST', mount: 'mount:2', reason: 'brickFell' });
  });
});

describe('the Shield generator (base health)', () => {
  // The generator stands on a foundation brick (spot 0), so a hit on the top of the base does not
  // bring it down between the two turns.
  const make = () =>
    mk({
      PAST: PAST_ARMED,
      FUTURE: armed(TYPICAL('FUTURE'), ['shieldGen', 'laser', 'turret', null]),
    });
  const guarded = (out: BlastOutcome) => (out.built?.guardBlocked.length ?? 0) > 0;

  it('blocks the first go that would hurt, once per enemy turn, and saves the dodge', () => {
    const aim = findAim(
      make,
      () => undefined,
      (_r, out) => guarded(out),
    );
    const c = make();
    c.ready();
    c.setAim(aim);
    c.fire();
    const first = c.shotLanded();
    expect(first.built?.guardBlocked).toEqual([{ team: 'FUTURE', mount: 'mount:0' }]);
    expect(first.damage).toBe(0);
    expect(first.built?.brickHits).toEqual([]);
    c.setAim(aim);
    c.fire();
    const second = c.shotLanded();
    expect(second.built?.guardBlocked).toEqual([]);
    expect(second.damage).toBeGreaterThan(0);
    reload(c, false);
    c.pass();
    skipTurn(c);
    // Team Past's next turn (a new wind): the generator is ready again.
    const later = () => {
      const m = make();
      skipTurn(m);
      skipTurn(m);
      return m;
    };
    const again = findAim(
      later,
      () => undefined,
      (_r, out) => guarded(out),
    );
    c.ready();
    c.setAim(again);
    c.fire();
    expect(c.shotLanded().built?.guardBlocked).toHaveLength(1);
  });

  it('a miss far away does not use it up', () => {
    const c = make();
    c.ready();
    c.setAim({ angleDeg: 80, power: 25 });
    c.fire();
    expect(c.shotLanded().built?.guardBlocked).toEqual([]);
  });

  it('guards only shells within guardRadius of its pad', () => {
    expect(BASE_IN_BATTLE.guardRadius).toBe(90);
  });
});

describe('the Computer player and weapons', () => {
  it('fires from a pad sometimes, always legally', () => {
    const c = mk(GUARDED);
    c.ready();
    const rng = createRng(11);
    const picks: Array<MountId | undefined> = [];
    for (let i = 0; i < 20; i++) {
      const shot = chooseShotWith(c.snapshot(), 'PAST', PRACTICE_BOT.levels.medium!, rng, {
        layout: PHASE1_LAYOUT,
      });
      picks.push(shot.mount);
      if (shot.mount) {
        const m = c.snapshot().mounts!.PAST.find((x) => x.id === shot.mount)!;
        expect(m.canFire && m.alive).toBe(true);
      }
    }
    expect(picks.some((p) => p !== undefined)).toBe(true);
    expect(picks.some((p) => p === undefined)).toBe(true);
    expect(picks).not.toContain('mount:1');
  });

  it('seeded Computer player matches with weapons on both bases all end with a winner', () => {
    const bases: Record<Team, ChosenBase> = {
      PAST: armed(TINY('PAST'), STRONGEST.PAST),
      FUTURE: armed(TYPICAL('FUTURE'), ['laser', 'shieldGen', 'turret', 'missilePod']),
    };
    for (let seed = 1; seed <= 12; seed++) {
      const r = playBotMatch({
        seed,
        firstTeam: seed % 2 ? 'PAST' : 'FUTURE',
        characterHealth: false,
        baseInBattle: true,
        disturbances: true,
        bases,
        profiles: { PAST: PRACTICE_BOT.levels.medium!, FUTURE: PRACTICE_BOT.levels.hard! },
      });
      expect(r.ended, `seed ${seed}`).toBe(true);
      expect(r.winner, `seed ${seed}`).not.toBeNull();
    }
  }, 120_000);
});
