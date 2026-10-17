// The backdrop for the thin screens (tap, intro, loading, setup, victory), drawn from plain shapes
// in the Time Clash look: a royal purple dusk and a castle with banners on the left, a night sky
// and a base with blue neon on the right, and a dashed gold line between the two times.
// Only palette colors are used. No gore, nothing scary.
import { PALETTE as C } from './palette';

/** The few Graphics calls we use, so tests can record them without Phaser. */
export interface GraphicsLike {
  fillStyle(color: number, alpha?: number): GraphicsLike;
  fillRect(x: number, y: number, w: number, h: number): GraphicsLike;
  fillCircle(x: number, y: number, radius: number): GraphicsLike;
  fillTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ): GraphicsLike;
}

export type Size = { width: number; height: number };

/** Sky bands, top to bottom. Stepped bands stand in for a gradient. */
const PAST_SKY = [C.purple900, C.purple700, C.purple500] as const;
const FUTURE_SKY = [C.inkDeep, C.blue900, C.blue700] as const;

export function drawBackdrop(g: GraphicsLike, size: Size): void {
  const { width: W, height: H } = size;
  const half = W / 2;
  const ground = H * 0.86;
  const u = W / 1280; // one design unit

  // Two skies, one for each time, in three soft bands.
  const band = ground / 3;
  PAST_SKY.forEach((c, i) => g.fillStyle(c).fillRect(0, i * band, half, band + 1 * u));
  FUTURE_SKY.forEach((c, i) => g.fillStyle(c).fillRect(half, i * band, W - half, band + 1 * u));
  // Sun and moon.
  g.fillStyle(C.ember).fillCircle(half * 0.45, H * 0.2, 56 * u);
  g.fillStyle(C.parchment).fillCircle(half * 1.55, H * 0.2, 40 * u);
  // A few friendly stars.
  for (let i = 0; i < 7; i++) {
    g.fillStyle(C.blue100).fillCircle(half + (60 + i * 85) * u, (50 + (i % 3) * 42) * u, 4 * u);
  }

  // Far hills (parallax layer one) and near hills (layer two).
  g.fillStyle(C.purple700).fillTriangle(0, ground, half * 0.5, ground - 150 * u, half, ground);
  g.fillStyle(C.blue700).fillTriangle(half, ground, half * 1.5, ground - 130 * u, W, ground);
  g.fillStyle(C.purple900).fillTriangle(
    half * 0.3,
    ground,
    half * 0.85,
    ground - 90 * u,
    half * 1.3,
    ground,
  );
  g.fillStyle(C.blue900).fillTriangle(
    half * 0.9,
    ground,
    half * 1.3,
    ground - 80 * u,
    half * 1.8,
    ground,
  );

  // Ground, with a bright lip on top.
  g.fillStyle(C.oak).fillRect(0, ground, half, H - ground);
  g.fillStyle(C.blue900).fillRect(half, ground, W - half, H - ground);
  g.fillStyle(C.purple300).fillRect(0, ground, half, 6 * u);
  g.fillStyle(C.pulse).fillRect(half, ground, W - half, 6 * u);

  // Castle (left): stone keep, three towers with purple roofs, a banner, an oak gate, a torch.
  const cx = 110 * u;
  const cy = ground - 230 * u;
  g.fillStyle(C.steelBlue).fillRect(cx, cy, 220 * u, 230 * u);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(C.steelBlue).fillRect(cx + i * 60 * u, cy - 30 * u, 40 * u, 30 * u);
  }
  g.fillStyle(C.steelBlue).fillRect(cx - 24 * u, cy - 70 * u, 56 * u, 300 * u);
  g.fillStyle(C.purple500).fillTriangle(
    cx - 34 * u,
    cy - 70 * u,
    cx + 4 * u,
    cy - 130 * u,
    cx + 42 * u,
    cy - 70 * u,
  );
  g.fillStyle(C.oak).fillRect(cx + 80 * u, ground - 110 * u, 60 * u, 110 * u);
  g.fillStyle(C.purple500).fillTriangle(
    cx + 100 * u,
    cy - 90 * u,
    cx + 100 * u,
    cy - 30 * u,
    cx + 170 * u,
    cy - 60 * u,
  );
  g.fillStyle(C.oak).fillRect(cx + 96 * u, cy - 95 * u, 6 * u, 65 * u);
  g.fillStyle(C.ember).fillCircle(cx + 62 * u, ground - 120 * u, 9 * u);

  // Secret base (right): steel hull, a dome, neon windows, an antenna with a glowing tip.
  const bx = W - 330 * u;
  g.fillStyle(C.steelBlue).fillRect(bx, ground - 150 * u, 220 * u, 150 * u);
  g.fillStyle(C.blue100).fillCircle(bx + 110 * u, ground - 150 * u, 90 * u);
  g.fillStyle(C.inkDeep).fillRect(bx, ground - 150 * u, 220 * u, 4 * u);
  g.fillStyle(C.blue500).fillRect(bx + 24 * u, ground - 104 * u, 62 * u, 48 * u);
  g.fillStyle(C.blue500).fillRect(bx + 134 * u, ground - 104 * u, 62 * u, 48 * u);
  g.fillStyle(C.pulse).fillRect(bx + 32 * u, ground - 96 * u, 46 * u, 32 * u);
  g.fillStyle(C.pulse).fillRect(bx + 142 * u, ground - 96 * u, 46 * u, 32 * u);
  g.fillStyle(C.steelBlue).fillRect(bx + 106 * u, ground - 290 * u, 8 * u, 60 * u);
  g.fillStyle(C.pulse).fillCircle(bx + 110 * u, ground - 296 * u, 12 * u);

  // The clash: a dashed gold line down the middle.
  const dash = 34 * u;
  const gap = 24 * u;
  for (let y = 0; y + dash <= ground; y += dash + gap) {
    g.fillStyle(C.ember).fillRect(half - 3 * u, y, 6 * u, dash);
  }
}
