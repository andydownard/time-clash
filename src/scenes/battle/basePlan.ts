// Built bases on the battlefield, the pure part: where each brick and weapon pad is drawn, how
// a hurt brick looks, and how a fallen brick crumbles. No Phaser, so it is unit tested.
// The bricks use the builder's own pictures (brickSvg in src/ui/baseBuilderArt.ts). Nobody is
// hurt: a brick puffs dust, tumbles down to the ground and fades away. Nothing scary.
import { footprint, pieceById } from '../../game/baseBuilder';
import { BASE_BUILDER } from '../../game/config';
import type { BrickId, BrickView, Rect, SpotView, Team } from '../../game/types';
import { brickSvg, weaponPadSvg } from '../../ui/baseBuilderArt';
import { ART, NO_TINT, PALETTE } from './visual';

/** Bricks are drawn this many times sharper than their world size, so they stay crisp. */
export const RASTER = 2;
/** A weapon pad's drawn size in world px, as a share of the brick scale (a pad is 10 steps). */
const PAD_STEPS = 10;

export type BrickSprite = {
  id: BrickId;
  /** Texture key. Same piece, turn and size share one texture. */
  key: string;
  svg: string;
  /** Center of the brick, world px. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Team Future's base is mirrored, so its pictures are flipped too. */
  flip: boolean;
};

export type PadSprite = {
  index: number;
  key: string;
  svg: string;
  x: number;
  y: number;
  size: number;
  /** The brick the pad sits on. The weapon falls with it. */
  brick: BrickId | null;
};

const textureKey = (piece: string, rot: number, w: number, h: number): string =>
  `tc-brick|${piece}|${rot}|${w}x${h}`;

/** What to draw for one team's bricks, in the order they were built. */
export function brickSprites(team: Team, bricks: Record<BrickId, BrickView>): BrickSprite[] {
  const out: BrickSprite[] = [];
  for (const [id, b] of Object.entries(bricks) as Array<[BrickId, BrickView]>) {
    if (b.team !== team) continue;
    const rot = b.rot ?? 0;
    const pw = Math.max(1, Math.round(b.box.w * RASTER));
    const ph = Math.max(1, Math.round(b.box.h * RASTER));
    const svg = brickSvg(b.piece, rot, pw, ph);
    if (!svg) continue;
    out.push({
      id,
      key: textureKey(b.piece, rot, pw, ph),
      svg,
      x: b.box.x + b.box.w / 2,
      y: b.box.y + b.box.h / 2,
      w: b.box.w,
      h: b.box.h,
      flip: team === 'FUTURE',
    });
  }
  return out;
}

/**
 * The weapon pads with a weapon on them, sized like the bricks around them (`stepPx` is world px
 * a build step). Empty pads are not drawn in battle.
 */
export function padSprites(spots: readonly SpotView[], stepPx: number): PadSprite[] {
  const size = Math.max(8, PAD_STEPS * stepPx);
  const px = Math.round(size * RASTER);
  return spots
    .filter((s) => s.weapon)
    .map((s) => ({
      index: s.index,
      key: `tc-pad|${s.weapon}|${px}`,
      svg: weaponPadSvg(s.weapon as string, px),
      x: s.x,
      y: s.y,
      size,
      brick: s.brick ?? null,
    }));
}

/** World px a build step, read from the bricks (a cell is 8 steps). 1 when there are none. */
export function stepPxOf(team: Team, bricks: Record<BrickId, BrickView>): number {
  for (const b of Object.values(bricks)) {
    const def = b.team === team ? pieceById(b.piece) : undefined;
    if (def && b.box.w > 0) {
      return b.box.w / (footprint(def, b.rot ?? 0).w * BASE_BUILDER.freeSteps);
    }
  }
  return 1;
}

/**
 * How a hurt brick looks. It gets darker in two steps and shows cracks, so the change does not
 * rest on color alone. Full health is untouched.
 */
export function brickWear(hp: number, maxHp: number): { tint: number; cracks: number } {
  const share = maxHp > 0 ? hp / maxHp : 0;
  if (share > 2 / 3) return { tint: NO_TINT, cracks: 0 };
  if (share > 1 / 3) return { tint: ART.brickWorn, cracks: 1 };
  return { tint: ART.brickWornMore, cracks: 2 };
}

/** Crack lines across a hurt brick, as segments in world px. Fixed per brick, never random. */
export function crackLines(box: Rect, cracks: number): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  if (cracks >= 1) {
    out.push([box.x + box.w * 0.3, box.y, box.x + box.w * 0.42, box.y + box.h * 0.55]);
    out.push([box.x + box.w * 0.42, box.y + box.h * 0.55, box.x + box.w * 0.34, box.y + box.h]);
  }
  if (cracks >= 2) {
    out.push([box.x + box.w * 0.72, box.y, box.x + box.w * 0.62, box.y + box.h * 0.5]);
    out.push([box.x + box.w * 0.62, box.y + box.h * 0.5, box.x + box.w * 0.8, box.y + box.h]);
  }
  return out;
}

/** One fallen brick's silly tumble: it hops, spins, lands on the ground, then fades away. */
export type Crumble = {
  /** Move from the brick's center, world px. */
  dx: number;
  dy: number;
  /** Spin, degrees. */
  angle: number;
  delayMs: number;
  durationMs: number;
  /** How long the fade after landing takes. */
  fadeMs: number;
};

/** The longest wait before the last brick of one collapse starts to fall. */
export const CRUMBLE_MAX_DELAY_MS = 480;
const CRUMBLE_STEP_MS = 70;
const CRUMBLE_MS = 620;
const FADE_MS = 360;
const REDUCED_MS = 300;

/**
 * The tumble for the `order`th brick to fall in one collapse. It drops to `groundY` (the base's
 * bottom edge), drifts back from the enemy a little (Team Past leans left, Team Future right) and
 * spins one way or the other. It never leaves the screen. With reduced motion: no move, no spin,
 * only a short fade.
 */
export function crumblePlan(
  team: Team,
  box: Rect,
  groundY: number,
  order: number,
  reduced: boolean,
): Crumble {
  const delayMs = Math.min(CRUMBLE_MAX_DELAY_MS, order * CRUMBLE_STEP_MS);
  if (reduced) return { dx: 0, dy: 0, angle: 0, delayMs: 0, durationMs: 0, fadeMs: REDUCED_MS };
  const back = team === 'PAST' ? -1 : 1;
  const side = order % 2 === 0 ? 1 : -1;
  const dy = Math.max(0, groundY - (box.y + box.h));
  const dx = back * (6 + (order % 3) * 6) * (side > 0 ? 1 : 0.5);
  const angle = side * (25 + (order % 4) * 15);
  return { dx, dy, angle, delayMs, durationMs: CRUMBLE_MS, fadeMs: FADE_MS };
}

/** A dust puff where a brick gave way: a few soft circles. Fixed per brick, never random. */
export function dustPuffs(
  box: Rect,
  order: number,
): Array<{ x: number; y: number; r: number; color: number }> {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.max(6, Math.min(box.w, box.h) * 0.45);
  const colors = [PALETTE.past.parchment, PALETTE.future.pale, PALETTE.past.light];
  return [-1, 0, 1].map((k, i) => ({
    x: cx + k * r * 0.9,
    y: cy - (i === 1 ? r * 0.4 : 0),
    r: r * (i === 1 ? 1.1 : 0.8),
    color: colors[(order + i) % colors.length] as number,
  }));
}
