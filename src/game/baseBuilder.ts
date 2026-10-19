// The base builder rules: bricks on a grid, with no Phaser and no screen. A player builds a castle
// (Team Past) or a base (Team Future) before a battle. Anything goes: bricks may stand on each
// other, stick out sideways, or lean on a wall. The only rules are "inside the plot" and "no two
// bricks in the same spot". Every function returns a new state and never changes the old one.
import { BASE_BUILDER as B } from './config';
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

export const pieceById = (id: unknown): PieceDef | undefined => PIECES.find((p) => p.id === id);
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
    if (def && def.team === team) owned.add(id);
  }
  return owned;
}

/** True when the builder should show. `search` is the address query, such as "?builder=1". */
export function baseBuilderOn(search: string): boolean {
  if (B.enabled) return true;
  try {
    return new URLSearchParams(search).get(B.queryParam) === '1';
  } catch {
    return false;
  }
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
  for (let i = 0; i < pieces.length; i++) {
    if (i === skip) continue;
    const other = rectOf(pieces[i] as Placed);
    if (other && overlaps(rect, other)) return 'overlap';
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

export type BuildState = {
  team: Team;
  pieces: readonly Placed[];
  /** Earlier piece lists, newest last. */
  undo: ReadonlyArray<readonly Placed[]>;
};

export type BuildResult =
  { ok: true; state: BuildState; index: number } | { ok: false; reason: PlaceRefusal };

export const newBuild = (team: Team, pieces: readonly Placed[] = []): BuildState => ({
  team,
  pieces,
  undo: [],
});

function commit(state: BuildState, pieces: readonly Placed[]): BuildState {
  const undo = [...state.undo, state.pieces].slice(-B.undoDepth);
  return { team: state.team, pieces, undo };
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
  return { team: state.team, pieces: last, undo: state.undo.slice(0, -1) };
}

// ---------- Saving and loading ----------

/** [piece, x, y, ox, oy, rot, hp] */
export type SavedPiece = [string, number, number, number, number, number, number];
export type SavedBase = { v: 1; p: SavedPiece[] };

export const toSaved = (pieces: readonly Placed[]): SavedBase => ({
  v: 1,
  p: pieces.map((q) => [q.piece, q.x, q.y, q.ox, q.oy, q.rot, q.hp]),
});

export const serializeBase = (pieces: readonly Placed[]): string => JSON.stringify(toSaved(pieces));

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
    if (!def || def.team !== team || (owned && !owned.has(def.id))) continue;
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

/** Keeps a base in a slot. An empty base empties the slot. */
export function saveSlot(
  state: BasesState,
  name: string,
  team: Team,
  slot: number,
  pieces: readonly Placed[],
): BasesState {
  if (!isWhole(slot, 0, B.slots - 1)) return state;
  const cur = basesOf(state, name, team);
  const slots = cur.slots.map((s, i) =>
    i === slot ? (pieces.length ? toSaved(pieces) : null) : s,
  );
  return withTeamBases(state, name, team, { ...cur, slots });
}

export function chooseSlot(state: BasesState, name: string, team: Team, slot: number): BasesState {
  if (!isWhole(slot, 0, B.slots - 1)) return state;
  return withTeamBases(state, name, team, { ...basesOf(state, name, team), chosen: slot });
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
      entry[team] = {
        chosen: isWhole(t.chosen, 0, B.slots - 1) ? t.chosen : 0,
        slots: Array.from({ length: B.slots }, (_, i) => {
          const pieces = repairBase(slots[i], team);
          return pieces.length ? toSaved(pieces) : null;
        }),
      };
    }
    players[clean] = entry;
  }
  return { players };
}
