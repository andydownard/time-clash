// Draws squares of one material so that touching squares read as one piece: no border between
// them, the material pattern runs on across the seam, and only the outer edge of the joined area
// gets an outline. A square with no neighbour is drawn exactly as `materialSquare` always did.
// Pure text, like the rest of the base art. The join rules are in materialJoin.ts.
import type { Material } from '../game/customShapes';
import { CELL, INK, MATERIAL_ART, materialSquare } from './materialArt';
import {
  diagonalSegments,
  isJoined,
  joinsFor,
  noJoins,
  openSpans,
  type BrickCell,
  type Joins,
  type Side,
  type Span,
  type Tile,
} from './materialJoin';

/** One square to draw: its top left corner, material, joins, and a count that varies the pattern. */
export type DrawTile = { x: number; y: number; mat: Material; joins: Joins; phase: number };

/** Outer corner radius of each material (the same as `materialSquare`'s rx). */
const RADIUS: Record<Material, number> = { stone: 4, wood: 3, panel: 6, metal: 2, glass: 3, jelly: 13 };
/** Space between the edge of the square and its fill (jelly keeps its small margin). */
const INSET: Record<Material, number> = { stone: 0, wood: 0, panel: 0, metal: 0, glass: 0, jelly: 1 };
/** Tiny overlap into a joined neighbour, so no hairline shows between two opaque fills. */
const BLEED = 0.6;
const C = CELL;
const f = (n: number): string => String(Math.round(n * 100) / 100);

type Covered = Record<Side, boolean>;
const coveredOf = (j: Joins): Covered => ({
  n: j.n.length > 0,
  e: j.e.length > 0,
  s: j.s.length > 0,
  w: j.w.length > 0,
});

/** A rectangle path with a radius on each corner (clockwise from top left; 0 is square). */
function roundedRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  [nw, ne, se, sw]: readonly [number, number, number, number],
): string {
  const arc = (r: number, x: number, y: number): string => (r > 0 ? `A${r},${r} 0 0 1 ${f(x)},${f(y)}` : '');
  return (
    `M${f(x0 + nw)},${f(y0)} H${f(x1 - ne)} ${arc(ne, x1, y0 + ne)} V${f(y1 - se)} ${arc(se, x1 - se, y1)} ` +
    `H${f(x0 + sw)} ${arc(sw, x0, y1 - sw)} V${f(y0 + nw)} ${arc(nw, x0 + nw, y0)} Z`
  );
}

/** Which corners are rounded: only where both edges that meet there are open. */
function corners(cov: Covered, mat: Material): [number, number, number, number] {
  const r = RADIUS[mat];
  return [
    !cov.n && !cov.w ? r : 0,
    !cov.n && !cov.e ? r : 0,
    !cov.s && !cov.e ? r : 0,
    !cov.s && !cov.w ? r : 0,
  ];
}

/** The box of the fill for a square: inset on open edges, bleeding a little into joined ones. */
function fillBox(t: DrawTile, cov: Covered): [number, number, number, number] {
  const i = INSET[t.mat];
  const bleed = t.mat === 'glass' ? 0 : BLEED;
  return [
    t.x + (cov.w ? -bleed : i),
    t.y + (cov.n ? -bleed : i),
    t.x + C + (cov.e ? bleed : -i),
    t.y + C + (cov.s ? bleed : -i),
  ];
}

function fillPath(t: DrawTile): string {
  const cov = coveredOf(t.joins);
  const [x0, y0, x1, y1] = fillBox(t, cov);
  return roundedRect(x0, y0, x1, y1, corners(cov, t.mat));
}

/** The outline: only the open stretches of each edge, plus the arcs at rounded corners. */
function outlinePath(t: DrawTile): string {
  const cov = coveredOf(t.joins);
  const i = INSET[t.mat];
  const x0 = t.x + (cov.w ? 0 : i);
  const y0 = t.y + (cov.n ? 0 : i);
  const x1 = t.x + C - (cov.e ? 0 : i);
  const y1 = t.y + C - (cov.s ? 0 : i);
  const rad = corners(cov, t.mat);
  const [nw, ne, se, sw] = rad;
  const open: Record<Side, Span[]> = {
    n: openSpans(t.joins.n),
    e: openSpans(t.joins.e),
    s: openSpans(t.joins.s),
    w: openSpans(t.joins.w),
  };
  const starts = (s: Side): boolean => open[s].some(([a]) => a < 1e-6);
  const ends = (s: Side): boolean => open[s].some(([, b]) => b > 1 - 1e-6);
  // A square outer corner (both edges open there, but one only partly) needs its two ends to meet.
  const capNW = nw === 0 && starts('n') && starts('w') ? 2 : 0;
  const capNE = ne === 0 && ends('n') && starts('e') ? 2 : 0;
  const capSE = se === 0 && ends('e') && ends('s') ? 2 : 0;
  const capSW = sw === 0 && starts('s') && ends('w') ? 2 : 0;
  const d: string[] = [];
  for (const [a, b] of open.n) {
    const from = x0 + a * (x1 - x0) + (a < 1e-6 ? (nw || -capNW) : 0);
    const to = x0 + b * (x1 - x0) - (b > 1 - 1e-6 ? (ne || -capNE) : 0);
    d.push(`M${f(from)},${f(y0)} H${f(to)}`);
  }
  for (const [a, b] of open.e) {
    const from = y0 + a * (y1 - y0) + (a < 1e-6 ? (ne || -capNE) : 0);
    const to = y0 + b * (y1 - y0) - (b > 1 - 1e-6 ? (se || -capSE) : 0);
    d.push(`M${f(x1)},${f(from)} V${f(to)}`);
  }
  for (const [a, b] of open.s) {
    const from = x0 + a * (x1 - x0) + (a < 1e-6 ? (sw || -capSW) : 0);
    const to = x0 + b * (x1 - x0) - (b > 1 - 1e-6 ? (se || -capSE) : 0);
    d.push(`M${f(from)},${f(y1)} H${f(to)}`);
  }
  for (const [a, b] of open.w) {
    const from = y0 + a * (y1 - y0) + (a < 1e-6 ? (nw || -capNW) : 0);
    const to = y0 + b * (y1 - y0) - (b > 1 - 1e-6 ? (sw || -capSW) : 0);
    d.push(`M${f(x0)},${f(from)} V${f(to)}`);
  }
  if (nw) d.push(`M${f(x0)},${f(y0 + nw)} A${nw},${nw} 0 0 1 ${f(x0 + nw)},${f(y0)}`);
  if (ne) d.push(`M${f(x1 - ne)},${f(y0)} A${ne},${ne} 0 0 1 ${f(x1)},${f(y0 + ne)}`);
  if (se) d.push(`M${f(x1)},${f(y1 - se)} A${se},${se} 0 0 1 ${f(x1 - se)},${f(y1)}`);
  if (sw) d.push(`M${f(x0 + sw)},${f(y1)} A${sw},${sw} 0 0 1 ${f(x0)},${f(y1 - sw)}`);
  return d.join(' ');
}

/** The pattern of one square. It reaches the joined edges, so it runs on into the neighbour. */
function pattern(t: DrawTile): string {
  const a = MATERIAL_ART[t.mat];
  const cov = coveredOf(t.joins);
  const { x, y, phase } = t;
  const cornerOpen = {
    nw: !cov.n && !cov.w,
    ne: !cov.n && !cov.e,
    se: !cov.s && !cov.e,
    sw: !cov.s && !cov.w,
  };
  switch (t.mat) {
    case 'stone': {
      const shine =
        !cov.n || phase % 2 === 0
          ? `<path d="M${x + 6},${y + 10} H${x + 24}" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round" fill="none"/>`
          : '';
      const crack =
        !cov.s || phase % 3 === 0
          ? `<path d="M${x + 26},${y + C - 5} l5,-8 l-3,-6" stroke="${a.line}" stroke-opacity=".5" stroke-width="2" fill="none"/>`
          : '';
      return shine + crack;
    }
    case 'wood': {
      const xs = cov.w ? x : x + 6;
      const xe = cov.e ? x + C : x + C - 6;
      // The dashes start where the grain starts, shifted so they line up across squares.
      const off = (((xs % 15) + 15) % 15).toFixed(2);
      const grain = `<path d="M${xs},${y + 14} H${xe} M${xs},${y + 26} H${xe}" stroke="${a.line}" stroke-width="2.5" fill="none" stroke-dasharray="10 5" stroke-dashoffset="${off}"/>`;
      const nail = (cx: number, cy: number): string => `<circle cx="${cx}" cy="${cy}" r="2" fill="${INK}"/>`;
      return (
        grain +
        (cornerOpen.nw ? nail(x + 8, y + 8) : '') +
        (cornerOpen.ne ? nail(x + C - 8, y + 8) : '') +
        (cornerOpen.sw ? nail(x + 8, y + C - 8) : '') +
        (cornerOpen.se ? nail(x + C - 8, y + C - 8) : '')
      );
    }
    case 'panel': {
      const ix0 = cov.w ? x : x + 6;
      const ix1 = cov.e ? x + C : x + C - 6;
      const iy0 = cov.n ? y : y + 6;
      const iy1 = cov.s ? y + C : y + C - 6;
      const r = (on: boolean): number => (on ? 3 : 0);
      const inner = `<path d="${roundedRect(ix0 - (cov.w ? BLEED : 0), iy0 - (cov.n ? BLEED : 0), ix1 + (cov.e ? BLEED : 0), iy1 + (cov.s ? BLEED : 0), [r(cornerOpen.nw), r(cornerOpen.ne), r(cornerOpen.se), r(cornerOpen.sw)])}" fill="${a.inner}"/>`;
      const glow: string[] = [];
      if (!cov.n) glow.push(`M${ix0},${iy0} H${ix1}`);
      if (!cov.e) glow.push(`M${ix1},${iy0} V${iy1}`);
      if (!cov.s) glow.push(`M${ix0},${iy1} H${ix1}`);
      if (!cov.w) glow.push(`M${ix0},${iy0} V${iy1}`);
      return `${inner}<path d="${glow.join(' ')}" stroke="${a.glow}" stroke-width="2" stroke-linecap="square" fill="none"/>`;
    }
    case 'metal': {
      const rivet = (cx: number, cy: number): string =>
        `<circle cx="${x + cx}" cy="${y + cy}" r="3.5" fill="${a.rivet}" stroke="${INK}" stroke-width="1.5"/>`;
      return (
        (cornerOpen.nw ? rivet(9, 9) : '') +
        (cornerOpen.ne ? rivet(C - 9, 9) : '') +
        (cornerOpen.sw ? rivet(9, C - 9) : '') +
        (cornerOpen.se ? rivet(C - 9, C - 9) : '')
      );
    }
    case 'glass': {
      const m = (open: boolean): number => (open ? 6 : 0);
      const segs = diagonalSegments(
        x + m(!cov.w),
        y + m(!cov.n),
        x + C - m(!cov.e),
        y + C - m(!cov.s),
        24,
      );
      if (segs.length === 0) return '';
      const d = segs.map(([x1, y1, x2, y2]) => `M${f(x1)},${f(y1)} L${f(x2)},${f(y2)}`).join(' ');
      return `<path d="${d}" stroke="${a.shine}" stroke-width="3.5" stroke-linecap="round" opacity=".9" fill="none"/>`;
    }
    case 'jelly': {
      // Two arrangements of bubbles, so a big blob does not repeat one blob.
      const spots: Array<[number, number, number]> =
        phase % 2 === 0
          ? [[13, 14, 4], [25, 24, 2.5], [15, 28, 1.8]]
          : [[26, 12, 3.5], [12, 24, 2.2], [27, 29, 2]];
      return spots
        .map(([cx, cy, r]) => `<circle cx="${x + cx}" cy="${y + cy}" r="${r}" fill="${a.bubble}" fill-opacity=".7"/>`)
        .join('');
    }
  }
}

/**
 * Squares drawn together: first every fill, then every pattern, then every outline, so an
 * outline is never covered by the fill of the square next to it. Glass fills are one path, so
 * two glass squares share no edge at all.
 */
export function tilesMarkup(tiles: readonly DrawTile[]): string {
  const plain = tiles.filter((t) => !isJoined(t.joins));
  const joined = tiles.filter((t) => isJoined(t.joins));
  const out: string[] = plain.map((t) => materialSquare(t.mat, t.x, t.y));
  const glass = joined.filter((t) => t.mat === 'glass');
  if (glass.length) {
    out.push(
      `<path d="${glass.map(fillPath).join(' ')}" fill="${MATERIAL_ART.glass!.fill}" fill-opacity=".55"/>`,
    );
  }
  for (const t of joined) {
    if (t.mat !== 'glass') out.push(`<path d="${fillPath(t)}" fill="${MATERIAL_ART[t.mat]!.fill}"/>`);
  }
  for (const t of joined) out.push(pattern(t));
  for (const t of joined) {
    const d = outlinePath(t);
    if (d) out.push(`<path d="${d}" stroke="${INK}" stroke-width="4" fill="none"/>`);
  }
  return out.join('');
}

/** The phase of a square from where it is, so the pattern repeats the same way everywhere. */
export const phaseOf = (x: number, y: number): number => Math.round(x / C) + Math.round(y / C);

/** A shape's squares drawn upright (column c at c * CELL), joined with each other. */
export function joinedShapeMarkup(cells: readonly BrickCell[]): string {
  const tiles: Tile[] = cells.map((q) => ({ l: q.c, t: q.r, r: q.c + 1, b: q.r + 1, mat: q.mat }));
  return tilesMarkup(
    tiles.map((t, i) => ({
      x: t.l * C,
      y: t.t * C,
      mat: t.mat,
      joins: joinsFor(t, tiles),
      phase: cells[i]!.c + cells[i]!.r,
    })),
  );
}

/**
 * One brick's squares, drawn in the brick's turned frame (column c at c * CELL), with joins that
 * were worked out against the whole base (`joins` is in the same order as `cells`).
 */
export function joinedBrickMarkup(cells: readonly BrickCell[], joins: readonly Joins[]): string {
  return tilesMarkup(
    cells.map((q, i) => ({
      x: q.c * C,
      y: q.r * C,
      mat: q.mat,
      joins: joins[i] ?? noJoins(),
      phase: q.c + q.r,
    })),
  );
}

/** One brick on the plot, in plot picture units (`tiles` are in steps, `scale` is units a step). */
export function joinedPlotMarkup(tiles: readonly Tile[], joins: readonly Joins[], scale: number): string {
  return tilesMarkup(
    tiles.map((t, i) => {
      const x = t.l * scale;
      const y = t.t * scale;
      return { x, y, mat: t.mat, joins: joins[i] ?? noJoins(), phase: phaseOf(x, y) };
    }),
  );
}
