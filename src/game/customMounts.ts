// Weapons of your own as base-builder spot weapons: the "My weapons" group in Build Base's Weapons
// mode. A pad keeps its own copy of the weapon (see `Spot.mine` in baseBuilder.ts), so this turns
// a copy into a spot weapon too. Pure, no Phaser.
import type { SpotWeaponDef } from './baseBuilder';
import { WORKSHOP as W } from './config';
import { styleOf, type CustomWeapon } from './customWeapons';
import { walletOf, type CampState } from './loadout';
import type { Team } from './types';

/**
 * One custom weapon as a mountable spot weapon. It is already owned, so it costs no Scrap. `art`
 * is the catalog weapon whose picture it uses (its style), and `mine` marks it as yours.
 */
export function customMountDef(cw: CustomWeapon, team: Team): SpotWeaponDef {
  const style = styleOf(cw.base);
  const role = W.mount.roles[style];
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
    art: W.mount.art[team][style],
    mine: true,
  };
}

/** The family's custom weapons for one side, as spot weapons, in the order they were made. */
export const customMountWeapons = (camp: CampState, name: string, team: Team): SpotWeaponDef[] =>
  (walletOf(camp, name).loadout[team].custom ?? []).map((cw) => customMountDef(cw, team));
