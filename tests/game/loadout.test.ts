import { describe, expect, it } from 'vitest';
import { DAMAGE } from '../../src/game/config';
import {
  DEFAULT_EFFECTS,
  effectsFor,
  freshCamp,
  freshLoadout,
  matchEffectsFor,
} from '../../src/game/loadout';
import {
  UPGRADES,
  upgradeCost,
  upgradeValue,
  upgradeById,
  upgradesOf,
} from '../../src/game/upgrades';
import {
  FORGE,
  STARTER,
  WEAPONS,
  forgeCost,
  weaponById,
  weaponStats,
  weaponsOf,
} from '../../src/game/weapons';

describe('weapons', () => {
  it('gives each team three weapons, a free starter first', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const list = weaponsOf(team);
      expect(list).toHaveLength(3);
      expect(list[0]!.id).toBe(STARTER[team]);
      expect(list[0]!.cost).toBe(0);
      expect(list.slice(1).every((w) => w.cost > 0)).toBe(true);
    }
  });
  it('makes the starter play exactly like Phase 1', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const w = weaponById(STARTER[team])!;
      expect(weaponStats(w, 1)).toEqual({
        direct: DAMAGE.direct,
        near: DAMAGE.near,
        speedScale: 1,
      });
    }
  });
  it('has unique ids and names, and a longer range means a faster launch', () => {
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length);
    expect(new Set(WEAPONS.map((w) => w.name)).size).toBe(WEAPONS.length);
    for (const team of ['PAST', 'FUTURE'] as const) {
      const [short, long, far] = weaponsOf(team);
      expect(short!.speedScale).toBeLessThan(long!.speedScale);
      expect(long!.speedScale).toBeLessThan(far!.speedScale);
    }
  });
  it('raises damage by a fixed step per level and clamps a bad level', () => {
    const w = weaponById('ironCannon')!;
    expect(weaponStats(w, 2).direct).toBe(w.direct + FORGE.directPerLevel);
    expect(weaponStats(w, 3).near).toBe(w.near + 2 * FORGE.nearPerLevel);
    expect(weaponStats(w, 99)).toEqual(weaponStats(w, 3));
    expect(weaponStats(w, -4)).toEqual(weaponStats(w, 1));
    expect(weaponStats(w, Number.NaN)).toEqual(weaponStats(w, 1));
  });
  it('charges for forge levels and stops at the top', () => {
    expect(forgeCost(1)).toBe(FORGE.upgradeCost[0]);
    expect(forgeCost(2)).toBe(FORGE.upgradeCost[1]);
    expect(forgeCost(3)).toBeNull();
    expect(forgeCost(9)).toBeNull();
  });
  it('finds nothing for an unknown id', () => {
    expect(weaponById('mystery')).toBeNull();
  });
});

describe('upgrades', () => {
  it('gives each team three, with rising prices', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      expect(upgradesOf(team)).toHaveLength(3);
    }
    for (const u of UPGRADES) {
      expect(u.cost[0]).toBeLessThan(u.cost[1]);
      expect(u.cost[1]).toBeLessThan(u.cost[2]);
    }
  });
  it('scales an effect by level and clamps a bad level', () => {
    const tower = upgradeById('tower')!;
    expect(upgradeValue(tower, 0)).toBe(0);
    expect(upgradeValue(tower, 2)).toBe(2 * tower.perLevel);
    expect(upgradeValue(tower, 99)).toBe(3 * tower.perLevel);
    expect(upgradeValue(tower, -1)).toBe(0);
    expect(upgradeValue(tower, Number.NaN)).toBe(0);
  });
  it('charges for the next level and stops at 3', () => {
    const gate = upgradeById('gate')!;
    expect(upgradeCost(gate, 0)).toBe(gate.cost[0]);
    expect(upgradeCost(gate, 2)).toBe(gate.cost[2]);
    expect(upgradeCost(gate, 3)).toBeNull();
    expect(upgradeCost(gate, -1)).toBeNull();
  });
});

describe('loadout effects', () => {
  it('a fresh camp has zero scrap and the starters', () => {
    const camp = freshCamp();
    expect(camp.scrap).toEqual({ PAST: 0, FUTURE: 0 });
    expect(camp.loadout.PAST).toEqual(freshLoadout('PAST'));
    expect(camp.creditedSeed).toBeNull();
  });
  it('gives Phase 1 numbers for a fresh game, so nothing changes until a family spends scrap', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      expect(DEFAULT_EFFECTS[team]).toEqual({
        direct: DAMAGE.direct,
        near: DAMAGE.near,
        speedScale: 1,
        maxHp: DAMAGE.startingBaseHp,
        directCut: 0,
        nearCut: 0,
        shieldHits: 0,
        directBonus: 0,
        repair: 0,
      });
    }
  });
  it('adds up weapon level and upgrade levels', () => {
    const loadout = {
      weapon: 'ironCannon' as const,
      owned: { royalSword: 1, ironCannon: 2 },
      upgrades: { tower: 2, wall: 1, gate: 3 },
    };
    const e = effectsFor('PAST', loadout);
    expect(e.direct).toBe(weaponById('ironCannon')!.direct + FORGE.directPerLevel);
    expect(e.speedScale).toBe(weaponById('ironCannon')!.speedScale);
    expect(e.maxHp).toBe(DAMAGE.startingBaseHp + 2 * upgradeById('tower')!.perLevel);
    expect(e.directCut).toBe(upgradeById('wall')!.perLevel);
    expect(e.nearCut).toBe(3 * upgradeById('gate')!.perLevel);
  });
  it('ignores a weapon from the other team or an unknown weapon (falls back to the starter)', () => {
    const wrong = { ...freshLoadout('PAST'), weapon: 'plasmaBlade' as const };
    expect(effectsFor('PAST', wrong)).toEqual(DEFAULT_EFFECTS.PAST);
    const unknown = { ...freshLoadout('PAST'), weapon: 'mystery' as never };
    expect(effectsFor('PAST', unknown)).toEqual(DEFAULT_EFFECTS.PAST);
  });
  it('ignores upgrades that belong to the other team', () => {
    const loadout = { ...freshLoadout('PAST'), upgrades: { forceField: 3, missiles: 3 } };
    expect(effectsFor('PAST', loadout)).toEqual(DEFAULT_EFFECTS.PAST);
  });
  it('builds both teams from a camp', () => {
    expect(matchEffectsFor(freshCamp())).toEqual(DEFAULT_EFFECTS);
  });
});
