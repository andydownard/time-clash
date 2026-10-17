import { describe, expect, it } from 'vitest';
import {
  freshCamp,
  freshLoadout,
  freshWallet,
  walletOf,
  withWallet,
  type CampState,
} from '../../src/game/loadout';
import { adoptLegacy, clearMyData, createStorage, loadCamp } from '../../src/storage/storage';
import type { BackingStore } from '../../src/storage/types';
import type { Players } from '../../src/game/types';

function fakeBacking(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
    data,
  };
}

const KEY = 'timeclash.camp';
const saved = (value: unknown, extra: Record<string, string> = {}) =>
  fakeBacking({ [KEY]: JSON.stringify(value), ...extra });
const alex = (c: CampState) => walletOf(c, 'Alex');

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'math' },
];
const playersJson = JSON.stringify(PLAYERS);

describe('the saved camp, by player name', () => {
  it('is a fresh camp when nothing is saved', () => {
    expect(loadCamp(createStorage(fakeBacking()))).toEqual(freshCamp());
  });

  it('saves and reads back each name with Scrap, lifetime Scrap, kits and the credited seed', () => {
    const camp = withWallet(
      withWallet(freshCamp(), {
        ...freshWallet('Alex'),
        scrap: 12,
        earned: 40,
        loadout: {
          PAST: {
            weapon: 'elderLongbow',
            owned: { royalSword: 1, elderLongbow: 2 },
            upgrades: { tower: 2 },
          },
          FUTURE: freshLoadout('FUTURE'),
        },
      }),
      { ...freshWallet('Sam'), scrap: 3, earned: 3 },
    );
    const withSeed = { ...camp, creditedSeed: 41 };
    const store = createStorage(fakeBacking());
    expect(store.set(KEY, withSeed)).toBe(true);
    expect(loadCamp(store)).toEqual(withSeed);
  });

  it('survives a reload (it really reaches the backing store)', () => {
    const backing = fakeBacking();
    createStorage(backing).set(
      KEY,
      withWallet(freshCamp(), { ...freshWallet('Alex'), scrap: 5, earned: 5 }),
    );
    expect(alex(loadCamp(createStorage(backing))).scrap).toBe(5);
  });

  it.each(['not json', '[]', '7', 'null', '"x"'])('falls back to a fresh camp for %s', (raw) => {
    expect(loadCamp(createStorage(fakeBacking({ [KEY]: raw })))).toEqual(freshCamp());
  });

  it('never throws when storage is blocked, and still works in memory', () => {
    const blocked: BackingStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createStorage(blocked);
    expect(loadCamp(store)).toEqual(freshCamp());
    const camp = withWallet(freshCamp(), { ...freshWallet('Alex'), scrap: 2, earned: 2 });
    expect(store.set(KEY, camp)).toBe(false);
    expect(alex(loadCamp(store)).scrap).toBe(2);
  });

  it('cleans bad numbers: negative, fractional, huge and text Scrap', () => {
    const wallets = {
      alex: { name: 'Alex', scrap: -5, earned: 'lots', loadout: {} },
      sam: { name: 'Sam', scrap: 3.5, earned: 1e12, loadout: {} },
      mia: { name: 'Mia', scrap: 1e12, earned: 2, loadout: {} },
    };
    const camp = loadCamp(createStorage(saved({ wallets, creditedSeed: 'x' })));
    expect(camp.creditedSeed).toBeNull();
    expect(alex(camp)).toMatchObject({ scrap: 0, earned: 0 });
    expect(walletOf(camp, 'Sam')).toMatchObject({ scrap: 0, earned: 0 });
    expect(walletOf(camp, 'Mia')).toMatchObject({ scrap: 0, earned: 2 });
  });

  it('never shows lifetime Scrap below the Scrap in hand', () => {
    const wallets = { alex: { name: 'Alex', scrap: 30, earned: 5, loadout: {} } };
    expect(alex(loadCamp(createStorage(saved({ wallets, creditedSeed: null })))).earned).toBe(30);
  });

  it('rebuilds the key from the name, so a hand-edited key cannot make a second pile', () => {
    const wallets = { 'WRONG KEY': { name: 'Alex', scrap: 9, earned: 9, loadout: {} } };
    const camp = loadCamp(createStorage(saved({ wallets, creditedSeed: null })));
    expect(Object.keys(camp.wallets)).toEqual(['alex']);
    expect(alex(camp).scrap).toBe(9);
  });

  it('drops a wallet with no usable name', () => {
    const wallets = { '': { name: '   ', scrap: 9, earned: 9, loadout: {} } };
    expect(loadCamp(createStorage(saved({ wallets, creditedSeed: null }))).wallets).toEqual({});
  });

  it('drops weapons from the other side and unknown ones, and keeps the starter owned', () => {
    const wallets = {
      alex: {
        name: 'Alex',
        scrap: 1,
        earned: 1,
        loadout: {
          PAST: {
            weapon: 'laserRifle',
            owned: { laserRifle: 2, mystery: 3, ironCannon: 9 },
            upgrades: { forceField: 2, tower: 7, wall: 2 },
          },
          FUTURE: { weapon: 'plasmaBlade', owned: {}, upgrades: {} },
        },
      },
    };
    const w = alex(loadCamp(createStorage(saved({ wallets, creditedSeed: null }))));
    expect(w.loadout.PAST.weapon).toBe('royalSword');
    expect(w.loadout.PAST.owned).toEqual({ royalSword: 1 });
    expect(w.loadout.PAST.upgrades).toEqual({ wall: 2 });
    expect(w.loadout.FUTURE.owned).toEqual({ plasmaBlade: 1 });
  });

  it('will not equip a weapon that is not owned', () => {
    const wallets = {
      alex: {
        name: 'Alex',
        scrap: 0,
        earned: 0,
        loadout: { PAST: { weapon: 'ironCannon', owned: { royalSword: 1 }, upgrades: {} } },
      },
    };
    const w = alex(loadCamp(createStorage(saved({ wallets, creditedSeed: null }))));
    expect(w.loadout.PAST.weapon).toBe('royalSword');
  });

  it('is wiped by Clear my data', () => {
    const backing = fakeBacking();
    const store = createStorage(backing);
    store.set(KEY, withWallet(freshCamp(), { ...freshWallet('Alex'), scrap: 9, earned: 9 }));
    expect(backing.data.has(KEY)).toBe(true);
    clearMyData(store);
    expect(backing.data.has(KEY)).toBe(false);
    expect(loadCamp(store)).toEqual(freshCamp());
  });
});

describe('moving an old save (one pile of Scrap per team) onto player names', () => {
  const old = {
    scrap: { PAST: 12, FUTURE: 7 },
    loadout: {
      PAST: {
        weapon: 'elderLongbow',
        owned: { royalSword: 1, elderLongbow: 2 },
        upgrades: { tower: 1 },
      },
      FUTURE: { weapon: 'plasmaBlade', owned: { plasmaBlade: 1 }, upgrades: { forceField: 2 } },
    },
    creditedSeed: 5,
  };

  it('gives each team Scrap and kit to the current player on that side', () => {
    const camp = loadCamp(createStorage(saved(old, { 'timeclash.players': playersJson })));
    expect(alex(camp)).toMatchObject({ scrap: 12, earned: 12 });
    expect(alex(camp).loadout.PAST.owned).toEqual({ royalSword: 1, elderLongbow: 2 });
    expect(alex(camp).loadout.PAST.upgrades).toEqual({ tower: 1 });
    expect(walletOf(camp, 'Sam')).toMatchObject({ scrap: 7, earned: 7 });
    expect(walletOf(camp, 'Sam').loadout.FUTURE.upgrades).toEqual({ forceField: 2 });
    expect(camp.creditedSeed).toBe(5);
    expect(Object.keys(camp.wallets).sort()).toEqual(['alex', 'sam']);
  });

  it('saves the move at once, so a later name change cannot take the Scrap with it', () => {
    const backing = saved(old, { 'timeclash.players': playersJson });
    const store = createStorage(backing);
    loadCamp(store);
    const onDisk = JSON.parse(backing.data.get(KEY) as string);
    expect(Object.keys(onDisk.wallets).sort()).toEqual(['alex', 'sam']);
    expect(onDisk.scrap).toBeUndefined();
    // Alex now plays under another name: the old pile stays with Alex.
    store.set('timeclash.players', [
      { ...PLAYERS[0], name: 'Mia' },
      PLAYERS[1],
    ] as unknown as Players);
    const camp = loadCamp(store);
    expect(alex(camp).scrap).toBe(12);
    expect(walletOf(camp, 'Mia').scrap).toBe(0);
  });

  it('keeps it safe, waiting for names, when no players are saved yet', () => {
    const camp = loadCamp(createStorage(saved(old)));
    expect(Object.values(camp.wallets).reduce((n, w) => n + w.scrap, 0)).toBe(19);
    // Once the names are known the Scrap moves over.
    expect(alex(adoptLegacy(camp, PLAYERS)).scrap).toBe(12);
  });

  it('adds to a name that already has Scrap, and never loses any', () => {
    const legacy = loadCamp(createStorage(saved(old)));
    const mine = withWallet(freshCamp(), { ...freshWallet('Alex'), scrap: 3, earned: 10 });
    const merged = adoptLegacy(
      { ...legacy, wallets: { ...legacy.wallets, ...mine.wallets } },
      PLAYERS,
    );
    expect(alex(merged)).toMatchObject({ scrap: 15, earned: 22 });
  });

  it('does nothing to a camp already saved by name', () => {
    const camp = withWallet(freshCamp(), { ...freshWallet('Alex'), scrap: 3, earned: 3 });
    expect(adoptLegacy(camp, PLAYERS)).toBe(camp);
  });

  it('does nothing without players', () => {
    const camp = loadCamp(createStorage(saved(old)));
    expect(adoptLegacy(camp, null)).toBe(camp);
  });
});
