// Built bases in battle: the bricks and weapon spots a player made, placed on the battlefield,
// with hit points, falling and support, wall hits for shells, and mounted weapons. Pure rules,
// no Phaser. Nobody is hurt: bricks puff and tumble. The match (match.ts) owns the state and
// calls these functions. Numbers are in BASE_IN_BATTLE (config.ts). See docs/GAME_SPEC.md.
import { BASE_BUILDER as BB, BASE_IN_BATTLE as BIB, BONUS, TEAM_FACING, WORLD } from './config';
import {
  PLOT_STEPS,
  chosenBase,
  chosenSpots,
  rectOf,
  restOverlap,
  spotWeaponById,
  type BasesState,
  type Placed,
  type Rect as StepRect,
  type SpotRole,
} from './baseBuilder';
import type {
  AimInput,
  BattleLayout,
  BrickId,
  BrickView,
  BuiltEvents,
  ChosenBase,
  GuardBlock,
  MountId,
  MountView,
  Rect,
  ShotResult,
  SpotView,
  Team,
  Vec2,
} from './types';
import { TEAMS } from './types';

/** The base a player takes into battle: bricks and weapon spots of the chosen slot. */
export const chosenBaseFor = (state: BasesState, name: string, team: Team): ChosenBase => ({
  pieces: chosenBase(state, name, team),
  spots: chosenSpots(state, name, team),
});

// ---------- Plot to battlefield ----------

const S = BIB.scale;
/** The plot's width on the battlefield, in px. */
export const PLOT_PX = { w: PLOT_STEPS.w * S, h: PLOT_STEPS.h * S } as const;

/** Left edge of a team's plot. Team Past builds from the left, Team Future from the right. */
export const plotLeft = (team: Team): number =>
  team === 'PAST' ? BIB.margin : WORLD.width - BIB.margin - PLOT_PX.w;

/** A point in build steps to battlefield px. Team Future is mirrored so it faces Team Past. */
export function pointToWorld(team: Team, x: number, y: number): Vec2 {
  const sx = TEAM_FACING[team] === 1 ? x : PLOT_STEPS.w - x;
  return { x: plotLeft(team) + sx * S, y: BIB.plotBottomY - (PLOT_STEPS.h - y) * S };
}

/** A brick's box in build steps to a box in battlefield px. */
export function boxToWorld(team: Team, r: StepRect): Rect {
  const a = pointToWorld(team, r.l, r.t);
  const b = pointToWorld(team, r.r, r.b);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

// ---------- State ----------

type BrickRec = BrickView & {
  id: BrickId;
  steps: StepRect;
  /** Indexes of the bricks directly under this one. */
  below: number[];
  /** Resting on the foundation. */
  grounded: boolean;
  /** Nothing held it up when the match began (a floating brick). It never falls by support. */
  anchored: boolean;
};

type MountRec = MountView & { damage: number };

export type BuiltTeam = {
  team: Team;
  bricks: BrickRec[];
  mounts: MountRec[];
  spots: SpotView[];
};
export type Built = Record<Team, BuiltTeam>;

const emptyTeam = (team: Team): BuiltTeam => ({ team, bricks: [], mounts: [], spots: [] });

/** True when a team brought a base (bricks or spots). */
export const hasBuilt = (bt: BuiltTeam): boolean => bt.bricks.length > 0 || bt.spots.length > 0;

const padHalf = BB.spots.padSteps;

function buildTeam(team: Team, base: ChosenBase | undefined): BuiltTeam {
  if (!base) return emptyTeam(team);
  const bricks: BrickRec[] = [];
  base.pieces.forEach((p, index) => {
    const steps = rectOf(p);
    if (!steps) return;
    bricks.push({
      id: `${team}:${index}`,
      team,
      piece: p.piece,
      hp: Math.max(1, p.hp),
      maxHp: Math.max(1, p.hp),
      box: boxToWorld(team, steps),
      alive: true,
      steps,
      below: [],
      grounded: steps.b >= PLOT_STEPS.h,
      anchored: false,
    });
  });
  // A brick rests on another where a filled square's bottom edge lies on a filled square's top
  // edge (the builder's own rule, so a shape of your own rests by its squares, not its box).
  const placed = base.pieces.filter((p) => rectOf(p) !== null);
  bricks.forEach((a, i) => {
    bricks.forEach((b, j) => {
      if (a !== b && restOverlap(placed[i] as Placed, placed[j] as Placed) > 0) a.below.push(j);
    });
    a.anchored = !a.grounded && a.below.length === 0;
  });
  const spots: SpotView[] = base.spots.map((s) => {
    const w = pointToWorld(team, s.x, s.y);
    return { index: s.index, x: w.x, y: w.y, weapon: s.weapon };
  });
  const mounts: MountRec[] = [];
  base.spots.forEach((s) => {
    const def = s.weapon === null ? undefined : spotWeaponById(s.weapon);
    if (!def || def.team !== team) return;
    const c = pointToWorld(team, s.x, s.y);
    // The weapon sits on the highest brick under its pad, or on the foundation.
    let under: BrickRec | null = null;
    for (const b of bricks) {
      if (b.steps.l < s.x + padHalf && b.steps.r > s.x - padHalf && b.steps.t >= s.y) {
        if (!under || b.steps.t < under.steps.t) under = b;
      }
    }
    mounts.push({
      id: `mount:${s.index}` as MountId,
      team,
      spot: s.index,
      weapon: def.id,
      role: def.role,
      hp: def.hp,
      maxHp: def.hp,
      origin: c,
      box: {
        x: c.x - BIB.mountBox.w / 2,
        y: c.y - BIB.mountBox.h / 2,
        w: BIB.mountBox.w,
        h: BIB.mountBox.h,
      },
      alive: true,
      brick: under ? under.id : null,
      canFire: def.role !== 'guard',
      damage: def.damage,
    });
  });
  return { team, bricks, mounts, spots };
}

/** Builds both teams. A team with no base given is empty (the default fixed base is used). */
export const createBuilt = (bases: Partial<Record<Team, ChosenBase>> = {}): Built => ({
  PAST: buildTeam('PAST', bases.PAST),
  FUTURE: buildTeam('FUTURE', bases.FUTURE),
});

const brickByIdIn = (bt: BuiltTeam, id: BrickId): BrickRec | undefined =>
  bt.bricks.find((b) => b.id === id);

/** The mounted weapon with this id on this team, or undefined. */
export const mountOf = (bt: BuiltTeam, id: string): MountRec | undefined =>
  bt.mounts.find((m) => m.id === id);

/** Mounts that can be picked to fire right now. */
export const firingMounts = (bt: BuiltTeam): MountRec[] =>
  bt.mounts.filter((m) => m.alive && m.canFire);

export const isMountId = (id: unknown): id is MountId =>
  typeof id === 'string' && /^mount:[0-3]$/.test(id);

// ---------- Snapshot copies ----------

export function viewBricks(built: Built): Record<BrickId, BrickView> {
  const out = {} as Record<BrickId, BrickView>;
  for (const team of TEAMS) {
    for (const b of built[team].bricks) {
      out[b.id] = {
        team: b.team,
        piece: b.piece,
        hp: b.hp,
        maxHp: b.maxHp,
        box: { ...b.box },
        alive: b.alive,
      };
    }
  }
  return out;
}

export function viewMounts(built: Built): Record<Team, MountView[]> {
  const copy = (bt: BuiltTeam): MountView[] =>
    bt.mounts.map((m) => ({
      id: m.id,
      team: m.team,
      spot: m.spot,
      weapon: m.weapon,
      role: m.role,
      hp: m.hp,
      maxHp: m.maxHp,
      origin: { ...m.origin },
      box: { ...m.box },
      alive: m.alive,
      brick: m.brick,
      canFire: m.canFire,
    }));
  return { PAST: copy(built.PAST), FUTURE: copy(built.FUTURE) };
}

export const viewSpots = (built: Built): Record<Team, SpotView[]> => ({
  PAST: built.PAST.spots.map((s) => ({ ...s })),
  FUTURE: built.FUTURE.spots.map((s) => ({ ...s })),
});

// ---------- Flight ----------

const NOWHERE: Rect = { x: -1000, y: -1000, w: 0, h: 0 };

const neutral = new WeakMap<BattleLayout, Map<string, BattleLayout>>();

/**
 * The layout a shell flies in. A team that brought a built base does not also get its default
 * base box (the bricks are its base), so that box is moved off the map. Memoized per layout.
 */
export function flightLayout(
  layout: BattleLayout,
  builtTeams: Record<Team, boolean>,
): BattleLayout {
  if (!builtTeams.PAST && !builtTeams.FUTURE) return layout;
  const key = `${builtTeams.PAST}|${builtTeams.FUTURE}`;
  const perLayout = neutral.get(layout) ?? new Map<string, BattleLayout>();
  neutral.set(layout, perLayout);
  let made = perLayout.get(key);
  if (!made) {
    made = {
      ...layout,
      bases: {
        PAST: builtTeams.PAST ? NOWHERE : layout.bases.PAST,
        FUTURE: builtTeams.FUTURE ? NOWHERE : layout.bases.FUTURE,
      },
    };
    perLayout.set(key, made);
  }
  return made;
}

export type Wall = { kind: 'brick' | 'mount'; id: string; box: Rect };

/** Everything on a team that stops a shell: weapons first, then standing bricks. */
export const wallsOf = (bt: BuiltTeam): Wall[] => [
  ...bt.mounts.filter((m) => m.alive).map((m): Wall => ({ kind: 'mount', id: m.id, box: m.box })),
  ...bt.bricks.filter((b) => b.alive).map((b): Wall => ({ kind: 'brick', id: b.id, box: b.box })),
];

/** Smallest t in [0, 1] where segment a to b is inside the box (0 if a is inside), or null. */
export function enterT(a: Vec2, b: Vec2, box: Rect): number | null {
  let t0 = 0;
  let t1 = 1;
  const axes: Array<[number, number, number, number]> = [
    [a.x, b.x - a.x, box.x, box.x + box.w],
    [a.y, b.y - a.y, box.y, box.y + box.h],
  ];
  for (const [p, d, lo, hi] of axes) {
    if (d === 0) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

/**
 * Cuts a flight at the first wall its path touches. A shell that `arcs` (a lob, or a flier's
 * shot) flies over the walls on the way up and across, and only meets one coming down.
 * Returns the flight unchanged when nothing is in the way.
 */
export function cutAtWalls(flight: ShotResult, walls: readonly Wall[], arcs: boolean): ShotResult {
  const { path } = flight;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as Vec2;
    const b = path[i + 1] as Vec2;
    if (arcs && b.y <= a.y) continue;
    let bestT: number | null = null;
    let best: Wall | null = null;
    for (const w of walls) {
      const t = enterT(a, b, w.box);
      if (t !== null && (bestT === null || t < bestT)) {
        bestT = t;
        best = w;
      }
    }
    if (bestT !== null && best) {
      const contact: Vec2 = { x: a.x + (b.x - a.x) * bestT, y: a.y + (b.y - a.y) * bestT };
      const cut = [...path.slice(0, i + 1), contact];
      return {
        path: cut,
        landing: contact,
        hit: flight.hit,
        steps: cut.length - 1,
        stoppedBy: { kind: best.kind, id: best.id },
      };
    }
  }
  return flight;
}

// ---------- Mounted weapons: aim, volley ----------

/** Keeps an aim inside what a mounted weapon of this role can do (direct is flat, lob is an arc). */
export function mountAim(role: SpotRole, aim: AimInput): AimInput {
  const r = BIB.aimByRole[role];
  return {
    angleDeg: Math.min(r.maxAngleDeg, Math.max(r.minAngleDeg, aim.angleDeg)),
    power: aim.power,
  };
}

/** The angles of each small shell in a volley, fanned around the aim. */
export const volleyAngles = (angleDeg: number): number[] => {
  const { shots, spreadDeg } = BIB.volley;
  return Array.from({ length: shots }, (_, i) =>
    Math.min(90, Math.max(0, angleDeg + (i - (shots - 1) / 2) * spreadDeg)),
  );
};

/** The role limits the Computer player searches inside. */
export const roleAngles = (role: SpotRole): { min: number; max: number } => ({
  min: BIB.aimByRole[role].minAngleDeg,
  max: BIB.aimByRole[role].maxAngleDeg,
});

/** Brick-hit-point damage of one shell. A Power Shot is 1.5 times as hard (rounded). */
export function wallDamage(
  source:
    { kind: 'fighter'; damageScale: number } | { kind: 'mount'; damage: number; role: SpotRole },
  power: boolean,
): number {
  const base =
    source.kind === 'fighter'
      ? BIB.brickDamage.fighterShot * source.damageScale
      : source.damage * BIB.brickDamage.roleMultiplier[source.role];
  const scaled = power ? base * BONUS.damageMultiplier : base;
  return base <= 0 ? 0 : Math.max(1, Math.round(scaled));
}

// ---------- Hits, falling, support ----------

export const freshEvents = (): BuiltEvents => ({
  brickHits: [],
  brickFell: [],
  bricksFell: [],
  mountHits: [],
  mountDown: [],
  guardBlocked: [],
});

function fallBrick(bt: BuiltTeam, b: BrickRec, ev: BuiltEvents): void {
  b.alive = false;
  b.hp = 0;
  ev.bricksFell.push(b.id);
  // A weapon sits on its brick: when the brick falls, the weapon falls too.
  for (const m of bt.mounts) {
    if (m.brick === b.id && m.alive) {
      m.alive = false;
      m.hp = 0;
      ev.mountDown.push({ team: bt.team, mount: m.id, reason: 'brickFell' });
    }
  }
}

/**
 * Bricks that lost their support fall, bottom to top, in a fixed order (lowest bottom edge first,
 * then leftmost, then by index). A brick is held up by the foundation or by a standing brick
 * directly under it. One pass is enough: what holds a brick up is always lower, so it was checked first.
 */
export function settle(bt: BuiltTeam, ev: BuiltEvents): void {
  const order = bt.bricks
    .map((b, i) => ({ b, i }))
    .sort((p, q) => q.b.steps.b - p.b.steps.b || p.b.steps.l - q.b.steps.l || p.i - q.i);
  for (const { b } of order) {
    if (!b.alive || b.anchored || b.grounded) continue;
    if (!b.below.some((j) => (bt.bricks[j] as BrickRec).alive)) fallBrick(bt, b, ev);
  }
}

/** A shell burst on a wall of `bt`: take hit points, and fall (with whatever it held up) at 0. */
export function hitWall(
  bt: BuiltTeam,
  wall: { kind: 'brick' | 'mount'; id: string },
  damage: number,
  ev: BuiltEvents,
): void {
  if (damage <= 0) return;
  if (wall.kind === 'mount') {
    const m = mountOf(bt, wall.id);
    if (!m || !m.alive) return;
    m.hp = Math.max(0, m.hp - damage);
    ev.mountHits.push({ team: bt.team, mount: m.id, damage, hp: m.hp });
    if (m.hp === 0) {
      m.alive = false;
      ev.mountDown.push({ team: bt.team, mount: m.id, reason: 'hit' });
    }
    return;
  }
  const b = brickByIdIn(bt, wall.id as BrickId);
  if (!b || !b.alive) return;
  b.hp = Math.max(0, b.hp - damage);
  const fell = b.hp === 0;
  ev.brickHits.push({ id: b.id, damage, hp: b.hp, fell });
  if (fell) {
    ev.brickFell.push(b.id);
    fallBrick(bt, b, ev);
    settle(bt, ev);
  }
}

// ---------- Guard (shield generator) ----------

/**
 * The standing shield generator of `bt` that blocks a hit landing at `impact`: within
 * BASE_IN_BATTLE.guardRadius of its pad, and not yet used this turn. Lowest spot first.
 */
export function guardFor(
  bt: BuiltTeam,
  impact: Vec2,
  used: ReadonlySet<string>,
): GuardBlock | null {
  for (const m of bt.mounts) {
    if (!m.alive || m.role !== 'guard' || used.has(m.id)) continue;
    if (Math.hypot(impact.x - m.origin.x, impact.y - m.origin.y) <= BIB.guardRadius) {
      return { team: bt.team, mount: m.id };
    }
  }
  return null;
}
