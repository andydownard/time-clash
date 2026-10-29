// Built bases in battle: the bricks and weapon spots a player made, placed on the battlefield,
// with hit points, falling and support, wall hits for shells, and mounted weapons. Pure rules,
// no Phaser. Nobody is hurt: bricks puff and tumble. The match (match.ts) owns the state and
// calls these functions. Numbers are in BASE_IN_BATTLE (config.ts). See docs/GAME_SPEC.md.
import { BASE_BUILDER as BB, BASE_IN_BATTLE as BIB, BONUS, TEAM_FACING, WORLD } from './config';
import {
  PLOT_STEPS,
  chosenBase,
  chosenSpots,
  onFoundation,
  rectOf,
  restOverlap,
  spotWeaponById,
  type BasesState,
  type Placed,
  type Rect as StepRect,
  type ResolvedSpot,
  type Rotation,
  type SpotRole,
  type SpotWeaponDef,
} from './baseBuilder';
import type {
  AimInput,
  BattleLayout,
  BlastResult,
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

/**
 * Where build steps land on the battlefield. Steps `x0` to `x1` across become px from `left`, at
 * `scale` px a step. The plot's bottom edge (the top of the foundation) sits at `bottom`. A
 * mirrored frame turns the base round, so Team Future faces Team Past.
 */
export type PlotFrame = {
  left: number;
  bottom: number;
  scale: number;
  x0: number;
  x1: number;
  mirror: boolean;
};

/** The whole plot at BASE_IN_BATTLE.scale, from the team's own edge (character health mode). */
export const plotFrame = (team: Team): PlotFrame => ({
  left: plotLeft(team),
  bottom: BIB.plotBottomY,
  scale: S,
  x0: 0,
  x1: PLOT_STEPS.w,
  mirror: TEAM_FACING[team] !== 1,
});

const padHalf = BB.spots.padSteps;

/** The room a built base may fill: the old base footprint, widened by `fitWiden` (half a side). */
export const fitRoom = (box: Rect): Rect => ({
  x: box.x - BIB.fitWiden / 2,
  y: box.y,
  w: box.w + BIB.fitWiden,
  h: box.h,
});

/**
 * Base health mode: the bricks and pads of a base, fitted inside the old base footprint `box`
 * (the drawn castle's place, widened by BASE_IN_BATTLE.fitWiden px), so the aim, the fighters,
 * the field and the HUD never move. It is centered, stands on the box's bottom edge, keeps its
 * shape, and is never drawn bigger than BASE_IN_BATTLE.fitMaxScale px a step.
 */
export function fitFrame(team: Team, base: ChosenBase, box: Rect): PlotFrame {
  let l = Infinity;
  let r = -Infinity;
  let t: number = PLOT_STEPS.h;
  for (const p of base.pieces) {
    const rect = rectOf(p);
    if (!rect) continue;
    l = Math.min(l, rect.l);
    r = Math.max(r, rect.r);
    t = Math.min(t, rect.t);
  }
  for (const sp of base.spots) {
    l = Math.min(l, sp.x - padHalf);
    r = Math.max(r, sp.x + padHalf);
    t = Math.min(t, sp.y - padHalf);
  }
  if (!Number.isFinite(l) || r <= l) {
    l = 0;
    r = PLOT_STEPS.w;
  }
  l = Math.max(0, l);
  r = Math.min(PLOT_STEPS.w, r);
  t = Math.max(0, Math.min(t, PLOT_STEPS.h - 1));
  const w = r - l;
  const h = PLOT_STEPS.h - t;
  const room = fitRoom(box);
  const scale = Math.min(room.w / w, room.h / h, BIB.fitMaxScale);
  return {
    left: room.x + (room.w - w * scale) / 2,
    bottom: box.y + box.h,
    scale,
    x0: l,
    x1: r,
    mirror: TEAM_FACING[team] !== 1,
  };
}

/** A point in build steps to battlefield px. Team Future is mirrored so it faces Team Past. */
export function pointToWorld(team: Team, x: number, y: number, frame = plotFrame(team)): Vec2 {
  const sx = frame.mirror ? frame.x1 - x : x - frame.x0;
  return { x: frame.left + sx * frame.scale, y: frame.bottom - (PLOT_STEPS.h - y) * frame.scale };
}

/** A brick's box in build steps to a box in battlefield px. */
export function boxToWorld(team: Team, r: StepRect, frame = plotFrame(team)): Rect {
  const a = pointToWorld(team, r.l, r.t, frame);
  const b = pointToWorld(team, r.r, r.b, frame);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

// ---------- Base health mode: brick health ----------

/**
 * Shares `total` by `weights` in whole numbers. Every share gets at least 1, the rest goes by
 * weight, and what rounding leaves over goes to the biggest remainders (then the lowest index).
 * So the shares add up to `total` exactly (when it is at least the count) and repeat every time.
 */
export function splitHealth(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const rest = Math.max(0, Math.round(total) - n);
  const sumW = weights.reduce((a, w) => a + Math.max(0, w), 0);
  const raw = weights.map((w) => (sumW > 0 ? (rest * Math.max(0, w)) / sumW : rest / n));
  const out = raw.map((v) => Math.floor(v));
  let left = rest - out.reduce((a, v) => a + v, 0);
  const order = raw
    .map((v, i) => ({ i, f: v - Math.floor(v) }))
    .sort((a, b) => b.f - a.f || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] = (out[i] as number) + 1;
    left -= 1;
  }
  return out.map((v) => v + 1);
}

/**
 * Base health mode: each brick's starting health. The saved hit points times `perHp`, held in the
 * fair band around `flatHp` (the health the team would have with no built base). The bricks on
 * the foundation share `foundationShare` of it by their saved strength, and the bricks above
 * share the rest. A base with nothing above gives the foundation all of it.
 */
export function healthPlan(
  saved: readonly number[],
  grounded: readonly boolean[],
  flatHp: number,
): number[] {
  const { perHp, band, foundationShare } = BIB.health;
  const totalSaved = saved.reduce((a, v) => a + Math.max(0, v), 0);
  const total = Math.round(
    Math.min(flatHp * band.max, Math.max(flatHp * band.min, totalSaved * perHp)),
  );
  const up = saved.map((_, i) => !grounded[i]);
  const upper = up.some(Boolean) ? Math.round(total * (1 - foundationShare)) : 0;
  const lower = splitHealth(
    total - upper,
    saved.filter((_, i) => !up[i]),
  );
  const higher = splitHealth(
    upper,
    saved.filter((_, i) => up[i]),
  );
  let a = 0;
  let b = 0;
  return saved.map((_, i) => (up[i] ? (higher[b++] as number) : (lower[a++] as number)));
}

// ---------- State ----------

type BrickRec = BrickView & {
  id: BrickId;
  steps: StepRect;
  /** Indexes of the bricks directly under this one. */
  below: number[];
  /** Resting on the foundation. */
  grounded: boolean;
  rot: Rotation;
  /** Nothing held it up when the match began (a floating brick). It never falls by support. */
  anchored: boolean;
};

type MountRec = MountView & {
  damage: number;
  /** Base health mode: how hard it hits next to a fighter's standard shot (`mountScale`). */
  scale: number;
};

/**
 * The weapon on a resolved spot: a weapon of your own from the pad's copy (`custom`), or a
 * catalog weapon. Only this side's weapons count. Undefined for an empty pad.
 */
function defOf(team: Team, s: ResolvedSpot): SpotWeaponDef | undefined {
  const def = s.custom ?? (s.weapon === null ? undefined : spotWeaponById(s.weapon));
  return def && def.team === team ? def : undefined;
}

/** A pad as drawn in battle: 10 steps across at the base's scale, never under 8 px. */
const padBoxPx = (scale: number): number => Math.max(8, 2 * padHalf * scale);

/**
 * Base health mode: how hard a weapon on a pad hits, next to a fighter's standard shot (1).
 * Its damage x its role multiplier x its shells, over BASE_IN_BATTLE.baseHealthMount.refDamage,
 * never above maxScale. The Shield generator does not fire, so it is 0.
 */
export function mountScale(def: Pick<SpotWeaponDef, 'damage' | 'role'>): number {
  const { refDamage, maxScale } = BIB.baseHealthMount;
  const shells = def.role === 'volley' ? BIB.volley.shots : 1;
  const raw = (def.damage * BIB.brickDamage.roleMultiplier[def.role] * shells) / refDamage;
  return Math.min(maxScale, Math.max(0, raw));
}

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

type BuildOptions = { frame?: PlotFrame; flatHp?: number };

function buildTeam(team: Team, base: ChosenBase | undefined, opts: BuildOptions = {}): BuiltTeam {
  if (!base) return emptyTeam(team);
  const frame = opts.frame ?? plotFrame(team);
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
      box: boxToWorld(team, steps, frame),
      alive: true,
      rot: p.rot,
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
  // Base health mode: the bricks are the base health, in the fair band (healthPlan).
  if (opts.flatHp !== undefined) {
    const hp = healthPlan(
      bricks.map((b) => b.maxHp),
      bricks.map((b) => b.grounded),
      opts.flatHp,
    );
    bricks.forEach((b, i) => {
      b.hp = hp[i] as number;
      b.maxHp = hp[i] as number;
    });
  }
  // A weapon sits on the highest brick under its pad, or on the foundation.
  const under = (x: number, y: number): BrickRec | null => {
    let found: BrickRec | null = null;
    for (const b of bricks) {
      if (b.steps.l < x + padHalf && b.steps.r > x - padHalf && b.steps.t >= y) {
        if (!found || b.steps.t < found.steps.t) found = b;
      }
    }
    return found;
  };
  const spots: SpotView[] = base.spots.map((s) => {
    const w = pointToWorld(team, s.x, s.y, frame);
    const def = defOf(team, s);
    return {
      index: s.index,
      x: w.x,
      y: w.y,
      weapon: s.weapon,
      brick: under(s.x, s.y)?.id ?? null,
      ...(def ? { art: def.art ?? def.id } : {}),
    };
  });
  const mounts: MountRec[] = [];
  // Base health mode: a pad's hit box is the pad as drawn. Character health keeps mountBox.
  const box =
    opts.flatHp === undefined
      ? BIB.mountBox
      : { w: padBoxPx(frame.scale), h: padBoxPx(frame.scale) };
  base.spots.forEach((s) => {
    const def = defOf(team, s);
    if (!def) return;
    const c = pointToWorld(team, s.x, s.y, frame);
    const below = under(s.x, s.y);
    mounts.push({
      id: `mount:${s.index}` as MountId,
      team,
      spot: s.index,
      weapon: def.id,
      role: def.role,
      hp: def.hp,
      maxHp: def.hp,
      origin: c,
      box: { x: c.x - box.w / 2, y: c.y - box.h / 2, w: box.w, h: box.h },
      alive: true,
      brick: below ? below.id : null,
      canFire: def.role !== 'guard',
      damage: def.damage,
      name: def.name,
      art: def.art ?? def.id,
      scale: mountScale(def),
    });
  });
  return { team, bricks, mounts, spots };
}

/**
 * Base health mode (character health off): each base is fitted into its old footprint in
 * `layout`, and its bricks get base health around `flatHp`. The weapons on the pads fire (see
 * docs/GAME_SPEC.md "Weapons on the pads"); a pad has no health of its own and falls with its brick.
 */
export type BaseHealthBuild = { layout: BattleLayout; flatHp: Record<Team, number> };

/** Builds both teams. A team with no base given is empty (the default fixed base is used). */
export function createBuilt(
  bases: Partial<Record<Team, ChosenBase>> = {},
  baseHealth?: BaseHealthBuild,
): Built {
  const one = (team: Team): BuiltTeam => {
    const base = bases[team];
    if (!baseHealth || !base) return buildTeam(team, base);
    return buildTeam(team, base, {
      frame: fitFrame(team, base, baseHealth.layout.bases[team]),
      flatHp: baseHealth.flatHp[team],
    });
  };
  return { PAST: one('PAST'), FUTURE: one('FUTURE') };
}

/** True when a base has a brick on the foundation (base health mode needs one to stand). */
export const standsOnGround = (base: ChosenBase | undefined): boolean =>
  !!base && base.pieces.some((p) => onFoundation(p));

/**
 * The bases the Camp takes into battle: each player's chosen base for their side, only when it
 * has a brick on the foundation. A player with no such base gets the default castle or base.
 */
export function battleBasesFor(
  state: BasesState,
  names: Record<Team, string>,
): Partial<Record<Team, ChosenBase>> {
  const out: Partial<Record<Team, ChosenBase>> = {};
  for (const team of TEAMS) {
    const base = chosenBaseFor(state, names[team], team);
    if (standsOnGround(base)) out[team] = base;
  }
  return out;
}

// ---------- Base health mode: the base health the HUD shows ----------

/** A brick on the foundation still stands. While one does, the base stands. */
export const foundationStands = (bt: BuiltTeam): boolean =>
  bt.bricks.some((b) => b.alive && b.grounded);

/** Base health left: the sum of the standing bricks, or 0 once the foundation is gone. */
export const builtHealth = (bt: BuiltTeam): number =>
  foundationStands(bt) ? bt.bricks.reduce((a, b) => a + (b.alive ? b.hp : 0), 0) : 0;

/** The standing brick closest to `p` (lowest index on a tie), or null when none stands. */
export function nearestBrick(bt: BuiltTeam, p: Vec2): { id: BrickId; box: Rect } | null {
  let best: BrickRec | null = null;
  let bestD = Infinity;
  for (const b of bt.bricks) {
    if (!b.alive) continue;
    const dx = Math.max(b.box.x - p.x, 0, p.x - (b.box.x + b.box.w));
    const dy = Math.max(b.box.y - p.y, 0, p.y - (b.box.y + b.box.h));
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best ? { id: best.id, box: best.box } : null;
}

/** The standing brick on the foundation nearest the enemy: where a walking helper bonks. */
export function frontBrick(bt: BuiltTeam): BrickId | null {
  const front = (b: BrickRec): number =>
    TEAM_FACING[bt.team] === 1 ? b.box.x + b.box.w : -b.box.x;
  let best: BrickRec | null = null;
  for (const b of bt.bricks) {
    if (b.alive && b.grounded && (!best || front(b) > front(best))) best = b;
  }
  return best ? best.id : null;
}

/** A repair patches the most hurt standing brick (lowest index on a tie), never past full. */
export function repairBricks(bt: BuiltTeam, amount: number): void {
  if (amount <= 0) return;
  let worst: BrickRec | null = null;
  for (const b of bt.bricks) {
    if (!b.alive || b.hp >= b.maxHp) continue;
    if (!worst || b.maxHp - b.hp > worst.maxHp - worst.hp) worst = b;
  }
  if (worst) worst.hp = Math.min(worst.maxHp, worst.hp + amount);
}

/** What a shell that reached a built base counts as: the brick it is scored on, and how well. */
export type BrickBlast = { brick: BrickId | null; result: BlastResult };

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
        rot: b.rot,
        grounded: b.grounded,
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
      name: m.name,
      art: m.art,
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
