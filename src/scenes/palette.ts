// Phaser wants numbers, not CSS variables. These mirror src/styles/tokens.css, and
// tests/scenes/backdrop.test.ts fails if one drifts away from that file.
export const PALETTE = {
  parchment: 0xf3e3c3,
  stone: 0x8c8a84,
  bannerRed: 0xb3372b,
  torchGold: 0xf2b134,
  wood: 0x6b4423,
  night: 0x0e1a33,
  cyan: 0x2ee6ff,
  magenta: 0xff3dae,
  mint: 0x7cffc4,
  steel: 0xb9c4d0,
  orange: 0xff7a1a,
  purple: 0x3b2a5e,
  white: 0xffffff,
} as const;
