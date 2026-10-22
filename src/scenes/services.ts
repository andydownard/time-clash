// Builds the services every scene shares. Browser pieces are injected so tests can fake them.
import { createAudioManager } from '../audio/audioManager';
import { createClipPlayer } from '../audio/clipPlayer';
import type { AudioEnv } from '../audio/types';
import { practiceEnabled } from '../game/practice';
import { createStorage, loadSettings, saveAudioSettings } from '../storage/storage';
import type { TypedStorage } from '../storage/types';
import type { QuestionBank } from '../questions/types';
import { createOverlay } from '../ui/overlay';
import type { LoadingEnv } from '../ui/loadingLogic';
import { createHowToPlay } from './chrome';
import { createSeedSource, type SeedSource } from './flow';
import type { AppServices } from './registry';
import { createFlags, createLoadFaults, type LoadFaults, type TestFlags } from './testHook';

type AudioWindow = Partial<
  Pick<Window, 'speechSynthesis' | 'setTimeout' | 'clearTimeout' | 'performance'>
> & {
  navigator?: Pick<Navigator, 'webdriver'>;
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
};

/**
 * A browser driven by a test tool (navigator.webdriver) never speaks. The system voice ignores
 * Chromium's --mute-audio, so a scripted run would read the intro aloud on the owner's computer.
 */
const isAutomated = (win: AudioWindow): boolean => win.navigator?.webdriver === true;

/** Nothing here makes sound. The AudioManager only calls these after the first tap. */
export function createBrowserAudioEnv(win: AudioWindow, voice = false): AudioEnv {
  return {
    // Spoken clips come from the app server (same origin) only in a build made with VITE_VOICE=on.
    clips: createClipPlayer(voice),
    createAudioContext: () => {
      const Ctor = win.AudioContext ?? win.webkitAudioContext;
      if (!Ctor) return null;
      try {
        return new Ctor();
      } catch {
        return null;
      }
    },
    createAudioElement: (src) => {
      try {
        return new Audio(src);
      } catch {
        return null;
      }
    },
    speechSynthesis: isAutomated(win) ? null : (win.speechSynthesis ?? null),
    createUtterance: (text) => new SpeechSynthesisUtterance(text),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as number),
    now: () => (win.performance ?? performance).now(),
  };
}

export type ServiceOptions = {
  doc: Document;
  win: AudioWindow;
  storage?: TypedStorage;
  loadBank?: () => Promise<QuestionBank>;
  entropy?: () => number;
  seeds?: SeedSource;
  faults?: LoadFaults;
  /** The page address query (`?computer=1` shows the Computer player choice). */
  search?: string;
  /** Ask the app server for spoken clips. Default: the build flag VITE_VOICE=on. */
  voice?: boolean;
};

const defaultLoadBank = async (): Promise<QuestionBank> => (await import('../questions/bank')).BANK;

const randomEntropy = (): number => {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return (a[0] ?? 0) / 2 ** 32;
  } catch {
    return Math.random();
  }
};

export function createServices(opts: ServiceOptions): {
  services: AppServices;
  seeds: SeedSource;
  faults: LoadFaults;
  flags: TestFlags;
} {
  const storage = opts.storage ?? createStorage();
  const settings = loadSettings(storage);
  const audio = createAudioManager(
    createBrowserAudioEnv(opts.win, opts.voice ?? import.meta.env.VITE_VOICE === 'on'),
    { muted: settings.muted, volume: settings.volume, musicOn: settings.musicOn },
    (state) => saveAudioSettings(storage, state),
  );
  const overlay = createOverlay(opts.doc, { audio, storage });
  const seeds = opts.seeds ?? createSeedSource(opts.entropy ?? randomEntropy);
  const faults = opts.faults ?? createLoadFaults();
  const flags = createFlags();
  const realLoad = opts.loadBank ?? defaultLoadBank;
  const env: LoadingEnv = {
    now: () => (opts.win.performance ?? performance).now(),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as number),
  };
  const services: AppServices = {
    overlay,
    audio,
    storage,
    env,
    howTo: createHowToPlay({ overlay, audio, env }),
    session: { match: null, bank: null },
    loadBank: async () => {
      if (faults.take()) throw new Error('Test hook: this load was told to fail.');
      return realLoad();
    },
    newSeed: () => seeds.next(),
    computerPlayer: practiceEnabled(opts.search ?? ''),
    flags,
  };
  return { services, seeds, faults, flags };
}
