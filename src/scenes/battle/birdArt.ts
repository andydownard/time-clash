// The cartoon birds that fly across the Battle sky, and their feather puff. Pure shapes, no
// Phaser, so tests can check them. The rules (src/game/disturbance.ts) say where a bird is; this
// file only says what it looks like. Shape and motion carry the meaning, never color alone.
import { DISTURBANCE } from '../../game/config';
import type { Vec2 } from '../../game/types';
import type { ArtShape } from './obstacleArt';
import { ART, PALETTE } from './visual';

/** Bird colors: a pale gull with an orange beak and a dark outline, so it reads on the night sky. */
export const BIRD_COLORS = {
  body: PALETTE.shared.white,
  wing: ART.cream,
  wingFar: ART.stone,
  beak: PALETTE.shared.ember,
  outline: PALETTE.shared.ink,
  eye: PALETTE.shared.ink,
} as const;

/** How long one wing beat takes (ms). Reduced motion holds the wings still. */
export const FLAP_MS = 420;
/** How long a bumped bird spins and how far (degrees). */
export const BONK = { ms: 600, turns: 1 } as const;

/** Wing lift from -1 (down) to 1 (up) at a time. Reduced motion: a still, level wing (0). */
export function flapAt(ms: number, reduced: boolean): number {
  if (reduced || !Number.isFinite(ms)) return 0;
  return Math.sin((2 * Math.PI * ms) / FLAP_MS);
}

/** Tilt in degrees of a bird `sinceMs` after it was bumped. 0 when not bumped or done. */
export function bonkTilt(sinceMs: number | null, reduced: boolean): number {
  if (sinceMs === null || !Number.isFinite(sinceMs) || sinceMs < 0 || sinceMs >= BONK.ms) return 0;
  // Reduced motion: a small fixed tilt, no spin.
  if (reduced) return 20;
  return (sinceMs / BONK.ms) * 360 * BONK.turns;
}

const rotate = (p: Vec2, deg: number): Vec2 => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 14): Vec2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });

/**
 * One bird, centered on `at`, facing `dir` (1 right, -1 left), with wings at `flap` (-1 to 1)
 * and turned `tiltDeg`. About 56 px nose to tail, inside the bump circle.
 */
export function birdShapes(at: Vec2, dir: 1 | -1, flap: number, tiltDeg = 0): ArtShape[] {
  const f = Math.max(-1, Math.min(1, Number.isFinite(flap) ? flap : 0));
  const place = (pts: Vec2[]): Vec2[] =>
    pts.map((p) => {
      const q = rotate({ x: p.x * dir, y: p.y }, tiltDeg * dir);
      return { x: at.x + q.x, y: at.y + q.y };
    });
  const pt = (x: number, y: number): Vec2 => place([{ x, y }])[0] as Vec2;
  const tip = -12 - 14 * f;
  const farWing = place([
    { x: 2, y: -4 },
    { x: -8, y: -4 },
    { x: -6, y: tip + 4 },
  ]);
  const tail = place([
    { x: -12, y: -1 },
    { x: -26, y: -8 },
    { x: -26, y: 6 },
  ]);
  const body = place(ellipse(0, 0, 16, 10));
  const head = pt(14, -6);
  const beak = place([
    { x: 20, y: -9 },
    { x: 20, y: -3 },
    { x: 29, y: -6 },
  ]);
  const nearWing = place([
    { x: 6, y: -3 },
    { x: -6, y: -3 },
    { x: -2, y: tip },
  ]);
  const eye = pt(16, -8);
  return [
    { op: 'poly', pts: farWing, color: BIRD_COLORS.wingFar, alpha: 1 },
    { op: 'poly', pts: tail, color: BIRD_COLORS.wing, alpha: 1 },
    { op: 'outline', pts: tail, width: 2, color: BIRD_COLORS.outline },
    { op: 'poly', pts: body, color: BIRD_COLORS.body, alpha: 1 },
    { op: 'outline', pts: body, width: 2, color: BIRD_COLORS.outline },
    { op: 'circle', x: head.x, y: head.y, r: 9, color: BIRD_COLORS.outline, alpha: 1 },
    { op: 'circle', x: head.x, y: head.y, r: 7.5, color: BIRD_COLORS.body, alpha: 1 },
    { op: 'poly', pts: beak, color: BIRD_COLORS.beak, alpha: 1 },
    { op: 'outline', pts: beak, width: 1.5, color: BIRD_COLORS.outline },
    { op: 'poly', pts: nearWing, color: BIRD_COLORS.wing, alpha: 1 },
    { op: 'outline', pts: nearWing, width: 2, color: BIRD_COLORS.outline },
    { op: 'circle', x: eye.x, y: eye.y, r: 2.2, color: BIRD_COLORS.eye, alpha: 1 },
  ];
}

/** Every point a bird's shapes use, for size checks. */
export function birdPoints(shapes: readonly ArtShape[]): Vec2[] {
  return shapes.flatMap((s) => {
    if (s.op === 'poly' || s.op === 'outline') return s.pts;
    if (s.op === 'circle')
      return [
        { x: s.x - s.r, y: s.y - s.r },
        { x: s.x + s.r, y: s.y + s.r },
      ];
    if (s.op === 'line') return [s.a, s.b];
    return [
      { x: s.x, y: s.y },
      { x: s.x + s.w, y: s.y + s.h },
    ];
  });
}

/** A feather in the puff: where it drifts to (from the bump spot) and how far it turns. */
export type Feather = { dx: number; dy: number; spinDeg: number };

/** Six feathers fan out from a bump, the same way every time for the same bird and step. */
export function featherBurst(birdId: number, step: number, count = 6): Feather[] {
  const out: Feather[] = [];
  for (let i = 0; i < count; i++) {
    // A fixed fan with a small wobble from the bird and step, so every puff looks a bit different.
    const wobble = (((birdId + 1) * 37 + step * 13 + i * 7) % 11) / 11;
    const a = (2 * Math.PI * i) / count + wobble * 0.6;
    const dist = 28 + wobble * 22;
    // Feathers drift down a little as they float away.
    out.push({ dx: Math.cos(a) * dist, dy: Math.sin(a) * dist + 18, spinDeg: 90 + wobble * 180 });
  }
  return out;
}

/** The bump circle, for drawing aids and tests. Same number the rules use. */
export const BIRD_HIT_RADIUS = DISTURBANCE.birds.hitRadius;
