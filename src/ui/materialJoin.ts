// Same-material squares that touch join into one piece: no seam, no border and no per-square
// outline between them. This file is the pure part: which edges of a square are shared with a
// neighbour of the same material, and the cells each brick is made of. No DOM, no Phaser. The
// drawing is in materialTiles.ts. Nothing here changes a brick's box, hit points or collision.
import { footprint, occupiedRects, pieceById, type Placed } from '../game/baseBuilder';
import { BASE_BUILDER as B } from '../game/config';
import { materialOf, rotateCells, type Material } from '../game/customShapes';

export type Side = 'n' | 'e' | 's' | 'w';
/** A stretch of one edge, as shares of its length: 0 is the start (left or top), 1 the end. */
export type Span = readonly [from: number, to: number];
/** For each edge of a square, the stretches that a same-material neighbour covers. */
export type Joins = Record<Side, Span[]>;

/** A square in any one unit (steps, picture units or px) with its material. */
export type Tile = { l: number; t: number; r: number; b: number; mat: Material };

export const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];

export const noJoins = (): Joins => ({ n: [], e: [], s: [], w: [] });
export const isJoined = (j: Joins): boolean => SIDES.some((s) => j[s].length > 0);

/** Sorts spans and merges the ones that touch or overlap. */
function merge(spans: Span[]): Span[] {
  const out: Array<[number, number]> = [];
  for (const [a, b] of [...spans].sort((p, q) => p[0] - q[0])) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/**
 * Which stretches of each edge of `tile` touch a tile of the same material in `all`. Tiles touch
 * when an edge sits on the other's opposite edge (within `eps`) and they share some length.
 * `tile` itself, and any tile that overlaps it by area, are skipped.
 */
export function joinsFor(tile: Tile, all: readonly Tile[], eps = 1e-6): Joins {
  const out = noJoins();
  const w = tile.r - tile.l;
  const h = tile.b - tile.t;
  if (w <= 0 || h <= 0) return out;
  for (const o of all) {
    if (o === tile || o.mat !== tile.mat) continue;
    const x0 = Math.max(tile.l, o.l);
    const x1 = Math.min(tile.r, o.r);
    const y0 = Math.max(tile.t, o.t);
    const y1 = Math.min(tile.b, o.b);
    const alongX: Span = [(x0 - tile.l) / w, (x1 - tile.l) / w];
    const alongY: Span = [(y0 - tile.t) / h, (y1 - tile.t) / h];
    if (x1 - x0 > eps) {
      if (Math.abs(o.b - tile.t) <= eps) out.n.push(alongX);
      if (Math.abs(o.t - tile.b) <= eps) out.s.push(alongX);
    }
    if (y1 - y0 > eps) {
      if (Math.abs(o.r - tile.l) <= eps) out.w.push(alongY);
      if (Math.abs(o.l - tile.r) <= eps) out.e.push(alongY);
    }
  }
  for (const s of SIDES) out[s] = merge(out[s]);
  return out;
}

/** The stretches of an edge that are not covered: where the outline is drawn. */
export function openSpans(covered: readonly Span[]): Span[] {
  const out: Span[] = [];
  let at = 0;
  for (const [a, b] of merge([...covered])) {
    if (a > at + 1e-6) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < 1 - 1e-6) out.push([at, 1]);
  return out;
}

/** The joins seen in a mirror (left and right swapped): east and west swap, top and bottom flip. */
export function mirrorJoins(j: Joins): Joins {
  const flip = (spans: Span[]): Span[] => spans.map(([a, b]) => [1 - b, 1 - a] as Span).reverse();
  return { n: flip(j.n), e: j.w, s: flip(j.s), w: j.e };
}

/** A short text for a set of joins, to key a texture or compare two sets. */
export function joinKey(j: Joins): string {
  const r = (n: number): number => Math.round(n * 100);
  return SIDES.map((s) => j[s].map(([a, b]) => `${r(a)}-${r(b)}`).join('+')).join('|');
}

/**
 * Slanted shine segments for glass: pieces of the lines X + Y = k * period inside the box, so the
 * lines run on across squares that touch. Segments shorter than `minLen` are left out.
 */
export function diagonalSegments(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  period: number,
  minLen = 4,
): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  if (x1 <= x0 || y1 <= y0 || period <= 0) return out;
  const first = Math.ceil((x0 + y0) / period);
  const last = Math.floor((x1 + y1) / period);
  for (let k = first; k <= last; k++) {
    const s = k * period;
    const xa = Math.max(x0, s - y1);
    const xb = Math.min(x1, s - y0);
    if ((xb - xa) * Math.SQRT2 < minLen) continue;
    out.push([xa, s - xa, xb, s - xb]);
  }
  return out;
}

// ---------- The squares of each brick ----------

/** One square of a brick in its turned frame: column, row and material. */
export type BrickCell = { c: number; r: number; mat: Material };

/**
 * The squares that join: a shape of your own (its squares), and the three plain one-material
 * bricks Stone, Plank and Panel (cut into squares). Other bricks have their own pictures and do
 * not join. Cells are in the brick's turned frame (as it sits on the plot). Empty if not joinable.
 */
export function cellsOfPiece(id: string, rot: number): BrickCell[] {
  const def = pieceById(id);
  if (!def) return [];
  if (def.cells) {
    return rotateCells(def.cells, rot).map((q) => ({ c: q[0], r: q[1], mat: materialOf(def.team, q) }));
  }
  const mat = PLAIN[def.id];
  if (!mat) return [];
  const f = footprint(def, rot as 0 | 90 | 180 | 270);
  const out: BrickCell[] = [];
  for (let r = 0; r < f.h; r++) for (let c = 0; c < f.w; c++) out.push({ c, r, mat });
  return out;
}

const PLAIN: Record<string, Material | undefined> = { stone: 'stone', plank: 'wood', panel: 'panel' };

/** True for a brick whose picture is made of joining squares. */
export const isJoinable = (id: string): boolean => cellsOfPiece(id, 0).length > 0;

/** The squares of each placed brick on the plot, in steps (same order as `cellsOfPiece`). */
export function plotTiles(pieces: readonly Placed[]): Tile[][] {
  return pieces.map((p) => {
    const cells = cellsOfPiece(p.piece, p.rot);
    if (cells.length === 0) return [];
    const rects = occupiedRects(p);
    // Normal bricks give one box. Cut it into squares the same way as the cells.
    if (rects.length === cells.length) {
      return cells.map((q, i) => ({ ...rects[i]!, mat: q.mat }));
    }
    const box = rects[0];
    if (!box) return [];
    const S = B.freeSteps;
    return cells.map((q) => ({
      l: box.l + q.c * S,
      t: box.t + q.r * S,
      r: box.l + (q.c + 1) * S,
      b: box.t + (q.r + 1) * S,
      mat: q.mat,
    }));
  });
}

/**
 * For each placed brick, the joins of each of its squares with every other square on the plot.
 * `null` for a brick that does not join, or whose squares touch nothing of their own material
 * (it keeps its ordinary picture).
 */
export function plotJoins(pieces: readonly Placed[]): Array<Joins[] | null> {
  const tiles = plotTiles(pieces);
  const all = tiles.flat();
  return tiles.map((mine, i) => {
    if (mine.length === 0) return null;
    const own = pieceById(pieces[i]!.piece)?.cells !== undefined;
    return joinsForBrick(mine, all, own);
  });
}

/**
 * The joins of one brick's squares against every square in `all` (which includes its own). A
 * shape of your own always draws as joined squares. A plain brick does only when it touches
 * another brick (`null` otherwise, so it keeps its ordinary picture).
 */
export function joinsForBrick(
  mine: readonly Tile[],
  all: readonly Tile[],
  own: boolean,
  eps = 1e-6,
): Joins[] | null {
  const joins = mine.map((t) => joinsFor(t, all, eps));
  if (own) return joins;
  const others = all.filter((t) => !mine.includes(t));
  return mine.some((t) => isJoined(joinsFor(t, others, eps))) ? joins : null;
}
