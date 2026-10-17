// Text on the canvas. Every label uses a role, so size, font, and colors live in one place.
// MedievalSharp is the old voice (jokes, hit words, speech). Orbitron is the new voice (numbers,
// counters, banners). Each role has a solid fill behind it, so no text sits on busy art.
// Plain data, no Phaser import, so tests can check contrast and size without a canvas.
import { PALETTE, css } from '../palette';

/** Same stacks as --tc-font-voice-old and --tc-font-voice-new in tokens.css (a test checks). */
export const FONT_FAMILY = {
  old: "'MedievalSharp', 'Palatino Linotype', Palatino, Georgia, serif",
  new: "'Orbitron', 'Arial Black', 'Helvetica Neue', Arial, sans-serif",
} as const;

export type TextRole =
  'hud' | 'readoutPast' | 'readoutFuture' | 'hit' | 'scrap' | 'bubble' | 'banner';

export type TextSpec = {
  family: keyof typeof FONT_FAMILY;
  weight: 400 | 700 | 800 | 900;
  /** Size in world px before the label scaler grows it for small screens. 20 is the floor. */
  basePx: number;
  color: string;
  bg: string;
  /** True when the text is a number or a counter. Those never use MedievalSharp. */
  numeric: boolean;
  letterSpacing: number;
};

const INK = css(PALETTE.inkDeep);
const PARCHMENT = css(PALETTE.parchment);

export const TEXT_ROLES: Record<TextRole, TextSpec> = {
  hud: {
    family: 'new',
    weight: 800,
    basePx: 20,
    color: PARCHMENT,
    bg: INK,
    numeric: true,
    letterSpacing: 1,
  },
  readoutPast: {
    family: 'new',
    weight: 900,
    basePx: 28,
    color: css(PALETTE.ember),
    bg: INK,
    numeric: true,
    letterSpacing: 2,
  },
  readoutFuture: {
    family: 'new',
    weight: 900,
    basePx: 28,
    color: css(PALETTE.pulse),
    bg: INK,
    numeric: true,
    letterSpacing: 2,
  },
  hit: {
    family: 'old',
    weight: 400,
    basePx: 30,
    color: INK,
    bg: PARCHMENT,
    numeric: false,
    letterSpacing: 0,
  },
  scrap: {
    family: 'new',
    weight: 900,
    basePx: 28,
    color: INK,
    bg: PARCHMENT,
    numeric: true,
    letterSpacing: 2,
  },
  bubble: {
    family: 'old',
    weight: 400,
    basePx: 28,
    color: INK,
    bg: PARCHMENT,
    numeric: false,
    letterSpacing: 0,
  },
  banner: {
    family: 'new',
    weight: 900,
    basePx: 28,
    color: INK,
    bg: css(PALETTE.ember),
    numeric: false,
    letterSpacing: 3,
  },
};

/** The fields of Phaser's TextStyle that we set. */
export type CanvasTextStyle = {
  fontFamily: string;
  fontSize: string;
  fontStyle: string;
  color: string;
  backgroundColor: string;
  letterSpacing: number;
  padding: { x: number; y: number };
};

export function textStyle(role: TextRole): CanvasTextStyle {
  const s = TEXT_ROLES[role];
  return {
    fontFamily: FONT_FAMILY[s.family],
    fontSize: `${s.basePx}px`,
    fontStyle: String(s.weight),
    color: s.color,
    backgroundColor: s.bg,
    letterSpacing: s.letterSpacing,
    padding: { x: 10, y: 4 },
  };
}

/** CSS font shorthands to preload, so canvas text redraws in the real face once it arrives. */
export function canvasFontSpecs(): string[] {
  const out = new Set<string>();
  for (const s of Object.values(TEXT_ROLES)) {
    const name = s.family === 'old' ? 'MedievalSharp' : 'Orbitron';
    out.add(`${s.weight} ${s.basePx}px ${name}`);
  }
  return [...out];
}

type FontSetLike = { load(spec: string): Promise<unknown> };

/**
 * Loads the faces, then calls onReady once. A missing or failing font never blocks play:
 * the system fallback stays on screen and onReady still runs.
 */
export async function preloadCanvasFonts(
  fonts: FontSetLike | undefined,
  onReady: () => void,
): Promise<void> {
  if (!fonts) return;
  try {
    await Promise.all(canvasFontSpecs().map((spec) => fonts.load(spec).catch(() => undefined)));
  } catch {
    // Fallback fonts are fine.
  }
  onReady();
}
