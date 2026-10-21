// Awkward Tumble: pure timeline data and pose sampling. The view only turns a pose into shapes.
// Steps in order: fold, windmill arms, pancake, spring up, look left, look right.
import { TIMING } from '../../game/config';
import type { BlastOutcome, Team } from '../../game/types';
import { TUMBLE_LINES } from '../../data/copy';
import { BOUNCE_HEIGHT, DIZZY, FALL_DX, FALL_HEIGHT, FALL_MS } from './visual';

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

// ---------- Fall, topple and vanish ----------
// The setup: the fighter teeters on the spot, arms flailing, looking both ways ("uh oh").
// Then it flies off its feet, lands with a squash, and bounces once (the payoff: a flat plank
// bounce, or a spin on its feet). Then it lies down, or wobbles and falls over. Dizzy stars
// circle its head. Nobody is hurt. It vanishes in a puff and comes back on the next turn.
// All of these are pure: same time in, same frame out.

export type FallVariant = 'face' | 'feet';
export const FALL_PHASES = ['teeter', 'fly', 'land', 'bounce', 'wobble', 'topple'] as const;
export type FallPhase = (typeof FALL_PHASES)[number];

export type FallFrame = {
  phase: FallPhase;
  /** 0..1 inside the phase. */
  progress: number;
  /** Pixels away from the start, toward the field. Never negative. */
  dx: number;
  /** Pixels off the ground. Never negative. */
  lift: number;
  /** Clockwise tilt away from the base. 90 means lying down. */
  rotationDeg: number;
  squashX: number;
  squashY: number;
  armSwingDeg: number;
  lookDir: -1 | 0 | 1;
};

/** Where each phase ends, as a share of the total. */
const FALL_ENDS: Record<FallPhase, number> = {
  teeter: 0.2,
  fly: 0.5,
  land: 0.58,
  bounce: 0.72,
  wobble: 0.84,
  topple: 1,
};
export const LYING_DEG = 90;
const LAND_SQUASH = 0.45;
/** The teeter rocks back and forth up to this far (degrees), then stands straight to launch. */
const TEETER_TILT = 14;
const easeInOut = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const clamp01 = (u: number): number => Math.min(1, Math.max(0, u));

/** Alternates by tumble count, so a family sees both kinds. Seeded by the count, not by a clock. */
export function fallVariant(count: number): FallVariant {
  return Math.abs(Math.trunc(count)) % 2 === 0 ? 'face' : 'feet';
}

export function fallFrame(
  timeMs: number,
  variant: FallVariant,
  totalMs: number = FALL_MS,
): FallFrame {
  const t = Number.isFinite(timeMs) ? Math.min(totalMs, Math.max(0, timeMs)) : 0;
  const f = totalMs > 0 ? t / totalMs : 1;
  const within = (from: number, to: number): number => clamp01((f - from) / (to - from));
  const phase: FallPhase = FALL_PHASES.find((p) => f < FALL_ENDS[p]) ?? 'topple';
  const i = FALL_PHASES.indexOf(phase);
  const u = within(i === 0 ? 0 : FALL_ENDS[FALL_PHASES[i - 1]!], FALL_ENDS[phase]);
  const flip = variant === 'feet' ? 360 : 360 + LYING_DEG;
  let dx = FALL_DX;
  let lift = 0;
  let rotationDeg = variant === 'feet' ? 0 : LYING_DEG;
  let squashY = 1;
  let armSwingDeg = 0;
  let lookDir: -1 | 0 | 1 = 0;
  switch (phase) {
    case 'teeter':
      // On tiptoe, rocking harder each time, arms going round. Looks one way, then the other.
      dx = 0;
      rotationDeg = -TEETER_TILT * Math.sin(Math.PI * 3 * u) * Math.sin(Math.PI * u);
      squashY = 1 + 0.08 * Math.sin(Math.PI * u);
      armSwingDeg = (900 * u) % 360;
      lookDir = u < 0.5 ? -1 : 1;
      break;
    case 'fly':
      dx = FALL_DX * easeOut(u);
      lift = 4 * FALL_HEIGHT * u * (1 - u);
      rotationDeg = (flip * easeInOut(u)) % 360;
      armSwingDeg = (540 * u) % 360;
      break;
    case 'land':
      squashY = 1 - LAND_SQUASH * Math.sin(Math.PI * u);
      break;
    case 'bounce':
      // Boing: up and back down. Flat on its face it bounces like a plank. On its feet it spins.
      lift = BOUNCE_HEIGHT * Math.sin(Math.PI * u);
      squashY = 1 + 0.1 * Math.sin(Math.PI * u);
      if (variant === 'feet') rotationDeg = (360 * easeInOut(u)) % 360;
      break;
    case 'wobble':
      // On its feet it sways. Lying down it looks around, dizzy.
      if (variant === 'feet') rotationDeg = 10 * Math.sin(Math.PI * 3 * u) * (1 - u);
      lookDir = u < 0.5 ? -1 : 1;
      break;
    case 'topple':
      if (variant === 'feet') rotationDeg = LYING_DEG * u * u;
      break;
  }
  return {
    phase,
    progress: u,
    dx,
    lift: Math.max(0, lift),
    rotationDeg,
    squashX: 1 + (1 - squashY) * 0.8,
    squashY,
    armSwingDeg,
    lookDir,
  };
}

/** The same frame as a TumblePose, so the character sprite can draw it. */
export function fallPose(frame: FallFrame): TumblePose {
  const step: Record<FallPhase, TumbleStep> = {
    teeter: 'windmill',
    fly: 'fold',
    land: 'pancake',
    bounce: 'spring',
    wobble: 'lookLeft',
    topple: 'spring',
  };
  return {
    step: step[frame.phase],
    progress: frame.progress,
    squashX: frame.squashX,
    squashY: frame.squashY,
    rotationDeg: frame.rotationDeg,
    armSwingDeg: frame.armSwingDeg,
    lift: frame.lift,
    lookDir: frame.lookDir,
  };
}

export type VanishFrame = {
  /** The fighter fades out in the first part. */
  characterAlpha: number;
  puffScale: number;
  puffAlpha: number;
};

/** u runs 0..1. The puff grows and fades. The fighter is gone by the time the puff is big. */
export function vanishFrame(u: number): VanishFrame {
  const x = clamp01(Number.isFinite(u) ? u : 0);
  return {
    characterAlpha: 1 - clamp01(x / 0.4),
    puffScale: 0.5 + 1.9 * easeOut(x),
    puffAlpha: x < 0.2 ? 0.9 * (x / 0.2) : 0.9 * (1 - (x - 0.2) / 0.8),
  };
}

export type DizzyStar = {
  /** Offset from the top of the head, in px. dy is always above the head. */
  dx: number;
  dy: number;
  alpha: number;
};

/** Three stars circle the head after the bounce. u runs 0..1 over DIZZY.ms. */
export function dizzyStarsFrame(u: number): DizzyStar[] {
  const x = clamp01(Number.isFinite(u) ? u : 0);
  const alpha = x < 0.15 ? x / 0.15 : x > 0.75 ? Math.max(0, (1 - x) / 0.25) : 1;
  return [0, 1, 2].map((k) => {
    const a = 2 * Math.PI * (DIZZY.spins * x + k / 3);
    return {
      dx: DIZZY.orbitX * Math.cos(a),
      dy: -DIZZY.rise + DIZZY.orbitY * Math.sin(a),
      alpha,
    };
  });
}
