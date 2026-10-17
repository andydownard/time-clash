// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createBrowserAudioEnv, createServices } from '../../src/scenes/services';
import { createStorage, loadSettings } from '../../src/storage/storage';
import { createLoadFaults } from '../../src/scenes/testHook';
import { createSeedSource } from '../../src/scenes/flow';
import { tinyBank } from './fakes';

describe('createBrowserAudioEnv', () => {
  it('builds an env from a window without touching the network or making sound', () => {
    const created: string[] = [];
    class FakeCtx {
      constructor() {
        created.push('ctx');
      }
    }
    const win = { AudioContext: FakeCtx, speechSynthesis: { cancel: () => undefined } } as never;
    const env = createBrowserAudioEnv(win);
    expect(created).toEqual([]);
    expect(env.createAudioContext?.()).toBeInstanceOf(FakeCtx);
    expect(env.speechSynthesis).toBeTruthy();
    expect(typeof env.now()).toBe('number');
  });
  it('falls back to webkitAudioContext and then to null', () => {
    class Old {}
    expect(
      createBrowserAudioEnv({ webkitAudioContext: Old } as never).createAudioContext?.(),
    ).toBeInstanceOf(Old);
    expect(createBrowserAudioEnv({} as never).createAudioContext?.()).toBeNull();
  });
  it('returns null instead of throwing when the constructor throws', () => {
    class Bad {
      constructor() {
        throw new Error('blocked');
      }
    }
    expect(createBrowserAudioEnv({ AudioContext: Bad } as never).createAudioContext?.()).toBeNull();
  });
  it('has no speech synthesis when the window lacks it', () => {
    expect(createBrowserAudioEnv({} as never).speechSynthesis ?? null).toBeNull();
  });
  it('never speaks in a browser driven by a test tool', () => {
    const synth = { speak: () => {}, cancel: () => {} };
    const driven = createBrowserAudioEnv({
      speechSynthesis: synth,
      navigator: { webdriver: true },
    } as never);
    expect(driven.speechSynthesis).toBeNull();
    const human = createBrowserAudioEnv({
      speechSynthesis: synth,
      navigator: { webdriver: false },
    } as never);
    expect(human.speechSynthesis).toBe(synth);
  });
});

describe('createServices', () => {
  const make = (over: Partial<Parameters<typeof createServices>[0]> = {}) => {
    const storage = createStorage(null);
    const r = createServices({
      doc: document,
      win: window,
      storage,
      loadBank: async () => tinyBank,
      entropy: () => 0.25,
      ...over,
    });
    return { storage, ...r };
  };

  it('starts muted-state and captions from saved settings', () => {
    const storage = createStorage(null);
    storage.set('timeclash.settings', {
      muted: true,
      volume: 0.3,
      captions: false,
      musicOn: true,
      reducedMotion: 'on',
    });
    const { services } = make({ storage });
    expect(services.audio.muted).toBe(true);
    expect(services.audio.volume).toBeCloseTo(0.3);
    expect(services.audio.unlocked).toBe(false);
  });
  it('saves mute changes made through the audio manager', () => {
    const { services, storage } = make();
    services.audio.setMuted(true);
    expect(loadSettings(storage).muted).toBe(true);
  });
  it('mints seeds from entropy and lets the hook pin them', () => {
    const { services, seeds } = make();
    const a = services.newSeed();
    expect(a).toBe(services.newSeed());
    seeds.pin(5);
    expect(services.newSeed()).toBe(5);
  });
  it('loadBank passes through the loader', async () => {
    const { services } = make();
    await expect(services.loadBank()).resolves.toBe(tinyBank);
  });
  it('loadBank fails on demand for the e2e hook, then recovers', async () => {
    const faults = createLoadFaults();
    const { services } = make({ faults });
    faults.failNext(1);
    await expect(services.loadBank()).rejects.toThrow();
    await expect(services.loadBank()).resolves.toBe(tinyBank);
  });
  it('shares one seed source when given one', () => {
    const seeds = createSeedSource(() => 0.9);
    seeds.pin(9);
    expect(make({ seeds }).services.newSeed()).toBe(9);
  });
  it('makes no network calls', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    make();
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
