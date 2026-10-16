// Shared fakes for audio and UI tests. A manual clock replaces real timers, so tests repeat.
import type { AudioEnv } from '../../src/audio/types';

export type FakeClock = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  /** Moves time forward, firing due timers in order. */
  advance: (ms: number) => void;
  pending: () => number;
};

export function createClock(): FakeClock {
  let t = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => t,
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: t + Math.max(0, ms), fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id as number);
    },
    advance(ms) {
      const target = t + ms;
      for (;;) {
        let best: [number, { at: number; fn: () => void }] | null = null;
        for (const e of timers) {
          if (e[1].at <= target && (!best || e[1].at < best[1].at)) best = e;
        }
        if (!best) break;
        timers.delete(best[0]);
        t = Math.max(t, best[1].at);
        best[1].fn();
      }
      t = target;
    },
    pending: () => timers.size,
  };
}

type Param = {
  value: number;
  calls: Array<[string, number, number?]>;
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime: (v: number, t: number) => void;
  exponentialRampToValueAtTime: (v: number, t: number) => void;
  setTargetAtTime: (v: number, t: number, c: number) => void;
};

function makeParam(value = 0): Param {
  const p: Param = {
    value,
    calls: [],
    setValueAtTime(v, t) {
      p.calls.push(['set', v, t]);
    },
    linearRampToValueAtTime(v, t) {
      p.calls.push(['linear', v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      p.calls.push(['exp', v, t]);
    },
    setTargetAtTime(v, t) {
      p.calls.push(['target', v, t]);
    },
  };
  return p;
}

export type FakeOsc = {
  type: string;
  frequency: Param;
  started: boolean;
  stopped: boolean;
  connect: (n: unknown) => unknown;
  start: () => void;
  stop: () => void;
};

export class FakeAudioContext {
  state: 'suspended' | 'running' | 'interrupted' = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = { kind: 'destination' };
  oscillators: FakeOsc[] = [];
  gains: Array<{ gain: Param; connect: (n: unknown) => unknown }> = [];
  resumeCalls = 0;
  suspendCalls = 0;
  onstatechange: (() => void) | null = null;
  suspend() {
    this.suspendCalls++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  throwOnCreate = false;
  resume() {
    this.resumeCalls++;
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator(): FakeOsc {
    if (this.throwOnCreate) throw new Error('boom');
    const o: FakeOsc = {
      type: 'sine',
      frequency: makeParam(440),
      started: false,
      stopped: false,
      connect: (n) => n,
      start: () => void (o.started = true),
      stop: () => void (o.stopped = true),
    };
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    const g = { gain: makeParam(1), connect: (n: unknown) => n };
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: makeParam(350),
      Q: makeParam(1),
      connect: (n: unknown) => n,
    };
  }
}

export class FakeSpeech {
  spoken: Array<{
    text: string;
    lang?: string;
    voice?: unknown;
    rate?: number;
    volume?: number;
    onend: (() => void) | null;
    onerror: (() => void) | null;
  }> = [];
  /** Silent utterances (volume 0) that only unlock speech inside a tap. Not counted as speech. */
  primers: Array<FakeSpeech['spoken'][number]> = [];
  cancelCalls = 0;
  speak(u: FakeSpeech['spoken'][number]) {
    if (u.volume === 0) this.primers.push(u);
    else this.spoken.push(u);
  }
  cancel() {
    this.cancelCalls++;
  }
  /** Finishes the latest utterance the way a browser would. */
  finishLast() {
    this.spoken[this.spoken.length - 1]?.onend?.();
  }
}

export class FakeAudioElement {
  src: string;
  volume = 1;
  played = 0;
  paused = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  playResult: 'ok' | 'reject' = 'ok';
  constructor(src: string) {
    this.src = src;
  }
  play(): Promise<void> {
    this.played++;
    return this.playResult === 'ok' ? Promise.resolve() : Promise.reject(new Error('NotSupported'));
  }
  pause() {
    this.paused = true;
  }
}

export type Harness = {
  clock: FakeClock;
  env: AudioEnv;
  ctx: FakeAudioContext;
  speech: FakeSpeech;
  elements: FakeAudioElement[];
  contextsCreated: () => number;
};

export function createHarness(
  opts: {
    noContext?: boolean;
    noSpeech?: boolean;
    noElement?: boolean;
    elementResult?: 'ok' | 'reject';
  } = {},
): Harness {
  const clock = createClock();
  const ctx = new FakeAudioContext();
  const speech = new FakeSpeech();
  const elements: FakeAudioElement[] = [];
  let created = 0;
  const env: AudioEnv = {
    createAudioContext: opts.noContext
      ? () => null
      : () => {
          created++;
          return ctx as unknown as AudioContext;
        },
    createAudioElement: opts.noElement
      ? () => null
      : (src) => {
          const el = new FakeAudioElement(src);
          if (opts.elementResult) el.playResult = opts.elementResult;
          elements.push(el);
          return el as unknown as HTMLAudioElement;
        },
    speechSynthesis: opts.noSpeech ? null : (speech as unknown as SpeechSynthesis),
    createUtterance: (text) =>
      ({ text, onend: null, onerror: null }) as unknown as SpeechSynthesisUtterance,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
  };
  return { clock, env, ctx, speech, elements, contextsCreated: () => created };
}
