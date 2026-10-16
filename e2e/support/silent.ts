// Makes every browser test silent. Runs in the page before any app code.
// speechSynthesis, AudioContext, Audio and media elements are replaced with recorders that
// make no sound. The app still thinks it is playing, so its code paths are the real ones.
// Chromium also runs with --mute-audio (playwright.config.ts) as a second layer.
// Also adds window.__skew: a test can add to performance.now() to make an answer slow
// without waiting (no arbitrary sleeps).
import type { Page } from '@playwright/test';
import './globals';

export function installSilentStubs(): void {
  const w = window;
  const state = {
    log: [] as string[],
    speakCalls: 0,
    cancelCalls: 0,
    audioContexts: 0,
    audioPlays: 0,
    speaking: 0,
    playing: 0,
  };
  w.__silent = state;
  w.__skew = 0;

  const define = (target: object, name: string, value: unknown): void => {
    Object.defineProperty(target, name, { value, configurable: true, writable: true });
  };

  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const node = () => ({
    gain: param(),
    frequency: param(),
    type: 'sine',
    connect() {
      return this;
    },
    disconnect() {},
    start() {},
    stop() {},
  });
  class SilentAudioContext {
    state = 'suspended';
    currentTime = 0;
    sampleRate = 44100;
    destination = node();
    constructor() {
      state.audioContexts++;
      state.log.push('AudioContext');
    }
    createOscillator = node;
    createGain = node;
    createBiquadFilter = node;
    async resume(): Promise<void> {
      this.state = 'running';
      state.log.push('AudioContext.resume');
    }
    async close(): Promise<void> {}
  }
  define(w, 'AudioContext', SilentAudioContext);
  define(w, 'webkitAudioContext', SilentAudioContext);

  class SilentAudio {
    volume = 1;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private on = false;
    constructor(public src = '') {
      state.log.push('Audio');
    }
    async play(): Promise<void> {
      state.audioPlays++;
      state.log.push('Audio.play');
      if (!this.on) {
        this.on = true;
        state.playing++;
      }
    }
    pause(): void {
      if (this.on) {
        this.on = false;
        state.playing--;
      }
    }
  }
  define(w, 'Audio', SilentAudio);
  const media = w.HTMLMediaElement?.prototype;
  if (media) {
    define(media, 'play', async () => {
      state.audioPlays++;
      state.log.push('HTMLMediaElement.play');
    });
    define(media, 'pause', () => {});
  }

  const queue = new Set<unknown>();
  const synth = {
    get speaking() {
      return queue.size > 0;
    },
    speak(u: unknown) {
      // A silent utterance only unlocks speech inside a tap (iPad). A real browser ends it at once.
      if ((u as { volume?: number }).volume === 0) {
        state.log.push('speechSynthesis.prime');
        return;
      }
      state.speakCalls++;
      state.log.push('speechSynthesis.speak');
      queue.add(u);
      state.speaking = queue.size;
    },
    cancel() {
      state.cancelCalls++;
      queue.clear();
      state.speaking = 0;
    },
    pause() {},
    resume() {},
    getVoices: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  define(w, 'speechSynthesis', synth);

  const realNow = w.performance.now.bind(w.performance);
  w.performance.now = () => realNow() + (w.__skew ?? 0);
}

export async function installSilent(page: Page): Promise<void> {
  await page.addInitScript(installSilentStubs);
}

/** Counts of sound starts so far. */
export async function soundCounts(page: Page) {
  return page.evaluate(() => {
    const s = window.__silent!;
    return {
      speak: s.speakCalls,
      cancel: s.cancelCalls,
      contexts: s.audioContexts,
      plays: s.audioPlays,
      active: s.speaking + s.playing,
      log: [...s.log],
    };
  });
}
