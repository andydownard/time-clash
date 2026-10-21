// The battlefield for one match (Phase 2): the biome's middle obstacle plus Team Future's base spot.
// Pure, no Phaser. Unknown ids fall back to the defaults, so nothing here ever throws.
import { BIOME_IDS, BIOMES, DEFAULT_PLAN, PHASE1_LAYOUT, SPOTS } from './config';
import { isSpotId, layoutForSpot } from './spots';
import type { BattleLayout, BiomeId, Polygon, Rect, SpotIdValue, Vec2 } from './types';
import { firingOrigin, ridesBase, type UnitDef } from './units';

/** What the family picks on the Battle Plan screen. */
export type BattlePlan = { biome: BiomeId; spot: SpotIdValue };

export const isBiomeId = (value: unknown): value is BiomeId =>
  typeof value === 'string' && (BIOME_IDS as readonly string[]).includes(value);

/** A clean plan: anything missing or unknown comes from DEFAULT_PLAN. */
export function normalizePlan(value: unknown): BattlePlan {
  const v = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    biome: isBiomeId(v.biome) ? v.biome : DEFAULT_PLAN.biome,
    spot: isSpotId(v.spot) ? v.spot : DEFAULT_PLAN.spot,
  };
}

const rectPolygon = (r: Rect): Polygon => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];

/**
 * The field for a biome and a spot. Obstacle 0 is always the biome's middle shape; the spot's
 * shapes follow. Aspen with no spot has exactly the Phase 1 terrain, bases and launchers.
 */
export function buildLayout(plan: {
  biome: BiomeId | null;
  spot: SpotIdValue | null;
}): BattleLayout {
  const biome: BiomeId = isBiomeId(plan.biome) ? plan.biome : 'aspen';
  const spot = isSpotId(plan.spot) ? plan.spot : null;
  const bySpot = layoutForSpot(spot);
  const [, ...spotShapes] = bySpot.terrain.obstacles;
  return {
    ...bySpot,
    terrain: {
      ground: bySpot.terrain.ground,
      obstacles: [BIOMES[biome].obstacle, ...spotShapes],
    },
    biome,
    spot,
    baseShift: { PAST: { x: 0, y: 0 }, FUTURE: spot ? { ...SPOTS[spot].shift } : { x: 0, y: 0 } },
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
