// Castle places for Team Past, the mirror of Team Future's base spots (spots.ts). Pure rules, no
// Phaser. `null` (or any unknown id) gives the Phase 1 layout, unchanged.
import { FORTS, FORT_IDS, PHASE1_LAYOUT } from './config';
import type { BattleLayout, FortIdValue, Vec2 } from './types';

export type FortId = FortIdValue;

export const isFortId = (value: unknown): value is FortId =>
  typeof value === 'string' && (FORT_IDS as readonly string[]).includes(value);

/** Phase 1 layout for null or an unknown id. Otherwise Phase 1 with the Past castle moved. */
export const layoutForFort = (fort: FortId | null | undefined): BattleLayout => {
  if (!isFortId(fort)) return PHASE1_LAYOUT;
  const cfg = FORTS[fort];
  return {
    ...PHASE1_LAYOUT,
    terrain: {
      ground: PHASE1_LAYOUT.terrain.ground,
      obstacles: [...PHASE1_LAYOUT.terrain.obstacles, ...cfg.obstacles],
    },
    bases: { ...PHASE1_LAYOUT.bases, PAST: { ...cfg.base } },
    launchOrigins: { ...PHASE1_LAYOUT.launchOrigins, PAST: { ...cfg.launchOrigin } },
  };
};

/** Launch height (y) of the Past castle at this place. Smaller is higher. */
export const fortElevation = (fort: FortId | null | undefined): number =>
  layoutForFort(fort).launchOrigins.PAST.y;

/** How far the castle moved from its Phase 1 place. Null or unknown: not at all. */
export const fortShift = (fort: FortId | null | undefined): Vec2 =>
  isFortId(fort) ? { ...FORTS[fort].shift } : { x: 0, y: 0 };
