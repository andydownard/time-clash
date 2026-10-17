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
import { freshCamp, type CampState } from '../../src/game/loadout';
import { FORGE, weaponById } from '../../src/game/weapons';
import { upgradeById } from '../../src/game/upgrades';

const rich = (n = 100): CampState => ({ ...freshCamp(), scrap: { PAST: n, FUTURE: n } });
const camp = (o: Outcome): CampState => {
  if (!o.ok) throw new Error(`refused: ${o.reason}`);
  return o.camp;
};

describe('addScrap', () => {
  it('adds scrap to one team, rounding down', () => {
    const c = addScrap(freshCamp(), 'PAST', 3.9);
    expect(c.scrap).toEqual({ PAST: 3, FUTURE: 0 });
  });
  it.each([-5, 0, Number.NaN, Infinity, -Infinity])('adds nothing for %s', (n) => {
    const start = freshCamp();
    expect(addScrap(start, 'PAST', n)).toEqual(start);
  });
  it('adds nothing for a bad team', () => {
    const start = freshCamp();
    expect(addScrap(start, 'NOPE' as never, 3)).toEqual(start);
  });
  it('does not change the camp it was given', () => {
    const start = freshCamp();
    addScrap(start, 'PAST', 5);
    expect(start.scrap.PAST).toBe(0);
  });
});

describe('creditMatch (idempotent)', () => {
  it('adds both teams scrap once for a match seed', () => {
    const c = creditMatch(freshCamp(), 7, { PAST: 4, FUTURE: 2 });
    expect(c.scrap).toEqual({ PAST: 4, FUTURE: 2 });
    expect(c.creditedSeed).toBe(7);
  });
  it('adds nothing the second time for the same seed (a replay cannot double pay)', () => {
    const once = creditMatch(freshCamp(), 7, { PAST: 4, FUTURE: 2 });
    const twice = creditMatch(once, 7, { PAST: 4, FUTURE: 2 });
    expect(twice).toEqual(once);
  });
  it('adds again for a new seed (a rematch)', () => {
    const once = creditMatch(freshCamp(), 7, { PAST: 4, FUTURE: 2 });
    const next = creditMatch(once, 8, { PAST: 1, FUTURE: 1 });
    expect(next.scrap).toEqual({ PAST: 5, FUTURE: 3 });
  });
});

describe('buyWeapon', () => {
  it('spends the price and owns the weapon at level 1', () => {
    const w = weaponById('elderLongbow')!;
    const c = camp(buyWeapon(rich(), 'PAST', 'elderLongbow'));
    expect(c.scrap.PAST).toBe(100 - w.cost);
    expect(c.loadout.PAST.owned.elderLongbow).toBe(1);
    expect(c.scrap.FUTURE).toBe(100);
  });
  it('refuses when there is not enough scrap, and changes nothing', () => {
    const start = { ...freshCamp(), scrap: { PAST: 11, FUTURE: 0 } };
    expect(buyWeapon(start, 'PAST', 'elderLongbow')).toEqual({
      ok: false,
      reason: 'not_enough_scrap',
    });
  });
  it('refuses a second purchase of the same weapon, so scrap is never spent twice', () => {
    const once = camp(buyWeapon(rich(), 'PAST', 'elderLongbow'));
    expect(buyWeapon(once, 'PAST', 'elderLongbow')).toEqual({ ok: false, reason: 'already_owned' });
  });
  it('refuses the other team weapon, an unknown id, and a bad team', () => {
    expect(buyWeapon(rich(), 'PAST', 'laserRifle')).toEqual({ ok: false, reason: 'wrong_team' });
    expect(buyWeapon(rich(), 'PAST', 'mystery' as never)).toEqual({ ok: false, reason: 'unknown' });
    expect(buyWeapon(rich(), 'NOPE' as never, 'elderLongbow')).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
  it('refuses the free starter, which is already owned', () => {
    expect(buyWeapon(rich(), 'PAST', 'royalSword')).toEqual({ ok: false, reason: 'already_owned' });
  });
});

describe('equipWeapon', () => {
  it('equips an owned weapon', () => {
    const owned = camp(buyWeapon(rich(), 'FUTURE', 'laserRifle'));
    expect(camp(equipWeapon(owned, 'FUTURE', 'laserRifle')).loadout.FUTURE.weapon).toBe(
      'laserRifle',
    );
  });
  it('refuses one that is not owned or belongs to the other team', () => {
    expect(equipWeapon(rich(), 'FUTURE', 'laserRifle')).toEqual({ ok: false, reason: 'not_owned' });
    expect(equipWeapon(rich(), 'FUTURE', 'ironCannon')).toEqual({
      ok: false,
      reason: 'wrong_team',
    });
  });
  it('costs nothing', () => {
    const owned = camp(buyWeapon(rich(), 'FUTURE', 'laserRifle'));
    expect(camp(equipWeapon(owned, 'FUTURE', 'laserRifle')).scrap).toEqual(owned.scrap);
  });
});

describe('forgeWeapon', () => {
  it('raises the equipped weapon one level for the forge price', () => {
    const c = camp(forgeWeapon(rich(), 'PAST'));
    expect(c.loadout.PAST.owned.royalSword).toBe(2);
    expect(c.scrap.PAST).toBe(100 - FORGE.upgradeCost[0]!);
  });
  it('stops at the top level and spends nothing more', () => {
    const top = camp(forgeWeapon(camp(forgeWeapon(rich(), 'PAST')), 'PAST'));
    expect(top.loadout.PAST.owned.royalSword).toBe(3);
    expect(forgeWeapon(top, 'PAST')).toEqual({ ok: false, reason: 'max_level' });
  });
  it('refuses when there is not enough scrap', () => {
    const poor = { ...freshCamp(), scrap: { PAST: FORGE.upgradeCost[0]! - 1, FUTURE: 0 } };
    expect(forgeWeapon(poor, 'PAST')).toEqual({ ok: false, reason: 'not_enough_scrap' });
  });
  it('only changes the team that paid', () => {
    const c = camp(forgeWeapon(rich(), 'PAST'));
    expect(c.loadout.FUTURE).toEqual(rich().loadout.FUTURE);
    expect(c.scrap.FUTURE).toBe(100);
  });
});

describe('buyUpgrade', () => {
  it('buys level 1, then level 2, then level 3, each at its own price', () => {
    const u = upgradeById('tower')!;
    let c = rich();
    for (let level = 1; level <= 3; level++) {
      const before = c.scrap.PAST;
      c = camp(buyUpgrade(c, 'PAST', 'tower'));
      expect(c.loadout.PAST.upgrades.tower).toBe(level);
      expect(before - c.scrap.PAST).toBe(u.cost[level - 1]);
    }
  });
  it('stops at level 3', () => {
    let c = rich();
    for (let i = 0; i < 3; i++) c = camp(buyUpgrade(c, 'FUTURE', 'forceField'));
    expect(buyUpgrade(c, 'FUTURE', 'forceField')).toEqual({ ok: false, reason: 'max_level' });
  });
  it('refuses when poor, for the other team, an unknown id, or a bad team', () => {
    expect(buyUpgrade(freshCamp(), 'PAST', 'tower')).toEqual({
      ok: false,
      reason: 'not_enough_scrap',
    });
    expect(buyUpgrade(rich(), 'PAST', 'forceField')).toEqual({ ok: false, reason: 'wrong_team' });
    expect(buyUpgrade(rich(), 'PAST', 'mystery' as never)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(buyUpgrade(rich(), 'NOPE' as never, 'tower')).toEqual({ ok: false, reason: 'unknown' });
  });
  it('never drops scrap below zero', () => {
    const exact = { ...freshCamp(), scrap: { PAST: upgradeById('tower')!.cost[0], FUTURE: 0 } };
    expect(camp(buyUpgrade(exact, 'PAST', 'tower')).scrap.PAST).toBe(0);
  });
});
