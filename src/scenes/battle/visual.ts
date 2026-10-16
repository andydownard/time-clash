// Drawing-only constants and the colors from docs/DESIGN_BRIEF.md.
// Balance numbers (damage, timing, aim limits) stay in src/game/config.ts.
import type { Team } from '../../game/types';

export const PALETTE = {
  past: {
    parchment: 0xf3e3c3,
    stone: 0x8c8a84,
    banner: 0xb3372b,
    gold: 0xf2b134,
    wood: 0x6b4423,
  },
  future: {
    night: 0x0e1a33,
    cyan: 0x2ee6ff,
    magenta: 0xff3dae,
    mint: 0x7cffc4,
    steel: 0xb9c4d0,
  },
  shared: {
    campfire: 0xff7a1a,
    twilight: 0x3b2a5e,
    white: 0xffffff,
    ink: 0x1b1b26,
  },
} as const;

/** The color each side's glow, projectile and bars lean on. */
export const TEAM_COLOR: Record<Team, number> = {
  PAST: PALETTE.past.gold,
  FUTURE: PALETTE.future.cyan,
};

/** Aim dial: the handle sits between these distances from the launcher. */
export const DIAL = { minRadius: 40, maxRadius: 150, handleRadius: 18 } as const;

/** Longest wind arrow, in world px. */
export const WIND_ARROW_MAX = 120;

/** The dotted preview keeps every Nth path step. */
export const PREVIEW_STRIDE = 3;
/** Alpha of the last preview dot. The first is 1. */
export const PREVIEW_MIN_ALPHA = 0.15;

/** Character stands this far outside its base, on the ground. */
export const CHARACTER_OFFSET = 40;
/** The speech bubble tip sits this far above the character's feet. */
export const BUBBLE_RISE = 130;
/** Widest a speech bubble gets, in world units. It is centered on the bubble anchor. */
export const BUBBLE_MAX_WORLD_W = 360;

/** How long the "+N scrap" popup lingers (ms). */
export const SCRAP_POPUP_MS = 900;
/** Beat after the last hit before Victory takes over (ms). */
export const WIN_BEAT_MS = 1400;
/** Beat that lets a hit label and effect be read (ms). */
export const IMPACT_BEAT_MS = 700;
/** Shorter fade used when motion is reduced (ms). */
export const REDUCED_FADE_MS = 250;

export const IMPACT_SCALE = { direct: 1.4, near: 1, miss: 0.6 } as const;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TEXT_MIN_PX = 20;
