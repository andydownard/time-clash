// Awkward Tumble: pure timeline data and pose sampling. The view only turns a pose into shapes.
// Steps in order: fold, windmill arms, pancake, spring up, look left, look right.
import { TIMING } from '../../game/config';
import type { BlastOutcome, Team, Vec2 } from '../../game/types';
import { tumblePool } from '../../data/copy';
import { HIT_FX } from '../../game/config';
import { createRng } from '../../game/rng';
import { FALL_DX, FALL_HEIGHT, FALL_MS } from './visual';

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
  /** Extra size on top of the squash. Missing means 1. */
  scale?: number;
};

const HEAD_HEIGHT = 80;
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
  return tumblePool(outcome.target)[outcome.bubbleIndex] ?? null;
}

// ---------- Fall, topple and vanish ----------
// A hit fighter flies off its feet, lands, then lies down (or lands on its feet and falls over).
// Nobody is hurt. The fighter then vanishes in a puff and comes back on the next turn.
// All three are pure: same time in, same frame out.

/** 'face' is a face-plant (forward). 'flop' is a backward flop. */
export type FallVariant = 'face' | 'flop';
export type FallPhase = 'fly' | 'land' | 'wobble' | 'topple';

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
  /** 1 is normal size. A fighter grows while it flies so the fall can be seen. */
  scale: number;
};

/** Where each phase ends, as a share of the total. */
const FALL_ENDS = { fly: 0.45, land: 0.57, wobble: 0.72, topple: 1 } as const;
export const LYING_DEG = 90;
const LAND_SQUASH = 0.35;
const easeInOut = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const clamp01 = (u: number): number => Math.min(1, Math.max(0, u));

/** Picks the fall style from the match seed and how many falls came before. No clock, no Math.random. */
export function fallVariantFor(seed: number, count: number): FallVariant {
  const a = Number.isFinite(seed) ? seed >>> 0 : 0;
  const b = Number.isFinite(count) ? Math.trunc(count) >>> 0 : 0;
  return createRng((a ^ Math.imul(b + 1, 0x9e3779b1)) >>> 0).next() < 0.5 ? 'face' : 'flop';
}

/** The tilt of a fighter lying down: forward is clockwise (+), a backward flop is the other way. */
const lyingDeg = (variant: FallVariant): number => (variant === 'flop' ? -LYING_DEG : LYING_DEG);

export function fallFrame(
  timeMs: number,
  variant: FallVariant,
  totalMs: number = FALL_MS,
): FallFrame {
  const t = Number.isFinite(timeMs) ? Math.min(totalMs, Math.max(0, timeMs)) : 0;
  const f = totalMs > 0 ? t / totalMs : 1;
  const within = (from: number, to: number): number => clamp01((f - from) / (to - from));
  let phase: FallPhase;
  let u: number;
  if (f < FALL_ENDS.fly) {
    phase = 'fly';
    u = within(0, FALL_ENDS.fly);
  } else if (f < FALL_ENDS.land) {
    phase = 'land';
    u = within(FALL_ENDS.fly, FALL_ENDS.land);
  } else if (f < FALL_ENDS.wobble) {
    phase = 'wobble';
    u = within(FALL_ENDS.land, FALL_ENDS.wobble);
  } else {
    phase = 'topple';
    u = within(FALL_ENDS.wobble, 1);
  }
  const lying = lyingDeg(variant);
  const flip = Math.sign(lying) * 360 + lying;
  let dx = FALL_DX;
  let lift = 0;
  let rotationDeg = lying;
  let squashY = 1;
  let armSwingDeg = 0;
  let lookDir: -1 | 0 | 1 = 0;
  switch (phase) {
    case 'fly':
      dx = FALL_DX * easeOut(u);
      lift = 4 * FALL_HEIGHT * u * (1 - u);
      rotationDeg = (flip * easeInOut(u)) % 360;
      armSwingDeg = (540 * u) % 360;
      break;
    case 'land':
      squashY = 1 - LAND_SQUASH * Math.sin(Math.PI * u);
      break;
    case 'wobble':
      // A little bounce off the ground, then it lies there looking around, dizzy.
      lift = HIT_FX.landBounce * Math.sin(Math.PI * u);
      lookDir = u < 0.5 ? -1 : 1;
      break;
    case 'topple':
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
    scale: phase === 'fly' ? lerp(1, HIT_FX.fallScale, easeOut(u)) : HIT_FX.fallScale,
  };
}

/** Standing back up: from lying where it fell to upright at its post, with a small hop. u runs 0..1. */
export function standUpFrame(u: number, variant: FallVariant): FallFrame {
  const x = clamp01(Number.isFinite(u) ? u : 0);
  const e = easeInOut(x);
  return {
    phase: 'topple',
    progress: x,
    dx: FALL_DX * (1 - e),
    lift: HIT_FX.standUpHop * Math.sin(Math.PI * x),
    rotationDeg: lyingDeg(variant) * (1 - e),
    squashX: 1,
    squashY: 1,
    armSwingDeg: 0,
    lookDir: 0,
    scale: lerp(HIT_FX.fallScale, 1, e),
  };
}

export type StarOffset = {
  dx: number;
  dy: number;
  /** In front of the head (drawn on top). */ front: boolean;
};

/** Where the little stars are, around a point over the fallen head. They circle on a flat oval. */
export function starOffsets(timeMs: number): StarOffset[] {
  const t = Number.isFinite(timeMs) ? timeMs : 0;
  const out: StarOffset[] = [];
  for (let i = 0; i < HIT_FX.starCount; i++) {
    const a = 2 * Math.PI * (i / HIT_FX.starCount) + (2 * Math.PI * t) / HIT_FX.starPeriodMs;
    const dx = Math.cos(a) * HIT_FX.starRadiusPx;
    const dy = Math.sin(a) * HIT_FX.starRadiusPx * HIT_FX.starSquash;
    out.push({ dx, dy, front: dy >= 0 });
  }
  return out;
}

/** The top of a fighter's head after a tilt (clockwise degrees about the feet). */
export function headPosition(feetX: number, feetY: number, angleDeg: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: feetX + Math.sin(rad) * HEAD_HEIGHT, y: feetY - Math.cos(rad) * HEAD_HEIGHT };
}

/** The same frame as a TumblePose, so the character sprite can draw it. */
export function fallPose(frame: FallFrame): TumblePose {
  const step: Record<FallPhase, TumbleStep> = {
    fly: 'fold',
    land: 'pancake',
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
    scale: frame.scale,
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
