// Upgrade levels. Pure data and arithmetic, no Phaser. They can no longer be bought (the old Build Base
// shop was removed 2026-10-25), but a level saved on a device still loads and counts in battle.
// Each team has three, and each goes from level 1 to 3.
import type { Team } from './types';

export type UpgradeId = 'tower' | 'wall' | 'gate' | 'forceField' | 'missiles' | 'squad';

/** What an upgrade changes in a match. */
export type UpgradeEffect =
  /** More base health. */
  | 'maxHp'
  /** Direct hits on this base do less damage. */
  | 'directCut'
  /** Near misses on this base do less damage. */
  | 'nearCut'
  /** The first hits on this base each match are blocked. */
  | 'shieldHits'
  /** This team's direct hits do more damage. */
  | 'directBonus'
  /** This base heals a little at the end of its own turn. */
  | 'repair';

export type Upgrade = {
  id: UpgradeId;
  team: Team;
  name: string;
  effect: UpgradeEffect;
  /** Added to the effect for each level. */
  perLevel: number;
};

export const UPGRADE_MAX_LEVEL = 3;

export const UPGRADES: readonly Upgrade[] = [
  {
    id: 'tower',
    team: 'PAST',
    name: 'Upgrade the Tower',
    effect: 'maxHp',
    perLevel: 48,
  },
  {
    id: 'wall',
    team: 'PAST',
    name: 'Reinforce the Wall',
    effect: 'directCut',
    perLevel: 3,
  },
  {
    id: 'gate',
    team: 'PAST',
    name: 'New Castle Gate',
    effect: 'nearCut',
    perLevel: 2,
  },
  {
    id: 'forceField',
    team: 'FUTURE',
    name: 'Force Field',
    effect: 'shieldHits',
    perLevel: 1,
  },
  {
    id: 'missiles',
    team: 'FUTURE',
    name: 'Missile Launcher',
    effect: 'directBonus',
    perLevel: 2,
  },
  {
    id: 'squad',
    team: 'FUTURE',
    name: 'Laser Squad',
    effect: 'repair',
    perLevel: 8,
  },
];

export const upgradeById = (id: string): Upgrade | null =>
  UPGRADES.find((u) => u.id === id) ?? null;

/** The total of an upgrade's effect at a level (0 to 3). A bad level counts as 0. */
export function upgradeValue(upgrade: Upgrade, level: number): number {
  const at = Math.min(
    UPGRADE_MAX_LEVEL,
    Math.max(0, Math.floor(Number.isFinite(level) ? level : 0)),
  );
  return at * upgrade.perLevel;
}
