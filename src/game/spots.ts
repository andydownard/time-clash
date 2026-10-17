// Phase 2 base deployment spots for Team Future. Pure rules, no Phaser.
// `null` (or any unknown id) gives the Phase 1 layout, unchanged.
import { PHASE1_LAYOUT, SPOTS, SPOT_IDS } from './config';
import type { BattleLayout, Vec2 } from './types';

export type SpotId = (typeof SPOT_IDS)[number];

export const isSpotId = (value: unknown): value is SpotId =>
  typeof value === 'string' && (SPOT_IDS as readonly string[]).includes(value);

/** Phase 1 layout for null or an unknown id. Otherwise Phase 1 with the Future base moved. */
export const layoutForSpot = (spot: SpotId | null | undefined): BattleLayout => {
  if (!isSpotId(spot)) return PHASE1_LAYOUT;
  const cfg = SPOTS[spot];
  return {
    ...PHASE1_LAYOUT,
    terrain: {
      ground: PHASE1_LAYOUT.terrain.ground,
      obstacles: [...PHASE1_LAYOUT.terrain.obstacles, ...cfg.obstacles],
    },
    bases: { ...PHASE1_LAYOUT.bases, FUTURE: { ...cfg.base } },
    launchOrigins: { ...PHASE1_LAYOUT.launchOrigins, FUTURE: { ...cfg.launchOrigin } },
  };
};

/** Launch height (y) of the Future base at this spot. Smaller is higher. */
export const spotElevation = (spot: SpotId | null | undefined): number =>
  layoutForSpot(spot).launchOrigins.FUTURE.y;

/** Move a Phase 1 Future-side point the way the base moved. Null or unknown: unchanged. */
export const shiftForSpot = (spot: SpotId | null | undefined, point: Vec2): Vec2 => {
  const shift = isSpotId(spot) ? SPOTS[spot].shift : { x: 0, y: 0 };
  return { x: point.x + shift.x, y: point.y + shift.y };
};
