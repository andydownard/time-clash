// Weapons of your own in the saved camp: an additive field. Old saves load unchanged, a clean list
// round-trips, and a corrupt entry is dropped (never a crash).
import { describe, expect, it } from 'vitest';
import { forgeCustomWeapon, forgeWeapon } from '../../src/game/economy';
import { freshCamp, walletOf, type CampState } from '../../src/game/loadout';
import { createStorage, loadCamp } from '../../src/storage/storage';
import { campWith } from '../helpers/camp';

function backing(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}
const KEY = 'timeclash.camp';
const load = (value: unknown): CampState =>
  loadCamp(createStorage(backing({ [KEY]: JSON.stringify(value) })));
const roundTrip = (camp: CampState): CampState => {
  const b = backing();
  createStorage(b).set(KEY, camp);
  return loadCamp(createStorage(b));
};

const entry = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `custom:P:${n}`,
  base: 'ironCannon',
  name: `Kaboom ${n}`,
  power: 2,
  reach: 2,
  splash: 4,
  ...extra,
});
const oldSave = {
  wallets: {
    alex: {
      name: 'Alex',
      scrap: 9,
      earned: 30,
      loadout: {
        PAST: { weapon: 'elderLongbow', owned: { royalSword: 1, elderLongbow: 2 }, upgrades: {} },
        FUTURE: { weapon: 'plasmaBlade', owned: { plasmaBlade: 1 }, upgrades: {} },
      },
    },
  },
  creditedSeed: 4,
};

describe('custom weapons in the saved camp', () => {
  it('an old save with no custom field loads unchanged, with no custom field added', () => {
    const camp = load(oldSave);
    const w = walletOf(camp, 'Alex');
    expect(w.loadout.PAST).toEqual(oldSave.wallets.alex.loadout.PAST);
    expect(w.loadout.PAST.custom).toBeUndefined();
    expect(w.scrap).toBe(9);
  });

  it('a forged, equipped and levelled custom weapon survives a reload', () => {
    let camp = campWith(99);
    const made = forgeCustomWeapon(
      camp,
      'Alex',
      'PAST',
      { base: 'ironCannon', power: 2, reach: 2, splash: 4 },
      'Kaboom',
    );
    if (made.ok) camp = made.camp;
    const up = forgeWeapon(camp, 'Alex', 'PAST');
    if (up.ok) camp = up.camp;
    const back = roundTrip(camp);
    expect(back).toEqual(camp);
    expect(walletOf(back, 'Alex').loadout.PAST.weapon).toBe('custom:P:1');
    expect(walletOf(back, 'Alex').loadout.PAST.owned['custom:P:1']).toBe(2);
  });

  it('drops a corrupt entry, keeps the good ones, and never throws', () => {
    const save = structuredClone(oldSave) as unknown as {
      wallets: { alex: { loadout: { PAST: Record<string, unknown> } } };
    };
    save.wallets.alex.loadout.PAST.custom = [
      entry(1),
      { ...entry(2), power: 99 },
      { ...entry(3), id: 'royalSword' },
      'junk',
      null,
      entry(4),
    ];
    save.wallets.alex.loadout.PAST.owned = {
      royalSword: 1,
      'custom:P:1': 3,
      'custom:P:2': 1,
      'custom:P:4': 7,
      'custom:P:9': 1,
    };
    save.wallets.alex.loadout.PAST.weapon = 'custom:P:4';
    const pastKit = walletOf(load(save), 'Alex').loadout.PAST;
    expect(pastKit.custom!.map((c) => c.id)).toEqual(['custom:P:1', 'custom:P:4']);
    // A level out of range is mended to 1, a level for a dropped weapon is dropped.
    expect(pastKit.owned).toEqual({ royalSword: 1, 'custom:P:1': 3, 'custom:P:4': 1 });
    expect(pastKit.weapon).toBe('custom:P:4');
  });

  it('an equipped custom weapon that was dropped falls back to the starter', () => {
    const save = structuredClone(oldSave) as unknown as {
      wallets: { alex: { loadout: { PAST: Record<string, unknown> } } };
    };
    save.wallets.alex.loadout.PAST.custom = [{ ...entry(1), name: 'kill zone' }];
    save.wallets.alex.loadout.PAST.owned = { royalSword: 1, 'custom:P:1': 1 };
    save.wallets.alex.loadout.PAST.weapon = 'custom:P:1';
    const pastKit = walletOf(load(save), 'Alex').loadout.PAST;
    expect(pastKit.custom).toBeUndefined();
    expect(pastKit.owned).toEqual({ royalSword: 1 });
    expect(pastKit.weapon).toBe('royalSword');
  });

  it('a custom weapon saved on the wrong side is dropped there', () => {
    const save = structuredClone(oldSave) as unknown as {
      wallets: { alex: { loadout: { FUTURE: Record<string, unknown> } } };
    };
    save.wallets.alex.loadout.FUTURE.custom = [entry(1)];
    save.wallets.alex.loadout.FUTURE.weapon = 'custom:P:1';
    const futureKit = walletOf(load(save), 'Alex').loadout.FUTURE;
    expect(futureKit.custom).toBeUndefined();
    expect(futureKit.weapon).toBe('plasmaBlade');
  });

  it('a custom list that is not a list is ignored', () => {
    const save = structuredClone(oldSave) as unknown as {
      wallets: { alex: { loadout: { PAST: Record<string, unknown> } } };
    };
    save.wallets.alex.loadout.PAST.custom = { 0: entry(1) };
    expect(walletOf(load(save), 'Alex').loadout.PAST.custom).toBeUndefined();
    expect(load({ wallets: {}, creditedSeed: null })).toEqual(freshCamp());
  });
});
