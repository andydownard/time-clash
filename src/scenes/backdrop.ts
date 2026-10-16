// A friendly placeholder backdrop made of plain shapes: a castle on the left, a secret base on
// the right, and a gold zigzag between them. No gore, nothing scary. Real art can replace it later.
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

export function drawBackdrop(g: GraphicsLike, size: Size): void {
  const { width: W, height: H } = size;
  const half = W / 2;
  const ground = H * 0.86;
  const u = W / 1280; // one design unit

  // Two skies, one for each time.
  g.fillStyle(C.parchment).fillRect(0, 0, half, ground);
  g.fillStyle(C.night).fillRect(half, 0, W - half, ground);
  // Sun and moon.
  g.fillStyle(C.torchGold).fillCircle(half * 0.45, H * 0.2, 56 * u);
  g.fillStyle(C.steel).fillCircle(half * 1.55, H * 0.2, 44 * u);
  // A few friendly stars.
  for (let i = 0; i < 6; i++) {
    g.fillStyle(C.white).fillCircle(half + (80 + i * 95) * u, (60 + (i % 3) * 45) * u, 4 * u);
  }
  // Ground.
  g.fillStyle(C.wood).fillRect(0, ground, half, H - ground);
  g.fillStyle(C.purple).fillRect(half, ground, W - half, H - ground);

  // Castle (left).
  const cx = 110 * u;
  const cy = ground - 230 * u;
  g.fillStyle(C.stone).fillRect(cx, cy, 220 * u, 230 * u);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(C.stone).fillRect(cx + i * 60 * u, cy - 30 * u, 40 * u, 30 * u);
  }
  g.fillStyle(C.wood).fillRect(cx + 80 * u, ground - 110 * u, 60 * u, 110 * u);
  g.fillStyle(C.bannerRed).fillTriangle(
    cx + 100 * u,
    cy - 90 * u,
    cx + 100 * u,
    cy - 30 * u,
    cx + 170 * u,
    cy - 60 * u,
  );
  g.fillStyle(C.wood).fillRect(cx + 96 * u, cy - 95 * u, 6 * u, 65 * u);

  // Secret base (right).
  const bx = W - 330 * u;
  g.fillStyle(C.steel).fillRect(bx, ground - 150 * u, 220 * u, 150 * u);
  g.fillStyle(C.cyan).fillCircle(bx + 110 * u, ground - 150 * u, 90 * u);
  g.fillStyle(C.night).fillRect(bx, ground - 150 * u, 220 * u, 4 * u);
  g.fillStyle(C.mint).fillRect(bx + 30 * u, ground - 100 * u, 50 * u, 40 * u);
  g.fillStyle(C.mint).fillRect(bx + 140 * u, ground - 100 * u, 50 * u, 40 * u);
  g.fillStyle(C.steel).fillRect(bx + 106 * u, ground - 290 * u, 8 * u, 60 * u);
  g.fillStyle(C.magenta).fillCircle(bx + 110 * u, ground - 296 * u, 12 * u);

  // The clash: a gold and orange zigzag down the middle.
  const zig = 5;
  const step = ground / zig;
  for (let i = 0; i < zig; i++) {
    const y = i * step;
    const flip = i % 2 === 0 ? -1 : 1;
    g.fillStyle(i % 2 === 0 ? C.torchGold : C.orange).fillTriangle(
      half - 36 * u,
      y + (flip < 0 ? 0 : step),
      half + 36 * u,
      y + (flip < 0 ? step : 0),
      half,
      y + step / 2,
    );
  }
}
