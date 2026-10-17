// What a team owns and has equipped, and the numbers a match uses because of it. Pure, no Phaser.
// The default loadout (starter weapon, no upgrades) gives exactly the Phase 1 numbers.
import { DAMAGE, SCRAP } from './config';
import type { Team } from './types';
import { upgradeValue, UPGRADES, type UpgradeId } from './upgrades';
import { STARTER, weaponById, weaponStats, type WeaponId } from './weapons';

export type TeamLoadout = {
  /** The weapon in use. It is always an owned weapon. */
  weapon: WeaponId;
  /** Owned weapons and the level of each (1 to 3). */
  owned: Partial<Record<WeaponId, number>>;
  /** Upgrade levels (1 to 3). Missing means level 0. */
  upgrades: Partial<Record<UpgradeId, number>>;
};

/** Everything saved at the Camp. Nothing here leaves the device. */
export type CampState = {
  scrap: Record<Team, number>;
  loadout: Record<Team, TeamLoadout>;
  /** The seed of the last match whose scrap was added, so a replay cannot add it twice. */
  creditedSeed: number | null;
};

/** What a match needs to know about one team. */
export type TeamEffects = {
  direct: number;
  near: number;
  speedScale: number;
  maxHp: number;
  /** Taken off a direct hit on this team's base (a hit never does less than 1). */
  directCut: number;
  /** Taken off a near miss on this team's base (a near miss never does less than 1). */
  nearCut: number;
  /** How many damaging hits this team's base blocks per match. */
  shieldHits: number;
  /** Added to this team's own direct hits. */
  directBonus: number;
  /** Health this base gets back at the end of its own turn. */
  repair: number;
};

export type MatchEffects = Record<Team, TeamEffects>;

export const freshLoadout = (team: Team): TeamLoadout => ({
  weapon: STARTER[team],
  owned: { [STARTER[team]]: 1 },
  upgrades: {},
});

export const freshCamp = (): CampState => ({
  scrap: { PAST: SCRAP.starting, FUTURE: SCRAP.starting },
  loadout: { PAST: freshLoadout('PAST'), FUTURE: freshLoadout('FUTURE') },
  creditedSeed: null,
});

/** The numbers for one team. An unknown weapon falls back to the starter, so it never throws. */
export function effectsFor(team: Team, loadout: TeamLoadout): TeamEffects {
  const weapon =
    weaponById(loadout.weapon)?.team === team
      ? (weaponById(loadout.weapon) as NonNullable<ReturnType<typeof weaponById>>)
      : (weaponById(STARTER[team]) as NonNullable<ReturnType<typeof weaponById>>);
  const level = loadout.owned[weapon.id] ?? 1;
  const stats = weaponStats(weapon, level);
  const total = (effect: string): number =>
    UPGRADES.filter((u) => u.team === team && u.effect === effect).reduce(
      (sum, u) => sum + upgradeValue(u, loadout.upgrades[u.id] ?? 0),
      0,
    );
  return {
    direct: stats.direct,
    near: stats.near,
    speedScale: stats.speedScale,
    maxHp: DAMAGE.startingBaseHp + total('maxHp'),
    directCut: total('directCut'),
    nearCut: total('nearCut'),
    shieldHits: total('shieldHits'),
    directBonus: total('directBonus'),
    repair: total('repair'),
  };
}

export const matchEffectsFor = (camp: CampState): MatchEffects => ({
  PAST: effectsFor('PAST', camp.loadout.PAST),
  FUTURE: effectsFor('FUTURE', camp.loadout.FUTURE),
});

/** A fresh game: every team has its starter weapon and no upgrades. Phase 1 numbers exactly. */
export const DEFAULT_EFFECTS: MatchEffects = matchEffectsFor(freshCamp());
