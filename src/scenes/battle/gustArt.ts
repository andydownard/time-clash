// The gust cue: three streak lines behind the shell and a fat arrow ahead, pointing the way the
// gust blows. Pure shapes, no Phaser. The cue has shape and motion, not only color.
import { WORLD } from '../../game/config';
import type { Vec2 } from '../../game/types';

export type GustCue = {
  /** Wind streaks behind the shell (on the side the gust comes from). */
  streaks: { x1: number; x2: number; y: number }[];
  /** A closed arrow outline ahead of the shell, pointing the gust's way. */
  arrow: Vec2[];
  /** Where the "Gust!" word floats up from. */
  label: Vec2;
};

const CUE = { streakLen: 46, streakGap: 14, rows: [-18, 0, 18], arrowLen: 56, shaft: 10, head: 26 };
/** How far the cue keeps from the screen edges, so the arrow never runs off. */
export const GUST_EDGE = 90;
/** The cue slides this far the gust's way while it shows (motion is part of the cue). */
export const GUST_SLIDE_PX = 40;
export const GUST_CUE_MS = 700;

/** The cue for a gust blowing `dir` (1 right, -1 left) where the shell is at `at`. */
export function gustCue(at: Vec2, dir: 1 | -1, width = WORLD.width): GustCue {
  const x = Math.max(GUST_EDGE, Math.min(width - GUST_EDGE, at.x));
  const y = at.y;
  const back = x - dir * CUE.streakGap;
  const streaks = CUE.rows.map((dy, i) => {
    // The middle streak is longest, so the three read as a puff of moving air.
    const len = i === 1 ? CUE.streakLen : CUE.streakLen * 0.7;
    return { x1: back - dir * len, x2: back, y: y + dy };
  });
  const s = x + dir * 12;
  const neck = s + dir * (CUE.arrowLen - CUE.head);
  const tip = s + dir * CUE.arrowLen;
  const h = CUE.shaft / 2;
  const arrow: Vec2[] = [
    { x: s, y: y - h },
    { x: neck, y: y - h },
    { x: neck, y: y - CUE.head / 2 },
    { x: tip, y },
    { x: neck, y: y + CUE.head / 2 },
    { x: neck, y: y + h },
    { x: s, y: y + h },
  ];
  return { streaks, arrow, label: { x, y: y - 48 } };
}
