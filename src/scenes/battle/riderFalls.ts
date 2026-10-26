// Which fighters fall when bricks of a built base give way, and what they say. Pure, no Phaser.
// The flow (flow.ts) asks this after every crumble; the scene plays the fall (riderFall.ts).
import { baseFallPool } from '../../data/copy';
import { createShuffleBag } from '../../game/bag';
import { BASE_FALL_LINE_COUNT, RNG_SALT } from '../../game/config';
import { createRng } from '../../game/rng';
import { RIDER_IDS } from '../../game/riders';
import type { BattleLayout, Team, Vec2 } from '../../game/types';
import { unitById, type UnitId } from '../../game/units';
import { unitSpot } from './unitSpots';

/** A fighter on a built base whose brick fell: drawn `fromDy`, then `toDy`, below its castle spot. */
export type RiderFall = { id: UnitId; fromDy: number; toDy: number };

export type Drops = Partial<Record<UnitId, number>>;

/** The riders of `team` that stand lower now than before, in roster order. */
export function riderFallsFor(team: Team, before: Drops, after: Drops): RiderFall[] {
  const out: RiderFall[] = [];
  for (const id of RIDER_IDS) {
    if (unitById(id)?.team !== team) continue;
    const fromDy = before[id] ?? 0;
    const toDy = after[id] ?? 0;
    if (toDy > fromDy) out.push({ id, fromDy, toDy });
  }
  return out;
}

/** Where the speech bubble's tail points: just over the fallen fighter's head, where it stands now. */
export function riderTail(id: UnitId, layout: Pick<BattleLayout, 'baseShift'>, dy: number): Vec2 {
  const def = unitById(id) as NonNullable<ReturnType<typeof unitById>>;
  const s = unitSpot(def);
  const shift = layout.baseShift?.[def.team] ?? { x: 0, y: 0 };
  return { x: s.box.x + s.box.w / 2 + shift.x, y: s.box.y + shift.y + dy };
}

/**
 * The funny line for each team's fall, from a seeded shuffle bag per team (its own salt, so the
 * other jokes keep their order). Every line shows once before any repeats, and never twice in a row.
 */
export function createBaseFallLines(seed: number): { next(team: Team): string } {
  const rng = createRng((seed ^ RNG_SALT.baseFalls) >>> 0);
  const bags = {
    PAST: createShuffleBag(rng, BASE_FALL_LINE_COUNT),
    FUTURE: createShuffleBag(rng, BASE_FALL_LINE_COUNT),
  };
  return {
    next: (team) => baseFallPool(team)[bags[team].next()] as string,
  };
}
