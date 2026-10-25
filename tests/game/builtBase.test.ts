// Built bases in battle (flag BASE_IN_BATTLE, off by default). These tests turn it on through
// MatchOptions and never change the constant. Pure rules only: no Phaser.
import { describe, expect, it } from 'vitest';
import {
  assignWeapon,
  newBuild,
  pieceById,
  placePiece,
  resolveSpots,
  spotWeaponsOf,
  type Placed,
  type Rotation,
} from '../../src/game/baseBuilder';
import { chooseShot } from '../../src/game/bot';
import { customId } from '../../src/game/customShapes';
import { playBotMatch } from '../../src/game/botPlay';
import { BASE_IN_BATTLE, BONUS, PHASE1_LAYOUT, PRACTICE_BOT } from '../../src/game/config';
import {
  PLOT_PX,
  boxToWorld,
  createBuilt,
  cutAtWalls,
  enterT,
  freshEvents,
  hitWall,
  mountAim,
  plotLeft,
  pointToWorld,
  volleyAngles,
  wallDamage,
  wallsOf,
} from '../../src/game/builtBase';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import {
  otherTeam,
  type BlastOutcome,
  type ChosenBase,
  type Match,
  type MatchController,
  type Players,
  type ShotResult,
  type Team,
} from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'math' },
];

const brick = (piece: string, x: number, y: number, hp: number, rot: Rotation = 0): Placed => ({
  piece,
  x,
  y,
  ox: 0,
  oy: 0,
  rot,
  hp,
});

/** A base from bricks and a few hand-placed pads. */
const baseOf = (
  pieces: Placed[],
  pads: Array<{ index: number; x: number; y: number; weapon: string | null }> = [],
): ChosenBase => ({ pieces, spots: pads });

// A Future wall right at the front: a stone on the foundation (x 1..3 cells) with a pad on top.
const FUTURE_BASE = baseOf(
  [brick('panel', 1, 10, 20), brick('panel', 1, 9, 20), brick('beam', 6, 10, 50)],
  [
    { index: 0, x: 16, y: 67, weapon: 'laser' },
    { index: 1, x: 80, y: 75, weapon: 'turret' },
  ],
);
const GUARD_BASE = baseOf(
  [brick('panel', 1, 10, 20), brick('beam', 6, 10, 50)],
  [{ index: 1, x: 80, y: 75, weapon: 'shieldGen' }],
);
const PAST_BASE = baseOf(
  [brick('stone', 1, 10, 20)],
  [
    { index: 0, x: 16, y: 75, weapon: 'cannon' },
    { index: 1, x: 100, y: 75, weapon: 'catapult' },
    { index: 2, x: 120, y: 75, weapon: 'archerPost' },
  ],
);

const mk = (
  bases: Partial<Record<Team, ChosenBase>> = { PAST: PAST_BASE, FUTURE: FUTURE_BASE },
  seed = 5,
  over: { baseInBattle?: boolean; characterHealth?: boolean } = {},
): MatchController =>
  createMatch({
    disturbances: false,
    players: PLAYERS,
    seed,
    characterHealth: over.characterHealth ?? true,
    baseInBattle: over.baseInBattle ?? true,
    bases,
  });

describe('layout: build plot to battlefield', () => {
  it('Team Past builds from the left and Team Future is mirrored on the right', () => {
    expect(plotLeft('PAST')).toBe(BASE_IN_BATTLE.margin);
    expect(plotLeft('FUTURE') + PLOT_PX.w).toBe(1280 - BASE_IN_BATTLE.margin);
    // A 2 by 1 cell stone in the bottom-left cell of the plot: steps l 0, r 16, t 80, b 88.
    const rect = { l: 0, t: 80, r: 16, b: 88 };
    const s = BASE_IN_BATTLE.scale;
    expect(boxToWorld('PAST', rect)).toEqual({
      x: 40,
      y: PHASE1_LAYOUT.terrain.ground[0]!.y - 8 * s,
      w: 16 * s,
      h: 8 * s,
    });
    const f = boxToWorld('FUTURE', rect);
    expect(f.x + f.w).toBe(1280 - BASE_IN_BATTLE.margin);
    expect(f.w).toBe(16 * s);
    expect(f.y + f.h).toBe(BASE_IN_BATTLE.plotBottomY);
  });

  it('a point mirrors for Future and keeps its height', () => {
    const p = pointToWorld('PAST', 16, 75);
    const q = pointToWorld('FUTURE', 16, 75);
    expect(p.y).toBe(q.y);
    expect(p.x - 40).toBe(1240 - q.x);
  });

  it('exposes brick boxes and the four spot positions in the snapshot', () => {
    const snap = mk().snapshot();
    expect(snap.baseInBattle).toBe(true);
    expect(Object.keys(snap.bricks ?? {}).sort()).toEqual([
      'FUTURE:0',
      'FUTURE:1',
      'FUTURE:2',
      'PAST:0',
    ]);
    expect(snap.bricks?.['PAST:0']).toMatchObject({
      hp: 20,
      maxHp: 20,
      alive: true,
      piece: 'stone',
    });
    expect(snap.spots?.FUTURE).toHaveLength(2);
    expect(snap.mounts?.PAST.map((m) => m.id)).toEqual(['mount:0', 'mount:1', 'mount:2']);
    expect(snap.builtBase).toEqual({ PAST: true, FUTURE: true });
  });

  it('a team with no base keeps the default fixed base; a built team does not', () => {
    const snap = mk({ PAST: PAST_BASE }).snapshot();
    expect(snap.builtBase).toEqual({ PAST: true, FUTURE: false });
    expect(snap.spots?.FUTURE).toEqual([]);
    expect(snap.mounts?.FUTURE).toEqual([]);
  });
});

describe('damage table', () => {
  it('a fighter shot does 20, a Power Shot 1.5 times that', () => {
    expect(wallDamage({ kind: 'fighter', damageScale: 1 }, false)).toBe(20);
    expect(wallDamage({ kind: 'fighter', damageScale: 1 }, true)).toBe(
      Math.round(20 * BONUS.damageMultiplier),
    );
  });
  it('a fighter shot follows its damageScale', () => {
    expect(wallDamage({ kind: 'fighter', damageScale: 1.3 }, false)).toBe(26);
  });
  it('a mounted weapon does its catalog damage times its role multiplier', () => {
    expect(wallDamage({ kind: 'mount', damage: 20, role: 'direct' }, false)).toBe(20);
    expect(wallDamage({ kind: 'mount', damage: 25, role: 'lob' }, false)).toBe(38);
    expect(wallDamage({ kind: 'mount', damage: 10, role: 'volley' }, false)).toBe(10);
    expect(wallDamage({ kind: 'mount', damage: 10, role: 'volley' }, true)).toBe(15);
    expect(wallDamage({ kind: 'mount', damage: 0, role: 'guard' }, true)).toBe(0);
  });
});

describe('bricks fall and take what they hold up', () => {
  // A column of three on the foundation, a separate stone, and a floating stone.
  const column = baseOf([
    brick('stone', 0, 10, 20), // 0: on the foundation
    brick('stone', 0, 9, 20), // 1: on 0
    brick('stone', 0, 8, 20), // 2: on 1
    brick('stone', 10, 10, 20), // 3: elsewhere
    brick('stone', 15, 3, 20), // 4: floating from the start
  ]);

  it('a brick at 0 hp falls once and the stack above it falls with it, bottom to top', () => {
    const built = createBuilt({ PAST: column });
    const ev = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:0' }, 20, ev);
    expect(ev.brickFell).toEqual(['PAST:0']);
    expect(ev.bricksFell).toEqual(['PAST:0', 'PAST:1', 'PAST:2']);
    const alive = built.PAST.bricks.map((b) => b.alive);
    expect(alive).toEqual([false, false, false, true, true]);
    // Hit points of a fallen brick are 0 and it takes no more hits.
    const again = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:0' }, 20, again);
    expect(again.brickHits).toEqual([]);
  });

  it('a hit that does not finish a brick only chips it', () => {
    const built = createBuilt({ PAST: column });
    const ev = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:1' }, 5, ev);
    expect(ev.brickHits).toEqual([{ id: 'PAST:1', damage: 5, hp: 15, fell: false }]);
    expect(ev.bricksFell).toEqual([]);
  });

  it('a brick in the middle falls with what is above it but not what is below', () => {
    const built = createBuilt({ PAST: column });
    const ev = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:1' }, 99, ev);
    expect(ev.bricksFell).toEqual(['PAST:1', 'PAST:2']);
    expect(built.PAST.bricks[0]!.alive).toBe(true);
  });

  it('a brick held by two bricks stays up until both are gone', () => {
    const bridge = baseOf([
      brick('stone', 0, 10, 20),
      brick('stone', 2, 10, 20),
      brick('long', 0, 9, 50), // 4 cells wide: rests on both
    ]);
    const built = createBuilt({ PAST: bridge });
    const a = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:0' }, 99, a);
    expect(a.bricksFell).toEqual(['PAST:0']);
    const b = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:1' }, 99, b);
    expect(b.bricksFell).toEqual(['PAST:1', 'PAST:2']);
  });

  it('a shape of many materials rests by its filled squares and has their hit points', () => {
    // An L of wood, glass, stone and jelly on the foundation, a stone on its foot, and a tower
    // in its empty corner (resting on the foot, beside the arm).
    const mixed = customId('PAST', 'w0/g0/1j');
    const hp = pieceById(mixed)!.hp;
    expect(hp).toBe(5 + 3 + 8 + 6);
    const built = createBuilt({
      PAST: baseOf([brick(mixed, 4, 8, hp), brick('tower', 5, 8, 35), brick('stone', 0, 10, 20)]),
    });
    const [shape, tower] = built.PAST.bricks;
    expect(shape!.grounded).toBe(true);
    expect(shape!.hp).toBe(22);
    expect(tower!.grounded).toBe(false);
    expect(tower!.below).toEqual([0]);
    expect(tower!.anchored).toBe(false);
    const ev = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:0' }, 99, ev);
    expect(ev.bricksFell).toEqual(['PAST:0', 'PAST:1']);
  });

  it('the order is the same every time', () => {
    const run = (): string[] => {
      const built = createBuilt({ PAST: column });
      const ev = freshEvents();
      hitWall(built.PAST, { kind: 'brick', id: 'PAST:0' }, 99, ev);
      return ev.bricksFell;
    };
    expect(run()).toEqual(run());
  });

  it('a floating brick never falls by support', () => {
    const built = createBuilt({ PAST: column });
    const ev = freshEvents();
    hitWall(built.PAST, { kind: 'brick', id: 'PAST:3' }, 99, ev);
    expect(built.PAST.bricks[4]!.alive).toBe(true);
  });
});

describe('a weapon sits on its brick', () => {
  it('falls with its brick, and is reported once', () => {
    const built = createBuilt({ FUTURE: FUTURE_BASE });
    const laser = built.FUTURE.mounts.find((m) => m.id === 'mount:0')!;
    expect(laser.brick).toBe('FUTURE:1');
    const ev = freshEvents();
    hitWall(built.FUTURE, { kind: 'brick', id: 'FUTURE:0' }, 99, ev);
    // Brick 1 sits on brick 0, so the laser pad falls with the stack.
    expect(ev.bricksFell).toEqual(['FUTURE:0', 'FUTURE:1']);
    expect(ev.mountDown).toEqual([{ team: 'FUTURE', mount: 'mount:0', reason: 'brickFell' }]);
    expect(laser.alive).toBe(false);
    // The other weapon rests on the beam and is untouched.
    expect(built.FUTURE.mounts.find((m) => m.id === 'mount:1')!.alive).toBe(true);
  });

  it('a weapon on the foundation never falls with a brick', () => {
    const built = createBuilt({
      PAST: baseOf([brick('stone', 0, 10, 20)], [{ index: 0, x: 100, y: 75, weapon: 'cannon' }]),
    });
    expect(built.PAST.mounts[0]!.brick).toBeNull();
  });

  it('a weapon is hit like a brick and goes down at 0 hp', () => {
    const built = createBuilt({ PAST: PAST_BASE });
    const ev = freshEvents();
    hitWall(built.PAST, { kind: 'mount', id: 'mount:0' }, 20, ev);
    expect(ev.mountHits).toEqual([{ team: 'PAST', mount: 'mount:0', damage: 20, hp: 10 }]);
    hitWall(built.PAST, { kind: 'mount', id: 'mount:0' }, 20, ev);
    expect(ev.mountDown).toEqual([{ team: 'PAST', mount: 'mount:0', reason: 'hit' }]);
  });
});

describe('shells and walls', () => {
  const flight = (pts: Array<[number, number]>): ShotResult => ({
    path: pts.map(([x, y]) => ({ x, y })),
    landing: { x: pts[pts.length - 1]![0], y: pts[pts.length - 1]![1] },
    hit: { kind: 'ground' },
    steps: pts.length - 1,
  });
  const wall = { kind: 'brick' as const, id: 'FUTURE:0', box: { x: 100, y: 0, w: 20, h: 100 } };

  it('enterT finds where a segment first touches a box', () => {
    expect(enterT({ x: 0, y: 50 }, { x: 200, y: 50 }, wall.box)).toBeCloseTo(0.5, 6);
    expect(enterT({ x: 0, y: 150 }, { x: 200, y: 150 }, wall.box)).toBeNull();
  });

  it('a straight shell stops at the wall', () => {
    const cut = cutAtWalls(
      flight([
        [0, 50],
        [90, 50],
        [130, 50],
        [200, 50],
      ]),
      [wall],
      false,
    );
    expect(cut.stoppedBy).toEqual({ kind: 'brick', id: 'FUTURE:0' });
    expect(cut.landing).toEqual({ x: 100, y: 50 });
    expect(cut.path[cut.path.length - 1]).toEqual({ x: 100, y: 50 });
    expect(cut.steps).toBe(cut.path.length - 1);
  });

  it('an arcing shell flies over a wall going up and across, and meets it coming down', () => {
    const across = flight([
      [0, 60],
      [90, 30],
      [130, 20],
      [200, 50],
    ]);
    expect(cutAtWalls(across, [wall], true)).toBe(across);
    const down = flight([
      [0, 0],
      [90, 20],
      [110, 60],
      [200, 200],
    ]);
    const cut = cutAtWalls(down, [wall], true);
    expect(cut.stoppedBy?.id).toBe('FUTURE:0');
  });

  it('a shell that misses every wall is returned as it was', () => {
    const f = flight([
      [0, 150],
      [200, 150],
    ]);
    expect(cutAtWalls(f, [wall], false)).toBe(f);
  });
});

/** Fire the first shot of a fresh match for each aim until `want` is true. */
function findShot(
  want: (r: ShotResult, c: MatchController, out: BlastOutcome) => boolean,
  setup: (c: MatchController) => void = () => undefined,
  bases?: Partial<Record<Team, ChosenBase>>,
  seed = 5,
): { angleDeg: number; power: number } {
  for (let power = 100; power >= 20; power -= 2) {
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += 1) {
      const c = mk(bases, seed);
      c.ready();
      setup(c);
      c.setAim({ angleDeg, power });
      const r = c.fire();
      if (want(r, c, c.shotLanded())) return { angleDeg, power };
    }
  }
  throw new Error('no aim found');
}

const startTurn = (
  c: MatchController,
  aim: { angleDeg: number; power: number },
  mount?: string,
): void => {
  c.ready();
  if (mount) c.selectUnit(mount as 'mount:0');
  c.setAim(aim);
};

describe('shots in a match', () => {
  it('a fighter shot stops at a Future brick and chips it by 20', () => {
    const aim = findShot(
      (r, _c, out) => r.stoppedBy?.kind === 'brick' && (out.built?.brickHits.length ?? 0) === 1,
    );
    const c = mk();
    startTurn(c, aim);
    const r = c.fire();
    expect(r.stoppedBy?.kind).toBe('brick');
    expect(r.path[r.path.length - 1]).toEqual(r.landing);
    const out = c.shotLanded();
    expect(out.built?.brickHits).toHaveLength(1);
    expect(out.built?.brickHits[0]).toMatchObject({ damage: 20 });
    const id = out.built!.brickHits[0]!.id;
    expect(c.snapshot().bricks?.[id]?.hp).toBe(c.snapshot().bricks![id]!.maxHp - 20);
  });

  it('a brick that runs out of hp reports brickFell and bricksFell, and the stack above goes too', () => {
    const column = baseOf([brick('stone', 1, 10, 20), brick('stone', 1, 9, 20)]);
    const aim = findShot(
      (r, _c, out) => r.stoppedBy?.id === 'FUTURE:0' && out.built!.bricksFell.length === 2,
      () => undefined,
      { PAST: PAST_BASE, FUTURE: column },
    );
    const c = mk({ PAST: PAST_BASE, FUTURE: column });
    startTurn(c, aim);
    c.fire();
    const out = c.shotLanded();
    expect(out.built?.brickFell).toEqual(['FUTURE:0']);
    expect(out.built?.bricksFell).toEqual(['FUTURE:0', 'FUTURE:1']);
    const snap = c.snapshot();
    expect(snap.bricks?.['FUTURE:1']?.alive).toBe(false);
  });

  it('a fighter behind a falling wall takes no damage from it', () => {
    const column = baseOf([brick('stone', 1, 10, 20), brick('stone', 1, 9, 20)]);
    const bases = { PAST: PAST_BASE, FUTURE: column };
    const aim = findShot(
      (r) => r.stoppedBy?.id === 'FUTURE:0',
      () => undefined,
      bases,
    );
    const c = mk(bases);
    startTurn(c, aim);
    c.fire();
    const before = c.snapshot().unitHp;
    c.shotLanded();
    // Bricks did the falling; only a shell's own near miss or hit could change health.
    const after = c.snapshot().unitHp;
    for (const id of Object.keys(before) as Array<keyof typeof before>) {
      expect(after[id]).toBeGreaterThanOrEqual(before[id] - 0);
    }
  });

  it('a lob stops only on the way down; a flat shot may stop on the way across', () => {
    const lob = (c: MatchController): void => {
      c.selectUnit('mount:1');
    };
    let stopped = 0;
    for (let power = 100; power >= 20; power -= 5) {
      for (let angleDeg = 45; angleDeg <= 90; angleDeg += 3) {
        const c = mk();
        c.ready();
        lob(c);
        c.setAim({ angleDeg, power });
        const r = c.fire();
        if (r.stoppedBy) {
          stopped += 1;
          const a = r.path[r.path.length - 2]!;
          const b = r.path[r.path.length - 1]!;
          // The last step is a step downward: it fell onto the wall.
          expect(b.y).toBeGreaterThan(a.y);
        }
      }
    }
    expect(stopped).toBeGreaterThan(0);
  });

  it('volley: a burst of small shells, each chipping for the weapon damage', () => {
    const volleyAim = findShot(
      (r, _c, out) =>
        (r.volley ?? []).every((s) => s.stoppedBy?.kind === 'brick') &&
        out.built!.brickHits.length > 0,
      (c) => c.selectUnit('mount:2'),
    );
    const c = mk();
    startTurn(c, volleyAim, 'mount:2');
    const r = c.fire();
    expect(r.volley).toHaveLength(BASE_IN_BATTLE.volley.shots);
    const out = c.shotLanded();
    expect(out.built!.brickHits.length).toBeGreaterThan(0);
    for (const h of out.built!.brickHits) expect(h.damage).toBe(10);
  });

  it('volley shells fan around the aim', () => {
    const a = volleyAngles(45);
    expect(a).toHaveLength(BASE_IN_BATTLE.volley.shots);
    expect(a[1]).toBe(45);
    expect(a[0]).toBeLessThan(45);
    expect(a[2]).toBeGreaterThan(45);
  });

  it('a direct weapon is held flat and a lob is held high', () => {
    const c = mk();
    c.ready();
    c.selectUnit('mount:0');
    expect(c.setAim({ angleDeg: 80, power: 70 }).angleDeg).toBe(
      BASE_IN_BATTLE.aimByRole.direct.maxAngleDeg,
    );
    c.selectUnit('mount:1');
    expect(c.setAim({ angleDeg: 10, power: 70 }).angleDeg).toBe(
      BASE_IN_BATTLE.aimByRole.lob.minAngleDeg,
    );
    expect(mountAim('volley', { angleDeg: 10, power: 5 })).toEqual({ angleDeg: 10, power: 5 });
  });

  it('a mounted weapon fires from its pad', () => {
    const c = mk();
    c.ready();
    c.selectUnit('mount:0');
    c.setAim({ angleDeg: 30, power: 60 });
    const r = c.fire();
    const pad = c.snapshot().mounts!.PAST[0]!.origin;
    expect(r.path[0]).toEqual(pad);
    expect(c.snapshot().lastShot).toMatchObject({ mount: 'mount:0', unit: 'C' });
  });

  it('a shield generator cannot be picked to fire; an unknown weapon is refused', () => {
    const c = mk({
      PAST: baseOf([], [{ index: 0, x: 40, y: 80, weapon: 'cannon' }]),
      FUTURE: FUTURE_BASE,
    });
    c.ready();
    expect(() => c.selectUnit('mount:3')).toThrow(RangeError);
    c.selectUnit('mount:0');
    c.selectUnit('A');
    expect(c.snapshot().selectedMount?.PAST).toBeNull();
  });

  it('with the flag off a mount id is unknown', () => {
    const c = mk({ PAST: PAST_BASE }, 5, { baseInBattle: false });
    c.ready();
    expect(() => c.selectUnit('mount:0')).toThrow(RangeError);
  });
});

describe('guard: the shield generator', () => {
  const bases = { PAST: PAST_BASE, FUTURE: GUARD_BASE };
  /** Future takes a harmless turn: two shots into the air, a wrong answer, pass. */
  const futureTurn = (c: MatchController): void => {
    c.ready();
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 80, power: 20 });
      c.fire();
      c.shotLanded();
    }
    c.reloadDone({ correct: false, elapsedMs: 1000 });
    c.pass();
  };

  it('blocks the first hit near its pad each turn, then lets the next one through', () => {
    const aim = findShot((_r, _c, out) => out.built!.guardBlocked.length > 0, undefined, bases);
    const c = mk(bases);
    startTurn(c, aim);
    c.fire();
    const first = c.shotLanded();
    expect(first.built?.guardBlocked).toEqual([{ team: 'FUTURE', mount: 'mount:1' }]);
    expect(first.built?.brickHits).toEqual([]);
    expect(first.damage).toBe(0);
    c.setAim(aim);
    c.fire();
    expect(c.shotLanded().built?.guardBlocked).toEqual([]);
  });

  it('is ready again on the next turn', () => {
    const aim = findShot((_r, _c, out) => out.built!.guardBlocked.length > 0, undefined, bases);
    const c = mk(bases);
    startTurn(c, aim);
    for (let i = 0; i < 2; i++) {
      c.setAim(aim);
      c.fire();
      c.shotLanded();
    }
    c.reloadDone({ correct: false, elapsedMs: 1000 });
    c.pass();
    futureTurn(c);
    c.ready();
    c.setAim(aim);
    c.fire();
    expect(c.shotLanded().built?.guardBlocked).toHaveLength(1);
  });

  it('a guard whose brick fell blocks nothing and is out', () => {
    const built = createBuilt({ FUTURE: GUARD_BASE });
    const ev = freshEvents();
    hitWall(built.FUTURE, { kind: 'brick', id: 'FUTURE:1' }, 99, ev);
    expect(ev.mountDown.map((m) => m.mount)).toEqual(['mount:1']);
  });
});

describe('a weapon falls with its brick in a match', () => {
  it('reports mountDown and the weapon can no longer be picked', () => {
    const bases = {
      PAST: PAST_BASE,
      FUTURE: baseOf([brick('panel', 1, 10, 20)], [{ index: 0, x: 16, y: 75, weapon: 'laser' }]),
    };
    const aim = findShot(
      (r) => r.stoppedBy?.id === 'FUTURE:0',
      () => undefined,
      bases,
    );
    const c = mk(bases);
    startTurn(c, aim);
    c.fire();
    const out = c.shotLanded();
    expect(out.built?.mountDown).toEqual([
      { team: 'FUTURE', mount: 'mount:0', reason: 'brickFell' },
    ]);
    expect(c.snapshot().mounts?.FUTURE[0]!.alive).toBe(false);
  });
});

describe('win condition is still all fighters', () => {
  it('a team with only rubble left is alive while its fighters stand', () => {
    const bases = { PAST: PAST_BASE, FUTURE: baseOf([brick('panel', 1, 10, 20)]) };
    const c = mk(bases);
    const aim = findShot(
      (r) => r.stoppedBy?.id === 'FUTURE:0',
      () => undefined,
      bases,
    );
    startTurn(c, aim);
    c.fire();
    c.shotLanded();
    const snap = c.snapshot();
    expect(snap.bricks?.['FUTURE:0']?.alive).toBe(false);
    expect(snap.status).toBe('PLAYING');
    expect(snap.aliveCount.FUTURE).toBe(5);
  });
});

describe('flags', () => {
  it('flag off: bases are ignored and the match plays the same', () => {
    const run = (withBases: boolean): { snap: Match; shots: ShotResult[]; out: BlastOutcome[] } => {
      const c = createMatch({
        disturbances: false,
        players: PLAYERS,
        seed: 9,
        characterHealth: true,
        baseInBattle: false,
        ...(withBases ? { bases: { PAST: PAST_BASE, FUTURE: FUTURE_BASE } } : {}),
      });
      const shots: ShotResult[] = [];
      const out: BlastOutcome[] = [];
      c.ready();
      for (const a of [40, 55]) {
        c.setAim({ angleDeg: a, power: 75 });
        shots.push(c.fire());
        out.push(c.shotLanded());
      }
      return { snap: c.snapshot(), shots, out };
    };
    const a = run(true);
    expect(a).toEqual(run(false));
    expect(a.snap.bricks).toBeUndefined();
    expect(a.snap.mounts).toBeUndefined();
    expect(a.out[0]!.built).toBeUndefined();
  });

  it('built bases need character health', () => {
    const c = mk({ PAST: PAST_BASE }, 5, { characterHealth: false });
    expect(c.snapshot().baseInBattle).toBeUndefined();
  });

  it('the constant default is off', () => {
    expect(BASE_IN_BATTLE.enabled).toBe(false);
  });

  it('same seed, same events', () => {
    const play = (): unknown => {
      const r = playBotMatch({
        seed: 77,
        characterHealth: true,
        baseInBattle: true,
        bases: { PAST: PAST_BASE, FUTURE: FUTURE_BASE },
        profiles: { PAST: PRACTICE_BOT.scriptedHuman, FUTURE: PRACTICE_BOT.scriptedHuman },
      });
      return r;
    };
    expect(play()).toEqual(play());
  });

  it('a rematch keeps the flag and the bases', () => {
    const c = mk();
    const again = createMatch(c.rematchOptions());
    expect(Object.keys(again.snapshot().bricks ?? {})).toHaveLength(4);
  });
});

describe('Computer player', () => {
  it('can pick a mounted weapon and aims inside its role limits', () => {
    const c = mk();
    c.ready();
    const state = c.snapshot();
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const shot = chooseShot(state, 'PAST', 'hard', createRng(seed));
      if (shot.mount) {
        seen.add(shot.mount);
        const m = state.mounts!.PAST.find((x) => x.id === shot.mount)!;
        expect(m.canFire && m.alive).toBe(true);
        expect(shot).toEqual({ ...mountAim(m.role, shot), unit: shot.unit, mount: shot.mount });
      }
      // Always legal to play.
      const play = mk();
      play.ready();
      play.selectUnit(shot.mount ?? shot.unit);
      play.setAim(shot);
      expect(() => play.fire()).not.toThrow();
    }
    expect(seen.size).toBeGreaterThan(0);
    // It never picks a shield generator or an empty pad.
    for (const id of seen) expect(['mount:0', 'mount:1', 'mount:2']).toContain(id);
  });

  it('without built bases the choice is exactly what it was', () => {
    const c = createMatch({
      disturbances: false,
      players: PLAYERS,
      seed: 3,
      characterHealth: true,
    });
    c.ready();
    const shot = chooseShot(c.snapshot(), 'PAST', 'medium', createRng(4));
    expect(shot.mount).toBeUndefined();
  });
});

// ---------- Random built bases: every match still ends ----------

/** A random legal base from a seed: some bricks, some weapons. */
function randomBase(seed: number, team: Team): ChosenBase {
  const rng = createRng(seed);
  let state = newBuild(team);
  const ids =
    team === 'PAST'
      ? ['stone', 'long', 'plank', 'tower', 'wallTop']
      : ['panel', 'beam', 'solar', 'antenna'];
  const tries = rng.int(0, 40);
  for (let i = 0; i < tries; i++) {
    const res = placePiece(
      state,
      rng.pick(ids),
      { x: rng.int(0, 22), y: rng.int(0, 10), ox: 0, oy: 0 },
      rng.pick([0, 90] as const),
    );
    if (res.ok) state = res.state;
  }
  const weapons = spotWeaponsOf(team);
  for (let i = 0; i < 4; i++) {
    if (rng.next() < 0.75) {
      const res = assignWeapon(state, i, rng.pick(weapons).id);
      if (res.ok) state = res.state;
    }
  }
  return { pieces: state.pieces, spots: resolveSpots(state.pieces, state.spots) };
}

describe('matches always end with all three flags on', () => {
  it('seeded bot matches with random built bases each end with a winner under the turn cap', () => {
    const levels = PRACTICE_BOT.levels;
    const profiles = [levels.easy, levels.medium, levels.hard, PRACTICE_BOT.scriptedHuman];
    // A few bases reused across seeds keeps the aim search cached.
    const pool = (team: Team): ChosenBase[] =>
      Array.from({ length: 6 }, (_, i) =>
        randomBase(1000 + i * 17 + (team === 'PAST' ? 0 : 5), team),
      );
    const past = pool('PAST');
    const future = pool('FUTURE');
    for (let seed = 1; seed <= 240; seed++) {
      const bases: Partial<Record<Team, ChosenBase>> = {};
      if (seed % 5 !== 0) bases.PAST = past[seed % 6]!;
      if (seed % 7 !== 0) bases.FUTURE = future[(seed >> 1) % 6]!;
      const r = playBotMatch({
        seed,
        characterHealth: true,
        baseInBattle: true,
        bases,
        firstTeam: seed % 2 ? 'PAST' : 'FUTURE',
        profiles: { PAST: profiles[seed % 4]!, FUTURE: profiles[(seed >> 2) % 4]! },
      });
      expect(r.ended, `seed ${seed}`).toBe(true);
      expect(r.winner, `seed ${seed}`).not.toBeNull();
      expect(r.turns, `seed ${seed}`).toBeLessThanOrEqual(PRACTICE_BOT.maxSimTurns);
    }
  }, 1_800_000);

  it('otherTeam is what the walls use', () => {
    const built = createBuilt({ FUTURE: FUTURE_BASE });
    expect(wallsOf(built[otherTeam('PAST')])).toHaveLength(3 + 2);
  });
});
