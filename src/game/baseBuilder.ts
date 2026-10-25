// The base builder rules: bricks on a grid, with no Phaser and no screen. A player builds a castle
// (Team Past) or a base (Team Future) before a battle. The rules: inside the plot, no two bricks in
// the same spot, and every brick is held up all the way down to the ground (see "Support"). A brick
// that something rests on cannot be taken away. Every function returns a new state and never
// changes the old one.
// A base also has four weapon spots: round pads where a cannon, laser or other weapon is mounted.
import { BASE_BUILDER as B } from './config';
import {
  customId,
  forTeam,
  isCustomId,
  parseCustomId,
  rotateCells,
  shapeHp,
  shapeKey,
  shapeNameProblem,
  shapeProblem,
  cellsFromKey,
  tidyName,
  type Cell,
  type ShapeProblem,
} from './customShapes';
import { customMountDef } from './customMounts';
import {
  cleanCustomList,
  findCustom,
  parseCustomWeaponId,
  type CustomWeapon,
} from './customWeapons';
import { walletKey } from './loadout';
import type { Team } from './types';
import { TEAMS } from './types';

export type Rotation = 0 | 90 | 180 | 270;
export const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

export type PieceDef = Readonly<{
  id: string;
  team: Team;
  /** Words for a screen reader and the tray. */
  name: string;
  /** Size in grid cells before turning. */
  w: number;
  h: number;
  /** Hit points kept in the save. The battle task reads them later. */
  hp: number;
  /** Owned from the start. Other pieces cost Scrap (see BASE_BUILDER.pieceScrap). */
  free: boolean;
  /** Only for a shape of your own: its filled squares (column, row, material), before turning. */
  cells?: readonly Cell[];
}>;

const piece = (
  id: string,
  team: Team,
  name: string,
  w: number,
  h: number,
  hp: number,
  free: boolean,
): PieceDef => ({ id, team, name, w, h, hp, free });

export const PIECES: readonly PieceDef[] = [
  piece('stone', 'PAST', 'Stone', 2, 1, B.hp.small, true),
  piece('long', 'PAST', 'Long stone', 4, 1, B.hp.large, true),
  piece('plank', 'PAST', 'Plank', 3, 1, B.hp.light, true),
  piece('tower', 'PAST', 'Tower', 1, 2, B.hp.medium, true),
  piece('wallTop', 'PAST', 'Wall top', 3, 1, B.hp.small, true),
  piece('arch', 'PAST', 'Arch', 2, 2, B.hp.medium, false),
  piece('gate', 'PAST', 'Gate', 2, 2, B.hp.large, false),
  piece('flag', 'PAST', 'Flag', 1, 2, B.hp.light, false),
  piece('panel', 'FUTURE', 'Panel', 2, 1, B.hp.small, true),
  piece('beam', 'FUTURE', 'Beam', 4, 1, B.hp.large, true),
  piece('solar', 'FUTURE', 'Solar panel', 3, 1, B.hp.small, true),
  piece('antenna', 'FUTURE', 'Antenna', 1, 2, B.hp.light, true),
  piece('laserBase', 'FUTURE', 'Laser turret base', 2, 2, B.hp.medium, false),
  piece('hangarDoor', 'FUTURE', 'Hangar door', 2, 2, B.hp.large, false),
  piece('powerCore', 'FUTURE', 'Power core', 2, 2, B.hp.medium, false),
];

const customDefs = new Map<string, PieceDef | null>();

/** The piece for a shape of your own, or undefined when the id is not a clean shape. */
function customDef(id: string): PieceDef | undefined {
  let def = customDefs.get(id);
  if (def === undefined) {
    const parts = parseCustomId(id);
    let w = 0;
    let h = 0;
    for (const [c, r] of parts?.cells ?? []) {
      w = Math.max(w, c + 1);
      h = Math.max(h, r + 1);
    }
    def = parts
      ? {
          id,
          team: parts.team,
          name: 'Your shape',
          w,
          h,
          hp: shapeHp(parts.team, parts.cells),
          free: true,
          cells: parts.cells,
        }
      : null;
    if (customDefs.size >= 500) customDefs.clear();
    customDefs.set(id, def);
  }
  return def ?? undefined;
}

/** A normal piece, or a shape of your own (its id carries its side and squares). */
export const pieceById = (id: unknown): PieceDef | undefined =>
  isCustomId(id) ? customDef(id) : PIECES.find((p) => p.id === id);
export const piecesOf = (team: Team): readonly PieceDef[] => PIECES.filter((p) => p.team === team);
/** Scrap to unlock a piece, or null if it is free from the start. */
export const pieceScrap = (def: PieceDef): number | null =>
  def.free ? null : (B.pieceScrap[def.id] ?? null);

/** The pieces a player has: the free ones, plus any they unlocked with Scrap. */
export function ownedPieceIds(team: Team, unlocked: readonly string[] | undefined): Set<string> {
  const owned = new Set(
    piecesOf(team)
      .filter((p) => p.free)
      .map((p) => p.id),
  );
  for (const id of unlocked ?? []) {
    const def = pieceById(id);
    // A shape of your own is never "unlocked": it travels inside the base that uses it.
    if (def && def.team === team && !def.cells) owned.add(id);
  }
  return owned;
}

// ---------- Weapon spots: the weapons that can be mounted ----------

export type SpotRole = 'direct' | 'lob' | 'volley' | 'guard';

export type SpotWeaponDef = Readonly<{
  id: string;
  team: Team;
  /** Words for a screen reader and the panel. */
  name: string;
  /** Scrap to unlock, or null when it is owned from the start. */
  scrap: number | null;
  /** How it fires in a later battle task: straight, in an arc, many small shots, or a shield. */
  role: SpotRole;
  damage: number;
  /** Hit points it starts with. */
  hp: number;
  /** A weapon of your own only: the catalog weapon whose picture it uses. */
  art?: string;
  /** A weapon of your own only (made in the Workshop, see customMounts.ts). */
  mine?: true;
}>;

export const SPOT_WEAPONS: readonly SpotWeaponDef[] = B.spotWeapons.map((w) => ({ ...w }));
export const spotWeaponById = (id: unknown): SpotWeaponDef | undefined =>
  SPOT_WEAPONS.find((w) => w.id === id);
export const spotWeaponsOf = (team: Team): readonly SpotWeaponDef[] =>
  SPOT_WEAPONS.filter((w) => w.team === team);

/** The spot weapons a player has: the free ones, plus any unlocked with Scrap. */
export function ownedSpotWeaponIds(
  team: Team,
  unlocked: readonly string[] | undefined,
): Set<string> {
  const owned = new Set(
    spotWeaponsOf(team)
      .filter((w) => w.scrap === null)
      .map((w) => w.id),
  );
  for (const id of unlocked ?? []) {
    const def = spotWeaponById(id);
    if (def && def.team === team) owned.add(id);
  }
  return owned;
}

/**
 * True when the builder should show. `search` is the address query: `?builder=1` forces it on and
 * `?builder=0` forces it off (the old Build Base shop). Anything else uses `BASE_BUILDER.enabled`.
 */
export function baseBuilderOn(search: string): boolean {
  try {
    const asked = new URLSearchParams(search).get(B.queryParam);
    if (asked === '1') return true;
    if (asked === '0') return false;
  } catch {
    // An unreadable address falls back to the setting.
  }
  return B.enabled;
}

// ---------- Placing ----------

/** One brick on the plot. x and y are whole cells. ox and oy are free steps inside the cell. */
export type Placed = {
  piece: string;
  x: number;
  y: number;
  /** 0 to freeSteps - 1. Always 0 when Snap was on. */
  ox: number;
  oy: number;
  rot: Rotation;
  hp: number;
};

export type Pos = Pick<Placed, 'x' | 'y' | 'ox' | 'oy'>;
export type Rect = { l: number; t: number; r: number; b: number };

const S = B.freeSteps;
/** The buildable area in steps. */
export const PLOT_STEPS = { w: B.cols * S, h: (B.rows - B.groundRows) * S } as const;

export function footprint(def: PieceDef, rot: Rotation): { w: number; h: number } {
  return rot % 180 === 0 ? { w: def.w, h: def.h } : { w: def.h, h: def.w };
}

const isRotation = (v: unknown): v is Rotation => ROTATIONS.includes(v as Rotation);
const isWhole = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** The brick's box in steps, or null if the brick is not a real piece. */
export function rectOf(p: Placed): Rect | null {
  const def = pieceById(p.piece);
  if (!def || !isRotation(p.rot)) return null;
  const f = footprint(def, p.rot);
  const l = p.x * S + p.ox;
  const t = p.y * S + p.oy;
  return { l, t, r: l + f.w * S, b: t + f.h * S };
}

/**
 * The boxes a brick really fills, in steps. A normal brick is one box. A shape of your own is one
 * box for each filled square, so a brick can sit in its empty corner. Empty for a bad brick.
 */
export function occupiedRects(p: Placed): Rect[] {
  const def = pieceById(p.piece);
  const box = rectOf(p);
  if (!def || !box) return [];
  if (!def.cells) return [box];
  return rotateCells(def.cells, p.rot).map(([c, r]) => ({
    l: box.l + c * S,
    t: box.t + r * S,
    r: box.l + (c + 1) * S,
    b: box.t + (r + 1) * S,
  }));
}

const inside = (r: Rect): boolean =>
  r.l >= 0 && r.t >= 0 && r.r <= PLOT_STEPS.w && r.b <= PLOT_STEPS.h;
/** Touching edges are fine. Only a shared area counts. */
const overlaps = (a: Rect, b: Rect): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/**
 * Why a brick cannot go somewhere. `floating`: nothing holds it up. `holding`: another brick rests
 * on it, so it cannot be taken away (the player takes the top brick off first).
 */
export type PlaceRefusal =
  'unknown' | 'outside' | 'overlap' | 'full' | 'nothing' | 'floating' | 'holding';

export function check(
  pieces: readonly Placed[],
  cand: Placed,
  skip: number | null = null,
): PlaceRefusal | null {
  const rect = rectOf(cand);
  if (!rect || !isWhole(cand.ox, 0, S - 1) || !isWhole(cand.oy, 0, S - 1)) return 'unknown';
  if (!inside(rect)) return 'outside';
  const mine = occupiedRects(cand);
  for (let i = 0; i < pieces.length; i++) {
    if (i === skip) continue;
    const other = rectOf(pieces[i] as Placed);
    // The boxes are checked first. Only then the filled squares of a shape of your own.
    if (!other || !overlaps(rect, other)) continue;
    const theirs = occupiedRects(pieces[i] as Placed);
    if (mine.some((a) => theirs.some((b) => overlaps(a, b)))) return 'overlap';
  }
  return null;
}

// ---------- Support: every brick is held up all the way down to the ground ----------

/** A brick needs at least this many steps of its bottom edge on what holds it up. */
const MIN_REST = B.minSupportSteps;

/** True when the brick stands on the foundation (its bottom edge is the bottom of the plot). */
export const onFoundation = (p: Placed): boolean => rectOf(p)?.b === PLOT_STEPS.h;

/** Steps of the bottom edges of `top` that sit exactly on the top edges of `under`. */
function contact(top: readonly Rect[], under: readonly Rect[]): number {
  let n = 0;
  for (const a of top) {
    for (const b of under) {
      if (a.b === b.t) n += Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
    }
  }
  return n;
}

/** Could a bottom edge of box `a` meet a top edge of box `b`? A quick test before the squares. */
const mayRest = (a: Rect, b: Rect): boolean => a.l < b.r && b.l < a.r && b.t <= a.b && a.t < b.b;

/**
 * How many steps of `top` rest on `under`: the bottom edge of a filled square of `top` lies
 * exactly on the top edge of a filled square of `under`, counted sideways. A gap gives 0.
 */
export function restOverlap(top: Placed, under: Placed): number {
  const a = rectOf(top);
  const b = rectOf(under);
  if (!a || !b || !mayRest(a, b)) return 0;
  return contact(occupiedRects(top), occupiedRects(under));
}

/**
 * For each brick, true when it is held up: it stands on the foundation, or it rests (by at least
 * BASE_BUILDER.minSupportSteps) on a brick that is itself held up. A brick that only touches
 * another at a corner, or only from the side, is not held up by it.
 */
export function heldUp(pieces: readonly Placed[]): boolean[] {
  const held = pieces.map(onFoundation);
  const restsOnMe: number[][] = pieces.map(() => []);
  for (let i = 0; i < pieces.length; i++) {
    for (let j = 0; j < pieces.length; j++) {
      if (i !== j && restOverlap(pieces[i] as Placed, pieces[j] as Placed) >= MIN_REST) {
        (restsOnMe[j] as number[]).push(i);
      }
    }
  }
  const queue = held.flatMap((h, i) => (h ? [i] : []));
  while (queue.length > 0) {
    const j = queue.shift() as number;
    for (const i of restsOnMe[j] as number[]) {
      if (!held[i]) {
        held[i] = true;
        queue.push(i);
      }
    }
  }
  return held;
}

/** The bricks without the one at `skip`: which are held up, and if any of them need `skip`. */
type SupportCtx = {
  rest: Placed[];
  restHeld: boolean[];
  /** Held up before, in the same order as `rest`. */
  before: boolean[];
  /** A brick that was held up is not held up without `skip`. */
  leansOnSkip: boolean;
};
const ctxCache = new WeakMap<readonly Placed[], Map<number | null, SupportCtx>>();

function supportCtx(pieces: readonly Placed[], skip: number | null): SupportCtx {
  let perList = ctxCache.get(pieces);
  if (!perList) {
    perList = new Map();
    ctxCache.set(pieces, perList);
  }
  let ctx = perList.get(skip);
  if (!ctx) {
    const all = heldUp(pieces);
    const rest = pieces.filter((_, i) => i !== skip);
    const restHeld = heldUp(rest);
    const before = all.filter((_, i) => i !== skip);
    ctx = { rest, restHeld, before, leansOnSkip: before.some((h, k) => h && !restHeld[k]) };
    perList.set(skip, ctx);
  }
  return ctx;
}

/**
 * Why `cand` cannot go on the plot (the brick at `skip` is the one being moved), or null when it
 * may. Bricks may not overlap, and the brick must be held up. A move may not leave a brick that
 * rested on the old place with nothing under it (`holding`, checked before `floating`).
 */
export function placeProblem(
  pieces: readonly Placed[],
  cand: Placed,
  skip: number | null = null,
): PlaceRefusal | null {
  const why = check(pieces, cand, skip);
  if (why) return why;
  const ctx = supportCtx(pieces, skip);
  if (!ctx.leansOnSkip) {
    // Nothing needs the moved brick, so only the brick itself must be held up.
    const held =
      onFoundation(cand) ||
      ctx.rest.some((p, k) => ctx.restHeld[k] && restOverlap(cand, p) >= MIN_REST);
    return held ? null : 'floating';
  }
  const after = heldUp([...ctx.rest, cand]);
  if (ctx.before.some((h, k) => h && !after[k])) return 'holding';
  return after[ctx.rest.length] ? null : 'floating';
}

/** True when taking the brick at `index` away would leave another brick with nothing under it. */
export function isHolding(pieces: readonly Placed[], index: number): boolean {
  return isWhole(index, 0, pieces.length - 1) && supportCtx(pieces, index).leansOnSkip;
}

const posOf = (p: Pos): Pos => ({ x: p.x, y: p.y, ox: p.ox, oy: p.oy });

const shiftDown = (p: Placed, d: number): Placed => ({
  ...p,
  ...splitSteps(p.x * S + p.ox, p.y * S + p.oy + d),
});

/**
 * A brick let go just above something lands on it: it slides straight down, at most
 * BASE_BUILDER.dropSnapSteps steps (less than one cell), to the first place it is held up.
 * Null when nothing is that close under it.
 */
export function dropOnto(
  pieces: readonly Placed[],
  cand: Placed,
  skip: number | null = null,
): Placed | null {
  for (let d = 1; d <= B.dropSnapSteps; d++) {
    const next = shiftDown(cand, d);
    const why = placeProblem(pieces, next, skip);
    if (why === null) return next;
    if (why !== 'floating') return null;
  }
  return null;
}

/** `cand` if it may go there, or the same brick dropped onto what is just under it, or null. */
function legalNear(pieces: readonly Placed[], cand: Placed, skip: number | null): Placed | null {
  const why = placeProblem(pieces, cand, skip);
  if (why === null) return cand;
  return why === 'floating' ? dropOnto(pieces, cand, skip) : null;
}

/**
 * Where a carried brick lands when it is let go at `cand`: right there, or dropped onto what is
 * just under it, or (when it overlaps a brick) the closest legal spot nearby. A brick let go in
 * mid-air is refused (`floating`), so nothing ever hangs in the sky.
 */
export function landingFor(
  pieces: readonly Placed[],
  cand: Placed,
  skip: number | null = null,
): { pos: Pos; why: null } | { pos: null; why: PlaceRefusal } {
  const why = placeProblem(pieces, cand, skip);
  if (why === null) return { pos: posOf(cand), why: null };
  if (why === 'floating') {
    const near = dropOnto(pieces, cand, skip);
    return near ? { pos: posOf(near), why: null } : { pos: null, why };
  }
  if (why === 'overlap') {
    const near = findSpot(pieces, cand, skip);
    return near ? { pos: near, why: null } : { pos: null, why };
  }
  return { pos: null, why };
}

/** Top-left of a brick from a point in fractional cells. Snap rounds to whole cells. */
export function positionFromPoint(fx: number, fy: number, snap: boolean): Pos {
  const stepsX = Math.round(fx * (snap ? 1 : S)) * (snap ? S : 1);
  const stepsY = Math.round(fy * (snap ? 1 : S)) * (snap ? S : 1);
  return splitSteps(stepsX, stepsY);
}

function splitSteps(sx: number, sy: number): Pos {
  const x = Math.floor(sx / S);
  const y = Math.floor(sy / S);
  return { x, y, ox: sx - x * S, oy: sy - y * S };
}

/** Pushes a position back inside the plot for this brick, so a drop near an edge still lands. */
export function clampToPlot(def: PieceDef, rot: Rotation, pos: Pos): Pos {
  const f = footprint(def, rot);
  const sx = Math.min(Math.max(pos.x * S + pos.ox, 0), PLOT_STEPS.w - f.w * S);
  const sy = Math.min(Math.max(pos.y * S + pos.oy, 0), PLOT_STEPS.h - f.h * S);
  return splitSteps(sx, sy);
}

/**
 * The closest legal spot to `pos` (free and held up), trying whole-cell shifts outward up to
 * `radius` cells. A shift that leaves the brick just above something drops it onto that.
 * Returns null if nothing near is legal.
 */
export function findSpot(
  pieces: readonly Placed[],
  base: Placed,
  skip: number | null,
  radius: number = B.turnSearchRadius,
): Pos | null {
  const def = pieceById(base.piece);
  if (!def) return null;
  const start = clampToPlot(def, base.rot, base);
  const tries: Array<[number, number]> = [[0, 0]];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) if (dx || dy) tries.push([dx, dy]);
  tries.sort(
    (a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2) || a[1] - b[1] || a[0] - b[0],
  );
  for (const [dx, dy] of tries) {
    const pos = clampToPlot(
      def,
      base.rot,
      splitSteps(start.x * S + start.ox + dx * S, start.y * S + start.oy + dy * S),
    );
    const near = legalNear(pieces, { ...base, ...pos }, skip);
    if (near) return posOf(near);
  }
  return null;
}

// ---------- The build state and its operations ----------

/**
 * One weapon spot. `x` and `y` (the pad's middle, in steps) are only set when the player pinned it.
 * `mine` is set only for a weapon of your own: the pad's own copy of it (its id is `weapon`), so a
 * weapon renamed or gone from the Forge later never breaks a saved base.
 */
export type Spot = { weapon?: string; mine?: CustomWeapon; x?: number; y?: number };

/**
 * A spot with its place worked out. `weapon` is null for an empty pad. `custom` is set only when
 * the pad holds a weapon of your own: that weapon as a spot weapon, from the pad's copy.
 */
export type ResolvedSpot = {
  index: number;
  x: number;
  y: number;
  weapon: string | null;
  custom?: SpotWeaponDef;
};

/**
 * The weapon on a spot: a catalog weapon, or a weapon of your own read from the pad's copy.
 * Undefined for an empty pad or anything unknown.
 */
export function spotDef(spot: Spot): SpotWeaponDef | undefined {
  if (spot.weapon === undefined) return undefined;
  const parsed = parseCustomWeaponId(spot.weapon);
  if (!parsed) return spotWeaponById(spot.weapon);
  const copy = cleanMine(spot.weapon, spot.mine);
  return copy ? customMountDef(copy, parsed.team) : undefined;
}

/** A pad's copy of a weapon of your own, checked like a saved Workshop weapon, or null. */
function cleanMine(id: unknown, copy: unknown): CustomWeapon | null {
  const parsed = parseCustomWeaponId(id);
  if (!parsed || typeof copy !== 'object' || copy === null) return null;
  // A copy that names its own id must name this one (a saved copy leaves its id out).
  const own = (copy as { id?: unknown }).id;
  if (own !== undefined && own !== id) return null;
  const [clean] = cleanCustomList([{ ...copy, id }], parsed.team);
  return clean ?? null;
}

type Snapshot = { pieces: readonly Placed[]; spots: readonly Spot[] };

export type BuildState = {
  team: Team;
  pieces: readonly Placed[];
  /** Always `B.spots.count` long. */
  spots: readonly Spot[];
  /** Earlier states, newest last. Bricks and weapons are undone together. */
  undo: readonly Snapshot[];
};

export type BuildResult =
  { ok: true; state: BuildState; index: number } | { ok: false; reason: PlaceRefusal };

export const emptySpots = (): Spot[] => Array.from({ length: B.spots.count }, () => ({}));

export const newBuild = (
  team: Team,
  pieces: readonly Placed[] = [],
  spots: readonly Spot[] = emptySpots(),
): BuildState => ({
  team,
  pieces,
  spots: normalizeSpots(spots),
  undo: [],
});

function commit(
  state: BuildState,
  pieces: readonly Placed[],
  spots: readonly Spot[] = state.spots,
): BuildState {
  const undo = [...state.undo, { pieces: state.pieces, spots: state.spots }].slice(-B.undoDepth);
  return { team: state.team, pieces, spots, undo };
}

/** Puts a new brick on the plot. The piece must be the state's team and not break a rule. */
export function placePiece(
  state: BuildState,
  id: string,
  pos: Pos,
  rot: Rotation = 0,
): BuildResult {
  const def = pieceById(id);
  if (!def || def.team !== state.team) return { ok: false, reason: 'unknown' };
  if (state.pieces.length >= B.maxPieces) return { ok: false, reason: 'full' };
  const cand: Placed = { piece: id, ...pos, rot, hp: def.hp };
  const why = placeProblem(state.pieces, cand);
  if (why) return { ok: false, reason: why };
  return {
    ok: true,
    state: commit(state, [...state.pieces, cand]),
    index: state.pieces.length,
  };
}

/**
 * Moves a brick that is already placed, turned to `rot` when given. The new place must be held
 * up, and no brick may be left with nothing under it (`holding`).
 */
export function movePiece(state: BuildState, index: number, pos: Pos, rot?: Rotation): BuildResult {
  const cur = state.pieces[index];
  if (!cur) return { ok: false, reason: 'nothing' };
  if (rot !== undefined && !isRotation(rot)) return { ok: false, reason: 'unknown' };
  const next: Placed = { ...cur, ...posOf(pos), rot: rot ?? cur.rot };
  const why = placeProblem(state.pieces, next, index);
  if (why) return { ok: false, reason: why };
  const pieces = state.pieces.map((p, i) => (i === index ? next : p));
  return { ok: true, state: commit(state, pieces), index };
}

/**
 * Turns a brick a quarter turn about its middle. It slides to the nearest legal spot if needed.
 * A brick that another brick rests on usually cannot turn (the reason is `holding`).
 */
export function turnPiece(state: BuildState, index: number): BuildResult {
  const cur = state.pieces[index];
  const def = cur && pieceById(cur.piece);
  if (!cur || !def) return { ok: false, reason: 'nothing' };
  const rot = ((cur.rot + 90) % 360) as Rotation;
  const before = footprint(def, cur.rot);
  const after = footprint(def, rot);
  // Keep the middle where it was (to the nearest step).
  const sx = cur.x * S + cur.ox + Math.round(((before.w - after.w) * S) / 2);
  const sy = cur.y * S + cur.oy + Math.round(((before.h - after.h) * S) / 2);
  const turned: Placed = { ...cur, ...splitSteps(sx, sy), rot };
  const spot = findSpot(state.pieces, turned, index);
  if (!spot) {
    return { ok: false, reason: isHolding(state.pieces, index) ? 'holding' : 'overlap' };
  }
  const pieces = state.pieces.map((p, i) => (i === index ? { ...turned, ...spot } : p));
  return { ok: true, state: commit(state, pieces), index };
}

/** Takes a brick off. A brick that another brick rests on stays (the reason is `holding`). */
export function removePiece(state: BuildState, index: number): BuildResult {
  if (!state.pieces[index]) return { ok: false, reason: 'nothing' };
  if (isHolding(state.pieces, index)) return { ok: false, reason: 'holding' };
  return {
    ok: true,
    state: commit(
      state,
      state.pieces.filter((_, i) => i !== index),
    ),
    index,
  };
}

/** Takes every brick off. Undo brings them back. Clear and Undo always work. */
export function clearBuild(state: BuildState): BuildState {
  return state.pieces.length === 0 ? state : commit(state, []);
}

/** Goes back one step. Nothing to undo changes nothing. */
export function undoBuild(state: BuildState): BuildState {
  const last = state.undo[state.undo.length - 1];
  if (!last) return state;
  return {
    team: state.team,
    pieces: last.pieces,
    spots: last.spots,
    undo: state.undo.slice(0, -1),
  };
}

// ---------- Weapon spots ----------

const PAD = B.spots.padSteps;
const padX = (x: number): number => Math.min(Math.max(x, PAD), PLOT_STEPS.w - PAD);
const padY = (y: number): number => Math.min(Math.max(y, PAD), PLOT_STEPS.h - PAD);

/** Pads sit about this far apart at the least, so a narrow base still shows four clear pads. */
const MIN_SPAN = B.spots.count * (2 * PAD + 2);

/**
 * Where each pad is. A pinned spot keeps its place. Any other pad is spread across the built base
 * and rests on the highest brick under it, or on the foundation. With no bricks the pads make a
 * row on the foundation. The bases never need to be tidy: a pad may sit on any brick.
 */
export function resolveSpots(pieces: readonly Placed[], spots: readonly Spot[]): ResolvedSpot[] {
  const rects = pieces.map(rectOf).filter((r): r is Rect => r !== null);
  let from = B.spots.rowFromCol * S;
  let to = B.spots.rowToCol * S;
  if (rects.length > 0) {
    from = Math.min(...rects.map((r) => r.l));
    to = Math.max(...rects.map((r) => r.r));
  }
  if (to - from < MIN_SPAN) {
    const mid = (from + to) / 2;
    from = mid - MIN_SPAN / 2;
    to = mid + MIN_SPAN / 2;
  }
  const floor = B.spots.topRows * S + PAD;
  return normalizeSpots(spots).map((spot, index) => {
    const weapon = spot.weapon ?? null;
    const custom = spot.mine ? spotDef(spot) : undefined;
    const extra = custom ? { custom } : {};
    if (spot.x !== undefined && spot.y !== undefined) {
      return { index, x: padX(spot.x), y: padY(spot.y), weapon, ...extra };
    }
    const x = padX(Math.round(from + ((to - from) * (index + 0.5)) / B.spots.count));
    const under = rects.filter((r) => r.l < x + PAD && r.r > x - PAD).map((r) => r.t);
    const rest = under.length ? Math.min(...under) : PLOT_STEPS.h;
    return { index, x, y: Math.max(floor, padY(rest - PAD)), weapon, ...extra };
  });
}

/** Spots that hold a weapon. */
export const spotsUsed = (spots: readonly Spot[]): number =>
  spots.filter((s) => s.weapon !== undefined).length;

export type SpotRefusal = 'nospot' | 'unknown' | 'locked' | 'empty' | 'outside';
export type SpotResult = { ok: true; state: BuildState } | { ok: false; reason: SpotRefusal };

const withSpot = (state: BuildState, index: number, next: Spot): BuildState =>
  commit(
    state,
    state.pieces,
    state.spots.map((s, i) => (i === index ? next : s)),
  );

/** A spot with no weapon: its pinned place (if any) stays. */
const withoutWeapon = (spot: Spot): Spot => {
  const rest: Spot = { ...spot };
  delete rest.weapon;
  delete rest.mine;
  return rest;
};

const sameMine = (a: CustomWeapon | undefined, b: CustomWeapon): boolean =>
  !!a &&
  a.name === b.name &&
  a.base === b.base &&
  a.power === b.power &&
  a.reach === b.reach &&
  a.splash === b.splash;

/**
 * Puts a weapon on a spot, replacing any weapon there. A catalog weapon the player has not
 * unlocked is refused when `owned` is given. A weapon of your own ("custom:P:1") must be in
 * `mine` (the player's Workshop weapons for this side) and be this side's: it costs nothing and
 * the pad keeps a copy of it. The same weapon on the same spot changes nothing.
 */
export function assignWeapon(
  state: BuildState,
  index: number,
  weaponId: string,
  owned?: ReadonlySet<string>,
  mine?: readonly CustomWeapon[],
): SpotResult {
  const cur = state.spots[index];
  if (!cur) return { ok: false, reason: 'nospot' };
  if (parseCustomWeaponId(weaponId)) {
    const found = findCustom(mine, weaponId);
    const copy = found && cleanMine(weaponId, found);
    if (!copy || parseCustomWeaponId(copy.id)?.team !== state.team) {
      return { ok: false, reason: 'unknown' };
    }
    if (cur.weapon === copy.id && sameMine(cur.mine, copy)) return { ok: true, state };
    return {
      ok: true,
      state: withSpot(state, index, { ...withoutWeapon(cur), weapon: copy.id, mine: copy }),
    };
  }
  const def = spotWeaponById(weaponId);
  if (!def || def.team !== state.team) return { ok: false, reason: 'unknown' };
  if (owned && !owned.has(def.id)) return { ok: false, reason: 'locked' };
  if (cur.weapon === def.id) return { ok: true, state };
  return { ok: true, state: withSpot(state, index, { ...withoutWeapon(cur), weapon: def.id }) };
}

/** Takes the weapon off a spot. The pad stays. */
export function clearSpot(state: BuildState, index: number): SpotResult {
  const cur = state.spots[index];
  if (!cur) return { ok: false, reason: 'nospot' };
  if (cur.weapon === undefined) return { ok: false, reason: 'empty' };
  return { ok: true, state: withSpot(state, index, withoutWeapon(cur)) };
}

/** Pins a pad's middle (in steps) or, with null, lets it follow the base again. */
export function moveSpot(
  state: BuildState,
  index: number,
  to: { x: number; y: number } | null,
): SpotResult {
  const cur = state.spots[index];
  if (!cur) return { ok: false, reason: 'nospot' };
  if (to === null) {
    const rest: Spot = { ...cur };
    delete rest.x;
    delete rest.y;
    return { ok: true, state: withSpot(state, index, rest) };
  }
  if (!padFits(to.x, to.y)) return { ok: false, reason: 'outside' };
  return { ok: true, state: withSpot(state, index, { ...cur, x: to.x, y: to.y }) };
}

const padFits = (x: unknown, y: unknown): x is number =>
  isWhole(x, PAD, PLOT_STEPS.w - PAD) && isWhole(y, PAD, PLOT_STEPS.h - PAD);

/** Exactly `count` spots: extras dropped, missing ones empty, bad fields removed. */
function normalizeSpots(spots: readonly Spot[]): Spot[] {
  return Array.from({ length: B.spots.count }, (_, i) => {
    const s = spots[i];
    const out: Spot = {};
    if (s && spotWeaponById(s.weapon)) out.weapon = s.weapon;
    const copy = s ? cleanMine(s.weapon, s.mine) : null;
    if (copy) {
      out.weapon = copy.id;
      out.mine = copy;
    }
    if (s && padFits(s.x, s.y)) {
      out.x = s.x;
      out.y = s.y;
    }
    return out;
  });
}

// ---------- Saving and loading ----------

/** [piece, x, y, ox, oy, rot, hp] */
export type SavedPiece = [string, number, number, number, number, number, number];
/** A pad's copy of a weapon of your own in a save: style, name, Power, Reach, Splash. */
export type SavedMine = { b: string; n: string; p: number; r: number; s: number };
/**
 * A weapon spot in a save: weapon id and, if pinned, the pad's middle in steps. `m` is new and
 * optional: only a weapon of your own has it, so every older save loads unchanged.
 */
export type SavedSpot = { w?: string; m?: SavedMine; x?: number; y?: number };
/** `s` is new and optional, so a base saved before weapon spots still loads. */
export type SavedBase = { v: 1; p: SavedPiece[]; s?: SavedSpot[] };

const spotHasData = (s: Spot): boolean => s.weapon !== undefined || s.x !== undefined;

export const toSaved = (pieces: readonly Placed[], spots?: readonly Spot[]): SavedBase => {
  const base: SavedBase = {
    v: 1,
    p: pieces.map((q) => [q.piece, q.x, q.y, q.ox, q.oy, q.rot, q.hp]),
  };
  const clean = normalizeSpots(spots ?? []);
  if (clean.some(spotHasData)) {
    base.s = clean.map((c) => ({
      ...(c.weapon !== undefined ? { w: c.weapon } : {}),
      ...(c.mine
        ? {
            m: {
              b: c.mine.base,
              n: c.mine.name,
              p: c.mine.power,
              r: c.mine.reach,
              s: c.mine.splash,
            },
          }
        : {}),
      ...(c.x !== undefined ? { x: c.x, y: c.y } : {}),
    }));
  }
  return base;
};

export const serializeBase = (pieces: readonly Placed[], spots?: readonly Spot[]): string =>
  JSON.stringify(toSaved(pieces, spots));

/**
 * Cleans the weapon spots of a saved base (an object or its JSON text). Nothing is trusted: an
 * unknown weapon, one for the other side, or one not owned (when `owned` is given) is dropped,
 * and a pad that sits outside the plot goes back to its automatic place. Always `count` spots.
 * A pinned pad rides on its brick: when an old floating brick is settled (see `settleBase`), the
 * pad moves down with it, and a pad whose brick had to go follows the base again.
 */
export function repairSpots(raw: unknown, team: Team, owned?: ReadonlySet<string>): Spot[] {
  const spots = cleanSpots(raw, team, owned);
  const pieces = cleanPieces(raw, team);
  const { drop } = settleBase(pieces);
  if (drop.every((d) => d === 0)) return spots;
  return spots.map((spot) => {
    if (spot.x === undefined || spot.y === undefined) return spot;
    const rider = riderOf(pieces, spot.x, spot.y);
    const d = rider === null ? 0 : drop[rider];
    if (d === 0) return spot;
    const y = spot.y + (d ?? 0);
    if (d !== null && d !== undefined && padFits(spot.x, y)) return { ...spot, y };
    const loose: Spot = { ...spot };
    delete loose.x;
    delete loose.y;
    return loose;
  });
}

/** The brick a pad sits on: the highest brick under the pad's width (the battle uses the same). */
function riderOf(pieces: readonly Placed[], x: number, y: number): number | null {
  let best: number | null = null;
  let bestTop = Infinity;
  pieces.forEach((p, i) => {
    const r = rectOf(p);
    if (r && r.l < x + PAD && r.r > x - PAD && r.t >= y && r.t < bestTop) {
      best = i;
      bestTop = r.t;
    }
  });
  return best;
}

const isObjectRow = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function cleanSpots(raw: unknown, team: Team, owned?: ReadonlySet<string>): Spot[] {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      return emptySpots();
    }
  }
  const list = typeof data === 'object' && data !== null ? (data as { s?: unknown }).s : undefined;
  return Array.from({ length: B.spots.count }, (_, i) => {
    const row: unknown = Array.isArray(list) ? list[i] : undefined;
    const out: Spot = {};
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return out;
    const { w, m, x, y } = row as Record<string, unknown>;
    const def = spotWeaponById(w);
    if (def && def.team === team && (!owned || owned.has(def.id))) out.weapon = def.id;
    // A weapon of your own travels in the pad's copy, so it needs no unlock (like a shape).
    const copy = isObjectRow(m)
      ? cleanMine(w, { base: m.b, name: m.n, power: m.p, reach: m.r, splash: m.s })
      : null;
    if (copy && parseCustomWeaponId(copy.id)?.team === team) {
      out.weapon = copy.id;
      out.mine = copy;
    }
    if (padFits(x, y)) {
      out.x = x;
      out.y = y as number;
    }
    return out;
  });
}

/**
 * Cleans a saved base. Nothing from storage is trusted: a bad brick is dropped, the rest stay.
 * Bricks that overlap an earlier brick, stick out of the plot, belong to the other team, or are
 * not owned (when `owned` is given) are dropped. HP is capped at the piece's full strength.
 * A brick saved floating in mid-air (before the support rule) drops down until it lands (see
 * `settleBase`). The builder and the battle both read bases through here.
 */
export function repairBase(raw: unknown, team: Team, owned?: ReadonlySet<string>): Placed[] {
  return settleBase(cleanPieces(raw, team, owned)).pieces;
}

/** True when loading this saved base had to move or take off a floating brick. */
export function baseWasSettled(raw: unknown, team: Team, owned?: ReadonlySet<string>): boolean {
  return settleBase(cleanPieces(raw, team, owned)).drop.some((d) => d !== 0);
}

/**
 * Makes every brick held up. Bricks that are not held up drop straight down, one at a time,
 * lowest first, then leftmost (then by index), until each lands on the foundation or on a brick
 * that is held up, without overlapping anything. A brick that cannot land (it would come to rest
 * on a corner only, or on a brick that never lands) is taken off as a last resort. `drop[i]` is
 * how many steps brick i fell, or null when it was taken off. Same input, same result.
 */
export function settleBase(pieces: readonly Placed[]): {
  pieces: Placed[];
  drop: Array<number | null>;
} {
  const cur = pieces.slice();
  const drop: Array<number | null> = pieces.map(() => 0);
  let held = heldUp(cur);
  if (held.every(Boolean)) return { pieces: cur, drop };
  const alive = pieces.map(() => true);
  const bottom = (i: number): number => rectOf(cur[i] as Placed)?.b ?? 0;
  const left = (i: number): number => rectOf(cur[i] as Placed)?.l ?? 0;
  let waiting = pieces
    .map((_, i) => i)
    .filter((i) => !held[i])
    .sort((a, b) => bottom(b) - bottom(a) || left(a) - left(b) || a - b);
  const liveHeld = (): boolean[] => {
    const idx = cur.map((_, i) => i).filter((i) => alive[i]);
    const h = heldUp(idx.map((i) => cur[i] as Placed));
    const out = cur.map(() => false);
    idx.forEach((i, k) => (out[i] = h[k] as boolean));
    return out;
  };
  let moved = true;
  while (moved && waiting.length > 0) {
    moved = false;
    const still: number[] = [];
    for (const i of waiting) {
      if (held[i]) continue;
      const others = cur.filter((_, j) => j !== i && alive[j]);
      const othersHeld = held.filter((_, j) => j !== i && alive[j]);
      const isHeld = (p: Placed): boolean =>
        onFoundation(p) || others.some((o, k) => othersHeld[k] && restOverlap(p, o) >= MIN_REST);
      let d = 0;
      let landed: Placed | null = null;
      for (;;) {
        const next = shiftDown(cur[i] as Placed, d + 1);
        if (check(others, next) !== null) break;
        d++;
        if (isHeld(next)) {
          landed = next;
          break;
        }
      }
      if (landed) {
        cur[i] = landed;
        drop[i] = (drop[i] ?? 0) + d;
        held = liveHeld();
        moved = true;
      } else still.push(i);
    }
    waiting = still;
  }
  for (const i of waiting) {
    alive[i] = false;
    drop[i] = null;
  }
  return { pieces: cur.filter((_, i) => alive[i]), drop };
}

function cleanPieces(raw: unknown, team: Team, owned?: ReadonlySet<string>): Placed[] {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
  const list = (data as { p?: unknown }).p;
  if (!Array.isArray(list)) return [];
  const out: Placed[] = [];
  for (const row of list.slice(0, B.maxPieces * 2)) {
    if (out.length >= B.maxPieces) break;
    if (!Array.isArray(row) || row.length < 6) continue;
    const [id, x, y, ox, oy, rot, hp] = row as unknown[];
    const def = pieceById(id);
    // A shape of your own is part of the base, so it needs no unlock.
    const unowned = owned && !def?.cells && !owned.has(def?.id ?? '');
    if (!def || def.team !== team || unowned) continue;
    if (!isWhole(x, -1000, 1000) || !isWhole(y, -1000, 1000)) continue;
    if (!isWhole(ox, 0, S - 1) || !isWhole(oy, 0, S - 1) || !isRotation(rot)) continue;
    const cand: Placed = {
      piece: def.id,
      x,
      y,
      ox,
      oy,
      rot,
      hp: isWhole(hp, 1, def.hp) ? hp : def.hp,
    };
    if (check(out, cand) === null) out.push(cand);
  }
  return out;
}

// ---------- Three saved bases per player and side ----------

export type TeamBases = {
  /** The slot used in battle, 0 to slots - 1. */
  chosen: number;
  /** Null is an empty slot. */
  slots: Array<SavedBase | null>;
  /** Shapes of your own that this player drew for this side (keys, see customShapes.ts). */
  shapes?: string[];
  /** The name the player gave each shape, by key. A shape with no name here gets "Shape N". */
  shapeNames?: Record<string, string>;
};
export type BasesState = { players: Record<string, Record<Team, TeamBases>> };

export const freshTeamBases = (): TeamBases => ({
  chosen: 0,
  slots: Array.from({ length: B.slots }, () => null),
});
export const freshBases = (): BasesState => ({ players: {} });

export function basesOf(state: BasesState, name: string, team: Team): TeamBases {
  return state.players[walletKey(name)]?.[team] ?? freshTeamBases();
}

const withTeamBases = (
  state: BasesState,
  name: string,
  team: Team,
  next: TeamBases,
): BasesState => {
  const key = walletKey(name);
  if (key === '') return state;
  const cur = state.players[key] ?? { PAST: freshTeamBases(), FUTURE: freshTeamBases() };
  return { players: { ...state.players, [key]: { ...cur, [team]: next } } };
};

/**
 * Keeps a base in a slot. A base with no bricks and no weapons empties the slot. Without `spots`,
 * the spots already saved in the slot stay as they are.
 */
export function saveSlot(
  state: BasesState,
  name: string,
  team: Team,
  slot: number,
  pieces: readonly Placed[],
  spots?: readonly Spot[],
): BasesState {
  if (!isWhole(slot, 0, B.slots - 1)) return state;
  const cur = basesOf(state, name, team);
  const keep = spots ?? repairSpots(cur.slots[slot], team);
  const slots = cur.slots.map((s, i) =>
    i === slot ? (pieces.length || keep.some(spotHasData) ? toSaved(pieces, keep) : null) : s,
  );
  return withTeamBases(state, name, team, { ...cur, slots });
}

export function chooseSlot(state: BasesState, name: string, team: Team, slot: number): BasesState {
  if (!isWhole(slot, 0, B.slots - 1)) return state;
  return withTeamBases(state, name, team, { ...basesOf(state, name, team), chosen: slot });
}

// ---------- Your own shapes: the saved list for each player and side ----------

/** The saved shape keys that are clean for this side, new, and within the most shapes. */
function cleanShapes(raw: unknown, team: Team): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const key of raw.slice(0, B.maxShapes * 4)) {
    if (out.length >= B.maxShapes) break;
    if (cellsFromKey(key, team) !== null && !out.includes(key as string)) out.push(key as string);
  }
  return out;
}

/** The saved names that belong to a saved shape and pass the name rules. */
function cleanShapeNames(raw: unknown, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const key of keys) {
    const v: unknown = Object.prototype.hasOwnProperty.call(raw, key)
      ? (raw as Record<string, unknown>)[key]
      : undefined;
    if (shapeNameProblem(v) === null) out[key] = tidyName(v);
  }
  return out;
}

/** The shapes a player drew for a side, as keys. Make a piece id with `customId(team, key)`. */
export function shapesOf(state: BasesState, name: string, team: Team): string[] {
  return cleanShapes(basesOf(state, name, team).shapes, team);
}

/** The name shown for the shape at place `index` (0 first) when it was saved without one. */
export const defaultShapeName = (index: number): string => `Shape ${index + 1}`;

export type SavedShape = { key: string; id: string; name: string };

/** The saved shapes in saved order, each with its piece id and its name (or "Shape N"). */
export function savedShapes(state: BasesState, name: string, team: Team): SavedShape[] {
  const keys = shapesOf(state, name, team);
  const names = cleanShapeNames(basesOf(state, name, team).shapeNames, keys);
  return keys.map((key, i) => ({
    key,
    id: customId(team, key),
    name: names[key] ?? defaultShapeName(i),
  }));
}

/** The name the pad fills in for a new shape: the first "Shape N" from the next place not in use. */
export function nextShapeName(state: BasesState, name: string, team: Team): string {
  const taken = new Set(savedShapes(state, name, team).map((s) => s.name.toLowerCase()));
  let i = shapesOf(state, name, team).length;
  while (taken.has(defaultShapeName(i).toLowerCase())) i++;
  return defaultShapeName(i);
}

export type ShapeSaveRefusal = ShapeProblem | 'duplicate' | 'full' | 'noname';
export type ShapeSaveResult =
  | { ok: true; state: BasesState; key: string; id: string; name: string }
  | { ok: false; reason: ShapeSaveRefusal };

/**
 * Saves a drawing in the player's list for this side, with its name. It is free. The same shape
 * (same squares, same materials) drawn in another place on the pad is a duplicate. A player keeps
 * at most BASE_BUILDER.maxShapes for each side. A name that is empty or breaks the name rules
 * (see `shapeNameProblem`; the player's own name is never used) becomes the next "Shape N", so
 * Save always works.
 */
export function saveShape(
  state: BasesState,
  name: string,
  team: Team,
  cells: readonly Cell[],
  shapeName?: string,
): ShapeSaveResult {
  const problem = shapeProblem(cells, team);
  if (problem) return { ok: false, reason: problem };
  if (walletKey(name) === '') return { ok: false, reason: 'noname' };
  const key = shapeKey(forTeam(team, cells));
  const have = shapesOf(state, name, team);
  if (have.includes(key)) return { ok: false, reason: 'duplicate' };
  if (have.length >= B.maxShapes) return { ok: false, reason: 'full' };
  const cur = basesOf(state, name, team);
  const label =
    shapeNameProblem(shapeName, [name]) === null
      ? tidyName(shapeName)
      : nextShapeName(state, name, team);
  const next = withTeamBases(state, name, team, {
    ...cur,
    shapes: [...have, key],
    shapeNames: { ...cleanShapeNames(cur.shapeNames, have), [key]: label },
  });
  return { ok: true, state: next, key, id: customId(team, key), name: label };
}

/**
 * Takes a shape (and its name) off the saved list. A base that already uses it keeps it, because
 * a placed shape carries its own squares and materials. A key that is not in the list changes
 * nothing (the same state returns).
 */
export function deleteShape(state: BasesState, name: string, team: Team, key: string): BasesState {
  const have = shapesOf(state, name, team);
  if (!have.includes(key)) return state;
  const cur = basesOf(state, name, team);
  const left = have.filter((k) => k !== key);
  const next: TeamBases = { chosen: cur.chosen, slots: cur.slots };
  if (left.length) {
    next.shapes = left;
    const names = cleanShapeNames(cur.shapeNames, left);
    if (Object.keys(names).length) next.shapeNames = names;
  }
  return withTeamBases(state, name, team, next);
}

/** The bricks in one slot, cleaned. */
export function slotPieces(
  state: BasesState,
  name: string,
  team: Team,
  slot: number,
  owned?: ReadonlySet<string>,
): Placed[] {
  return repairBase(basesOf(state, name, team).slots[slot], team, owned);
}

/** The weapon spots in one slot, cleaned. */
export function slotSpots(
  state: BasesState,
  name: string,
  team: Team,
  slot: number,
  owned?: ReadonlySet<string>,
): Spot[] {
  return repairSpots(basesOf(state, name, team).slots[slot], team, owned);
}

/**
 * The weapon spots this player takes into battle, each with its place on the plot (in steps) and
 * the weapon id, or null when the pad is empty (the battle task reads this with `chosenBase`).
 */
export function chosenSpots(state: BasesState, name: string, team: Team): ResolvedSpot[] {
  const { chosen } = basesOf(state, name, team);
  return resolveSpots(chosenBase(state, name, team), slotSpots(state, name, team, chosen));
}

/** The base this player takes into battle for this side (the battle task reads this). */
export function chosenBase(state: BasesState, name: string, team: Team): Placed[] {
  const bases = basesOf(state, name, team);
  return slotPieces(state, name, team, bases.chosen);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Cleans everything read from storage. Returns null only when it is not an object at all. */
export function parseBases(raw: unknown): BasesState | null {
  if (!isObject(raw) || !isObject(raw.players)) return null;
  const players: BasesState['players'] = {};
  for (const [key, value] of Object.entries(raw.players).slice(0, B.maxPlayers)) {
    if (!isObject(value)) continue;
    // The key is rebuilt so a hand-edited key cannot make a second pile.
    const clean = walletKey(key);
    if (clean === '') continue;
    const entry = { PAST: freshTeamBases(), FUTURE: freshTeamBases() };
    for (const team of TEAMS) {
      const t = value[team];
      if (!isObject(t)) continue;
      const slots = Array.isArray(t.slots) ? t.slots : [];
      const shapes = cleanShapes(t.shapes, team);
      const shapeNames = cleanShapeNames(t.shapeNames, shapes);
      entry[team] = {
        ...(shapes.length ? { shapes } : {}),
        ...(Object.keys(shapeNames).length ? { shapeNames } : {}),
        chosen: isWhole(t.chosen, 0, B.slots - 1) ? t.chosen : 0,
        slots: Array.from({ length: B.slots }, (_, i) => {
          // Cleaned but not settled: the builder settles a base when it opens it, so it can say so.
          const pieces = cleanPieces(slots[i], team);
          const spots = cleanSpots(slots[i], team);
          return pieces.length || spots.some(spotHasData) ? toSaved(pieces, spots) : null;
        }),
      };
    }
    players[clean] = entry;
  }
  return { players };
}
