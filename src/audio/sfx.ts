// Sound effects made in code with WebAudio. Original by construction: no files, no licenses.
import { noiseBurst } from './synthKit';
import type { SfxName } from './types';

type Ctx = AudioContext;

/** One oscillator with a gain envelope. `freqs` are [value, secondsFromStart] steps. */
function voice(
  ctx: Ctx,
  out: AudioNode,
  type: OscillatorType,
  steps: ReadonlyArray<readonly [number, number]>,
  seconds: number,
  peak: number,
  startAt: number,
  ramp: 'exp' | 'linear' = 'exp',
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  const first = steps[0];
  if (!first) return;
  osc.frequency.setValueAtTime(first[0], startAt + first[1]);
  for (const [f, t] of steps.slice(1)) {
    if (ramp === 'exp') osc.frequency.exponentialRampToValueAtTime(f, startAt + t);
    else osc.frequency.linearRampToValueAtTime(f, startAt + t);
  }
  env.gain.setValueAtTime(0.0001, startAt);
  env.gain.linearRampToValueAtTime(peak, startAt + Math.min(0.02, seconds / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds);
  osc.connect(env);
  env.connect(out);
  osc.start(startAt);
  osc.stop(startAt + seconds + 0.02);
}

/**
 * Plays one effect. `level` is the master peak (volume times the SFX gain cap).
 * Throws nothing: callers wrap it, but we stay defensive too.
 */
export function playSynth(ctx: Ctx, name: SfxName, level: number): void {
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = level;
  master.connect(ctx.destination);
  switch (name) {
    case 'launch': // slide whistle up
      voice(
        ctx,
        master,
        'sine',
        [
          [300, 0],
          [1500, 0.5],
        ],
        0.55,
        0.9,
        t,
      );
      break;
    case 'cannonBoom': {
      // A tiny wooden creak, then the boom: pitched-down thump plus a fast-fading rumble.
      voice(
        ctx,
        master,
        'sawtooth',
        [
          [190, 0],
          [130, 0.09],
        ],
        0.1,
        0.12,
        t,
      );
      const boomAt = t + 0.06;
      voice(
        ctx,
        master,
        'sine',
        [
          [130, 0],
          [38, 0.28],
        ],
        0.34,
        1,
        boomAt,
      );
      noiseBurst(ctx, master, {
        filter: 'lowpass',
        freq: 700,
        freqEnd: 70,
        seconds: 0.45,
        peak: 0.9,
        startAt: boomAt,
      });
      break;
    }
    case 'laserPew': // pew pew pew
      for (let i = 0; i < 3; i++) {
        voice(
          ctx,
          master,
          'square',
          [
            [1900 - i * 150, 0],
            [260, 0.08],
          ],
          0.09,
          0.45,
          t + i * 0.1,
        );
      }
      break;
    case 'boing': // spring: up, down, up a little
      voice(
        ctx,
        master,
        'triangle',
        [
          [180, 0],
          [520, 0.12],
          [140, 0.3],
          [330, 0.45],
          [200, 0.6],
        ],
        0.65,
        0.9,
        t,
      );
      break;
    case 'horn': // two-note cartoon horn
      voice(
        ctx,
        master,
        'sawtooth',
        [
          [220, 0],
          [220, 0.4],
        ],
        0.45,
        0.5,
        t,
      );
      voice(
        ctx,
        master,
        'sawtooth',
        [
          [277, 0],
          [277, 0.4],
        ],
        0.45,
        0.4,
        t,
      );
      break;
    case 'clunk': // reload done
      voice(
        ctx,
        master,
        'square',
        [
          [140, 0],
          [70, 0.12],
        ],
        0.16,
        0.8,
        t,
      );
      break;
    case 'thud': // soft toy-like
      voice(
        ctx,
        master,
        'sine',
        [
          [110, 0],
          [45, 0.15],
        ],
        0.2,
        1,
        t,
      );
      break;
    case 'bonk': // a hollow foam knock: a quick high tap that drops, then a soft low bump
      voice(
        ctx,
        master,
        'triangle',
        [
          [660, 0],
          [240, 0.08],
        ],
        0.12,
        0.8,
        t,
      );
      voice(
        ctx,
        master,
        'sine',
        [
          [150, 0],
          [90, 0.12],
        ],
        0.16,
        0.7,
        t + 0.03,
      );
      break;
    case 'step': // four soft pitter-patter steps
      for (let i = 0; i < 4; i++) {
        voice(
          ctx,
          master,
          'sine',
          [
            [i % 2 === 0 ? 220 : 190, 0],
            [110, 0.05],
          ],
          0.06,
          0.45,
          t + i * 0.16,
        );
      }
      break;
    case 'click':
      voice(
        ctx,
        master,
        'square',
        [
          [880, 0],
          [660, 0.03],
        ],
        0.05,
        0.4,
        t,
      );
      break;
    case 'bonus': // two bright coin pings
      [1319, 1760].forEach((f, i) => {
        voice(
          ctx,
          master,
          'triangle',
          [
            [f, 0],
            [f * 1.02, 0.1],
          ],
          0.14,
          0.5,
          t + i * 0.09,
        );
      });
      break;
    case 'squawk': // a surprised bird: two quick chirps that fall in pitch
      [0, 0.13].forEach((at, i) => {
        voice(
          ctx,
          master,
          'sawtooth',
          [
            [1250 - i * 150, 0],
            [1500 - i * 150, 0.03],
            [620 - i * 80, 0.1],
          ],
          0.11,
          0.3,
          t + at,
        );
      });
      break;
    case 'whoosh': {
      // A rush of air: band-passed noise that sweeps up, plus a soft low hum under it.
      noiseBurst(ctx, master, {
        filter: 'bandpass',
        freq: 350,
        freqEnd: 1800,
        q: 0.8,
        seconds: 0.5,
        peak: 0.55,
        startAt: t,
      });
      voice(
        ctx,
        master,
        'sine',
        [
          [160, 0],
          [240, 0.4],
        ],
        0.5,
        0.15,
        t,
      );
      break;
    }
    case 'cheer': // happy rising notes
      [523, 659, 784, 1047].forEach((f, i) => {
        voice(
          ctx,
          master,
          'triangle',
          [
            [f, 0],
            [f * 1.01, 0.18],
          ],
          0.22,
          0.6,
          t + i * 0.12,
        );
      });
      break;
  }
}
