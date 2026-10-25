// Drawing-only constants and the colors from docs/DESIGN_SYSTEM.md.
// Balance numbers (damage, timing, aim limits) stay in src/game/config.ts.
import type { Team } from '../../game/types';
import { PALETTE as TOKENS } from '../palette';

/**
 * Art-only colors from the Battle board (illustration shades, not UI tokens). Text and
 * interface colors always come from PALETTE in ../palette.ts so they match tokens.css.
 */
export const ART = {
  stone: 0x8c84a8,
  stoneLine: 0x5f5880,
  stoneEdge: 0x3b3560,
  grassTop: 0x4a9468,
  grassMid: 0x2f7050,
  grassLow: 0x1b4538,
  soilTop: 0x5b6b88,
  hull: 0x5d6c8c,
  hullDark: 0x1d2744,
  visor: 0xcfd9ee,
  /** Knight helmet, arms and legs on the Battle board: pale silver with a purple tint. */
  knightSteel: 0xb3b8d4,
  skin: 0xf5c9a0,
  pink: 0xff5fb0,
  cream: 0xf3e6c8,
  metal: 0x7d879c,
  metalDark: 0x3d4560,
  flame: 0xff7a2e,
  // Projectile shades from the designers' missile in campArt.ts.
  missileGreen: 0x2d6a3a,
  missileGreenDark: 0x1f4a2c,
  flameYellow: 0xffd23e,
  shadow: 0x05061a,
  skyTop: 0x0c1a52,
  skyMid: 0x2f2a9c,
  skyLow: 0x9a4fc4,
  skyHorizon: 0xee7fa0,
  skyGlow: 0xffb877,
  /** The night aspen forest: dusky white trunks, dark bark, dim golden leaves. */
  aspenTrunk: 0xc4bfd6,
  aspenBark: 0x2a2540,
  aspenLeafFar: 0x8f7436,
  aspenLeafNear: 0xa8863a,
  /** A hurt built brick is drawn a little darker, then darker still (it also shows cracks). */
  brickWorn: 0xd8d8d8,
  brickWornMore: 0xb0b0b0,
} as const;

/** Phaser's "no tint" (multiplies by white). Not a color on screen. */
export const NO_TINT = 0xffffff;

/** Colors the drawing code leans on, grouped by team. Every UI color is a design token. */
export const PALETTE = {
  past: {
    parchment: TOKENS.parchment,
    stone: ART.stone,
    stoneLine: ART.stoneLine,
    banner: TOKENS.purple500,
    bannerDark: TOKENS.purple700,
    deep: TOKENS.purple900,
    gold: TOKENS.ember,
    light: TOKENS.purple300,
    wood: TOKENS.oak,
  },
  future: {
    night: TOKENS.blue900,
    glow: TOKENS.pulse,
    neon: TOKENS.blue500,
    edge: TOKENS.blue700,
    pale: TOKENS.blue100,
    steel: TOKENS.steelBlue,
    hull: ART.hull,
    hullDark: ART.hullDark,
    visor: ART.visor,
    pink: ART.pink,
  },
  shared: {
    campfire: ART.flame,
    twilight: TOKENS.purple700,
    white: TOKENS.white,
    ink: TOKENS.inkDeep,
    ember: TOKENS.ember,
    pulse: TOKENS.pulse,
    shadow: ART.shadow,
  },
} as const;

/** The color each side's glow, projectile and bars lean on. */
export const TEAM_COLOR: Record<Team, number> = {
  PAST: PALETTE.past.gold,
  FUTURE: PALETTE.future.glow,
};

/**
 * Aim dial: the handle sits between these distances from the launcher. grabRadius is how close a
 * pointer must land to pick the handle up: 2 x 48 x (768 / 1280) = 57.6 screen px on portrait iPad.
 */
/**
 * The small angle guide at the muzzle, in world px. The visible handle is small. The invisible
 * grab circle around it is at least 56px across on every supported screen.
 */
export const DIAL = { arcRadius: 52, guideLength: 108, handleRadius: 9, grabRadius: 48, labelGap: 14 } as const;

/**
 * Panel geometry in world px. The strip below the ground line (y 620 to 720) holds the panels.
 * The panels end at y 680 on purpose: the fixed Pause button in the bottom right corner starts
 * at about y 685 once the canvas fills a 1280x800 screen, and the panel must stay above it.
 */
export const PANEL = {
  y: 626,
  h: 54,
  edge: 16,
  pad: 10,
  gap: 10,
  iconW: 30,
} as const;

/** Longest wind arrow, in world px. */
export const WIND_ARROW_MAX = 120;

/** The dotted preview keeps every Nth path step. */
export const PREVIEW_STRIDE = 3;
/** Alpha of the last preview dot. The first is 1. */
export const PREVIEW_MIN_ALPHA = 0.15;
/** The arc left after a shot keeps every Nth step, and is drawn this see-through. */
export const TRACE_STRIDE = 4;
export const TRACE_ALPHA = 0.55;

/** Chrono stands this far outside its base, on the ground. Chrono is small so it fits the gap. */
export const CHARACTER_OFFSET = 16;
/** The speech bubble tip sits this far above the character's feet. */
export const BUBBLE_RISE = 130;
/** The bubble tail aims this far above the character's feet (about head height). */
export const TAIL_TARGET_RISE = 66;
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

/**
 * Awkward tumble: teeter (the setup), fly away, land, bounce (the payoff), wobble or lie, then
 * topple. All in ms and px.
 */
export const FALL_MS = 2100;
export const FALL_DX = 230;
export const FALL_HEIGHT = 120;
/** How high the fighter bounces after the first landing. */
export const BOUNCE_HEIGHT = 36;
/** The wind-up glow at the launcher before a shot. Matches --tc-fire-charge in tokens.css. */
export const CHARGE_MS = 380;
/** The vanish puff after the tumble. */
export const VANISH_MS = 700;

export const IMPACT_SCALE = { direct: 1.4, near: 1, miss: 0.6 } as const;

export const TEXT_MIN_PX = 20;
