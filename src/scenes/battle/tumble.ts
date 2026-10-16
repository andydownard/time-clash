// Awkward Tumble: pure timeline data and pose sampling. The view only turns a pose into shapes.
// Steps in order: fold, windmill arms, pancake, spring up, look left, look right.
import { TIMING } from '../../game/config';
import type { BlastOutcome, Team } from '../../game/types';
import { TUMBLE_LINES } from '../../data/copy';

export const TUMBLE_STEPS = [
  'fold',
  'windmill',
  'pancake',
  'spring',
  'lookLeft',
  'lookRight',
] as const;
export type TumbleStep = (typeof TUMBLE_STEPS)[number];

/** Share of the total time each step takes. Adds up to 1. */
const WEIGHTS: Record<TumbleStep, number> = {
  fold: 0.15,
  windmill: 0.25,
  pancake: 0.15,
  spring: 0.15,
  lookLeft: 0.15,
  lookRight: 0.15,
};

export type TimelineStep = { step: TumbleStep; startMs: number; endMs: number };

export function tumbleTimeline(totalMs: number = TIMING.tumbleMs): TimelineStep[] {
  let cum = 0;
  let from = 0;
  return TUMBLE_STEPS.map((step) => {
    cum += WEIGHTS[step];
    const endMs = step === 'lookRight' ? totalMs : Math.round(totalMs * cum);
    const out = { step, startMs: from, endMs };
    from = endMs;
    return out;
  });
}

export type TumblePose = {
  step: TumbleStep;
  /** 0..1 inside the step. */
  progress: number;
  squashX: number;
  squashY: number;
  rotationDeg: number;
  armSwingDeg: number;
  /** Pixels off the ground. */
  lift: number;
  lookDir: -1 | 0 | 1;
};

const FOLD_SQUASH = 0.55;
const PANCAKE_SQUASH = 0.12;
const FOLD_TILT = -15;
const SPRING_LIFT = 60;
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const easeOut = (u: number): number => 1 - (1 - u) * (1 - u);

export function tumblePose(timeMs: number, totalMs: number = TIMING.tumbleMs): TumblePose {
  const t = Number.isFinite(timeMs) ? Math.min(totalMs, Math.max(0, timeMs)) : 0;
  const tl = tumbleTimeline(totalMs);
  const cur = tl.find((s) => t < s.endMs) ?? tl[tl.length - 1]!;
  const u = cur.endMs > cur.startMs ? (t - cur.startMs) / (cur.endMs - cur.startMs) : 1;
  let squashY = 1;
  let rotationDeg = 0;
  let armSwingDeg = 0;
  let lift = 0;
  let lookDir: -1 | 0 | 1 = 0;
  switch (cur.step) {
    case 'fold':
      squashY = lerp(1, FOLD_SQUASH, u);
      rotationDeg = lerp(0, FOLD_TILT, u);
      break;
    case 'windmill':
      squashY = FOLD_SQUASH;
      rotationDeg = FOLD_TILT;
      armSwingDeg = (720 * u) % 360;
      break;
    case 'pancake':
      squashY = lerp(FOLD_SQUASH, PANCAKE_SQUASH, Math.min(1, u / 0.4));
      rotationDeg = lerp(FOLD_TILT, 0, Math.min(1, u / 0.4));
      break;
    case 'spring':
      squashY = lerp(PANCAKE_SQUASH, 1, easeOut(u));
      lift = Math.sin(Math.PI * u) * SPRING_LIFT;
      break;
    case 'lookLeft':
      lookDir = -1;
      break;
    case 'lookRight':
      lookDir = 1;
      break;
  }
  return {
    step: cur.step,
    progress: u,
    squashX: 1 + (1 - squashY) * 0.8,
    squashY,
    rotationDeg,
    armSwingDeg,
    lift,
    lookDir,
  };
}

/** The defender tumbles on a near miss only (docs/CONTRACTS.md decision 8). */
export function tumblingTeam(outcome: BlastOutcome): Team | null {
  return outcome.tumble ? outcome.target : null;
}

/** The speech bubble line the seeded rng picked, or null. */
export function bubbleText(outcome: BlastOutcome): string | null {
  if (!outcome.tumble || outcome.bubbleIndex === null) return null;
  return TUMBLE_LINES[outcome.bubbleIndex] ?? null;
}
