// The base builder rules: bricks on a grid, with no Phaser and no screen. A player builds a castle
// (Team Past) or a base (Team Future) before a battle. Anything goes: bricks may stand on each
// other, stick out sideways, or lean on a wall. The only rules are "inside the plot" and "no two
// bricks in the same spot". Every function returns a new state and never changes the old one.
// A base also has four weapon spots: round pads where a cannon, laser or other weapon is mounted.
import { BASE_BUILDER as B } from './config';
import {
  customId,
  isCustomId,
  parseCustomId,
  rotateCells,
  shapeKey,
  shapeProblem,
  cellsFromKey,
  type Cell,
  type ShapeProblem,
} from './customShapes';
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
  /** Only for a shape of your own: its filled squares (column, row), before turning. */
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
          hp: parts.cells.length * B.hpPerCell,
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

export type PlaceRefusal = 'unknown' | 'outside' | 'overlap' | 'full' | 'nothing';

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
 * The closest legal spot to `pos`, trying whole-cell shifts outward up to `radius` cells.
 * Returns null if nothing near is free.
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
    if (check(pieces, { ...base, ...pos }, skip) === null) return pos;
  }
  return null;
}

// ---------- The build state and its operations ----------

/** One weapon spot. `x` and `y` (the pad's middle, in steps) are only set when the player pinned it. */
export type Spot = { weapon?: string; x?: number; y?: number };

/** A spot with its place worked out. `weapon` is null for an empty pad. */
export type ResolvedSpot = { index: number; x: number; y: number; weapon: string | null };

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
  const why = check(state.pieces, cand);
  if (why) return { ok: false, reason: why };
  return {
    ok: true,
    state: commit(state, [...state.pieces, cand]),
    index: state.pieces.length,
  };
}

/** Moves a brick that is already placed. */
export function movePiece(state: BuildState, index: number, pos: Pos): BuildResult {
  const cur = state.pieces[index];
  if (!cur) return { ok: false, reason: 'nothing' };
  const next: Placed = { ...cur, ...pos };
  const why = check(state.pieces, next, index);
  if (why) return { ok: false, reason: why };
  const pieces = state.pieces.map((p, i) => (i === index ? next : p));
  return { ok: true, state: commit(state, pieces), index };
}

/** Turns a brick a quarter turn about its middle. It slides to the nearest free spot if needed. */
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
  if (!spot) return { ok: false, reason: 'overlap' };
  const pieces = state.pieces.map((p, i) => (i === index ? { ...turned, ...spot } : p));
  return { ok: true, state: commit(state, pieces), index };
}

export function removePiece(state: BuildState, index: number): BuildResult {
  if (!state.pieces[index]) return { ok: false, reason: 'nothing' };
  return {
    ok: true,
    state: commit(
      state,
      state.pieces.filter((_, i) => i !== index),
    ),
    index,
  };
}

/** Takes every brick off. Undo brings them back. */
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
    if (spot.x !== undefined && spot.y !== undefined) {
      return { index, x: padX(spot.x), y: padY(spot.y), weapon };
    }
    const x = padX(Math.round(from + ((to - from) * (index + 0.5)) / B.spots.count));
    const under = rects.filter((r) => r.l < x + PAD && r.r > x - PAD).map((r) => r.t);
    const rest = under.length ? Math.min(...under) : PLOT_STEPS.h;
    return { index, x, y: Math.max(floor, padY(rest - PAD)), weapon };
  });
}

/** Spots that hold a weapon. */
export const spotsUsed = (spots: readonly Spot[]): number =>
  spots.filter((s) => s.weapon !== undefined).length;

export type SpotRefusal = 'nospot' | 'unknown' | 'locked' | 'empty' | 'outside';
export type SpotResult =
  { ok: true; state: BuildState } | { ok: false; reason: SpotRefusal };

const withSpot = (state: BuildState, index: number, next: Spot): BuildState =>
  commit(
    state,
    state.pieces,
    state.spots.map((s, i) => (i === index ? next : s)),
  );

/**
 * Puts a weapon on a spot, replacing any weapon there. A weapon the player has not unlocked is
 * refused when `owned` is given. The same weapon on the same spot changes nothing.
 */
export function assignWeapon(
  state: BuildState,
  index: number,
  weaponId: string,
  owned?: ReadonlySet<string>,
): SpotResult {
  const cur = state.spots[index];
  if (!cur) return { ok: false, reason: 'nospot' };
  const def = spotWeaponById(weaponId);
  if (!def || def.team !== state.team) return { ok: false, reason: 'unknown' };
  if (owned && !owned.has(def.id)) return { ok: false, reason: 'locked' };
  if (cur.weapon === def.id) return { ok: true, state };
  return { ok: true, state: withSpot(state, index, { ...cur, weapon: def.id }) };
}

/** Takes the weapon off a spot. The pad stays. */
export function clearSpot(state: BuildState, index: number): SpotResult {
  const cur = state.spots[index];
  if (!cur) return { ok: false, reason: 'nospot' };
  if (cur.weapon === undefined) return { ok: false, reason: 'empty' };
  const rest: Spot = { ...cur };
  delete rest.weapon;
  return { ok: true, state: withSpot(state, index, rest) };
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
/** A weapon spot in a save: weapon id and, if pinned, the pad's middle in steps. */
export type SavedSpot = { w?: string; x?: number; y?: number };
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
 */
export function repairSpots(raw: unknown, team: Team, owned?: ReadonlySet<string>): Spot[] {
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
    const { w, x, y } = row as Record<string, unknown>;
    const def = spotWeaponById(w);
    if (def && def.team === team && (!owned || owned.has(def.id))) out.weapon = def.id;
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
 */
export function repairBase(raw: unknown, team: Team, owned?: ReadonlySet<string>): Placed[] {
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

/** The saved shape keys that are clean, new, and within the most shapes. */
function cleanShapes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const key of raw.slice(0, B.maxShapes * 4)) {
    if (out.length >= B.maxShapes) break;
    if (cellsFromKey(key) !== null && !out.includes(key as string)) out.push(key as string);
  }
  return out;
}

/** The shapes a player drew for a side, as keys. Make a piece id with `customId(team, key)`. */
export function shapesOf(state: BasesState, name: string, team: Team): string[] {
  return cleanShapes(basesOf(state, name, team).shapes);
}

export type ShapeSaveRefusal = ShapeProblem | 'duplicate' | 'full' | 'noname';
export type ShapeSaveResult =
  { ok: true; state: BasesState; key: string; id: string } | { ok: false; reason: ShapeSaveRefusal };

/**
 * Saves a drawing in the player's list for this side. It is free. The same shape drawn in another
 * place on the pad is a duplicate. A player keeps at most BASE_BUILDER.maxShapes for each side.
 */
export function saveShape(
  state: BasesState,
  name: string,
  team: Team,
  cells: readonly Cell[],
): ShapeSaveResult {
  const problem = shapeProblem(cells);
  if (problem) return { ok: false, reason: problem };
  if (walletKey(name) === '') return { ok: false, reason: 'noname' };
  const key = shapeKey(cells);
  const have = shapesOf(state, name, team);
  if (have.includes(key)) return { ok: false, reason: 'duplicate' };
  if (have.length >= B.maxShapes) return { ok: false, reason: 'full' };
  const next = withTeamBases(state, name, team, {
    ...basesOf(state, name, team),
    shapes: [...have, key],
  });
  return { ok: true, state: next, key, id: customId(team, key) };
}

/**
 * Takes a shape off the saved list. A base that already uses it keeps it, because a placed shape
 * carries its own squares. A key that is not in the list changes nothing (the same state returns).
 */
export function deleteShape(state: BasesState, name: string, team: Team, key: string): BasesState {
  const have = shapesOf(state, name, team);
  if (!have.includes(key)) return state;
  const cur = basesOf(state, name, team);
  const left = have.filter((k) => k !== key);
  const next: TeamBases = { chosen: cur.chosen, slots: cur.slots };
  if (left.length) next.shapes = left;
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
      const shapes = cleanShapes(t.shapes);
      entry[team] = {
        ...(shapes.length ? { shapes } : {}),
        chosen: isWhole(t.chosen, 0, B.slots - 1) ? t.chosen : 0,
        slots: Array.from({ length: B.slots }, (_, i) => {
          const pieces = repairBase(slots[i], team);
          const spots = repairSpots(slots[i], team);
          return pieces.length || spots.some(spotHasData) ? toSaved(pieces, spots) : null;
        }),
      };
    }
    players[clean] = entry;
  }
  return { players };
}
