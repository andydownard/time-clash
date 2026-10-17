import { describe, expect, it } from 'vitest';
import { createStorage } from '../../src/storage/storage';
import { SCENE_KEYS } from '../../src/scenes/registry';
import {
  buildMatchSetup,
  controllerFrom,
  createSeedSource,
  loadAssets,
  routeAfterIntro,
  routeAfterLoading,
  routeAfterSetup,
  routeAfterTap,
  routeAfterVictory,
  victoryFrom,
} from '../../src/scenes/flow';
import { fakeController, players, stats, tinyBank } from './fakes';
import { createMatch } from '../../src/game/match';

describe('routeAfterTap', () => {
  it('goes to the intro on a first visit', () => {
    expect(routeAfterTap(createStorage(null)).key).toBe(SCENE_KEYS.intro);
  });
  it('skips the intro when it was seen', () => {
    const s = createStorage(null);
    s.set('timeclash.introSeen', true);
    expect(routeAfterTap(s)).toEqual({ key: SCENE_KEYS.loading, data: { next: SCENE_KEYS.setup } });
  });
  it('treats introSeen=false as unseen', () => {
    const s = createStorage(null);
    s.set('timeclash.introSeen', false);
    expect(routeAfterTap(s).key).toBe(SCENE_KEYS.intro);
  });
  it('treats broken storage as a first visit and never throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    expect(routeAfterTap(createStorage(throwing)).key).toBe(SCENE_KEYS.intro);
  });
});

describe('routeAfterIntro', () => {
  it('loads, then sets up', () => {
    expect(routeAfterIntro()).toEqual({
      key: SCENE_KEYS.loading,
      data: { next: SCENE_KEYS.setup },
    });
  });
});

describe('buildMatchSetup', () => {
  it('keeps both players, the seed, and Team Past first', () => {
    expect(buildMatchSetup(players, 42)).toEqual({ players, seed: 42, firstTeam: 'PAST' });
  });
  it('builds something createMatch accepts', () => {
    const m = createMatch(buildMatchSetup(players, 42));
    expect(m.snapshot().turn.team).toBe('PAST');
  });
});

describe('routeAfterLoading', () => {
  it('goes to Battle with the setup when told to', () => {
    const setup = buildMatchSetup(players, 5);
    expect(routeAfterLoading({ next: SCENE_KEYS.battle, setup })).toEqual({
      key: SCENE_KEYS.battle,
      data: setup,
    });
  });
  it('goes to Setup when told to', () => {
    expect(routeAfterLoading({ next: SCENE_KEYS.setup }).key).toBe(SCENE_KEYS.setup);
  });
  it.each([undefined, null, 7, 'x', {}, { next: 'Nope' }, { next: SCENE_KEYS.battle }])(
    'falls back to Setup for bad data %#',
    (bad) => {
      expect(routeAfterLoading(bad).key).toBe(SCENE_KEYS.setup);
    },
  );
});

describe('controllerFrom', () => {
  it('accepts a controller or a wrapper', () => {
    const c = fakeController();
    expect(controllerFrom(c)).toBe(c);
    expect(controllerFrom({ controller: c })).toBe(c);
  });
  it.each([undefined, null, 3, 'a', {}, { controller: {} }, { snapshot: 1 }])(
    'returns null for %#',
    (bad) => {
      expect(controllerFrom(bad)).toBeNull();
    },
  );
});

describe('victoryFrom', () => {
  it('reads winner, names, stats and rematch from a finished controller', () => {
    const c = fakeController({}, { players, seed: 99, firstTeam: 'FUTURE' });
    const v = victoryFrom(c)!;
    expect(v.options.winner).toBe('PAST');
    expect(v.options.names).toEqual({ PAST: 'Alex', FUTURE: 'Sam' });
    expect(v.options.stats.PAST.directHits).toBe(1);
    expect(v.rematch).toEqual({ players, seed: 99, firstTeam: 'FUTURE' });
  });
  it('accepts a wrapped controller', () => {
    expect(victoryFrom({ controller: fakeController() })!.options.winner).toBe('PAST');
  });
  it('accepts the BattleResult that BattleScene sends', () => {
    const result = {
      winner: 'FUTURE',
      names: { PAST: 'Alex', FUTURE: 'Sam' },
      stats: { PAST: stats(), FUTURE: stats() },
      rematch: { players, seed: 12, firstTeam: 'FUTURE' },
    };
    const v = victoryFrom(result)!;
    expect(v.options.winner).toBe('FUTURE');
    expect(v.rematch.seed).toBe(12);
  });
  it('is null while the match is still playing', () => {
    expect(victoryFrom(fakeController({ status: 'PLAYING', winner: null }))).toBeNull();
  });
  it('is null when there is no winner', () => {
    expect(victoryFrom(fakeController({ winner: null }))).toBeNull();
  });
  const good = {
    winner: 'PAST',
    names: { PAST: 'A', FUTURE: 'B' },
    stats: { PAST: stats(), FUTURE: stats() },
    rematch: { players, seed: 1 },
  };
  it.each([
    undefined,
    null,
    5,
    'x',
    {},
    { ...good, winner: 'NOBODY' },
    { ...good, names: { PAST: 1, FUTURE: 'B' } },
    { ...good, stats: { PAST: stats() } },
    { ...good, rematch: { players: 'x', seed: 1 } },
    { ...good, rematch: { players, seed: 'x' } },
    { ...good, rematch: null },
  ])('is null for a bad BattleResult %#', (bad) => {
    expect(victoryFrom(bad)).toBeNull();
  });
});

describe('routeAfterSetup', () => {
  it('goes to the Camp, which reads the saved players', () => {
    expect(routeAfterSetup()).toEqual({ key: SCENE_KEYS.camp });
  });
});

describe('routeAfterVictory', () => {
  it('rematch loads, then fights with the rematch options', () => {
    const rematch = { players, seed: 99, firstTeam: 'FUTURE' as const };
    expect(routeAfterVictory('rematch', rematch)).toEqual({
      key: SCENE_KEYS.loading,
      data: { next: SCENE_KEYS.battle, setup: rematch },
    });
  });
  it('Back to Camp returns to the Camp', () => {
    expect(routeAfterVictory('back-to-camp', { players, seed: 1 }).key).toBe(SCENE_KEYS.camp);
  });
});

describe('loadAssets', () => {
  it('reports rising progress that ends at 1', async () => {
    const seen: number[] = [];
    const bank = await loadAssets(
      async () => tinyBank,
      (p) => seen.push(p),
    );
    expect(bank).toBe(tinyBank);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[seen.length - 1]).toBe(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
  it('fails on an empty bank, so Retry can show', async () => {
    await expect(
      loadAssets(
        async () => ({ questions: [] }),
        () => undefined,
      ),
    ).rejects.toThrow();
  });
  it('passes a load failure up', async () => {
    await expect(
      loadAssets(
        async () => {
          throw new Error('lost');
        },
        () => undefined,
      ),
    ).rejects.toThrow('lost');
  });
});

describe('createSeedSource', () => {
  it('turns entropy into a non-negative 31-bit integer', () => {
    const s = createSeedSource(() => 0.5);
    const n = s.next();
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(2 ** 31);
  });
  it('repeats with the same entropy', () => {
    expect(createSeedSource(() => 0.25).next()).toBe(createSeedSource(() => 0.25).next());
  });
  it('can be pinned and released', () => {
    const s = createSeedSource(() => 0.5);
    s.pin(77);
    expect(s.next()).toBe(77);
    expect(s.next()).toBe(77);
    s.pin(null);
    expect(s.next()).not.toBe(77);
  });
  it('ignores a bad pin', () => {
    const s = createSeedSource(() => 0.5);
    s.pin(Number.NaN);
    s.pin(-3);
    s.pin(1.5);
    expect(s.next()).not.toBeNaN();
    expect(s.next()).toBe(createSeedSource(() => 0.5).next());
  });
});
