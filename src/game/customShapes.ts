// Your own shapes, as pure rules: a shape is a few squares drawn on a small pad. The squares must
// touch (side to side), there must be at least one, and no more than BASE_BUILDER.maxShapeCells.
// Each square has a material (stone, wood, glass, jelly for Team Past; panel, metal, glass, jelly
// for Team Future). A square with no material is the side's first one (its old look).
// A shape is trimmed, so the same shape drawn in two places on the pad is one shape. Its key is its
// rows, one letter a square, joined by "/": "0" is empty, "1" is the side's default material, and
// a material letter (w, g, j, m) is that material. An L of stone is "10/10/11". A placed shape is a
// piece whose id carries its side and key, so a saved base always holds the whole shape, with its
// materials, and never needs the saved list to load.
import { BASE_BUILDER as B } from './config';
import { nameProblem, tidyName, type NameProblem } from './customWeapons';
import type { Team } from './types';

export type Material = keyof typeof B.materialHp;
export const MATERIALS = Object.keys(B.materialHp) as Material[];

/** One square on the pad: column, row, and its material when it is not the side default. */
export type Cell = readonly [col: number, row: number, mat?: Material];
export type ShapeProblem = 'empty' | 'apart' | 'big' | 'outside' | 'material';

const PAD = B.shapePad;
const SIDE: Record<Team, string> = { PAST: 'P', FUTURE: 'F' };

/** The letter for each material in a key. The side default is always written "1". */
const LETTER: Record<Material, string> = {
  stone: 's',
  wood: 'w',
  panel: 'p',
  metal: 'm',
  glass: 'g',
  jelly: 'j',
};
const FROM_LETTER = new Map(MATERIALS.map((m) => [LETTER[m], m]));

export const isMaterial = (v: unknown): v is Material =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(B.materialHp, v);

/** The materials a side draws with. The first is its default. */
export const materialsOf = (team: Team): readonly Material[] => B.teamMaterials[team];
export const defaultMaterial = (team: Team): Material => B.teamMaterials[team][0];

/** What a square is made of, for a side. */
export const materialOf = (team: Team, cell: Cell): Material => cell[2] ?? defaultMaterial(team);

const isPadIndex = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < PAD;

const withMat = (c: number, r: number, mat: Material | undefined): Cell =>
  mat === undefined ? [c, r] : [c, r, mat];

/** The squares with repeats removed (the first one wins), in reading order, moved to the corner. */
export function normalizeCells(cells: readonly Cell[]): Cell[] {
  const seen = new Set<string>();
  const unique: Cell[] = [];
  for (const [c, r, m] of cells) {
    if (seen.has(`${c},${r}`)) continue;
    seen.add(`${c},${r}`);
    unique.push(withMat(c, r, m));
  }
  if (unique.length === 0) return [];
  const c0 = Math.min(...unique.map((q) => q[0]));
  const r0 = Math.min(...unique.map((q) => q[1]));
  return unique
    .map(([c, r, m]) => withMat(c - c0, r - r0, m))
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** The shape trimmed, with any square of the side's default material written as plain. */
export function forTeam(team: Team, cells: readonly Cell[]): Cell[] {
  const def = defaultMaterial(team);
  return normalizeCells(cells.map(([c, r, m]) => withMat(c, r, m === def ? undefined : m)));
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
  const todo: Array<[number, number]> = [[all[0]![0], all[0]![1]]];
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

/**
 * Why a drawing cannot be saved, or null when it is fine. With `team`, every material must be one
 * that side draws with. Without it, any known material is fine.
 */
export function shapeProblem(cells: readonly Cell[], team?: Team): ShapeProblem | null {
  if (!Array.isArray(cells)) return 'outside';
  for (const q of cells) {
    if (!Array.isArray(q) || !isPadIndex(q[0]) || !isPadIndex(q[1])) return 'outside';
    const m: unknown = q[2];
    if (m !== undefined && (!isMaterial(m) || (team && !materialsOf(team).includes(m))))
      return 'material';
  }
  const n = normalizeCells(cells);
  if (n.length === 0) return 'empty';
  if (n.length > B.maxShapeCells) return 'big';
  return isConnected(n) ? null : 'apart';
}

/** The canonical text of a shape: one letter a square, rows joined by "/". Same shape, same key. */
export function shapeKey(cells: readonly Cell[]): string {
  const n = normalizeCells(cells);
  const { w, h } = shapeSize(n);
  const at = new Map(n.map(([c, r, m]) => [`${c},${r}`, m ? LETTER[m] : '1']));
  return Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => at.get(`${c},${r}`) ?? '0').join(''),
  ).join('/');
}

/**
 * The squares a key stands for, or null when the key is not a clean, trimmed, valid shape. With
 * `team`, the materials must be that side's, and its default must be written "1".
 */
export function cellsFromKey(key: unknown, team?: Team): Cell[] | null {
  if (typeof key !== 'string' || key.length > PAD * (PAD + 1)) return null;
  const rows = key.split('/');
  if (rows.length > PAD) return null;
  const w = rows[0]!.length;
  const cells: Cell[] = [];
  for (const [r, row] of rows.entries()) {
    if (row.length !== w || w < 1 || w > PAD) return null;
    for (let c = 0; c < w; c++) {
      const ch = row[c]!;
      if (ch === '0') continue;
      if (ch === '1') cells.push([c, r]);
      else {
        const m = FROM_LETTER.get(ch);
        if (!m || (team && m === defaultMaterial(team))) return null;
        cells.push([c, r, m]);
      }
    }
  }
  if (shapeProblem(cells, team) !== null || shapeKey(cells) !== key) return null;
  return cells;
}

/** Hit points of a whole shape for a side: the sum of each square's material. */
export const shapeHp = (team: Team, cells: readonly Cell[]): number =>
  normalizeCells(cells).reduce((n, q) => n + B.materialHp[materialOf(team, q)], 0);

/** The squares after turning a quarter turn clockwise `rot / 90` times, trimmed again. */
export function rotateCells(cells: readonly Cell[], rot: number): Cell[] {
  let cur = normalizeCells(cells);
  for (let i = 0; i < (((rot % 360) + 360) % 360) / 90; i++) {
    const { h } = shapeSize(cur);
    cur = normalizeCells(cur.map(([c, r, m]) => withMat(h - 1 - r, c, m)));
  }
  return cur;
}

// ---------- Names ----------

/**
 * Why a shape name cannot be used, or null when it is fine: the Workshop's name rules (letters,
 * numbers and spaces, no blocked word, no player's own name), at most BASE_BUILDER.shapeNameMax.
 */
export const shapeNameProblem = (
  raw: unknown,
  privateNames: readonly string[] = [],
): NameProblem | null => nameProblem(raw, privateNames, B.shapeNameMax);

export { tidyName };

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
  const cells = cellsFromKey(key, team);
  return cells ? { team, key, cells } : null;
}
