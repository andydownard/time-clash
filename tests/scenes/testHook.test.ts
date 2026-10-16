import { describe, expect, it } from 'vitest';
import { createSeedSource } from '../../src/scenes/flow';
import {
  createLoadFaults,
  e2eEnabled,
  installTestHook,
  type TimeClashHook,
} from '../../src/scenes/testHook';
import { createStorage } from '../../src/storage/storage';
import type { MatchController } from '../../src/game/types';
import { fakeController, players } from './fakes';

describe('e2eEnabled', () => {
  it('needs ?e2e=1 and a non-production build', () => {
    expect(e2eEnabled('?e2e=1', 'e2e')).toBe(true);
    expect(e2eEnabled('?e2e=1', 'development')).toBe(true);
  });
  it('is never on in a production build, even with the query', () => {
    expect(e2eEnabled('?e2e=1', 'production')).toBe(false);
  });
  it.each(['', '?e2e=0', '?e2e=true', '?x=1', '?e2e', '?e2e=1x'])(
    'is off without the exact query %j',
    (q) => {
      expect(e2eEnabled(q, 'development')).toBe(false);
    },
  );
  it('finds the flag among other params', () => {
    expect(e2eEnabled('?a=1&e2e=1&b=2', 'development')).toBe(true);
  });
});

describe('createLoadFaults', () => {
  it('fails exactly the requested number of loads', () => {
    const f = createLoadFaults();
    f.failNext(2);
    expect(f.take()).toBe(true);
    expect(f.take()).toBe(true);
    expect(f.take()).toBe(false);
  });
  it('ignores a bad count', () => {
    const f = createLoadFaults();
    f.failNext(-1);
    f.failNext(Number.NaN);
    expect(f.take()).toBe(false);
  });
});

describe('installTestHook', () => {
  const make = (
    over: {
      sessionMatch?: MatchController;
      search?: string;
      mode?: string;
      scenes?: Array<Record<string, unknown>>;
    } = {},
  ) => {
    const win: { __timeclash?: TimeClashHook } = {};
    const seeds = createSeedSource(() => 0.5);
    const faults = createLoadFaults();
    const storage = createStorage(null);
    const session = { match: over.sessionMatch ?? null, bank: null };
    const installed = installTestHook(win, {
      search: over.search ?? '?e2e=1',
      mode: over.mode ?? 'development',
      seeds,
      faults,
      storage,
      session,
      activeScenes: () => (over.scenes ?? []) as never,
    });
    return { win, seeds, faults, storage, installed };
  };

  it('installs nothing in production', () => {
    const t = make({ mode: 'production' });
    expect(t.installed).toBe(false);
    expect(t.win.__timeclash).toBeUndefined();
  });
  it('installs nothing without the query', () => {
    expect(make({ search: '' }).win.__timeclash).toBeUndefined();
  });
  it('lets a test pin the seed and release it', () => {
    const t = make();
    t.win.__timeclash!.setSeed(77);
    expect(t.seeds.next()).toBe(77);
    t.win.__timeclash!.setSeed(null);
    expect(t.seeds.next()).not.toBe(77);
  });
  it('lets a test fail the next loads', () => {
    const t = make();
    t.win.__timeclash!.failNextLoads(1);
    expect(t.faults.take()).toBe(true);
    expect(t.faults.take()).toBe(false);
  });
  it('reports the active scene key', () => {
    const t = make({ scenes: [{ scene: { key: 'SetupScene' } }] });
    expect(t.win.__timeclash!.scene()).toBe('SetupScene');
    expect(make().win.__timeclash!.scene()).toBeNull();
  });
  it('reads the match from the active scene controller, as a copy', () => {
    const c = fakeController({ seed: 31 });
    const t = make({ scenes: [{ scene: { key: 'BattleScene' }, controller: c }] });
    const m = t.win.__timeclash!.match()!;
    expect(m.seed).toBe(31);
    (m as { seed: number }).seed = 1;
    expect(t.win.__timeclash!.match()!.seed).toBe(31);
  });
  it('prefers the session match, which the loading step sets', () => {
    const t = make({ sessionMatch: fakeController({ seed: 5 }) });
    expect(t.win.__timeclash!.match()!.seed).toBe(5);
  });
  it('returns null when no scene has a controller', () => {
    expect(
      make({ scenes: [{ scene: { key: 'SetupScene' } }] }).win.__timeclash!.match(),
    ).toBeNull();
  });
  it('reads saved players from storage', () => {
    const t = make();
    expect(t.win.__timeclash!.players()).toBeNull();
    t.storage.set('timeclash.players', players);
    expect(t.win.__timeclash!.players()).toEqual(players);
  });
  it('does not expose the question bank or any answer', () => {
    const keys = Object.keys(make().win.__timeclash!);
    expect(keys.some((k) => /answer|question|bank/i.test(k))).toBe(false);
  });
});
