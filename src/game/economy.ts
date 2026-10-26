// Scrap and what it buys, by player name. Pure functions: each takes the Camp state and returns a
// new one, or a plain reason why not. Scrap never goes below zero, nothing is bought twice, and a
// bad input (wrong team, unknown id, NaN, an empty name) changes nothing.
import { ammoById, isSpecialAmmo, type AmmoId } from './ammo';
import { pieceById, pieceScrap, spotWeaponById } from './baseBuilder';
import { WORKSHOP } from './config';
import {
  customCost,
  designProblem,
  isCustomWeaponId,
  nameProblem,
  nextCustomId,
  parseCustomWeaponId,
  tidyName,
  type WeaponDesign,
} from './customWeapons';
import { walletOf, weaponFor, withWallet, walletKey, type CampState, type Wallet } from './loadout';
import type { Team } from './types';
import { TEAMS } from './types';
import { forgeCost, weaponById, type AnyWeaponId, type WeaponId } from './weapons';

export type Refusal =
  | 'unknown'
  | 'wrong_team'
  | 'already_owned'
  | 'not_owned'
  | 'max_level'
  | 'not_enough_scrap'
  /** Workshop: points out of range or over the budget, or an unknown style. */
  | 'bad_design'
  /** Workshop: a name that is empty, too long, odd, blocked, or personal. */
  | 'bad_name'
  /** Workshop: this player already has WORKSHOP.maxPerTeam weapons of their own for this side. */
  | 'too_many';

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

/** Puts an owned weapon (a catalog one or one of your own) in use. */
export function equipWeapon(camp: CampState, name: string, team: Team, id: AnyWeaponId): Outcome {
  const custom = parseCustomWeaponId(id);
  const weapon = weaponById(id);
  if (!hasName(name) || !isTeam(team) || (!weapon && !custom)) {
    return { ok: false, reason: 'unknown' };
  }
  if ((weapon?.team ?? custom?.team) !== team) return { ok: false, reason: 'wrong_team' };
  const wallet = walletOf(camp, name);
  const loadout = wallet.loadout[team];
  if (!loadout.owned[id] || (isCustomWeaponId(id) && !weaponFor(team, loadout, id))) {
    return { ok: false, reason: 'not_owned' };
  }
  return {
    ok: true,
    camp: withWallet(camp, withLoadout({ ...wallet, name: name.trim() }, team, { weapon: id })),
  };
}

/**
 * Forges a weapon of your own (the Weapon Workshop). It costs Scrap by its strength, joins the
 * side's list with a fresh id (a repeated name is fine), is owned at level 1, and is put in use.
 * `weaponName` is checked again here; it never carries the player's own name.
 */
export function forgeCustomWeapon(
  camp: CampState,
  name: string,
  team: Team,
  design: WeaponDesign,
  weaponName: string,
): Outcome {
  if (!hasName(name) || !isTeam(team)) return { ok: false, reason: 'unknown' };
  const problem = designProblem(design, team);
  if (problem) return { ok: false, reason: problem };
  if (nameProblem(weaponName, [name]) !== null) return { ok: false, reason: 'bad_name' };
  const wallet = walletOf(camp, name);
  const list = wallet.loadout[team].custom ?? [];
  if (list.length >= WORKSHOP.maxPerTeam) return { ok: false, reason: 'too_many' };
  const paid = pay(wallet, customCost(design));
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  const id = nextCustomId(team, list);
  const made = {
    id,
    base: design.base,
    name: tidyName(weaponName),
    power: design.power,
    reach: design.reach,
    splash: design.splash,
  };
  return {
    ok: true,
    camp: withWallet(
      camp,
      withLoadout({ ...paid, name: name.trim() }, team, {
        custom: [...list, made],
        owned: { ...paid.loadout[team].owned, [id]: 1 },
        weapon: id,
      }),
    ),
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

/** Unlocks a weapon for base spots. Free weapons and ones already unlocked are never paid for. */
export function unlockSpotWeapon(camp: CampState, name: string, team: Team, id: string): Outcome {
  const def = spotWeaponById(id);
  if (!hasName(name) || !isTeam(team) || !def) return { ok: false, reason: 'unknown' };
  if (def.team !== team) return { ok: false, reason: 'wrong_team' };
  if (def.scrap === null) return { ok: false, reason: 'already_owned' };
  const wallet = walletOf(camp, name);
  const have = wallet.loadout[team].mounts ?? [];
  if (have.includes(id)) return { ok: false, reason: 'already_owned' };
  const paid = pay(wallet, def.scrap);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  return {
    ok: true,
    camp: withWallet(
      camp,
      withLoadout({ ...paid, name: name.trim() }, team, { mounts: [...have, id] }),
    ),
  };
}

/** Unlocks a base-builder piece. Free pieces and pieces already unlocked are never paid for. */
export function unlockPiece(camp: CampState, name: string, team: Team, id: string): Outcome {
  const def = pieceById(id);
  if (!hasName(name) || !isTeam(team) || !def) return { ok: false, reason: 'unknown' };
  if (def.team !== team) return { ok: false, reason: 'wrong_team' };
  const cost = pieceScrap(def);
  if (def.free) return { ok: false, reason: 'already_owned' };
  if (cost === null) return { ok: false, reason: 'unknown' };
  const wallet = walletOf(camp, name);
  const have = wallet.loadout[team].pieces ?? [];
  if (have.includes(id)) return { ok: false, reason: 'already_owned' };
  const paid = pay(wallet, cost);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  return {
    ok: true,
    camp: withWallet(
      camp,
      withLoadout({ ...paid, name: name.trim() }, team, { pieces: [...have, id] }),
    ),
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
