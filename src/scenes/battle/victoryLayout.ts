// Victory art, the math part: where the podium, winner, loser, and confetti go, and how the
// loser pops back up. Pure and seeded, so it is unit tested. victoryArt.ts draws it.
import { createRng } from '../../game/rng';
import type { Rect, Team, Vec2 } from '../../game/types';
import { PALETTE } from './visual';

export type Size = { width: number; height: number };

export type VictoryLayout = {
  podium: Rect;
  /** Where the winner's feet are: on top of the podium. */
  winnerFeet: Vec2;
  /** The loser lies flat on the ground, on the side of their own base. */
  loserFeet: Vec2;
  groundY: number;
};

export function victoryLayout(winner: Team, size: Size): VictoryLayout {
  const { width: W, height: H } = size;
  const groundY = H * 0.88;
  const podiumW = W * 0.2;
  const podiumH = H * 0.2;
  const podium: Rect = { x: W / 2 - podiumW / 2, y: groundY - podiumH, w: podiumW, h: podiumH };
  // Team Past's base is on the left, so a losing Past stands left of the podium.
  const loserX = winner === 'PAST' ? W * 0.82 : W * 0.18;
  return {
    podium,
    winnerFeet: { x: W / 2, y: podium.y },
    loserFeet: { x: loserX, y: groundY },
    groundY,
  };
}

export type ConfettiPiece = {
  x: number;
  startY: number;
  endY: number;
  color: number;
  /** Turns during the fall, in degrees. */
  spin: number;
  delayMs: number;
  durationMs: number;
};

const CONFETTI_COLORS = [
  PALETTE.past.gold,
  PALETTE.past.banner,
  PALETTE.future.glow,
  PALETTE.future.neon,
  PALETTE.future.pink,
  PALETTE.past.parchment,
] as const;

/** 56 pieces, repeatable for a given winner. */
export function confettiFor(winner: Team, size: Size): ConfettiPiece[] {
  const rng = createRng(winner === 'PAST' ? 0x7061 : 0x6675);
  return Array.from({ length: 56 }, (_, i) => ({
    x: Math.round(rng.next() * size.width),
    startY: -20 - Math.round(rng.next() * size.height * 0.4),
    endY: Math.round(size.height * (0.55 + rng.next() * 0.43)),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] as number,
    spin: Math.round(180 + rng.next() * 540),
    delayMs: Math.round(rng.next() * 1600),
    durationMs: Math.round(2200 + rng.next() * 1600),
  }));
}

/** The loser lies flat this long, then pops up. */
export const LOSER_FLAT_MS = 1400;
export const LOSER_POP_MS = 700;
const FLAT = 0.16;

/** Vertical scale of the loser at time t: flat, then a springy pop that overshoots once. */
export function loserSquash(ms: number): number {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= LOSER_FLAT_MS) return FLAT;
  const p = (t - LOSER_FLAT_MS) / LOSER_POP_MS;
  if (p >= 1) return 1;
  // easeOutBack: rises past 1, then settles.
  const c1 = 1.9;
  const c3 = c1 + 1;
  const eased = 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
  return FLAT + (1 - FLAT) * eased;
}

export const HOVER_PERIOD_MS = 2400;
export const HOVER_RANGE_PX = 10;

/** Up and down offset for the hovering podium, in px. Negative is up. */
export function hoverOffset(ms: number): number {
  const t = Number(ms);
  if (!Number.isFinite(t)) return 0;
  return Math.sin((t / HOVER_PERIOD_MS) * Math.PI * 2) * HOVER_RANGE_PX;
}
