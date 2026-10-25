// Birds, gusts and recoil: the seeded nudges that keep shots from being too predictable.
// Pure functions of the seed, the turn number and time. No Phaser. The scene only draws them.
// Numbers live in DISTURBANCE (config.ts).
import { AIM, DISTURBANCE, WORLD } from './config';
import { createRng } from './rng';
import type { AimInput, Vec2 } from './types';
import type { UnitRole } from './units';

/** Golden-ratio multiplier (as in wind.ts). Spreads neighbouring numbers across 32 bits. */
const MIX = 0x9e3779b1;

const mix = (seed: number, salt: number, a: number, b = 0): number => {
  const s = Number.isFinite(seed) ? seed : 0;
  const n = Number.isFinite(a) ? Math.max(0, Math.floor(a)) : 0;
  return (s ^ salt ^ Math.imul(n + 1, MIX) ^ Math.imul(b + 7, 0x85ebca6b)) >>> 0;
};

// ---------- Birds ----------

/** One bird's flight for a turn. Its place at any time comes from birdAt(). */
export type BirdPath = {
  id: number;
  /** Where it is when the turn starts (world px). */
  x0: number;
  y0: number;
  /** Sideways speed, px/s. Negative flies left. */
  vx: number;
  /** Where in its bob it starts, 0 to 1. */
  bobPhase: number;
};

const B = DISTURBANCE.birds;
const SPAN_MIN = -B.edgeMarginPx;
const SPAN = WORLD.width + 2 * B.edgeMarginPx;

/** One or two birds for this turn, on seeded paths. Same seed and turn, same birds. */
export const birdsForTurn = (seed: number, turnNumber: number): BirdPath[] => {
  const rng = createRng(mix(seed, DISTURBANCE.salt.birds, turnNumber));
  const count = rng.int(B.minCount, B.maxCount);
  const birds: BirdPath[] = [];
  for (let id = 0; id < count; id++) {
    let x0 = SPAN_MIN + rng.next() * SPAN;
    const prev = birds[id - 1];
    // A second bird starts well away from the first, so the two never sit on top of each other.
    if (prev && Math.abs(x0 - prev.x0) < B.minGapPx) {
      x0 = prev.x0 + (x0 >= prev.x0 ? 1 : -1) * B.minGapPx;
      if (x0 > SPAN_MIN + SPAN) x0 = prev.x0 - B.minGapPx;
      if (x0 < SPAN_MIN) x0 = prev.x0 + B.minGapPx;
    }
    const y0 = B.minY + rng.next() * (B.maxY - B.minY);
    const speed = B.minSpeed + rng.next() * (B.maxSpeed - B.minSpeed);
    const vx = rng.next() < 0.5 ? -speed : speed;
    birds.push({ id, x0, y0, vx, bobPhase: rng.next() });
  }
  return birds;
};

/** Where a bird is `ms` after the turn's birds took off. It wraps around past each edge. */
export const birdAt = (bird: BirdPath, ms: number): Vec2 => {
  const t = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const travelled = bird.x0 - SPAN_MIN + (bird.vx * t) / 1000;
  const wrapped = ((travelled % SPAN) + SPAN) % SPAN;
  const bob = Math.sin(2 * Math.PI * (bird.bobPhase + t / B.bobPeriodMs)) * B.bobPx;
  return { x: SPAN_MIN + wrapped, y: bird.y0 + bob };
};

/** Shortest distance from point p to the segment a-b. */
export const segmentGap = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(a.x + dx * u - p.x, a.y + dy * u - p.y);
};

/**
 * The shell's new velocity after it bumps a bird. It turns by `nudgeDeg` (up when the shell is
 * above the bird's center, down when below) and keeps `speedKeep` of its speed.
 */
export const bumpVelocity = (
  v: { vx: number; vy: number },
  shell: Vec2,
  bird: Vec2,
): { vx: number; vy: number } => {
  const speed = Math.hypot(v.vx, v.vy) * B.speedKeep;
  const heading = Math.atan2(v.vy, v.vx);
  const turn = (B.nudgeDeg * Math.PI) / 180;
  const over = shell.y <= bird.y;
  const side = v.vx >= 0 ? 1 : -1;
  // y grows down, so "up" is a smaller heading for a shell flying right and a larger one flying left.
  const next = heading + (over ? -side : side) * turn;
  return { vx: Math.cos(next) * speed, vy: Math.sin(next) * speed };
};

// ---------- Gusts ----------

/**
 * The one gust of a turn. It starts `startShare` of the way through the shell's plain flight
 * (so a fast flat shot meets it as surely as a lob) and blows for `durationMs`.
 */
export type Gust = { startShare: number; durationMs: number; push: number };

const G = DISTURBANCE.gust;

/** This turn's gust. Same seed and turn, same gust. Either way, about as often. */
export const gustForTurn = (seed: number, turnNumber: number): Gust => {
  const rng = createRng(mix(seed, DISTURBANCE.salt.gust, turnNumber));
  const startShare = G.earliestShare + rng.next() * (G.latestShare - G.earliestShare);
  const strength = G.minPush + rng.next() * (G.maxPush - G.minPush);
  const push = rng.next() < 0.5 ? -strength : strength;
  return { startShare, durationMs: G.durationMs, push };
};

/** When the gust starts (ms after launch) for a shell whose plain flight lasts `flightMs`. */
export const gustStartMs = (gust: Gust, flightMs: number): number =>
  gust.startShare * (Number.isFinite(flightMs) && flightMs > 0 ? flightMs : 0);

/** The gust's extra sideways push `ms` after launch: its push while it blows, else 0. */
export const gustPushAt = (gust: Gust | null, ms: number, flightMs: number): number => {
  if (!gust) return 0;
  const start = gustStartMs(gust, flightMs);
  return ms >= start && ms < start + gust.durationMs ? gust.push : 0;
};

// ---------- Recoil ----------

/**
 * How far the dials slide after shot `shotInTurn` (0, 1, 2) of a turn, for this fighter role.
 * Whole numbers between minus and plus the role's limits. Seeded, so tests repeat.
 */
export const recoilFor = (
  seed: number,
  turnNumber: number,
  shotInTurn: number,
  role: UnitRole,
): AimInput => {
  const limit = (DISTURBANCE.recoil as Partial<Record<string, AimInput>>)[role];
  if (!limit) return { angleDeg: 0, power: 0 };
  const rng = createRng(mix(seed, DISTURBANCE.salt.recoil, turnNumber, shotInTurn));
  return {
    angleDeg: rng.int(-limit.angleDeg, limit.angleDeg),
    power: rng.int(-limit.power, limit.power),
  };
};

/** The aim plus a kick, always inside the AIM limits. */
export const kickAim = (aim: AimInput, kick: AimInput): AimInput => ({
  angleDeg: Math.min(AIM.angleMaxDeg, Math.max(AIM.angleMinDeg, aim.angleDeg + kick.angleDeg)),
  power: Math.min(AIM.powerMax, Math.max(AIM.powerMin, aim.power + kick.power)),
});

// ---------- One flight ----------

/** What disturbs one flight: the turn's birds (and the bird clock at launch) and its gust. */
export type FlightDisturbance = {
  birds: readonly BirdPath[];
  /** The bird clock (ms since the turn's birds took off) when the shell leaves the muzzle. */
  birdMs: number;
  gust: Gust | null;
};
