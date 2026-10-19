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
  /** Base-builder pieces unlocked with Scrap. The free pieces are never listed. */
  pieces?: string[];
  /** Weapons for base spots unlocked with Scrap. The free ones are never listed. */
  mounts?: string[];
};

/**
 * One player's saved progress, found by name. Scrap is one currency for the player. The weapons and
 * upgrades they own are kept for each side, so Alex has a Past kit and a Future kit.
 */
export type Wallet = {
  /** The name as the player typed it (last time). */
  name: string;
  /** Scrap to spend now. */
  scrap: number;
  /** Every Scrap this player has ever earned. It never goes down. */
  earned: number;
  loadout: Record<Team, TeamLoadout>;
};

/** Everything saved at the Camp, by player name. Nothing here leaves the device. */
export type CampState = {
  /** Keyed by walletKey(name). */
  wallets: Record<string, Wallet>;
  /** The seed of the last match whose scrap was added, so a replay cannot add it twice. */
  creditedSeed: number | null;
};

/** Names match without caring about capitals or extra spaces ("  alex" is "Alex"). */
export const walletKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

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

export const freshWallet = (name = ''): Wallet => ({
  name: name.trim(),
  scrap: SCRAP.starting,
  earned: 0,
  loadout: { PAST: freshLoadout('PAST'), FUTURE: freshLoadout('FUTURE') },
});

export const freshCamp = (): CampState => ({ wallets: {}, creditedSeed: null });

/** A player's saved progress, or a fresh wallet if they have none yet (nothing is stored). */
export const walletOf = (camp: CampState, name: string): Wallet =>
  camp.wallets[walletKey(name)] ?? freshWallet(name);

/** The camp with this wallet saved under its name. Never changes the camp it is given. */
export const withWallet = (camp: CampState, wallet: Wallet): CampState => ({
  ...camp,
  wallets: { ...camp.wallets, [walletKey(wallet.name)]: wallet },
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

/** The numbers for a match, from what each of the two players owns for the side they play. */
export const matchEffectsFor = (camp: CampState, names: Record<Team, string>): MatchEffects => ({
  PAST: effectsFor('PAST', walletOf(camp, names.PAST).loadout.PAST),
  FUTURE: effectsFor('FUTURE', walletOf(camp, names.FUTURE).loadout.FUTURE),
});

/** A fresh game: every team has its starter weapon and no upgrades. Phase 1 numbers exactly. */
export const DEFAULT_EFFECTS: MatchEffects = matchEffectsFor(freshCamp(), {
  PAST: '',
  FUTURE: '',
});
