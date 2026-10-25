// Weapons of your own as base-builder spot weapons. Data only, for a later "My weapons" section in
// Build Base's Weapons mode: the builder screen does not show these yet. Pure, no Phaser.
import type { SpotWeaponDef } from './baseBuilder';
import { WORKSHOP as W } from './config';
import { styleOf, type CustomWeapon } from './customWeapons';
import { walletOf, type CampState } from './loadout';
import type { Team } from './types';

/** One custom weapon as a mountable spot weapon. It is already owned, so it costs no Scrap. */
export function customMountDef(cw: CustomWeapon, team: Team): SpotWeaponDef {
  const role = W.mount.roles[styleOf(cw.base)];
  return {
    id: cw.id,
    team,
    name: cw.name,
    scrap: null,
    role,
    damage: Math.round(
      (W.mount.damageBase + W.mount.damagePerPower * cw.power) * W.mount.roleScale[role],
    ),
    hp: W.mount.hpBase + W.mount.hpPerSparePower * (W.maxPoints - cw.power),
  };
}

/** The family's custom weapons for one side, as spot weapons, in the order they were made. */
export const customMountWeapons = (camp: CampState, name: string, team: Team): SpotWeaponDef[] =>
  (walletOf(camp, name).loadout[team].custom ?? []).map((cw) => customMountDef(cw, team));
