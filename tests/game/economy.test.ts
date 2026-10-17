import { describe, expect, it } from 'vitest';
import {
  addScrap,
  buyUpgrade,
  buyWeapon,
  creditMatch,
  equipWeapon,
  forgeWeapon,
  type Outcome,
} from '../../src/game/economy';
import { freshCamp, walletKey, walletOf, type CampState } from '../../src/game/loadout';
import { FORGE, weaponById } from '../../src/game/weapons';
import { upgradeById } from '../../src/game/upgrades';
import { campWith } from '../helpers/camp';

const camp = (o: Outcome): CampState => {
  if (!o.ok) throw new Error(`refused: ${o.reason}`);
  return o.camp;
};
const alex = (c: CampState) => walletOf(c, 'Alex');

describe('names', () => {
  it('match without caring about capitals or extra spaces', () => {
    expect(walletKey('  Alex ')).toBe('alex');
    expect(walletKey('ALEX')).toBe(walletKey('alex'));
    expect(walletKey('Mary   Jane')).toBe('mary jane');
  });
  it('give a fresh wallet to a name nobody has used', () => {
    const w = walletOf(freshCamp(), 'Newbie');
    expect(w).toMatchObject({ name: 'Newbie', scrap: 0, earned: 0 });
  });
});

describe('addScrap', () => {
  it('adds Scrap to that player and to their lifetime total, rounding down', () => {
    const c = addScrap(freshCamp(), 'Alex', 3.9);
    expect(alex(c)).toMatchObject({ scrap: 3, earned: 3 });
  });
  it('keeps each name separate', () => {
    const c = addScrap(addScrap(freshCamp(), 'Alex', 4), 'Sam', 2);
    expect(alex(c).scrap).toBe(4);
    expect(walletOf(c, 'Sam').scrap).toBe(2);
  });
  it('finds the same player whatever the capitals, and keeps the newest spelling', () => {
    const c = addScrap(addScrap(freshCamp(), 'alex', 3), '  ALEX ', 2);
    expect(Object.keys(c.wallets)).toEqual(['alex']);
    expect(alex(c)).toMatchObject({ scrap: 5, earned: 5, name: 'ALEX' });
  });
  it.each([-5, 0, Number.NaN, Infinity, -Infinity])('adds nothing for %s', (n) => {
    const start = freshCamp();
    expect(addScrap(start, 'Alex', n)).toEqual(start);
  });
  it.each(['', '   '])('adds nothing for the empty name %j', (name) => {
    const start = freshCamp();
    expect(addScrap(start, name, 5)).toEqual(start);
  });
  it('does not change the camp it was given', () => {
    const start = freshCamp();
    addScrap(start, 'Alex', 5);
    expect(start.wallets).toEqual({});
  });
  it('never lowers the lifetime total when Scrap is spent', () => {
    const rich = campWith(30);
    const spent = camp(buyWeapon(rich, 'Alex', 'PAST', 'elderLongbow'));
    expect(alex(spent).scrap).toBe(18);
    expect(alex(spent).earned).toBe(30);
    expect(alex(addScrap(spent, 'Alex', 2)).earned).toBe(32);
  });
});

describe('creditMatch (idempotent)', () => {
  const earned = [
    { name: 'Alex', scrap: 4 },
    { name: 'Sam', scrap: 2 },
  ];
  it('adds each player Scrap once for a match seed', () => {
    const c = creditMatch(freshCamp(), 7, earned);
    expect(alex(c).scrap).toBe(4);
    expect(walletOf(c, 'Sam').scrap).toBe(2);
    expect(c.creditedSeed).toBe(7);
  });
  it('adds nothing the second time for the same seed (a replay cannot double pay)', () => {
    const once = creditMatch(freshCamp(), 7, earned);
    expect(creditMatch(once, 7, earned)).toEqual(once);
  });
  it('adds again for a new seed (a rematch)', () => {
    const next = creditMatch(creditMatch(freshCamp(), 7, earned), 8, [
      { name: 'Alex', scrap: 1 },
      { name: 'Sam', scrap: 1 },
    ]);
    expect(alex(next)).toMatchObject({ scrap: 5, earned: 5 });
    expect(walletOf(next, 'Sam').scrap).toBe(3);
  });
  it('gives the Scrap to the same person on either side (the name is what counts)', () => {
    const c = creditMatch(creditMatch(freshCamp(), 1, [{ name: 'Alex', scrap: 3 }]), 2, [
      { name: 'alex', scrap: 2 },
    ]);
    expect(alex(c).scrap).toBe(5);
  });
});

describe('buyWeapon', () => {
  it('spends the price and owns the weapon at level 1, for that player and side only', () => {
    const w = weaponById('elderLongbow')!;
    const c = camp(buyWeapon(campWith(100, 100), 'Alex', 'PAST', 'elderLongbow'));
    expect(alex(c).scrap).toBe(100 - w.cost);
    expect(alex(c).loadout.PAST.owned.elderLongbow).toBe(1);
    expect(alex(c).loadout.FUTURE.owned).toEqual({ plasmaBlade: 1 });
    expect(walletOf(c, 'Sam').scrap).toBe(100);
  });
  it('refuses when there is not enough Scrap, and changes nothing', () => {
    expect(buyWeapon(campWith(11), 'Alex', 'PAST', 'elderLongbow')).toEqual({
      ok: false,
      reason: 'not_enough_scrap',
    });
  });
  it('refuses a second purchase of the same weapon, so Scrap is never spent twice', () => {
    const once = camp(buyWeapon(campWith(100), 'Alex', 'PAST', 'elderLongbow'));
    expect(buyWeapon(once, 'Alex', 'PAST', 'elderLongbow')).toEqual({
      ok: false,
      reason: 'already_owned',
    });
  });
  it('refuses the other side weapon, an unknown id, a bad team, and an empty name', () => {
    const c = campWith(100);
    expect(buyWeapon(c, 'Alex', 'PAST', 'laserRifle')).toEqual({ ok: false, reason: 'wrong_team' });
    expect(buyWeapon(c, 'Alex', 'PAST', 'mystery' as never)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(buyWeapon(c, 'Alex', 'NOPE' as never, 'elderLongbow')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(buyWeapon(c, '  ', 'PAST', 'elderLongbow')).toEqual({ ok: false, reason: 'unknown' });
  });
  it('refuses the free starter, which is already owned', () => {
    expect(buyWeapon(campWith(100), 'Alex', 'PAST', 'royalSword')).toEqual({
      ok: false,
      reason: 'already_owned',
    });
  });
  it('lets one player own a different kit for each side', () => {
    const c = camp(buyWeapon(campWith(100), 'Alex', 'FUTURE', 'laserRifle'));
    expect(alex(c).loadout.FUTURE.owned.laserRifle).toBe(1);
    expect(alex(c).loadout.PAST.owned.laserRifle).toBeUndefined();
  });
  it('pays from the player who is buying, found by name in any capitals', () => {
    const c = camp(buyWeapon(campWith(100), 'ALEX', 'PAST', 'elderLongbow'));
    expect(alex(c).loadout.PAST.owned.elderLongbow).toBe(1);
  });
});

describe('equipWeapon', () => {
  it('equips an owned weapon', () => {
    const owned = camp(buyWeapon(campWith(100, 100), 'Sam', 'FUTURE', 'laserRifle'));
    const c = camp(equipWeapon(owned, 'Sam', 'FUTURE', 'laserRifle'));
    expect(walletOf(c, 'Sam').loadout.FUTURE.weapon).toBe('laserRifle');
  });
  it('refuses one that is not owned, belongs to the other side, or has no name', () => {
    expect(equipWeapon(campWith(0, 100), 'Sam', 'FUTURE', 'laserRifle')).toEqual({
      ok: false,
      reason: 'not_owned',
    });
    expect(equipWeapon(campWith(0, 100), 'Sam', 'FUTURE', 'ironCannon')).toEqual({
      ok: false,
      reason: 'wrong_team',
    });
    expect(equipWeapon(campWith(0, 100), '', 'FUTURE', 'plasmaBlade')).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
  it('costs nothing', () => {
    const owned = camp(buyWeapon(campWith(0, 100), 'Sam', 'FUTURE', 'laserRifle'));
    expect(walletOf(camp(equipWeapon(owned, 'Sam', 'FUTURE', 'laserRifle')), 'Sam').scrap).toBe(
      walletOf(owned, 'Sam').scrap,
    );
  });
});

describe('forgeWeapon', () => {
  it('raises the equipped weapon one level for the forge price', () => {
    const c = camp(forgeWeapon(campWith(100), 'Alex', 'PAST'));
    expect(alex(c).loadout.PAST.owned.royalSword).toBe(2);
    expect(alex(c).scrap).toBe(100 - FORGE.upgradeCost[0]!);
  });
  it('stops at the top level and spends nothing more', () => {
    const top = camp(forgeWeapon(camp(forgeWeapon(campWith(100), 'Alex', 'PAST')), 'Alex', 'PAST'));
    expect(alex(top).loadout.PAST.owned.royalSword).toBe(3);
    expect(forgeWeapon(top, 'Alex', 'PAST')).toEqual({ ok: false, reason: 'max_level' });
  });
  it('refuses when there is not enough Scrap, or for an empty name', () => {
    expect(forgeWeapon(campWith(FORGE.upgradeCost[0]! - 1), 'Alex', 'PAST')).toEqual({
      ok: false,
      reason: 'not_enough_scrap',
    });
    expect(forgeWeapon(campWith(100), '', 'PAST')).toEqual({ ok: false, reason: 'unknown' });
  });
  it('only changes the player who paid', () => {
    const c = camp(forgeWeapon(campWith(100, 100), 'Alex', 'PAST'));
    expect(walletOf(c, 'Sam')).toEqual(walletOf(campWith(100, 100), 'Sam'));
  });
});

describe('buyUpgrade', () => {
  it('buys level 1, then level 2, then level 3, each at its own price', () => {
    const u = upgradeById('tower')!;
    let c = campWith(100);
    for (let level = 1; level <= 3; level++) {
      const before = alex(c).scrap;
      c = camp(buyUpgrade(c, 'Alex', 'PAST', 'tower'));
      expect(alex(c).loadout.PAST.upgrades.tower).toBe(level);
      expect(before - alex(c).scrap).toBe(u.cost[level - 1]);
    }
  });
  it('stops at level 3', () => {
    let c = campWith(0, 100);
    for (let i = 0; i < 3; i++) c = camp(buyUpgrade(c, 'Sam', 'FUTURE', 'forceField'));
    expect(buyUpgrade(c, 'Sam', 'FUTURE', 'forceField')).toEqual({
      ok: false,
      reason: 'max_level',
    });
  });
  it('refuses when poor, for the other side, an unknown id, a bad team, or an empty name', () => {
    expect(buyUpgrade(freshCamp(), 'Alex', 'PAST', 'tower')).toEqual({
      ok: false,
      reason: 'not_enough_scrap',
    });
    expect(buyUpgrade(campWith(100), 'Alex', 'PAST', 'forceField')).toEqual({
      ok: false,
      reason: 'wrong_team',
    });
    expect(buyUpgrade(campWith(100), 'Alex', 'PAST', 'mystery' as never)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(buyUpgrade(campWith(100), 'Alex', 'NOPE' as never, 'tower')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(buyUpgrade(campWith(100), ' ', 'PAST', 'tower')).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
  it('never drops Scrap below zero', () => {
    const exact = campWith(upgradeById('tower')!.cost[0]);
    expect(alex(camp(buyUpgrade(exact, 'Alex', 'PAST', 'tower'))).scrap).toBe(0);
  });
});
