// Plans for the hit moment: the impact burst, the flash limiter and the "-N" pip. Pure (no Phaser),
// so Vitest checks the numbers. The view in fightEffects.ts only draws what these return.
import { HIT_FX } from '../../game/config';
import { createRng } from '../../game/rng';
import type { Rect, Team, Vec2 } from '../../game/types';
import { ART, PALETTE } from './visual';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Fire for Team Past, cool cyan and white for Team Future. */
export function hitBurstColors(team: Team): {
  flash: number;
  ring: number;
  smoke: number;
  particles: readonly number[];
} {
  return team === 'PAST'
    ? {
        flash: PALETTE.shared.white,
        ring: ART.flameYellow,
        smoke: PALETTE.shared.white,
        particles: [ART.flame, ART.flameYellow, PALETTE.shared.ember, PALETTE.shared.white],
      }
    : {
        flash: PALETTE.shared.white,
        ring: PALETTE.future.glow,
        smoke: PALETTE.future.pale,
        particles: [
          PALETTE.future.glow,
          PALETTE.shared.white,
          PALETTE.future.pale,
          PALETTE.future.neon,
        ],
      };
}

export type BurstParticle = {
  angle: number;
  dist: number;
  size: number;
  color: number;
  delayMs: number;
  durationMs: number;
};
export type HitBurstPlan = {
  flash: { radius: number; delayMs: number; durationMs: number; color: number };
  ring: { radius: number; endScale: number; delayMs: number; durationMs: number; color: number };
  smoke: { radius: number; rise: number; delayMs: number; durationMs: number; color: number };
  particles: BurstParticle[];
};

/** The same team, scale and seed give the same burst. Every piece ends before burstMaxMs. */
export function hitBurstPlan(shooter: Team, scale: number, seed: number): HitBurstPlan {
  const s = Number.isFinite(scale) ? clamp(scale, 0.5, 2) : 1;
  const rng = createRng(Number.isFinite(seed) ? seed >>> 0 : 0);
  const colors = hitBurstColors(shooter);
  const n = HIT_FX.particleCount;
  const particles: BurstParticle[] = [];
  for (let i = 0; i < n; i++) {
    const delayMs = Math.round(rng.next() * 60);
    const durationMs = Math.round(
      HIT_FX.particleMinMs + rng.next() * (HIT_FX.particleMaxMs - HIT_FX.particleMinMs),
    );
    particles.push({
      // Spread evenly round the circle, with a little wobble so it does not look like a clock.
      angle: ((i + rng.next() * 0.7) / n) * Math.PI * 2,
      dist:
        (HIT_FX.particleMinDist + rng.next() * (HIT_FX.particleMaxDist - HIT_FX.particleMinDist)) *
        s,
      size: Math.round((5 + rng.next() * 6) * Math.min(s, 1.5)),
      color: colors.particles[i % colors.particles.length] as number,
      delayMs,
      durationMs: Math.min(durationMs, HIT_FX.burstMaxMs - 20 - delayMs),
    });
  }
  return {
    flash: { radius: 60 * s, delayMs: 0, durationMs: HIT_FX.flashMs, color: colors.flash },
    ring: {
      radius: HIT_FX.ringStartRadius,
      endScale: HIT_FX.ringEndScale * s,
      delayMs: 0,
      durationMs: HIT_FX.ringMs,
      color: colors.ring,
    },
    smoke: {
      radius: 26 * s,
      rise: 46 * s,
      delayMs: 40,
      durationMs: HIT_FX.smokeMs,
      color: colors.smoke,
    },
    particles,
  };
}

/**
 * Photosensitivity guard. `allow(nowMs)` says whether one more flash may show. Never more than
 * `perSecond` in any one second. A clock that jumps back, or junk, never lets a flash through.
 */
export function createFlashLimiter(perSecond: number = HIT_FX.maxFlashesPerSecond): {
  allow(nowMs: number): boolean;
} {
  let stamps: number[] = [];
  return {
    allow(nowMs) {
      if (!Number.isFinite(nowMs)) return false;
      stamps = stamps.filter((t) => t <= nowMs && nowMs - t < 1000);
      if (stamps.length >= perSecond) return false;
      stamps.push(nowMs);
      return true;
    },
  };
}

/** "-25" for 25 damage. Nothing for no damage. */
export function damagePipText(damage: number): string | null {
  if (!Number.isFinite(damage) || damage <= 0) return null;
  return `-${Math.round(damage)}`;
}

/** The pip starts just over the middle of the base that was hit. */
export function pipAnchor(base: Rect): Vec2 {
  return { x: base.x + base.w / 2, y: base.y - 24 };
}
