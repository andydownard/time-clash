// Plays the background music from src/audio/musicData.ts with WebAudio.
// A small scheduler wakes every few milliseconds and books the notes due in the next
// quarter second ("lookahead"), so timing stays steady even when the page is busy.
// Rules (AGENTS.md risk 5): quiet by default, ducks under speech, stops cleanly, never throws.
import {
  FLAVORS,
  MUSIC_MIX,
  MUSIC_TEMPO,
  STEP_SEC,
  midiToHz,
  scheduleMusic,
  type Flavor,
  type MusicEvent,
} from './musicData';
import { noiseBurst } from './synthKit';

type Ctx = AudioContext;

export type MusicEnv = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
};

export interface MusicPlayer {
  readonly running: boolean;
  /** Starts the loop on this team's flavor. Does nothing if already running. */
  start(flavor: Flavor): void;
  /** Crossfades to the other flavor. Remembered if the music is not running yet. */
  setFlavor(flavor: Flavor): void;
  /** 0 to 1, from the saved volume. Clamped. NaN is ignored. */
  setLevel(level: number): void;
  /** True while a spoken line plays. */
  setDucked(ducked: boolean): void;
  /** Fades out and lets go of every node. Safe to call any time. */
  stop(): void;
}

type Run = {
  master: GainNode;
  buses: Record<Flavor, GainNode>;
  origin: number;
  nextStep: number;
  timer: unknown;
  /** Past this audio time a flavor is silent, so it is no longer scheduled. */
  liveUntil: Record<Flavor, number>;
};

const START_DELAY_SEC = 0.08;
const STOP_FADE_SEC = 0.06;
const FADE_TIME_CONSTANTS = 3;
const LFO_HZ = (MUSIC_TEMPO.bpm / 60) * 2;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function createMusicPlayer(ctx: Ctx, env: MusicEnv): MusicPlayer {
  let run: Run | null = null;
  let flavor: Flavor = 'PAST';
  let level = 1;
  let ducked = false;

  const target = (): number => MUSIC_MIX.master * level * (ducked ? MUSIC_MIX.duck : 1);

  const applyLevel = (r: Run): void => {
    try {
      r.master.gain.setTargetAtTime(target(), ctx.currentTime, MUSIC_MIX.levelTimeConstant);
    } catch {
      /* the level just stays where it was */
    }
  };

  // ---------- voices ----------

  /** One oscillator through an optional filter and a gain envelope. */
  function note(
    out: AudioNode,
    e: MusicEvent,
    type: OscillatorType,
    peak: number,
    opts: { filterHz?: number; slideFrom?: number } = {},
  ): void {
    if (e.midi === undefined) return;
    const hz = midiToHz(e.midi);
    const osc = ctx.createOscillator();
    const env_ = ctx.createGain();
    osc.type = type;
    if (opts.slideFrom !== undefined) {
      osc.frequency.setValueAtTime(hz * opts.slideFrom, e.time);
      osc.frequency.exponentialRampToValueAtTime(hz, e.time + 0.03);
    } else {
      osc.frequency.setValueAtTime(hz, e.time);
    }
    const level_ = peak * e.velocity;
    env_.gain.setValueAtTime(0.0001, e.time);
    env_.gain.linearRampToValueAtTime(level_, e.time + 0.01);
    env_.gain.exponentialRampToValueAtTime(0.0001, e.time + e.duration);
    if (opts.filterHz !== undefined) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filterHz;
      osc.connect(f);
      f.connect(env_);
    } else {
      osc.connect(env_);
    }
    env_.connect(out);
    osc.start(e.time);
    osc.stop(e.time + e.duration + 0.03);
  }

  function wobbleBass(out: AudioNode, e: MusicEvent): void {
    if (e.midi === undefined) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    const env_ = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(midiToHz(e.midi), e.time);
    filter.type = 'lowpass';
    filter.Q.value = 6;
    filter.frequency.value = 420;
    lfo.type = 'sine';
    lfo.frequency.value = LFO_HZ;
    lfoDepth.gain.value = 320;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    env_.gain.setValueAtTime(0.0001, e.time);
    env_.gain.linearRampToValueAtTime(0.5 * e.velocity, e.time + 0.01);
    env_.gain.exponentialRampToValueAtTime(0.0001, e.time + e.duration);
    osc.connect(filter);
    filter.connect(env_);
    env_.connect(out);
    osc.start(e.time);
    lfo.start(e.time);
    osc.stop(e.time + e.duration + 0.03);
    lfo.stop(e.time + e.duration + 0.03);
  }

  function drum(out: AudioNode, e: MusicEvent): void {
    if (e.track === 'kick') {
      const osc = ctx.createOscillator();
      const env_ = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, e.time);
      osc.frequency.exponentialRampToValueAtTime(45, e.time + 0.12);
      env_.gain.setValueAtTime(0.0001, e.time);
      env_.gain.linearRampToValueAtTime(0.9 * e.velocity, e.time + 0.005);
      env_.gain.exponentialRampToValueAtTime(0.0001, e.time + 0.14);
      osc.connect(env_);
      env_.connect(out);
      osc.start(e.time);
      osc.stop(e.time + 0.16);
    } else if (e.track === 'snare') {
      noiseBurst(ctx, out, {
        filter: 'highpass',
        freq: 1400,
        seconds: 0.09,
        peak: 0.45 * e.velocity,
        startAt: e.time,
      });
    } else if (e.track === 'clap') {
      noiseBurst(ctx, out, {
        filter: 'bandpass',
        freq: 1600,
        q: 1.2,
        seconds: 0.07,
        peak: 0.6 * e.velocity,
        startAt: e.time,
      });
    }
  }

  function play(e: MusicEvent, bus: GainNode, which: Flavor): void {
    switch (e.track) {
      case 'bass':
        if (e.wobble) wobbleBass(bus, e);
        else note(bus, e, 'sawtooth', 0.55, { filterHz: 520 }); // tuba-like
        break;
      case 'chord':
        note(bus, e, 'square', 0.12, { filterHz: 1800 });
        break;
      case 'lead':
        // A little upward scoop gives the squeak.
        note(bus, e, which === 'PAST' ? 'square' : 'sawtooth', 0.2, { slideFrom: 0.96 });
        break;
      case 'arp':
        note(bus, e, 'square', 0.14, { filterHz: 3200 });
        break;
      default:
        drum(bus, e);
    }
  }

  // ---------- scheduler ----------

  function tick(): void {
    const r = run;
    if (!r) return;
    try {
      const now = ctx.currentTime;
      // After a long stall (a background tab), skip ahead instead of playing old notes.
      if (r.origin + r.nextStep * STEP_SEC < now - 0.05) {
        r.nextStep = Math.max(r.nextStep, Math.ceil((now - r.origin) / STEP_SEC));
      }
      const endStep = Math.ceil((now + MUSIC_MIX.lookaheadSec - r.origin) / STEP_SEC);
      if (endStep > r.nextStep) {
        for (const f of FLAVORS) {
          if (r.liveUntil[f] <= r.origin + r.nextStep * STEP_SEC) continue;
          for (const e of scheduleMusic(f, r.origin, r.nextStep, endStep)) {
            try {
              play(e, r.buses[f], f);
            } catch {
              /* one bad note must not stop the song */
            }
          }
        }
        r.nextStep = endStep;
      }
    } catch {
      /* keep ticking */
    }
    if (run === r) r.timer = env.setTimeout(tick, MUSIC_MIX.tickMs);
  }

  // ---------- public ----------

  return {
    get running() {
      return run !== null;
    },

    start(startFlavor: Flavor): void {
      if (run) return;
      try {
        flavor = startFlavor;
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.connect(ctx.destination);
        const bus = (): GainNode => {
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, now);
          g.connect(master);
          return g;
        };
        const buses: Record<Flavor, GainNode> = { PAST: bus(), FUTURE: bus() };
        buses[flavor].gain.setValueAtTime(1, now);
        const liveUntil: Record<Flavor, number> = { PAST: 0, FUTURE: 0 };
        liveUntil[flavor] = Infinity;
        const r: Run = {
          master,
          buses,
          origin: now + START_DELAY_SEC,
          nextStep: 0,
          timer: null,
          liveUntil,
        };
        run = r;
        applyLevel(r);
        tick();
      } catch {
        run = null;
      }
    },

    setFlavor(next: Flavor): void {
      if (next === flavor) return;
      const previous = flavor;
      flavor = next;
      const r = run;
      if (!r) return;
      try {
        const now = ctx.currentTime;
        const tc = MUSIC_MIX.crossfadeSec / FADE_TIME_CONSTANTS;
        r.buses[next].gain.setTargetAtTime(1, now, tc);
        r.buses[previous].gain.setTargetAtTime(0, now, tc);
        r.liveUntil[next] = Infinity;
        r.liveUntil[previous] = now + MUSIC_MIX.crossfadeSec * 2;
      } catch {
        /* the old flavor just keeps playing */
      }
    },

    setLevel(next: number): void {
      if (typeof next !== 'number' || Number.isNaN(next)) return;
      level = clamp01(next);
      if (run) applyLevel(run);
    },

    setDucked(next: boolean): void {
      ducked = Boolean(next);
      if (run) applyLevel(run);
    },

    stop(): void {
      const r = run;
      if (!r) return;
      run = null;
      env.clearTimeout(r.timer);
      try {
        const now = ctx.currentTime;
        r.master.gain.cancelScheduledValues(now);
        r.master.gain.setTargetAtTime(0, now, STOP_FADE_SEC / FADE_TIME_CONSTANTS);
      } catch {
        /* disconnect below still silences it */
      }
      // Notes already booked sit behind the faded master. Cut the wire once the fade is done.
      env.setTimeout(
        () => {
          try {
            r.master.disconnect();
          } catch {
            /* already gone */
          }
        },
        Math.ceil((STOP_FADE_SEC + MUSIC_MIX.lookaheadSec) * 1000),
      );
    },
  };
}
