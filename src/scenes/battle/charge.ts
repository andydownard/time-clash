// The wind-up before a shot (pure). A glow ring pulls in to the launcher while a bright core
// grows, then the shot goes. The view only turns a frame into shapes.
import { CHARGE_MS } from './visual';

/** Ring sizes in world px. */
export const CHARGE = { ringStart: 46, ringEnd: 8, coreMax: 16 } as const;

export type ChargeFrame = {
  ringRadius: number;
  ringAlpha: number;
  coreRadius: number;
  coreAlpha: number;
};

const clamp01 = (u: number): number => Math.min(1, Math.max(0, Number.isFinite(u) ? u : 0));
const easeIn = (u: number): number => u * u;

/** How long the wind-up lasts. Reduced motion skips it: the shot goes at once. */
export function chargeMs(reduced: boolean): number {
  return reduced ? 0 : CHARGE_MS;
}

/** u runs 0..1 over the wind-up. */
export function chargeFrame(u: number): ChargeFrame {
  const x = clamp01(u);
  const e = easeIn(x);
  return {
    ringRadius: CHARGE.ringStart + (CHARGE.ringEnd - CHARGE.ringStart) * e,
    ringAlpha: 0.35 + 0.6 * x,
    coreRadius: CHARGE.coreMax * (0.25 + 0.75 * e),
    coreAlpha: 0.3 + 0.7 * x,
  };
}
