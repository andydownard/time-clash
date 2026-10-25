// The Forge's weapons. Pure data and arithmetic, no Phaser. Each team has three: a free starter
// that plays exactly like Phase 1 (so a fresh game is unchanged), a longer-range one, and a
// heavy one. The Forge can raise any owned weapon from level 1 to 3.
import { DAMAGE } from './config';
import type { Team } from './types';

export type WeaponId =
  'royalSword' | 'elderLongbow' | 'ironCannon' | 'plasmaBlade' | 'laserRifle' | 'railCannon';

/** A weapon made in the Weapon Workshop: "custom:" + side letter + ":" + serial (customWeapons.ts). */
export type CustomWeaponId = `custom:${string}`;
/** A catalog weapon or one of your own. */
export type AnyWeaponId = WeaponId | CustomWeaponId;

export type RangeLabel = 'short' | 'long' | 'far';

export type Weapon = {
  id: WeaponId;
  team: Team;
  name: string;
  /** Damage of a direct hit at level 1. */
  direct: number;
  /** Damage of a near miss at level 1. */
  near: number;
  /** Multiplies the launch speed, so a longer-range weapon throws farther at the same power. */
  speedScale: number;
  range: RangeLabel;
  /** Scrap to unlock. The starter is free. */
  cost: number;
};

/** The Forge's level rules. Raising an equipped weapon from level n to n + 1 costs upgradeCost[n - 1]. */
export const FORGE = {
  maxLevel: 3,
  directPerLevel: 2,
  nearPerLevel: 1,
  upgradeCost: [6, 12] as readonly number[],
} as const;

export const WEAPONS: readonly Weapon[] = [
  {
    id: 'royalSword',
    team: 'PAST',
    name: 'Royal Sword',
    direct: DAMAGE.direct,
    near: DAMAGE.near,
    speedScale: 1,
    range: 'short',
    cost: 0,
  },
  {
    id: 'elderLongbow',
    team: 'PAST',
    name: 'Elder Longbow',
    direct: 20,
    near: 10,
    speedScale: 1.1,
    range: 'long',
    cost: 12,
  },
  {
    id: 'ironCannon',
    team: 'PAST',
    name: 'Iron Cannon',
    direct: 32,
    near: 12,
    speedScale: 1.2,
    range: 'far',
    cost: 24,
  },
  {
    id: 'plasmaBlade',
    team: 'FUTURE',
    name: 'Plasma Blade',
    direct: DAMAGE.direct,
    near: DAMAGE.near,
    speedScale: 1,
    range: 'short',
    cost: 0,
  },
  {
    id: 'laserRifle',
    team: 'FUTURE',
    name: 'Laser Rifle',
    direct: 20,
    near: 10,
    speedScale: 1.1,
    range: 'long',
    cost: 12,
  },
  {
    id: 'railCannon',
    team: 'FUTURE',
    name: 'Rail Cannon',
    direct: 32,
    near: 12,
    speedScale: 1.2,
    range: 'far',
    cost: 24,
  },
];

/** Each team starts with its free weapon equipped. */
export const STARTER: Record<Team, WeaponId> = { PAST: 'royalSword', FUTURE: 'plasmaBlade' };

export const weaponsOf = (team: Team): Weapon[] => WEAPONS.filter((w) => w.team === team);

export const weaponById = (id: string): Weapon | null => WEAPONS.find((w) => w.id === id) ?? null;

/** A row in the Forge: a catalog weapon, or one of your own (`mine`) drawn like its `base` style. */
export type ForgeWeapon = Omit<Weapon, 'id'> & { id: AnyWeaponId; base: WeaponId; mine: boolean };

export const asForgeWeapon = (w: Weapon): ForgeWeapon => ({ ...w, base: w.id, mine: false });

const clampLevel = (level: number): number =>
  Math.min(FORGE.maxLevel, Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));

/** What a weapon does at a level (1 to 3). A bad level counts as level 1. */
export function weaponStats(
  weapon: Pick<Weapon, 'direct' | 'near' | 'speedScale'>,
  level: number,
): { direct: number; near: number; speedScale: number } {
  const extra = clampLevel(level) - 1;
  return {
    direct: weapon.direct + extra * FORGE.directPerLevel,
    near: weapon.near + extra * FORGE.nearPerLevel,
    speedScale: weapon.speedScale,
  };
}

/** Scrap to raise a weapon from `level` to the next, or null at the top level. */
export function forgeCost(level: number): number | null {
  const at = clampLevel(level);
  if (at >= FORGE.maxLevel) return null;
  return FORGE.upgradeCost[at - 1] ?? null;
}
