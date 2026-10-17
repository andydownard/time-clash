import { describe, expect, it } from 'vitest';
import { freshCamp, freshLoadout } from '../../src/game/loadout';
import { clearMyData, createStorage, loadCamp } from '../../src/storage/storage';
import type { BackingStore } from '../../src/storage/types';

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
const saved = (value: unknown) => fakeBacking({ [KEY]: JSON.stringify(value) });

describe('the saved camp', () => {
  it('is a fresh camp when nothing is saved', () => {
    expect(loadCamp(createStorage(fakeBacking()))).toEqual(freshCamp());
  });

  it('saves and reads back scrap, weapons, upgrades and the credited seed', () => {
    const camp = {
      scrap: { PAST: 12, FUTURE: 3 },
      loadout: {
        PAST: {
          weapon: 'elderLongbow' as const,
          owned: { royalSword: 1, elderLongbow: 2 },
          upgrades: { tower: 2 },
        },
        FUTURE: freshLoadout('FUTURE'),
      },
      creditedSeed: 41,
    };
    const store = createStorage(fakeBacking());
    expect(store.set(KEY, camp)).toBe(true);
    expect(loadCamp(store)).toEqual(camp);
  });

  it('survives a reload (it really reaches the backing store)', () => {
    const backing = fakeBacking();
    createStorage(backing).set(KEY, { ...freshCamp(), scrap: { PAST: 5, FUTURE: 0 } });
    expect(loadCamp(createStorage(backing)).scrap.PAST).toBe(5);
  });

  it.each(['not json', '[]', '7', 'null', '"x"'])('falls back to a fresh camp for %s', (raw) => {
    const store = createStorage(fakeBacking({ [KEY]: raw }));
    expect(loadCamp(store)).toEqual(freshCamp());
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
    expect(store.set(KEY, { ...freshCamp(), scrap: { PAST: 2, FUTURE: 0 } })).toBe(false);
    expect(loadCamp(store).scrap.PAST).toBe(2);
  });

  it('cleans bad numbers: negative, fractional, huge and text scrap', () => {
    const base = freshCamp();
    const camp = loadCamp(
      createStorage(saved({ ...base, scrap: { PAST: -5, FUTURE: 3.5 }, creditedSeed: 'x' })),
    );
    expect(camp.scrap).toEqual({ PAST: 0, FUTURE: 0 });
    expect(camp.creditedSeed).toBeNull();
    const huge = loadCamp(createStorage(saved({ ...base, scrap: { PAST: 1e12, FUTURE: 9 } })));
    expect(huge.scrap).toEqual({ PAST: 0, FUTURE: 9 });
  });

  it('drops weapons from the other team and unknown ones, and keeps the starter owned', () => {
    const camp = loadCamp(
      createStorage(
        saved({
          ...freshCamp(),
          loadout: {
            PAST: {
              weapon: 'laserRifle',
              owned: { laserRifle: 2, mystery: 3, ironCannon: 9 },
              upgrades: { forceField: 2, tower: 7, wall: 2 },
            },
            FUTURE: { weapon: 'plasmaBlade', owned: {}, upgrades: {} },
          },
        }),
      ),
    );
    expect(camp.loadout.PAST.weapon).toBe('royalSword');
    expect(camp.loadout.PAST.owned).toEqual({ royalSword: 1 });
    expect(camp.loadout.PAST.upgrades).toEqual({ wall: 2 });
    expect(camp.loadout.FUTURE.owned).toEqual({ plasmaBlade: 1 });
  });

  it('will not equip a weapon that is not owned', () => {
    const camp = loadCamp(
      createStorage(
        saved({
          ...freshCamp(),
          loadout: {
            PAST: { weapon: 'ironCannon', owned: { royalSword: 1 }, upgrades: {} },
            FUTURE: freshLoadout('FUTURE'),
          },
        }),
      ),
    );
    expect(camp.loadout.PAST.weapon).toBe('royalSword');
  });

  it('is wiped by Clear my data', () => {
    const backing = fakeBacking();
    const store = createStorage(backing);
    store.set(KEY, { ...freshCamp(), scrap: { PAST: 9, FUTURE: 9 } });
    expect(backing.data.has(KEY)).toBe(true);
    clearMyData(store);
    expect(backing.data.has(KEY)).toBe(false);
    expect(loadCamp(store)).toEqual(freshCamp());
  });
});
