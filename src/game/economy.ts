// Scrap and what it buys, by player name. Pure functions: each takes the Camp state and returns a
// new one, or a plain reason why not. Scrap never goes below zero, nothing is bought twice, and a
// bad input (wrong team, unknown id, NaN, an empty name) changes nothing.
import { ammoById, isSpecialAmmo, type AmmoId } from './ammo';
import { walletOf, withWallet, walletKey, type CampState, type Wallet } from './loadout';
import type { Team } from './types';
import { TEAMS } from './types';
import { upgradeById, upgradeCost, UPGRADE_MAX_LEVEL, type UpgradeId } from './upgrades';
import { forgeCost, weaponById, type WeaponId } from './weapons';

export type Refusal =
  'unknown' | 'wrong_team' | 'already_owned' | 'not_owned' | 'max_level' | 'not_enough_scrap';

export type Outcome = { ok: true; camp: CampState } | { ok: false; reason: Refusal };

const isTeam = (t: unknown): t is Team => TEAMS.includes(t as Team);
const hasName = (name: unknown): name is string =>
  typeof name === 'string' && walletKey(name) !== '';

/** The wallet after paying `cost`, or null if the player cannot afford it. */
const pay = (wallet: Wallet, cost: number): Wallet | null =>
  wallet.scrap >= cost ? { ...wallet, scrap: wallet.scrap - cost } : null;

const withLoadout = (
  wallet: Wallet,
  team: Team,
  patch: Partial<Wallet['loadout'][Team]>,
): Wallet => ({
  ...wallet,
  loadout: { ...wallet.loadout, [team]: { ...wallet.loadout[team], ...patch } },
});

/** Adds Scrap a player earned. Bad amounts (negative, NaN, fractions) add nothing or round down. */
export function addScrap(camp: CampState, name: string, earned: number): CampState {
  if (!hasName(name) || !Number.isFinite(earned) || earned <= 0) return camp;
  const wallet = walletOf(camp, name);
  const add = Math.floor(earned);
  // The newest spelling of the name wins, so a changed capital letter shows up.
  return withWallet(camp, {
    ...wallet,
    name: name.trim(),
    scrap: wallet.scrap + add,
    earned: wallet.earned + add,
  });
}

/** Adds a finished match's Scrap once. The same match seed again adds nothing. */
export function creditMatch(
  camp: CampState,
  seed: number,
  earned: ReadonlyArray<{ name: string; scrap: number }>,
): CampState {
  if (camp.creditedSeed === seed) return camp;
  let next: CampState = { ...camp, creditedSeed: seed };
  for (const e of earned) next = addScrap(next, e.name, e.scrap);
  return next;
}

export function buyWeapon(camp: CampState, name: string, team: Team, id: WeaponId): Outcome {
  const weapon = weaponById(id);
  if (!hasName(name) || !isTeam(team) || !weapon) return { ok: false, reason: 'unknown' };
  if (weapon.team !== team) return { ok: false, reason: 'wrong_team' };
  const wallet = walletOf(camp, name);
  if (wallet.loadout[team].owned[id]) return { ok: false, reason: 'already_owned' };
  const paid = pay(wallet, weapon.cost);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  const owned = { ...paid.loadout[team].owned, [id]: 1 };
  return {
    ok: true,
    camp: withWallet(camp, withLoadout({ ...paid, name: name.trim() }, team, { owned })),
  };
}

export function equipWeapon(camp: CampState, name: string, team: Team, id: WeaponId): Outcome {
  const weapon = weaponById(id);
  if (!hasName(name) || !isTeam(team) || !weapon) return { ok: false, reason: 'unknown' };
  if (weapon.team !== team) return { ok: false, reason: 'wrong_team' };
  const wallet = walletOf(camp, name);
  if (!wallet.loadout[team].owned[id]) return { ok: false, reason: 'not_owned' };
  return {
    ok: true,
    camp: withWallet(camp, withLoadout({ ...wallet, name: name.trim() }, team, { weapon: id })),
  };
}

/** Raises the equipped weapon one level at the Forge. */
export function forgeWeapon(camp: CampState, name: string, team: Team): Outcome {
  if (!hasName(name) || !isTeam(team)) return { ok: false, reason: 'unknown' };
  const wallet = walletOf(camp, name);
  const loadout = wallet.loadout[team];
  const level = loadout.owned[loadout.weapon] ?? 1;
  const cost = forgeCost(level);
  if (cost === null) return { ok: false, reason: 'max_level' };
  const paid = pay(wallet, cost);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  const owned = { ...loadout.owned, [loadout.weapon]: level + 1 };
  return {
    ok: true,
    camp: withWallet(camp, withLoadout({ ...paid, name: name.trim() }, team, { owned })),
  };
}

/** Buys the next level of an upgrade. */
export function buyUpgrade(camp: CampState, name: string, team: Team, id: UpgradeId): Outcome {
  const upgrade = upgradeById(id);
  if (!hasName(name) || !isTeam(team) || !upgrade) return { ok: false, reason: 'unknown' };
  if (upgrade.team !== team) return { ok: false, reason: 'wrong_team' };
  const wallet = walletOf(camp, name);
  const level = wallet.loadout[team].upgrades[id] ?? 0;
  if (level >= UPGRADE_MAX_LEVEL) return { ok: false, reason: 'max_level' };
  const cost = upgradeCost(upgrade, level);
  if (cost === null) return { ok: false, reason: 'max_level' };
  const paid = pay(wallet, cost);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  const upgrades = { ...paid.loadout[team].upgrades, [id]: level + 1 };
  return {
    ok: true,
    camp: withWallet(camp, withLoadout({ ...paid, name: name.trim() }, team, { upgrades })),
  };
}

/** Unlocks a special ammo kind for one side. Standard is free and cannot be unlocked. */
export function unlockAmmo(camp: CampState, name: string, team: Team, id: AmmoId): Outcome {
  if (!hasName(name) || !isTeam(team) || !isSpecialAmmo(id))
    return { ok: false, reason: 'unknown' };
  const ammo = ammoById(id);
  if (!ammo) return { ok: false, reason: 'unknown' };
  const wallet = walletOf(camp, name);
  const have = wallet.loadout[team].ammo ?? [];
  if (have.includes(id)) return { ok: false, reason: 'already_owned' };
  const paid = pay(wallet, ammo.cost);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  return {
    ok: true,
    camp: withWallet(
      camp,
      withLoadout({ ...paid, name: name.trim() }, team, { ammo: [...have, id] }),
    ),
  };
}
