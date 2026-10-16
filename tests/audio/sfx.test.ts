import { describe, expect, it } from 'vitest';
import { playSynth } from '../../src/audio/sfx';
import { SFX_NAMES } from '../../src/audio/types';
import { RecordingContext } from './recordingContext';

const play = (name: Parameters<typeof playSynth>[1], opts = {}) => {
  const ctx = new RecordingContext(opts);
  ctx.currentTime = 5;
  playSynth(ctx.asContext(), name, 0.5);
  return ctx;
};

describe('new launch sounds', () => {
  it('are listed as effects', () => {
    expect(SFX_NAMES).toContain('cannonBoom');
    expect(SFX_NAMES).toContain('laserPew');
    expect(SFX_NAMES).toContain('launch'); // the slide whistle stays
  });

  it('cannonBoom has a low thump, a noise rumble and a creak', () => {
    const ctx = play('cannonBoom');
    const osc = ctx.of('osc');
    expect(osc.length).toBeGreaterThanOrEqual(2); // thump and creak
    expect(ctx.of('source').length).toBeGreaterThanOrEqual(1); // rumble
    const thump = osc.find((o) => o.type === 'sine');
    expect(thump).toBeDefined();
    const sweep = thump!.frequency!.calls;
    const first = sweep.find((c) => c.kind === 'set')!.value;
    const last = sweep.filter((c) => c.kind === 'exp').at(-1)!.value;
    expect(first).toBeLessThan(220);
    expect(last).toBeLessThan(first); // pitched down
    expect(last).toBeLessThan(70);
  });

  it('cannonBoom is short and every node stops', () => {
    const ctx = play('cannonBoom');
    for (const n of [...ctx.of('osc'), ...ctx.of('source')]) {
      expect(n.startedAt).not.toBeNull();
      expect(n.stoppedAt).not.toBeNull();
      expect(n.startedAt!).toBeGreaterThanOrEqual(5);
      expect(n.stoppedAt!).toBeLessThanOrEqual(5 + 1.2);
    }
  });

  it('cannonBoom rumble filter sweeps down', () => {
    const ctx = play('cannonBoom');
    const f = ctx.of('filter')[0]!;
    const calls = f.frequency!.calls;
    const start = calls.find((c) => c.kind === 'set')!.value;
    const end = calls.filter((c) => c.kind === 'exp').at(-1)!.value;
    expect(end).toBeLessThan(start);
  });

  it('cannonBoom still thumps when noise is unavailable', () => {
    const ctx = play('cannonBoom', { withNoise: false });
    expect(ctx.of('osc').length).toBeGreaterThanOrEqual(2);
    expect(ctx.of('source')).toHaveLength(0);
  });

  it('laserPew makes three falling zaps in a row', () => {
    const ctx = play('laserPew');
    const zaps = ctx.of('osc');
    expect(zaps).toHaveLength(3);
    const starts = zaps.map((z) => z.startedAt!);
    expect(starts[1]!).toBeGreaterThan(starts[0]!);
    expect(starts[2]!).toBeGreaterThan(starts[1]!);
    expect(starts[2]! - starts[0]!).toBeLessThan(0.5);
    for (const z of zaps) {
      const calls = z.frequency!.calls;
      const from = calls.find((c) => c.kind === 'set')!.value;
      const to = calls.filter((c) => c.kind === 'exp').at(-1)!.value;
      expect(to).toBeLessThan(from / 2); // falls
    }
  });

  it('laserPew zaps do not overlap into a smear', () => {
    const zaps = play('laserPew').of('osc');
    expect(zaps[0]!.stoppedAt!).toBeLessThanOrEqual(zaps[1]!.startedAt! + 0.05);
  });

  it('all effects play without throwing on a plain context', () => {
    for (const name of SFX_NAMES) {
      expect(() => play(name)).not.toThrow();
    }
  });
});
