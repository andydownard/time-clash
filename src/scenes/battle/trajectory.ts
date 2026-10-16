// Turns the pure ballistics path into animation frames. No Phaser.
import { AIM, BALLISTICS } from '../../game/config';
import type { ShotResult, Vec2 } from '../../game/types';
import type { PreviewDot } from './types';
import { PREVIEW_MIN_ALPHA, PREVIEW_STRIDE } from './visual';

const STEP_MS = BALLISTICS.stepSeconds * 1000;

export function flightDurationMs(result: Pick<ShotResult, 'steps'>): number {
  return result.steps * STEP_MS;
}

/** Position at a time since launch, interpolated between fixed steps. Clamped to the path. */
export function pointAtTime(path: readonly Vec2[], elapsedMs: number): Vec2 {
  const first = path[0];
  if (!first) return { x: 0, y: 0 };
  const last = path[path.length - 1] as Vec2;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return { ...first };
  const pos = elapsedMs / STEP_MS;
  if (pos >= path.length - 1) return { ...last };
  const i = Math.floor(pos);
  const frac = pos - i;
  const a = path[i] as Vec2;
  const b = path[i + 1] as Vec2;
  if (frac < 1e-9) return { ...a };
  if (frac > 1 - 1e-9) return { ...b };
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

/** A short run of dots from the start of a path, fading from 1 to PREVIEW_MIN_ALPHA. */
export function previewDots(path: readonly Vec2[]): PreviewDot[] {
  const points: Vec2[] = [];
  for (let i = 0; i < AIM.previewPoints; i++) {
    const p = path[i * PREVIEW_STRIDE];
    if (!p) break;
    points.push(p);
  }
  const n = points.length;
  return points.map((p, i) => ({
    x: p.x,
    y: p.y,
    alpha: n <= 1 ? 1 : 1 - (1 - PREVIEW_MIN_ALPHA) * (i / (n - 1)),
  }));
}
