// The battlefield for one match (Phase 2): the biome's middle obstacle, Team Future's base spot and
// Team Past's castle place.
// Pure, no Phaser. Unknown ids fall back to the defaults, so nothing here ever throws.
import { BIOME_IDS, BIOMES, DEFAULT_PLAN, FORTS, PHASE1_LAYOUT, SPOTS } from './config';
import { fortShift, isFortId } from './forts';
import { isSpotId, layoutForSpot } from './spots';
import type { BattleLayout, BiomeId, FortIdValue, Polygon, Rect, SpotIdValue, Vec2 } from './types';
import { firingOrigin, ridesBase, type UnitDef } from './units';

/**
 * What the family picks on the Battle Plan screen. `fort` is optional: a plan saved before Team Past
 * had castle places has none, and no fort means the Phase 1 castle.
 */
export type BattlePlan = { biome: BiomeId; spot: SpotIdValue; fort?: FortIdValue };

export const isBiomeId = (value: unknown): value is BiomeId =>
  typeof value === 'string' && (BIOME_IDS as readonly string[]).includes(value);

/**
 * A clean plan: a missing or unknown place or spot comes from DEFAULT_PLAN. A missing or unknown
 * castle place is left out, so an old saved plan loads as the Phase 1 castle.
 */
export function normalizePlan(value: unknown): BattlePlan {
  const v = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    biome: isBiomeId(v.biome) ? v.biome : DEFAULT_PLAN.biome,
    spot: isSpotId(v.spot) ? v.spot : DEFAULT_PLAN.spot,
    ...(isFortId(v.fort) ? { fort: v.fort } : {}),
  };
}

const rectPolygon = (r: Rect): Polygon => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];

/**
 * The field for a biome, a spot and a castle place. Obstacle 0 is always the biome's middle shape;
 * the spot's shapes follow, then the castle place's. Aspen with no spot and no castle place has
 * exactly the Phase 1 terrain, bases and launchers.
 */
export function buildLayout(plan: {
  biome: BiomeId | null;
  spot: SpotIdValue | null;
  fort?: FortIdValue | null;
}): BattleLayout {
  const biome: BiomeId = isBiomeId(plan.biome) ? plan.biome : 'aspen';
  const spot = isSpotId(plan.spot) ? plan.spot : null;
  const fort = isFortId(plan.fort) ? plan.fort : null;
  const bySpot = layoutForSpot(spot);
  const [, ...spotShapes] = bySpot.terrain.obstacles;
  const byFort = fort ? FORTS[fort] : null;
  return {
    ...bySpot,
    terrain: {
      ground: bySpot.terrain.ground,
      obstacles: [BIOMES[biome].obstacle, ...spotShapes, ...(byFort ? byFort.obstacles : [])],
    },
    bases: byFort ? { ...bySpot.bases, PAST: { ...byFort.base } } : bySpot.bases,
    launchOrigins: byFort
      ? { ...bySpot.launchOrigins, PAST: { ...byFort.launchOrigin } }
      : bySpot.launchOrigins,
    biome,
    spot,
    fort,
    baseShift: { PAST: fortShift(fort), FUTURE: spot ? { ...SPOTS[spot].shift } : { x: 0, y: 0 } },
  };
}

export { ridesBase };

/** Where this fighter's shot starts on this field. Same rule as `firingOrigin` in units.ts. */
export const unitOrigin = (layout: BattleLayout, unit: UnitDef): Vec2 =>
  firingOrigin(unit.team, unit.id, layout);

/** The layout with these walls added as solid shapes. No walls gives the same object back. */
export function withWalls(layout: BattleLayout, walls: readonly Rect[]): BattleLayout {
  if (walls.length === 0) return layout;
  return {
    ...layout,
    terrain: {
      ground: layout.terrain.ground,
      obstacles: [...layout.terrain.obstacles, ...walls.map(rectPolygon)],
    },
  };
}

export { PHASE1_LAYOUT };
