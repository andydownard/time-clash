// Scrap and what it buys. Pure functions: each takes the Camp state and returns a new one, or a
// plain reason why not. Scrap never goes below zero, nothing is bought twice, and a bad input
// (wrong team, unknown id, NaN) changes nothing.
import type { CampState } from './loadout';
import type { Team } from './types';
import { TEAMS } from './types';
import { upgradeById, upgradeCost, UPGRADE_MAX_LEVEL, type UpgradeId } from './upgrades';
import { forgeCost, weaponById, type WeaponId } from './weapons';

export type Refusal =
  'unknown' | 'wrong_team' | 'already_owned' | 'not_owned' | 'max_level' | 'not_enough_scrap';

export type Outcome = { ok: true; camp: CampState } | { ok: false; reason: Refusal };

const isTeam = (t: unknown): t is Team => TEAMS.includes(t as Team);

const spend = (camp: CampState, team: Team, cost: number): CampState | null =>
  camp.scrap[team] >= cost
    ? { ...camp, scrap: { ...camp.scrap, [team]: camp.scrap[team] - cost } }
    : null;

const withLoadout = (camp: CampState, team: Team, patch: Partial<CampState['loadout'][Team]>) => ({
  ...camp,
  loadout: { ...camp.loadout, [team]: { ...camp.loadout[team], ...patch } },
});

/** Adds scrap earned in a match. Bad amounts (negative, NaN, fractions) add nothing or round down. */
export function addScrap(camp: CampState, team: Team, earned: number): CampState {
  if (!isTeam(team) || !Number.isFinite(earned) || earned <= 0) return camp;
  return { ...camp, scrap: { ...camp.scrap, [team]: camp.scrap[team] + Math.floor(earned) } };
}

/** Adds a finished match's scrap once. The same match seed again adds nothing. */
export function creditMatch(
  camp: CampState,
  seed: number,
  earned: Record<Team, number>,
): CampState {
  if (camp.creditedSeed === seed) return camp;
  let next: CampState = { ...camp, creditedSeed: seed };
  for (const team of TEAMS) next = addScrap(next, team, earned[team]);
  return next;
}

export function buyWeapon(camp: CampState, team: Team, id: WeaponId): Outcome {
  const weapon = weaponById(id);
  if (!isTeam(team) || !weapon) return { ok: false, reason: 'unknown' };
  if (weapon.team !== team) return { ok: false, reason: 'wrong_team' };
  if (camp.loadout[team].owned[id]) return { ok: false, reason: 'already_owned' };
  const paid = spend(camp, team, weapon.cost);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  const loadout = paid.loadout[team];
  return { ok: true, camp: withLoadout(paid, team, { owned: { ...loadout.owned, [id]: 1 } }) };
}

export function equipWeapon(camp: CampState, team: Team, id: WeaponId): Outcome {
  const weapon = weaponById(id);
  if (!isTeam(team) || !weapon) return { ok: false, reason: 'unknown' };
  if (weapon.team !== team) return { ok: false, reason: 'wrong_team' };
  if (!camp.loadout[team].owned[id]) return { ok: false, reason: 'not_owned' };
  return { ok: true, camp: withLoadout(camp, team, { weapon: id }) };
}

/** Raises the equipped weapon one level at the Forge. */
export function forgeWeapon(camp: CampState, team: Team): Outcome {
  if (!isTeam(team)) return { ok: false, reason: 'unknown' };
  const loadout = camp.loadout[team];
  const level = loadout.owned[loadout.weapon] ?? 1;
  const cost = forgeCost(level);
  if (cost === null) return { ok: false, reason: 'max_level' };
  const paid = spend(camp, team, cost);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  return {
    ok: true,
    camp: withLoadout(paid, team, { owned: { ...loadout.owned, [loadout.weapon]: level + 1 } }),
  };
}

/** Buys the next level of an upgrade. */
export function buyUpgrade(camp: CampState, team: Team, id: UpgradeId): Outcome {
  const upgrade = upgradeById(id);
  if (!isTeam(team) || !upgrade) return { ok: false, reason: 'unknown' };
  if (upgrade.team !== team) return { ok: false, reason: 'wrong_team' };
  const level = camp.loadout[team].upgrades[id] ?? 0;
  if (level >= UPGRADE_MAX_LEVEL) return { ok: false, reason: 'max_level' };
  const cost = upgradeCost(upgrade, level);
  if (cost === null) return { ok: false, reason: 'max_level' };
  const paid = spend(camp, team, cost);
  if (!paid) return { ok: false, reason: 'not_enough_scrap' };
  const loadout = paid.loadout[team];
  return {
    ok: true,
    camp: withLoadout(paid, team, { upgrades: { ...loadout.upgrades, [id]: level + 1 } }),
  };
}
