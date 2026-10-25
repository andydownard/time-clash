// Forging a weapon of your own with Scrap, then using it like any other: equip it, level it up,
// take it into a match, and mount it on a base (data only). Every refusal changes nothing.
import { describe, expect, it } from 'vitest';
import { WORKSHOP } from '../../src/game/config';
import { customMountWeapons } from '../../src/game/customMounts';
import {
  customCost,
  customStats,
  presetFor,
  type WeaponDesign,
} from '../../src/game/customWeapons';
import { equipWeapon, forgeCustomWeapon, forgeWeapon } from '../../src/game/economy';
import {
  effectsFor,
  matchEffectsFor,
  walletOf,
  weaponFor,
  type CampState,
} from '../../src/game/loadout';
import { FORGE } from '../../src/game/weapons';
import { NAMES, campWith } from '../helpers/camp';

const SWORD: WeaponDesign = { base: 'royalSword', power: 4, reach: 1, splash: 3 };
const RIFLE: WeaponDesign = { base: 'laserRifle', power: 2, reach: 5, splash: 2 };

function forge(camp: CampState, design = SWORD, name = 'Wobbly Noodle', team = 'PAST' as const) {
  return forgeCustomWeapon(camp, NAMES[team], team, design, name);
}

describe('forgeCustomWeapon', () => {
  it('spends the Scrap, saves the weapon, owns it at level 1 and equips it', () => {
    const cost = customCost(SWORD);
    const out = forge(campWith(cost + 5));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const w = walletOf(out.camp, 'Alex');
    expect(w.scrap).toBe(5);
    expect(w.loadout.PAST.custom).toEqual([{ id: 'custom:P:1', name: 'Wobbly Noodle', ...SWORD }]);
    expect(w.loadout.PAST.owned['custom:P:1']).toBe(1);
    expect(w.loadout.PAST.weapon).toBe('custom:P:1');
    // Team Future is untouched.
    expect(w.loadout.FUTURE.custom).toBeUndefined();
  });

  it('never changes the camp it is given', () => {
    const camp = campWith(50);
    const before = JSON.stringify(camp);
    forge(camp);
    expect(JSON.stringify(camp)).toBe(before);
  });

  it('not enough Scrap: refused, nothing changes', () => {
    const out = forge(campWith(customCost(SWORD) - 1));
    expect(out).toEqual({ ok: false, reason: 'not_enough_scrap' });
  });

  it('a bad name is refused', () => {
    expect(forge(campWith(50), SWORD, 'kill zone')).toEqual({ ok: false, reason: 'bad_name' });
    expect(forge(campWith(50), SWORD, '')).toEqual({ ok: false, reason: 'bad_name' });
    expect(forge(campWith(50), SWORD, 'Alex Zapper')).toEqual({ ok: false, reason: 'bad_name' });
    expect(forge(campWith(50), SWORD, 'Zap 5551234')).toEqual({ ok: false, reason: 'bad_name' });
  });

  it('over budget or out of range is refused', () => {
    const over = { ...SWORD, power: 5, reach: 5, splash: 5 };
    expect(forge(campWith(99), over)).toEqual({ ok: false, reason: 'bad_design' });
    expect(forge(campWith(99), { ...SWORD, power: 0 })).toEqual({
      ok: false,
      reason: 'bad_design',
    });
  });

  it('the other side’s style is refused', () => {
    expect(forge(campWith(99), RIFLE)).toEqual({ ok: false, reason: 'wrong_team' });
  });

  it('an empty player name or a bad team is refused', () => {
    expect(forgeCustomWeapon(campWith(99), '  ', 'PAST', SWORD, 'Bonk')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(forgeCustomWeapon(campWith(99), 'Alex', 'MIDDLE' as 'PAST', SWORD, 'Bonk')).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('allows the same name twice, with two different ids', () => {
    let camp = campWith(99);
    for (let i = 0; i < 2; i++) {
      const out = forge(camp, SWORD, 'Bonk');
      expect(out.ok).toBe(true);
      if (out.ok) camp = out.camp;
    }
    const list = walletOf(camp, 'Alex').loadout.PAST.custom!;
    expect(list.map((c) => c.name)).toEqual(['Bonk', 'Bonk']);
    expect(new Set(list.map((c) => c.id)).size).toBe(2);
  });

  it(`stops at ${WORKSHOP.maxPerTeam} weapons per side, per player`, () => {
    let camp = campWith(999, 999);
    for (let i = 0; i < WORKSHOP.maxPerTeam; i++) {
      const out = forge(camp, SWORD, `Bonk ${i}`);
      expect(out.ok).toBe(true);
      if (out.ok) camp = out.camp;
    }
    const before = walletOf(camp, 'Alex').scrap;
    expect(forge(camp, SWORD, 'One more')).toEqual({ ok: false, reason: 'too_many' });
    expect(walletOf(camp, 'Alex').scrap).toBe(before);
    // Sam's Future side has its own room.
    expect(forgeCustomWeapon(camp, 'Sam', 'FUTURE', RIFLE, 'Zippy Taco').ok).toBe(true);
  });

  it('keeps the newest spelling of the player name, like other Scrap spends', () => {
    const out = forgeCustomWeapon(campWith(99), ' alex ', 'PAST', SWORD, 'Bonk');
    expect(out.ok && walletOf(out.camp, 'Alex').name).toBe('alex');
  });
});

describe('a custom weapon is a normal owned weapon after that', () => {
  const made = (): CampState => {
    const out = forge(campWith(100));
    if (!out.ok) throw new Error('forge failed');
    return out.camp;
  };

  it('can be equipped again after picking a catalog weapon', () => {
    const a = equipWeapon(made(), 'Alex', 'PAST', 'royalSword');
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = equipWeapon(a.camp, 'Alex', 'PAST', 'custom:P:1');
    expect(b.ok && walletOf(b.camp, 'Alex').loadout.PAST.weapon).toBe('custom:P:1');
  });

  it('cannot equip a custom id it does not own, or the other side’s', () => {
    expect(equipWeapon(made(), 'Alex', 'PAST', 'custom:P:2')).toEqual({
      ok: false,
      reason: 'not_owned',
    });
    expect(equipWeapon(made(), 'Alex', 'FUTURE', 'custom:P:1')).toEqual({
      ok: false,
      reason: 'wrong_team',
    });
    expect(equipWeapon(made(), 'Alex', 'PAST', 'custom:P:x' as 'custom:P:1')).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('levels up at the Forge like the others, to the top level', () => {
    let camp = made();
    for (let level = 2; level <= FORGE.maxLevel; level++) {
      const out = forgeWeapon(camp, 'Alex', 'PAST');
      expect(out.ok).toBe(true);
      if (out.ok) camp = out.camp;
      expect(walletOf(camp, 'Alex').loadout.PAST.owned['custom:P:1']).toBe(level);
    }
    expect(forgeWeapon(camp, 'Alex', 'PAST')).toEqual({ ok: false, reason: 'max_level' });
  });

  it('the match reads it exactly like a catalog weapon, levels included', () => {
    let camp = made();
    const base = customStats(SWORD);
    expect(matchEffectsFor(camp, NAMES).PAST).toMatchObject(base);
    const up = forgeWeapon(camp, 'Alex', 'PAST');
    if (up.ok) camp = up.camp;
    expect(matchEffectsFor(camp, NAMES).PAST).toMatchObject({
      direct: base.direct + FORGE.directPerLevel,
      near: base.near + FORGE.nearPerLevel,
      speedScale: base.speedScale,
    });
    // Team Future still uses its starter.
    expect(matchEffectsFor(camp, NAMES).FUTURE.direct).toBe(25);
  });

  it('weaponFor finds catalog and custom weapons, and nothing else', () => {
    const loadout = walletOf(made(), 'Alex').loadout.PAST;
    expect(weaponFor('PAST', loadout, 'custom:P:1')?.name).toBe('Wobbly Noodle');
    expect(weaponFor('PAST', loadout, 'elderLongbow')?.id).toBe('elderLongbow');
    expect(weaponFor('PAST', loadout, 'laserRifle')).toBeNull();
    expect(weaponFor('PAST', loadout, 'custom:P:9')).toBeNull();
    expect(weaponFor('FUTURE', loadout, 'custom:P:1')).toBeNull();
  });

  it('a loadout pointing at a missing custom weapon falls back to the starter', () => {
    const loadout = { ...walletOf(made(), 'Alex').loadout.PAST, custom: [] };
    expect(effectsFor('PAST', loadout).direct).toBe(25);
  });
});

describe('customMountWeapons (data for a later "My weapons" section in Build Base)', () => {
  it('is empty for a player with none', () => {
    expect(customMountWeapons(campWith(0), 'Alex', 'PAST')).toEqual([]);
    expect(customMountWeapons(campWith(0), 'Nobody', 'FUTURE')).toEqual([]);
  });

  it('turns each custom weapon into a mountable spot weapon, role from its style', () => {
    let camp = campWith(999, 999);
    const designs: Array<[WeaponDesign, string]> = [
      [{ base: 'royalSword', ...presetFor('royalSword') }, 'Bonk'],
      [{ base: 'elderLongbow', power: 1, reach: 5, splash: 1 }, 'Twang'],
      [{ base: 'ironCannon', power: 5, reach: 1, splash: 4 }, 'Kaboom'],
    ];
    for (const [d, n] of designs) {
      const out = forge(camp, d, n);
      if (out.ok) camp = out.camp;
    }
    const mounts = customMountWeapons(camp, 'Alex', 'PAST');
    expect(mounts).toEqual([
      {
        id: 'custom:P:1',
        team: 'PAST',
        name: 'Bonk',
        scrap: null,
        role: 'direct',
        damage: 17,
        hp: 24,
      },
      {
        id: 'custom:P:2',
        team: 'PAST',
        name: 'Twang',
        scrap: null,
        role: 'volley',
        damage: 6,
        hp: 28,
      },
      {
        id: 'custom:P:3',
        team: 'PAST',
        name: 'Kaboom',
        scrap: null,
        role: 'lob',
        damage: 23,
        hp: 20,
      },
    ]);
    expect(customMountWeapons(camp, 'Alex', 'FUTURE')).toEqual([]);
  });

  it('never makes a mount stronger than the strongest catalog spot weapon', () => {
    let camp = campWith(999);
    const out = forge(camp, { base: 'ironCannon', power: 5, reach: 1, splash: 4 }, 'Max');
    if (out.ok) camp = out.camp;
    const [m] = customMountWeapons(camp, 'Alex', 'PAST');
    expect(m!.damage).toBeLessThanOrEqual(35);
    expect(m!.hp).toBeLessThanOrEqual(40);
    expect(m!.hp).toBeGreaterThan(0);
  });
});
