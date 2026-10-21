// Your own shapes, as pure rules: a shape is a few squares drawn on a small pad. The squares must
// touch (side to side), there must be at least one, and no more than BASE_BUILDER.maxShapeCells.
// A shape is trimmed, so the same shape drawn in two places on the pad is one shape. Its key is its
// rows of 0 and 1, such as "10/10/11" for an L. A placed shape is a piece whose id carries its side
// and key, so a saved base always holds the whole shape and never needs the saved list to load.
import { BASE_BUILDER as B } from './config';
import type { Team } from './types';

/** One square on the pad: column, then row. */
export type Cell = readonly [col: number, row: number];
export type ShapeProblem = 'empty' | 'apart' | 'big' | 'outside';

const PAD = B.shapePad;
const SIDE: Record<Team, string> = { PAST: 'P', FUTURE: 'F' };

const isPadIndex = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < PAD;

/** The squares with repeats removed, in reading order, moved to the top left corner. */
export function normalizeCells(cells: readonly Cell[]): Cell[] {
  const seen = new Set<string>();
  const unique: Cell[] = [];
  for (const [c, r] of cells) {
    if (seen.has(`${c},${r}`)) continue;
    seen.add(`${c},${r}`);
    unique.push([c, r]);
  }
  if (unique.length === 0) return [];
  const c0 = Math.min(...unique.map((q) => q[0]));
  const r0 = Math.min(...unique.map((q) => q[1]));
  return unique.map(([c, r]): Cell => [c - c0, r - r0]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Width and height in squares of a trimmed shape. */
export function shapeSize(cells: readonly Cell[]): { w: number; h: number } {
  const n = normalizeCells(cells);
  return {
    w: n.length ? Math.max(...n.map((q) => q[0])) + 1 : 0,
    h: n.length ? Math.max(...n.map((q) => q[1])) + 1 : 0,
  };
}

/** True when every square can be reached from the first by steps up, down, left or right. */
export function isConnected(cells: readonly Cell[]): boolean {
  const all = normalizeCells(cells);
  if (all.length === 0) return false;
  const left = new Set(all.map(([c, r]) => `${c},${r}`));
  const todo: Cell[] = [all[0]!];
  left.delete(`${all[0]![0]},${all[0]![1]}`);
  while (todo.length) {
    const [c, r] = todo.pop()!;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const k = `${c + dc},${r + dr}`;
      if (left.delete(k)) todo.push([c + dc, r + dr]);
    }
  }
  return left.size === 0;
}

/** Why a drawing cannot be saved, or null when it is fine. */
export function shapeProblem(cells: readonly Cell[]): ShapeProblem | null {
  if (!Array.isArray(cells)) return 'outside';
  for (const q of cells) {
    if (!Array.isArray(q) || !isPadIndex(q[0]) || !isPadIndex(q[1])) return 'outside';
  }
  const n = normalizeCells(cells);
  if (n.length === 0) return 'empty';
  if (n.length > B.maxShapeCells) return 'big';
  return isConnected(n) ? null : 'apart';
}

/** The canonical text of a shape: its rows of 0 and 1, joined by "/". Same shape, same key. */
export function shapeKey(cells: readonly Cell[]): string {
  const n = normalizeCells(cells);
  const { w, h } = shapeSize(n);
  const on = new Set(n.map(([c, r]) => `${c},${r}`));
  return Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => (on.has(`${c},${r}`) ? '1' : '0')).join(''),
  ).join('/');
}

/** The squares a key stands for, or null when the key is not a clean, trimmed, valid shape. */
export function cellsFromKey(key: unknown): Cell[] | null {
  if (typeof key !== 'string' || key.length > PAD * (PAD + 1)) return null;
  const rows = key.split('/');
  if (rows.length > PAD) return null;
  const w = rows[0]!.length;
  const cells: Cell[] = [];
  for (const [r, row] of rows.entries()) {
    if (row.length !== w || w < 1 || w > PAD || !/^[01]+$/.test(row)) return null;
    for (let c = 0; c < w; c++) if (row[c] === '1') cells.push([c, r]);
  }
  if (shapeProblem(cells) !== null || shapeKey(cells) !== key) return null;
  return cells;
}

/** The squares after turning a quarter turn clockwise `rot / 90` times, trimmed again. */
export function rotateCells(cells: readonly Cell[], rot: number): Cell[] {
  let cur = normalizeCells(cells);
  for (let i = 0; i < (((rot % 360) + 360) % 360) / 90; i++) {
    const { h } = shapeSize(cur);
    cur = normalizeCells(cur.map(([c, r]): Cell => [h - 1 - r, c]));
  }
  return cur;
}

// ---------- Ids ----------

const PREFIX = 'own:';
export const isCustomId = (id: unknown): id is string =>
  typeof id === 'string' && id.startsWith(PREFIX);

/** The piece id of a shape of your own: "own:" + side letter + ":" + key. */
export const customId = (team: Team, key: string): string => `${PREFIX}${SIDE[team]}:${key}`;

export type CustomParts = { team: Team; key: string; cells: Cell[] };

/** Reads a piece id. Null unless it is a real, clean shape for a side. */
export function parseCustomId(id: unknown): CustomParts | null {
  if (!isCustomId(id) || id.length > 64) return null;
  const team = id[PREFIX.length] === 'P' ? 'PAST' : id[PREFIX.length] === 'F' ? 'FUTURE' : null;
  if (!team || id[PREFIX.length + 1] !== ':') return null;
  const key = id.slice(PREFIX.length + 2);
  const cells = cellsFromKey(key);
  return cells ? { team, key, cells } : null;
}
