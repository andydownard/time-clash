// Phaser wants numbers, not CSS variables. These mirror the look tokens in src/styles/tokens.css
// (docs/DESIGN_SYSTEM.md). tests/scenes/battle/palette.test.ts fails if a value here drifts
// from the CSS var named in TOKEN_VAR, and tests/scenes/backdrop.test.ts checks every value
// appears in tokens.css. Art-only colors that are not UI tokens live in battle/visual.ts (ART).
export const PALETTE = {
  blue100: 0xe1eaff,
  blue300: 0x86a9ff,
  blue500: 0x2f6bff,
  blue700: 0x1a3fb5,
  blue900: 0x0a1a4f,
  purple100: 0xefe6ff,
  purple300: 0xbc9cff,
  purple500: 0x8247e8,
  purple700: 0x5a28b8,
  purple900: 0x25104f,
  inkDeep: 0x12102b,
  parchment: 0xf7ebcb,
  oak: 0x7a4a24,
  steelBlue: 0x9aa8bd,
  ember: 0xffb23e,
  pulse: 0x4fd8ff,
  white: 0xffffff,
  /** The page and canvas background. Same color as inkDeep. */
  night: 0x12102b,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** The CSS custom property each palette entry mirrors. The drift test walks this table. */
export const TOKEN_VAR: Record<PaletteKey, string> = {
  blue100: '--tc-blue-100',
  blue300: '--tc-blue-300',
  blue500: '--tc-blue-500',
  blue700: '--tc-blue-700',
  blue900: '--tc-blue-900',
  purple100: '--tc-purple-100',
  purple300: '--tc-purple-300',
  purple500: '--tc-purple-500',
  purple700: '--tc-purple-700',
  purple900: '--tc-purple-900',
  inkDeep: '--tc-ink-deep',
  parchment: '--tc-parchment-warm',
  oak: '--tc-oak',
  steelBlue: '--tc-steel-blue',
  ember: '--tc-ember',
  pulse: '--tc-pulse',
  white: '--tc-white',
  night: '--tc-ink-deep',
};

/** 0xrrggbb as a CSS string, for Phaser text styles. */
export const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
