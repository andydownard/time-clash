// Loaded before every Vitest file. Makes the whole unit run silent.
// Browser sound APIs are replaced with recorders that make no sound. Code that is handed its
// own fakes (the normal way) never touches these. If code reaches a recorder, the test fails,
// because a real run would have played sound. A test that wants to call one on purpose must
// call silentLog.take() afterwards.
import { afterEach } from 'vitest';

export type SilentCall = { api: string };

const calls: SilentCall[] = [];

export const silentLog = {
  record(api: string): void {
    calls.push({ api });
  },
  /** Returns the recorded calls and clears the log. */
  take(): SilentCall[] {
    return calls.splice(0, calls.length);
  },
};

/** Throws if anything made (or tried to make) sound since the log was last cleared. */
export function assertSilent(): void {
  const found = silentLog.take();
  if (found.length > 0) {
    throw new Error(
      `A test started real sound: ${found.map((c) => c.api).join(', ')}. ` +
        'Inject a fake instead of using the browser API.',
    );
  }
}

class SilentAudioParam {
  value = 0;
  setValueAtTime(): this {
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class SilentNode {
  gain = new SilentAudioParam();
  frequency = new SilentAudioParam();
  type = 'sine';
  connect(): this {
    return this;
  }
  disconnect(): void {}
  start(): void {}
  stop(): void {}
}

class SilentAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = new SilentNode();
  constructor() {
    silentLog.record('AudioContext');
  }
  createOscillator = (): SilentNode => new SilentNode();
  createGain = (): SilentNode => new SilentNode();
  createBiquadFilter = (): SilentNode => new SilentNode();
  async resume(): Promise<void> {
    silentLog.record('AudioContext.resume');
  }
  async close(): Promise<void> {}
}

class SilentAudio {
  volume = 1;
  src: string;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src = '') {
    this.src = src;
    silentLog.record('Audio');
  }
  async play(): Promise<void> {
    silentLog.record('Audio.play');
  }
  pause(): void {}
}

class SilentUtterance {
  rate = 1;
  volume = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text = '') {}
}

const silentSynth = {
  speaking: false,
  speak(): void {
    silentLog.record('speechSynthesis.speak');
  },
  cancel(): void {},
  getVoices: (): unknown[] => [],
};

function install(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

install('AudioContext', SilentAudioContext);
install('webkitAudioContext', SilentAudioContext);
install('Audio', SilentAudio);
install('SpeechSynthesisUtterance', SilentUtterance);
install('speechSynthesis', silentSynth);

afterEach(() => {
  assertSilent();
});
