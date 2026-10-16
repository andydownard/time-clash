import { describe, expect, it } from 'vitest';
import { createAudioManager } from '../../src/audio/audioManager';
import { MUSIC_MIX } from '../../src/audio/musicData';
import type { AudioEnv, VoiceLine } from '../../src/audio/types';
import { createHarness } from './fakes';
import { RecordingContext } from './recordingContext';

const line: VoiceLine = {
  id: 'hi',
  text: 'Hello there.',
  captions: [{ text: 'Hello there.', startMs: 0 }],
  durationMs: 2000,
};

function setup(init = { muted: false, volume: 0.7 }) {
  const h = createHarness();
  const rec = new RecordingContext();
  const env: AudioEnv = { ...h.env, createAudioContext: () => rec.asContext() };
  const audio = createAudioManager(env, init);
  /** Last target level of the music master gain, or null if no music was built. */
  const master = (): number | null => {
    const g = rec.of('gain')[0];
    const t = g?.gain?.calls.filter((c) => c.kind === 'target');
    return t && t.length > 0 ? t[t.length - 1]!.value : null;
  };
  const oscillators = () => rec.of('osc').filter((o) => o.startedAt !== null).length;
  return { h, rec, audio, master, oscillators };
}

describe('music: before the first tap', () => {
  it('stays silent and builds nothing', async () => {
    const { audio, rec, h } = setup();
    audio.setMusicTeam('PAST');
    expect(rec.nodes).toHaveLength(0);
    expect(h.clock.pending()).toBe(0);
    expect(audio.musicPlaying).toBe(false);
  });

  it('starts once the tap unlocks audio', async () => {
    const { audio, oscillators, h } = setup();
    audio.setMusicTeam('PAST');
    await audio.unlock();
    expect(audio.musicPlaying).toBe(true);
    expect(oscillators()).toBeGreaterThan(0);
    expect(h.clock.pending()).toBeGreaterThan(0);
  });
});

describe('music: mute, volume, on/off', () => {
  it('is quiet by default and follows the saved volume', async () => {
    const { audio, master } = setup({ muted: false, volume: 0.5 });
    await audio.unlock();
    audio.setMusicTeam('PAST');
    expect(master()).toBeCloseTo(MUSIC_MIX.master * 0.5, 6);
    audio.setVolume(1);
    expect(master()).toBeCloseTo(MUSIC_MIX.master, 6);
    audio.setVolume(0);
    expect(master()).toBe(0);
  });

  it('never starts while muted, and starts when unmuted', async () => {
    const { audio, oscillators } = setup({ muted: true, volume: 0.7 });
    await audio.unlock();
    audio.setMusicTeam('FUTURE');
    expect(audio.musicPlaying).toBe(false);
    expect(oscillators()).toBe(0);
    audio.setMuted(false);
    expect(audio.musicPlaying).toBe(true);
  });

  it('stops cleanly when muted', async () => {
    const { audio, h } = setup();
    await audio.unlock();
    audio.setMusicTeam('PAST');
    audio.setMuted(true);
    expect(audio.musicPlaying).toBe(false);
    h.clock.advance(1000);
    expect(h.clock.pending()).toBe(0);
  });

  it('music on/off works and is on by default', async () => {
    const { audio } = setup();
    expect(audio.musicOn).toBe(true);
    await audio.unlock();
    audio.setMusicTeam('PAST');
    audio.setMusicOn(false);
    expect(audio.musicOn).toBe(false);
    expect(audio.musicPlaying).toBe(false);
    audio.setMusicOn(true);
    expect(audio.musicPlaying).toBe(true);
  });

  it('turning music off keeps sound effects working', async () => {
    const { audio, rec } = setup();
    await audio.unlock();
    audio.setMusicOn(false);
    audio.playSfx('laserPew');
    expect(rec.of('osc')).toHaveLength(3);
  });

  it('stopMusic stops it, and a later unmute does not bring it back', async () => {
    const { audio } = setup();
    await audio.unlock();
    audio.setMusicTeam('PAST');
    audio.stopMusic();
    expect(audio.musicPlaying).toBe(false);
    audio.setMuted(true);
    audio.setMuted(false);
    expect(audio.musicPlaying).toBe(false);
    audio.setMusicTeam('FUTURE');
    expect(audio.musicPlaying).toBe(true);
  });
});

describe('music: teams', () => {
  it('crossfades when the active team changes, and does not restart', async () => {
    const { audio, rec, h } = setup();
    await audio.unlock();
    audio.setMusicTeam('PAST');
    const timers = h.clock.pending();
    audio.setMusicTeam('FUTURE');
    expect(h.clock.pending()).toBe(timers);
    const buses = rec
      .of('gain')
      .filter((g) => g.gain!.calls.some((c) => c.kind === 'target' && c.value === 0));
    expect(buses.length).toBeGreaterThan(0);
  });
});

describe('music: ducking under speech', () => {
  it('lowers while a line plays and recovers when it ends', async () => {
    const { audio, master, h } = setup({ muted: false, volume: 1 });
    await audio.unlock();
    audio.setMusicTeam('PAST');
    const normal = master()!;
    const handle = audio.speak(line);
    expect(master()!).toBeCloseTo(normal * MUSIC_MIX.duck, 6);
    h.clock.advance(60000);
    await handle.done;
    expect(master()!).toBeCloseTo(normal, 6);
  });

  it('recovers when the line is stopped (Skip)', async () => {
    const { audio, master } = setup({ muted: false, volume: 1 });
    await audio.unlock();
    audio.setMusicTeam('PAST');
    const normal = master()!;
    const handle = audio.speak(line);
    handle.stop();
    expect(master()!).toBeCloseTo(normal, 6);
  });

  it('stays ducked across back-to-back lines', async () => {
    const { audio, master } = setup({ muted: false, volume: 1 });
    await audio.unlock();
    audio.setMusicTeam('PAST');
    const normal = master()!;
    audio.speak(line);
    audio.speak({ ...line, id: 'two' });
    expect(master()!).toBeCloseTo(normal * MUSIC_MIX.duck, 6);
    audio.stopSpeech();
    expect(master()!).toBeCloseTo(normal, 6);
  });

  it('ducks even when started before the music', async () => {
    const { audio, master } = setup({ muted: false, volume: 1 });
    await audio.unlock();
    audio.speak(line);
    audio.setMusicTeam('PAST');
    expect(master()!).toBeCloseTo(MUSIC_MIX.master * MUSIC_MIX.duck, 6);
  });
});

describe('music: when audio is missing or broken', () => {
  it('never throws without an AudioContext', async () => {
    const h = createHarness({ noContext: true });
    const audio = createAudioManager(h.env, { muted: false, volume: 0.7 });
    await audio.unlock();
    expect(() => {
      audio.setMusicTeam('PAST');
      audio.setMusicTeam('FUTURE');
      audio.setMusicOn(false);
      audio.setMusicOn(true);
      audio.stopMusic();
    }).not.toThrow();
    expect(audio.musicPlaying).toBe(false);
  });

  it('never throws when the old fake context has no noise or filters', async () => {
    const h = createHarness();
    const audio = createAudioManager(h.env, { muted: false, volume: 0.7 });
    await audio.unlock();
    expect(() => audio.setMusicTeam('PAST')).not.toThrow();
  });

  it('never throws when building nodes fails', async () => {
    const { audio, rec } = setup();
    rec.failGain = true;
    await audio.unlock();
    expect(() => audio.setMusicTeam('PAST')).not.toThrow();
    expect(audio.musicPlaying).toBe(false);
  });
});
