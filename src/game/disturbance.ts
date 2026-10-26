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

// ---------- Level ----------

/** How strong a turn's birds, gust and recoil are. */
export type DisturbanceLevel = (typeof DISTURBANCE.levelOrder)[number];

/**
 * This turn's level: low, medium or high, a third of the time each. Its own seeded stream, so
 * drawing it moves no other random number. Same seed and turn, same level.
 */
export const levelForTurn = (seed: number, turnNumber: number): DisturbanceLevel => {
  const rng = createRng(mix(seed, DISTURBANCE.salt.level, turnNumber));
  return rng.pick(DISTURBANCE.levelOrder);
};

/** The multipliers for a level (an unknown level counts as low, the old mild setting). */
export const levelScale = (level: DisturbanceLevel | undefined) =>
  DISTURBANCE.levels[level ?? 'low'] ?? DISTURBANCE.levels.low;

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
  /** How far a bump turns the shell, degrees (the turn's level). Missing: the low setting. */
  nudgeDeg?: number;
};

const B = DISTURBANCE.birds;
const SPAN_MIN = -B.edgeMarginPx;
const SPAN = WORLD.width + 2 * B.edgeMarginPx;

/**
 * A start spot at least `minGapPx` from every earlier bird, as close to the drawn spot as can be.
 * Tries the drawn spot, a gap either side of each earlier bird, and the midpoints between them.
 */
const spreadOut = (x: number, earlier: readonly number[]): number => {
  if (earlier.length === 0) return x;
  const sorted = [...earlier].sort((a, b) => a - b);
  const candidates = [x, ...sorted.flatMap((e) => [e - B.minGapPx, e + B.minGapPx])];
  for (let i = 1; i < sorted.length; i++)
    candidates.push(((sorted[i - 1] as number) + (sorted[i] as number)) / 2);
  const fits = (c: number) =>
    c >= SPAN_MIN && c <= SPAN_MIN + SPAN && earlier.every((e) => Math.abs(c - e) >= B.minGapPx);
  let best: number | null = null;
  for (const c of candidates)
    if (fits(c) && (best === null || Math.abs(c - x) < Math.abs(best - x))) best = c;
  return best ?? x;
};

/**
 * One to three birds for this turn, on seeded paths (the level sets how many and how hard they
 * nudge). Same seed and turn, same birds.
 */
export const birdsForTurn = (
  seed: number,
  turnNumber: number,
  level: DisturbanceLevel = levelForTurn(seed, turnNumber),
): BirdPath[] => {
  const rng = createRng(mix(seed, DISTURBANCE.salt.birds, turnNumber));
  const scale = levelScale(level);
  const [lo, hi] = scale.birdCount;
  const count = rng.int(Math.max(B.minCount, lo), Math.min(B.maxCount, hi));
  const nudgeDeg = B.nudgeDeg * scale.nudge;
  const birds: BirdPath[] = [];
  for (let id = 0; id < count; id++) {
    // Every bird starts well away from the others, so two never sit on top of each other.
    const x0 = spreadOut(
      SPAN_MIN + rng.next() * SPAN,
      birds.map((b) => b.x0),
    );
    const y0 = B.minY + rng.next() * (B.maxY - B.minY);
    const speed = B.minSpeed + rng.next() * (B.maxSpeed - B.minSpeed);
    const vx = rng.next() < 0.5 ? -speed : speed;
    birds.push({ id, x0, y0, vx, bobPhase: rng.next(), nudgeDeg });
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
  nudgeDeg: number = B.nudgeDeg,
): { vx: number; vy: number } => {
  const speed = Math.hypot(v.vx, v.vy) * B.speedKeep;
  const heading = Math.atan2(v.vy, v.vx);
  const turn = ((Number.isFinite(nudgeDeg) ? nudgeDeg : B.nudgeDeg) * Math.PI) / 180;
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
export type Gust = {
  startShare: number;
  durationMs: number;
  push: number;
  /** The turn's level (the scene sizes the gust cue by it). Missing: low. */
  level?: DisturbanceLevel;
};

const G = DISTURBANCE.gust;

/** This turn's gust, as strong as the turn's level. Same seed and turn, same gust. Either way, about as often. */
export const gustForTurn = (
  seed: number,
  turnNumber: number,
  level: DisturbanceLevel = levelForTurn(seed, turnNumber),
): Gust => {
  const rng = createRng(mix(seed, DISTURBANCE.salt.gust, turnNumber));
  const startShare = G.earliestShare + rng.next() * (G.latestShare - G.earliestShare);
  const strength = (G.minPush + rng.next() * (G.maxPush - G.minPush)) * levelScale(level).push;
  const push = rng.next() < 0.5 ? -strength : strength;
  return { startShare, durationMs: G.durationMs, push, level };
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

/** A role's recoil limits at a level: the low limits times the level's multiplier, rounded. */
export const recoilLimit = (role: UnitRole, level?: DisturbanceLevel): AimInput | null => {
  const limit = (DISTURBANCE.recoil as Partial<Record<string, AimInput>>)[role];
  if (!limit) return null;
  const k = levelScale(level).recoil;
  return { angleDeg: Math.round(limit.angleDeg * k), power: Math.round(limit.power * k) };
};

/**
 * How far the dials slide after shot `shotInTurn` (0, 1, 2) of a turn, for this fighter role.
 * Whole numbers between minus and plus the role's limits at the turn's level (one level for the
 * whole turn, so every shot of a turn kicks alike). Seeded, so tests repeat.
 */
export const recoilFor = (
  seed: number,
  turnNumber: number,
  shotInTurn: number,
  role: UnitRole,
  level: DisturbanceLevel = levelForTurn(seed, turnNumber),
): AimInput => {
  const limit = recoilLimit(role, level);
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
