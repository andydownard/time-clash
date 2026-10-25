// The battle loop picks the launch sound by team and tells the music whose turn it is.
import { describe, expect, it } from 'vitest';
import type { SfxName } from '../../src/audio/types';
import { QUICK_END, findAim, makeWorld, settle } from '../scenes/battle/flowHarness';

const SEED = 7;

function withMusicLog(w: ReturnType<typeof makeWorld>) {
  const calls: string[] = [];
  w.deps.audio = {
    playSfx: (n: SfxName) => void calls.push(`sfx:${n}`),
    setMusicTeam: (t: string) => void calls.push(`team:${t}`),
    stopMusic: () => void calls.push('stop'),
  } as unknown as typeof w.deps.audio;
  return calls;
}

describe('battle sounds', () => {
  it('Team Past fires with the cannon, not the whistle', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    expect(w.sfx.filter((s) => s === 'cannonBoom')).toHaveLength(2);
    expect(w.sfx).not.toContain('launch');
    expect(w.sfx).not.toContain('laserPew');
  });

  it('Team Future fires with the laser', async () => {
    const mp = findAim(SEED, 0, 'PAST', 'miss');
    const mf = findAim(SEED, 1, 'FUTURE', 'miss');
    const w = makeWorld({ seed: SEED, script: [mp, mp, mf, mf] });
    void w.flow.run();
    await settle();
    expect(w.sfx.filter((s) => s === 'cannonBoom')).toHaveLength(2);
    expect(w.sfx.filter((s) => s === 'laserPew')).toHaveLength(2);
    expect(w.sfx).not.toContain('launch');
  });

  it('tells the music the active team at the start of each turn', async () => {
    const mp = findAim(SEED, 0, 'PAST', 'miss');
    const mf = findAim(SEED, 1, 'FUTURE', 'miss');
    const w = makeWorld({ seed: SEED, script: [mp, mp, mf, mf] });
    const calls = withMusicLog(w);
    void w.flow.run();
    await settle();
    const teams = calls.filter((c) => c.startsWith('team:'));
    expect(teams.slice(0, 2)).toEqual(['team:PAST', 'team:FUTURE']);
  });

  it('stops the music when the match ends', async () => {
    const dP = (turn: number) => findAim(SEED, turn, 'PAST', 'direct');
    const dF = (turn: number) => findAim(SEED, turn, 'FUTURE', 'miss');
    const w = makeWorld({
      seed: SEED,
      script: [dP(0), dP(0), dF(1), dF(1), dP(2), dP(2)],
      matchOptions: QUICK_END,
    });
    const calls = withMusicLog(w);
    void w.flow.run();
    await settle();
    expect(w.results).toHaveLength(1);
    expect(calls[calls.length - 1]).toBe('stop');
  });

  it('stops the music when the scene is torn down mid-match', async () => {
    const w = makeWorld({ seed: SEED, script: [] });
    const calls = withMusicLog(w);
    const done = w.flow.run();
    await settle();
    w.flow.destroy();
    await done;
    expect(calls).toContain('stop');
  });

  it('still works when the audio object has no music methods', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    expect(w.log).toContain('reload:PAST');
  });
});
