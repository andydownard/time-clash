// The silly fall of a fighter whose brick gave way on a built base. Pure, no Phaser, so it is unit
// tested. The fighter drops with the brick (with a little bounce), flops over away from the enemy,
// squashes, puffs dust and stands up again on the lower spot. Nobody is hurt. With reduced motion
// it moves to the lower spot at once and blinks. Every number here is fixed, never random.
import type { UnitDef } from '../../game/units';
import type { Team, Vec2 } from '../../game/types';
import { unitSpot } from './unitSpots';

/** The longest a fall may take, start to standing again. */
export const RIDER_FALL_MAX_MS = 1150;

export type RiderFallPlan = {
  dropMs: number;
  flopMs: number;
  standMs: number;
  totalMs: number;
  /** How far it tips over, degrees. Negative leans left (Team Past falls back from the enemy). */
  flopAngle: number;
  /** Height share while flopped (1 is no squash). */
  squash: number;
  /** Reduced motion: how many blinks, and the faintest it gets. */
  blinks: number;
  blinkAlpha: number;
};

export type RiderFrame = {
  /** How far below its old castle spot the fighter is drawn, world px. */
  dy: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
};

// The drop matches a brick's tumble (basePlan.ts drops a brick with a bounce in 620 ms), a bit
// quicker so the whole fall stays under 1.2 s.
const DROP_MS = 520;
const FLOP_MS = 260;
const STAND_MS = 320;
const FLOP_DEG = 70;
const SQUASH = 0.78;
const REDUCED_MS = 320;

export function riderFallPlan(team: Team, reduced: boolean): RiderFallPlan {
  if (reduced) {
    return {
      dropMs: 0,
      flopMs: 0,
      standMs: 0,
      totalMs: REDUCED_MS,
      flopAngle: 0,
      squash: 1,
      blinks: 2,
      blinkAlpha: 0.35,
    };
  }
  const back = team === 'PAST' ? -1 : 1;
  return {
    dropMs: DROP_MS,
    flopMs: FLOP_MS,
    standMs: STAND_MS,
    totalMs: DROP_MS + FLOP_MS + STAND_MS,
    flopAngle: back * FLOP_DEG,
    squash: SQUASH,
    blinks: 0,
    blinkAlpha: 1,
  };
}

/** The usual bounce ease: lands, hops twice smaller, settles. 0 to 1. */
function bounceOut(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
  if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
  return n * (t - 2.625 / d) ** 2 + 0.984375;
}

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Where the fighter is `t` ms into its fall from `fromDy` to `toDy`. */
export function riderFallFrame(
  plan: RiderFallPlan,
  t: number,
  fromDy: number,
  toDy: number,
): RiderFrame {
  const upright = { angle: 0, scaleX: 1, scaleY: 1 };
  if (t >= plan.totalMs) return { dy: toDy, ...upright, alpha: 1 };
  if (plan.dropMs === 0) {
    // Reduced motion: at the new spot at once, blinking.
    const phase = (clamp01(t / plan.totalMs) * plan.blinks) % 1;
    const alpha = phase < 0.5 ? plan.blinkAlpha : 1;
    return { dy: toDy, ...upright, alpha: t <= 0 ? 1 : alpha };
  }
  if (t < plan.dropMs) {
    const k = Math.min(1, bounceOut(clamp01(t / plan.dropMs)));
    // A small awkward wobble on the way down.
    const wobble = Math.sin((t / plan.dropMs) * Math.PI * 3) * 8 * Math.sign(plan.flopAngle);
    return { dy: fromDy + (toDy - fromDy) * k, angle: wobble, scaleX: 1, scaleY: 1, alpha: 1 };
  }
  const squashOf = (k: number) => ({
    scaleX: 1 + (1 - plan.squash) * 0.5 * k,
    scaleY: 1 - (1 - plan.squash) * k,
  });
  if (t < plan.dropMs + plan.flopMs) {
    const k = smooth(clamp01((t - plan.dropMs) / plan.flopMs));
    return { dy: toDy, angle: plan.flopAngle * k, ...squashOf(k), alpha: 1 };
  }
  const k = 1 - smooth(clamp01((t - plan.dropMs - plan.flopMs) / plan.standMs));
  return { dy: toDy, angle: plan.flopAngle * k, ...squashOf(k), alpha: 1 };
}

/** A fighter's feet in its own drawing space: the middle of its drawing's bottom edge. */
export function riderPivot(def: UnitDef): Vec2 {
  const s = unitSpot(def);
  return { x: s.box.x + s.box.w / 2, y: s.box.y + s.box.h };
}

/**
 * The fighter container's position, turn and scale for a frame, so it turns and squashes round
 * its feet (`pivot`), and the feet sit at pivot + shift + dy. `shift` is the base's move for the
 * castle place or Austin spot.
 */
export function riderPose(
  frame: RiderFrame,
  pivot: Vec2,
  shift: Vec2,
): { x: number; y: number; angle: number; scaleX: number; scaleY: number } {
  const r = (frame.angle * Math.PI) / 180;
  const sx = pivot.x * frame.scaleX;
  const sy = pivot.y * frame.scaleY;
  const rx = sx * Math.cos(r) - sy * Math.sin(r);
  const ry = sx * Math.sin(r) + sy * Math.cos(r);
  return {
    x: pivot.x + shift.x - rx,
    y: pivot.y + shift.y + frame.dy - ry,
    angle: frame.angle,
    scaleX: frame.scaleX,
    scaleY: frame.scaleY,
  };
}
