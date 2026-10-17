// Decides which effect a landed shot gets. Pure, so it is unit tested.
import { HITS } from '../../data/copy';
import { WORLD } from '../../game/config';
import { createRng } from '../../game/rng';
import type { BlastOutcome, Rect, ShotResult, Team } from '../../game/types';
import type { EffectKind, ImpactInfo } from './types';
import { ART, IMPACT_SCALE, PALETTE } from './visual';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

const AMMO: Record<Team, EffectKind> = { PAST: 'confetti', FUTURE: 'plasma' };

export function describeImpact(
  shooter: Team,
  shot: ShotResult,
  outcome: BlastOutcome,
  chosenLabel?: string,
): ImpactInfo {
  const position = {
    x: clamp(shot.landing.x, 0, WORLD.width),
    y: clamp(shot.landing.y, 0, WORLD.height),
  };
  let kind: EffectKind;
  let label: string;
  switch (outcome.result) {
    case 'direct':
      kind = 'blocks';
      label = HITS.direct;
      break;
    case 'near':
      kind = AMMO[shooter];
      label = HITS.near;
      break;
    default:
      kind = 'puff';
      label = HITS.miss;
  }
  return {
    kind,
    position,
    target: outcome.target,
    shooter,
    result: outcome.result,
    damage: outcome.damage,
    scale: IMPACT_SCALE[outcome.result],
    label: chosenLabel ?? label,
  };
}

// ---------- Explosions ----------
// A shot bursts where it lands: a fireball, smoke and a few chunks. Nobody is hurt.

export type Debris = 'stone' | 'metal';
export type Fireball = { radius: number; delayMs: number; durationMs: number; color: number };
export type SmokePuff = {
  dx: number;
  dy: number;
  radius: number;
  delayMs: number;
  durationMs: number;
};
export type Chunk = {
  angle: number;
  dist: number;
  size: number;
  color: number;
  durationMs: number;
  /** How high it hops on the way, in px. */
  hop: number;
};
export type ExplosionPlan = {
  flashRadius: number;
  fireballs: Fireball[];
  smoke: SmokePuff[];
  chunks: Chunk[];
};

const DEBRIS_COLORS: Record<Debris, readonly number[]> = {
  stone: [PALETTE.past.stone, PALETTE.past.stoneLine, PALETTE.past.wood],
  metal: [PALETTE.future.steel, PALETTE.future.hull, PALETTE.future.hullDark],
};

/** Plasma bursts glow blue at the edge. Everything else burns orange. */
const fireColors = (kind: EffectKind): readonly [number, number, number] =>
  kind === 'plasma'
    ? [PALETTE.shared.white, PALETTE.future.glow, PALETTE.future.neon]
    : [PALETTE.shared.white, ART.flameYellow, ART.flame];

/**
 * The same kind, scale and seed give the same burst. A miss (small scale) is mostly dust.
 * `chunkCount` lets a base blast throw more pieces.
 */
export function explosionPlan(
  kind: EffectKind,
  scale: number,
  seed: number,
  debris: Debris = kind === 'plasma' ? 'metal' : 'stone',
  chunkCount?: number,
): ExplosionPlan {
  const s = Number.isFinite(scale) ? clamp(scale, 0.3, 4) : 1;
  const rng = createRng(seed >>> 0);
  const dust = kind === 'puff';
  const [core, mid, edge] = fireColors(kind);
  const r = 34 * s;
  const fireballs: Fireball[] = dust
    ? [{ radius: r * 0.6, delayMs: 0, durationMs: 260, color: mid }]
    : [
        { radius: r * 1.25, delayMs: 0, durationMs: 520, color: edge },
        { radius: r * 0.9, delayMs: 40, durationMs: 440, color: mid },
        { radius: r * 0.5, delayMs: 80, durationMs: 360, color: core },
      ];
  const smokeCount = clamp(Math.round(3 + 2 * s), 3, 9);
  const smoke: SmokePuff[] = [];
  for (let i = 0; i < smokeCount; i++) {
    smoke.push({
      dx: (rng.next() - 0.5) * 70 * s,
      dy: -(10 + rng.next() * 40) * s,
      radius: (14 + rng.next() * 12) * s,
      delayMs: 100 + Math.round(rng.next() * 200),
      durationMs: 700 + Math.round(rng.next() * 400),
    });
  }
  const count = chunkCount ?? (dust ? 3 : clamp(Math.round(4 * s), 3, 8));
  const colors = DEBRIS_COLORS[debris];
  const chunks: Chunk[] = [];
  for (let i = 0; i < count; i++) {
    chunks.push({
      // Always upward and outward, so pieces arc through the air and fall.
      angle: -Math.PI * (0.1 + 0.8 * rng.next()),
      dist: (60 + rng.next() * 80) * s,
      size: Math.round((6 + rng.next() * 8) * Math.min(s, 2)),
      color: colors[i % colors.length] as number,
      durationMs: 600 + Math.round(rng.next() * 300),
      hop: (40 + rng.next() * 60) * s,
    });
  }
  return { flashRadius: r * 1.6, fireballs, smoke, chunks };
}

export type BlastSpot = { x: number; y: number; scale: number; delayMs: number };

/** A base that reaches 0 health blows up in a chain of fireballs. Nobody comes out. */
export function baseBlastPlan(base: Rect, seed: number): BlastSpot[] {
  const rng = createRng(seed >>> 0);
  const spots: BlastSpot[] = [];
  for (let i = 0; i < 4; i++) {
    spots.push({
      x: base.x + base.w * (0.15 + 0.7 * ((i + rng.next() * 0.6) / 4)),
      y: base.y + base.h * (0.25 + 0.5 * rng.next()),
      scale: i === 1 || i === 2 ? 2.2 : 1.6,
      delayMs: i * 140,
    });
  }
  return spots;
}
