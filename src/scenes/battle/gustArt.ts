// The gust cue: streak lines behind the shell and a fat arrow ahead, pointing the way the gust
// blows. Pure shapes, no Phaser. The cue has shape and motion, not only color. A stronger turn
// level draws more streaks and a bigger arrow, so a big gust looks big (no words added).
import { WORLD } from '../../game/config';
import type { DisturbanceLevel } from '../../game/disturbance';
import type { Vec2 } from '../../game/types';

export type GustCue = {
  /** Wind streaks behind the shell (on the side the gust comes from). */
  streaks: { x1: number; x2: number; y: number }[];
  /** A closed arrow outline ahead of the shell, pointing the gust's way. */
  arrow: Vec2[];
  /** Where the "Gust!" word floats up from. */
  label: Vec2;
  /** The streak line width, px. */
  width: number;
};

const CUE = {
  streakLen: 46,
  streakGap: 14,
  rowGap: 18,
  arrowLen: 56,
  shaft: 10,
  head: 26,
  line: 6,
};
/** Per level: how many streaks, and how much bigger than the low cue everything is drawn. */
export const GUST_LEVEL_CUE: Readonly<
  Record<DisturbanceLevel, { streaks: number; scale: number }>
> = {
  low: { streaks: 3, scale: 1 },
  medium: { streaks: 4, scale: 1.3 },
  high: { streaks: 5, scale: 1.6 },
};
/** How far the low cue keeps from the screen edges, so the arrow never runs off. */
export const GUST_EDGE = 90;
/** The cue slides this far the gust's way while it shows (motion is part of the cue). */
export const GUST_SLIDE_PX = 40;
export const GUST_CUE_MS = 700;

/**
 * The cue for a gust blowing `dir` (1 right, -1 left) where the shell is at `at`, sized by the
 * turn's level (low is the old cue).
 */
export function gustCue(
  at: Vec2,
  dir: 1 | -1,
  width = WORLD.width,
  level: DisturbanceLevel = 'low',
): GustCue {
  const { streaks: rows, scale: k } = GUST_LEVEL_CUE[level] ?? GUST_LEVEL_CUE.low;
  const streakLen = CUE.streakLen * k;
  const arrowLen = CUE.arrowLen * k;
  const head = CUE.head * k;
  // The cue keeps clear of both edges: far enough for the arrow ahead and the streaks behind.
  const edge = Math.max(GUST_EDGE, 12 + arrowLen + 4, CUE.streakGap + streakLen + 4);
  const x = Math.max(edge, Math.min(width - edge, at.x));
  const y = at.y;
  const back = x - dir * CUE.streakGap;
  const mid = (rows - 1) / 2;
  const streaks = Array.from({ length: rows }, (_, i) => {
    // The middle streak (or two) is longest, so the lines read as a puff of moving air.
    const len = Math.abs(i - mid) < 1 ? streakLen : streakLen * 0.7;
    return { x1: back - dir * len, x2: back, y: y + (i - mid) * CUE.rowGap };
  });
  const s = x + dir * 12;
  const neck = s + dir * (arrowLen - head);
  const tip = s + dir * arrowLen;
  const h = (CUE.shaft * k) / 2;
  const arrow: Vec2[] = [
    { x: s, y: y - h },
    { x: neck, y: y - h },
    { x: neck, y: y - head / 2 },
    { x: tip, y },
    { x: neck, y: y + head / 2 },
    { x: neck, y: y + h },
    { x: s, y: y + h },
  ];
  const labelLift = 48 + mid * CUE.rowGap - CUE.rowGap;
  return { streaks, arrow, label: { x, y: y - labelLift }, width: CUE.line * k };
}
