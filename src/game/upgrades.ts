// The Build Base (old shop) choices. Pure data and arithmetic, no Phaser. Each team has three, and each
// goes from level 1 to 3. The effects are small on purpose: one purchase never wins the game.
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
  /** Scrap for level 1, 2 and 3. */
  cost: readonly [number, number, number];
};

export const UPGRADE_MAX_LEVEL = 3;

export const UPGRADES: readonly Upgrade[] = [
  {
    id: 'tower',
    team: 'PAST',
    name: 'Upgrade the Tower',
    effect: 'maxHp',
    perLevel: 48,
    cost: [6, 10, 14],
  },
  {
    id: 'wall',
    team: 'PAST',
    name: 'Reinforce the Wall',
    effect: 'directCut',
    perLevel: 3,
    cost: [6, 10, 14],
  },
  {
    id: 'gate',
    team: 'PAST',
    name: 'New Castle Gate',
    effect: 'nearCut',
    perLevel: 2,
    cost: [4, 8, 12],
  },
  {
    id: 'forceField',
    team: 'FUTURE',
    name: 'Force Field',
    effect: 'shieldHits',
    perLevel: 1,
    cost: [8, 14, 20],
  },
  {
    id: 'missiles',
    team: 'FUTURE',
    name: 'Missile Launcher',
    effect: 'directBonus',
    perLevel: 2,
    cost: [6, 10, 14],
  },
  {
    id: 'squad',
    team: 'FUTURE',
    name: 'Laser Squad',
    effect: 'repair',
    perLevel: 8,
    cost: [6, 10, 14],
  },
];

export const upgradesOf = (team: Team): Upgrade[] => UPGRADES.filter((u) => u.team === team);

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

/** Scrap for the next level, or null at the top level. */
export function upgradeCost(upgrade: Upgrade, level: number): number | null {
  const at = Math.floor(Number.isFinite(level) ? level : 0);
  if (at < 0 || at >= UPGRADE_MAX_LEVEL) return null;
  return upgrade.cost[at] ?? null;
}
