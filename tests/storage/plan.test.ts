// The Battle Plan (biome and base spot) and owned ammo survive a reload of the page, and bad data
// never gets through.
import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN } from '../../src/game/config';
import { createStorage, loadCamp, loadPlan } from '../../src/storage/storage';
import { STORAGE_KEYS } from '../../src/storage/types';

function fakeBacking(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('timeclash.plan', () => {
  it('is a known storage key', () => {
    expect(STORAGE_KEYS).toContain('timeclash.plan');
  });

  it('loads the default plan when nothing is saved', () => {
    expect(loadPlan(createStorage(fakeBacking()))).toEqual(DEFAULT_PLAN);
  });

  it('round-trips a good plan', () => {
    const s = createStorage(fakeBacking());
    s.set('timeclash.plan', { biome: 'temple', spot: 'bridge' });
    expect(loadPlan(s)).toEqual({ biome: 'temple', spot: 'bridge' });
  });

  it('fixes bad or partial data from the default plan', () => {
    const bad = (v: unknown) =>
      loadPlan(createStorage(fakeBacking({ 'timeclash.plan': JSON.stringify(v) })));
    expect(bad({ biome: 'moon', spot: 'bridge' })).toEqual({ ...DEFAULT_PLAN, spot: 'bridge' });
    expect(bad({ biome: 'cherry' })).toEqual({ ...DEFAULT_PLAN, biome: 'cherry' });
    expect(bad('nope')).toEqual(DEFAULT_PLAN);
    expect(bad(null)).toEqual(DEFAULT_PLAN);
    expect(loadPlan(createStorage(fakeBacking({ 'timeclash.plan': '{not json' })))).toEqual(
      DEFAULT_PLAN,
    );
  });

  it('never throws when storage itself throws', () => {
    const broken = {
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
    expect(loadPlan(createStorage(broken))).toEqual(DEFAULT_PLAN);
  });
});

describe('owned ammo in the saved camp', () => {
  const camp = (ammo: unknown) =>
    JSON.stringify({
      wallets: {
        alex: {
          name: 'Alex',
          scrap: 5,
          earned: 50,
          loadout: {
            PAST: { weapon: 'royalSword', owned: { royalSword: 1 }, upgrades: {}, ammo },
            FUTURE: { weapon: 'plasmaBlade', owned: { plasmaBlade: 1 }, upgrades: {} },
          },
        },
      },
      creditedSeed: null,
    });

  it('keeps real special kinds, once each', () => {
    const s = createStorage(
      fakeBacking({ 'timeclash.camp': camp(['bowling', 'confetti', 'bowling']) }),
    );
    expect(loadCamp(s).wallets.alex?.loadout.PAST.ammo).toEqual(['confetti', 'bowling']);
  });

  it('drops Standard, junk and non-lists', () => {
    const s = createStorage(fakeBacking({ 'timeclash.camp': camp(['standard', 'laser', 7]) }));
    expect(loadCamp(s).wallets.alex?.loadout.PAST.ammo ?? []).toEqual([]);
    const t = createStorage(fakeBacking({ 'timeclash.camp': camp('confetti') }));
    expect(loadCamp(t).wallets.alex?.loadout.PAST.ammo ?? []).toEqual([]);
  });

  it('an old save with no ammo field still loads', () => {
    const s = createStorage(fakeBacking({ 'timeclash.camp': camp(undefined) }));
    expect(loadCamp(s).wallets.alex?.scrap).toBe(5);
  });
});
