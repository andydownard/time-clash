// Shared constants for the base pictures: one grid cell, the ink color, and the art colors for the
// materials of a shape of your own. Split out so the square drawing (baseBuilderArt.ts) and the
// joined drawing (materialTiles.ts) share them without importing each other.
import { BASE_BUILDER as B } from '../game/config';
import type { Material } from '../game/customShapes';

/** One grid cell in picture units. The plot picture is cols * CELL wide. */
export const CELL = 40;
export const PLOT_W = B.cols * CELL;
export const PLOT_H = B.rows * CELL;
/** Steps (free grid) to picture units. */
export const STEP = CELL / B.freeSteps;

export const INK = '#12102b';
const O = `stroke="${INK}" stroke-width="4"`;

/**
 * Art colors for the materials of a shape of your own (illustration shades, like the bricks).
 * Stone, wood, panel and metal reuse the brick colors. Glass and jelly are new.
 */
export const MATERIAL_ART: Record<Material, Readonly<Record<string, string>>> = {
  stone: { fill: '#9aa8bd', line: INK },
  wood: { fill: '#a8672b', line: '#6e3f17' },
  panel: { fill: '#2a3a66', inner: '#1d2744', glow: '#2ee6ff' },
  metal: { fill: '#b9c4d0', rivet: '#5d6c8c' },
  glass: { fill: '#bfeaff', shine: '#ffffff' },
  jelly: { fill: '#ff5fb0', bubble: '#ffffff' },
};

/**
 * One square of a material at (x, y), CELL wide. Each material has its own pattern as well as
 * its own color, so the look never rests on color alone: stone has a crack, wood has grain and
 * nails, a panel has a glowing inset, metal has four rivets, glass has slanted shine lines and
 * is see-through, jelly is rounded with bubbles.
 */
export function materialSquare(mat: Material, x: number, y: number): string {
  const a = MATERIAL_ART[mat];
  const C = CELL;
  switch (mat) {
    case 'stone':
      return `<rect x="${x}" y="${y}" width="${C}" height="${C}" rx="4" fill="${a.fill}" ${O}/><path d="M${x + 6},${y + 10} H${x + 24}" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M${x + 26},${y + C - 5} l5,-8 l-3,-6" stroke="${a.line}" stroke-opacity=".5" stroke-width="2" fill="none"/>`;
    case 'wood':
      return `<rect x="${x}" y="${y}" width="${C}" height="${C}" rx="3" fill="${a.fill}" ${O}/><path d="M${x + 6},${y + 14} H${x + C - 6} M${x + 6},${y + 26} H${x + C - 6}" stroke="${a.line}" stroke-width="2.5" fill="none" stroke-dasharray="10 5"/><circle cx="${x + 8}" cy="${y + 8}" r="2" fill="${INK}"/><circle cx="${x + C - 8}" cy="${y + C - 8}" r="2" fill="${INK}"/>`;
    case 'panel':
      return `<rect x="${x}" y="${y}" width="${C}" height="${C}" rx="6" fill="${a.fill}" ${O}/><rect x="${x + 6}" y="${y + 6}" width="${C - 12}" height="${C - 12}" rx="3" fill="${a.inner}" stroke="${a.glow}" stroke-width="2"/>`;
    case 'metal':
      return `<rect x="${x}" y="${y}" width="${C}" height="${C}" rx="2" fill="${a.fill}" ${O}/>${[
        [9, 9],
        [C - 9, 9],
        [9, C - 9],
        [C - 9, C - 9],
      ]
        .map(
          ([cx, cy]) =>
            `<circle cx="${x + cx!}" cy="${y + cy!}" r="3.5" fill="${a.rivet}" stroke="${INK}" stroke-width="1.5"/>`,
        )
        .join('')}`;
    case 'glass':
      return `<rect x="${x}" y="${y}" width="${C}" height="${C}" rx="3" fill="${a.fill}" fill-opacity=".55" ${O}/><path d="M${x + 8},${y + 22} L${x + 22},${y + 8} M${x + 14},${y + 32} L${x + 32},${y + 14}" stroke="${a.shine}" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>`;
    case 'jelly':
      return `<rect x="${x + 1}" y="${y + 1}" width="${C - 2}" height="${C - 2}" rx="13" fill="${a.fill}" ${O}/><circle cx="${x + 13}" cy="${y + 14}" r="4" fill="${a.bubble}" fill-opacity=".7"/><circle cx="${x + 25}" cy="${y + 24}" r="2.5" fill="${a.bubble}" fill-opacity=".7"/><circle cx="${x + 15}" cy="${y + 28}" r="1.8" fill="${a.bubble}" fill-opacity=".7"/>`;
  }
}
