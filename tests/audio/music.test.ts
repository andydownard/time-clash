import { describe, expect, it } from 'vitest';
import { createMusicPlayer } from '../../src/audio/music';
import {
  LOOP_SEC,
  MUSIC_MIX,
  STEP_SEC,
  scheduleMusic,
  type Flavor,
} from '../../src/audio/musicData';
import { createClock } from './fakes';
import { RecordingContext } from './recordingContext';

function setup(opts: { withNoise?: boolean } = {}) {
  const clock = createClock();
  const ctx = new RecordingContext(opts);
  const player = createMusicPlayer(ctx.asContext(), clock);
  /** Moves both the audio clock and the timers forward, in scheduler-sized steps. */
  const run = (seconds: number): void => {
    const slice = MUSIC_MIX.tickMs / 1000;
    for (let t = 0; t < seconds - 1e-9; t += slice) {
      ctx.currentTime += slice;
      clock.advance(MUSIC_MIX.tickMs);
    }
  };
  return { clock, ctx, player, run };
}

const startedOscillators = (ctx: RecordingContext) =>
  ctx.of('osc').filter((o) => o.startedAt !== null);

describe('music player: scheduling', () => {
  it('makes nothing until started', () => {
    const { ctx, player } = setup();
    expect(player.running).toBe(false);
    expect(ctx.nodes).toHaveLength(0);
  });

  it('schedules only notes inside the lookahead window', () => {
    const { ctx, player } = setup();
    player.start('PAST');
    expect(player.running).toBe(true);
    const osc = startedOscillators(ctx);
    expect(osc.length).toBeGreaterThan(0);
    for (const o of osc) {
      expect(o.startedAt!).toBeGreaterThanOrEqual(0);
      expect(o.startedAt!).toBeLessThanOrEqual(ctx.currentTime + MUSIC_MIX.lookaheadSec + 0.2);
    }
  });

  it('keeps scheduling as time passes, with no gaps and no repeats', () => {
    const a = setup();
    a.player.start('PAST');
    a.run(LOOP_SEC);
    const b = setup();
    b.player.start('PAST');
    b.run(LOOP_SEC * 2);
    // Twice the time gives about twice the notes (within one loop edge).
    const one = startedOscillators(a.ctx).length;
    const two = startedOscillators(b.ctx).length;
    expect(two).toBeGreaterThan(one * 1.8);
    expect(two).toBeLessThan(one * 2.2);
  });

  it('plays exactly the events the pure schedule lists for the first steps', () => {
    const { ctx, player, run } = setup();
    player.start('PAST');
    run(2);
    const horizon = ctx.currentTime + MUSIC_MIX.lookaheadSec;
    const origin = startedOscillators(ctx).reduce((m, o) => Math.min(m, o.startedAt!), Infinity);
    const steps = Math.ceil((horizon - origin) / STEP_SEC);
    const expected = scheduleMusic('PAST', origin, 0, steps).filter((e) => e.track !== 'clap');
    expect(expected.length).toBeGreaterThan(20);
    // Every event with a pitch has an oscillator starting at its time.
    const starts = new Set(startedOscillators(ctx).map((o) => o.startedAt!.toFixed(6)));
    for (const e of expected.filter((x) => x.midi !== undefined && x.track === 'bass')) {
      expect(starts.has(e.time.toFixed(6))).toBe(true);
    }
  });

  it('start twice does not double the timers', () => {
    const { clock, player } = setup();
    player.start('PAST');
    player.start('FUTURE');
    expect(clock.pending()).toBe(1);
  });

  it('skips ahead after a long stall instead of playing a pile of old notes', () => {
    const { ctx, clock, player } = setup();
    player.start('PAST');
    const before = startedOscillators(ctx).length;
    ctx.currentTime += 120; // tab was in the background
    clock.advance(MUSIC_MIX.tickMs);
    const added = startedOscillators(ctx).length - before;
    expect(added).toBeLessThan(80);
  });

  it('works without noise support (old browser)', () => {
    const { ctx, player, run } = setup({ withNoise: false });
    expect(() => {
      player.start('PAST');
      run(2);
    }).not.toThrow();
    expect(startedOscillators(ctx).length).toBeGreaterThan(0);
  });
});

describe('music player: stop', () => {
  it('stops the timer, fades the bus and lets go of it', () => {
    const { ctx, clock, player, run } = setup();
    player.start('PAST');
    run(1);
    player.stop();
    expect(player.running).toBe(false);
    expect(clock.pending()).toBeLessThanOrEqual(1); // only the short cleanup timer
    const count = ctx.nodes.length;
    run(1);
    expect(ctx.nodes.length).toBe(count);
    const master = ctx.of('gain')[0]!;
    expect(master.gain!.calls.some((c) => c.kind === 'target' && c.value === 0)).toBe(true);
    expect(master.disconnected).toBe(true);
    expect(clock.pending()).toBe(0);
  });

  it('can start again after stopping', () => {
    const { ctx, player } = setup();
    player.start('PAST');
    player.stop();
    const before = startedOscillators(ctx).length;
    player.start('FUTURE');
    expect(player.running).toBe(true);
    expect(startedOscillators(ctx).length).toBeGreaterThan(before);
  });

  it('stop before start and stop twice are safe', () => {
    const { player } = setup();
    expect(() => {
      player.stop();
      player.start('PAST');
      player.stop();
      player.stop();
    }).not.toThrow();
  });
});

describe('music player: level and ducking', () => {
  const masterTarget = (ctx: RecordingContext): number => {
    const calls = ctx.of('gain')[0]!.gain!.calls.filter((c) => c.kind === 'target');
    return calls[calls.length - 1]!.value;
  };

  it('is quiet by default and follows the volume', () => {
    const { ctx, player } = setup();
    player.setLevel(1);
    player.start('PAST');
    expect(masterTarget(ctx)).toBeCloseTo(MUSIC_MIX.master, 6);
    player.setLevel(0.5);
    expect(masterTarget(ctx)).toBeCloseTo(MUSIC_MIX.master * 0.5, 6);
    expect(MUSIC_MIX.master).toBeLessThanOrEqual(0.25);
  });

  it('ducks under speech and comes back', () => {
    const { ctx, player } = setup();
    player.setLevel(1);
    player.start('PAST');
    player.setDucked(true);
    expect(masterTarget(ctx)).toBeCloseTo(MUSIC_MIX.master * MUSIC_MIX.duck, 6);
    player.setDucked(false);
    expect(masterTarget(ctx)).toBeCloseTo(MUSIC_MIX.master, 6);
  });

  it('remembers duck and level set before start', () => {
    const { ctx, player } = setup();
    player.setLevel(0.4);
    player.setDucked(true);
    player.start('PAST');
    expect(masterTarget(ctx)).toBeCloseTo(MUSIC_MIX.master * 0.4 * MUSIC_MIX.duck, 6);
  });

  it('clamps level and ignores NaN', () => {
    const { ctx, player } = setup();
    player.start('PAST');
    player.setLevel(7);
    expect(masterTarget(ctx)).toBeCloseTo(MUSIC_MIX.master, 6);
    player.setLevel(-3);
    expect(masterTarget(ctx)).toBe(0);
    player.setLevel(0.5);
    player.setLevel(NaN);
    expect(masterTarget(ctx)).toBeCloseTo(MUSIC_MIX.master * 0.5, 6);
  });
});

describe('music player: crossfade', () => {
  const notesPerLoop = (first: Flavor, then?: Flavor): number => {
    const { ctx, player, run } = setup();
    player.start(first);
    if (then) player.setFlavor(then);
    run(MUSIC_MIX.crossfadeSec * 3); // let the fade finish
    const before = startedOscillators(ctx).length;
    run(LOOP_SEC);
    return startedOscillators(ctx).length - before;
  };

  it('fades one bus down and the other up', () => {
    const { ctx, player } = setup();
    player.start('PAST');
    player.setFlavor('FUTURE');
    const targets = ctx
      .of('gain')
      .map((g) => g.gain!.calls.filter((c) => c.kind === 'target').map((c) => c.value));
    expect(targets.some((t) => t[t.length - 1] === 0)).toBe(true);
    expect(targets.some((t) => t[t.length - 1] === 1)).toBe(true);
  });

  it('stops playing the old flavor after the fade', () => {
    expect(notesPerLoop('PAST', 'FUTURE')).toBe(notesPerLoop('FUTURE'));
    expect(notesPerLoop('FUTURE', 'PAST')).toBe(notesPerLoop('PAST'));
  });

  it('setting the same flavor again changes nothing', () => {
    const { ctx, player } = setup();
    player.start('PAST');
    const n = ctx.nodes.length;
    player.setFlavor('PAST');
    expect(ctx.nodes.length).toBe(n);
  });

  it('setFlavor before start is remembered', () => {
    const a = setup();
    a.player.setFlavor('FUTURE');
    a.player.start('FUTURE');
    const b = setup();
    b.player.setFlavor('FUTURE');
    b.player.start('PAST'); // start's flavor wins
    expect(startedOscillators(a.ctx).length).not.toBe(startedOscillators(b.ctx).length);
  });
});

describe('music player: never throws', () => {
  it('survives an AudioContext that cannot build oscillators', () => {
    const { ctx, player, run } = setup();
    ctx.failOscillator = true;
    expect(() => {
      player.start('PAST');
      run(1);
      player.setFlavor('FUTURE');
      player.stop();
    }).not.toThrow();
  });

  it('survives an AudioContext that cannot build gains', () => {
    const { ctx, player } = setup();
    ctx.failGain = true;
    expect(() => {
      player.start('PAST');
      player.setLevel(0.2);
      player.setDucked(true);
      player.stop();
    }).not.toThrow();
    expect(player.running).toBe(false);
  });
});
