// Small WebAudio building blocks shared by sound effects and music. All original, no files.

type Ctx = AudioContext;

const NOISE_SECONDS = 0.6;
const NOISE_SEED = 0x5eed;
const noiseCache = new WeakMap<object, AudioBuffer | null>();

/**
 * A short buffer of white noise, made once per context. The numbers come from a seeded
 * generator, so the noise is the same every run. Null when the browser has no buffers.
 */
export function getNoise(ctx: Ctx): AudioBuffer | null {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx) ?? null;
  let buffer: AudioBuffer | null = null;
  try {
    if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
      const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
      buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let state = NOISE_SEED;
      for (let i = 0; i < data.length; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        data[i] = (state / 4294967296) * 2 - 1;
      }
    }
  } catch {
    buffer = null;
  }
  noiseCache.set(ctx, buffer);
  return buffer;
}

export type NoiseBurst = {
  filter: BiquadFilterType;
  /** Filter frequency at the start, and where it slides to by the end. */
  freq: number;
  freqEnd?: number;
  q?: number;
  seconds: number;
  peak: number;
  startAt: number;
};

/** Filtered noise with a fast-decay envelope. Does nothing when noise is unavailable. */
export function noiseBurst(ctx: Ctx, out: AudioNode, o: NoiseBurst): void {
  const buffer = getNoise(ctx);
  if (!buffer) return;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  src.buffer = buffer;
  filter.type = o.filter;
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.freq, o.startAt);
  if (o.freqEnd !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), o.startAt + o.seconds);
  }
  env.gain.setValueAtTime(0.0001, o.startAt);
  env.gain.linearRampToValueAtTime(o.peak, o.startAt + Math.min(0.008, o.seconds / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, o.startAt + o.seconds);
  src.connect(filter);
  filter.connect(env);
  env.connect(out);
  src.start(o.startAt);
  src.stop(o.startAt + o.seconds + 0.02);
}
