import { describe, expect, it, vi } from 'vitest';
import { createAudioManager } from '../../src/audio/audioManager';
import { SFX_NAMES, type VoiceLine } from '../../src/audio/types';
import { AUDIO } from '../../src/game/config';
import { createHarness } from './fakes';

const line: VoiceLine = {
  id: 'aim',
  audioSrc: '/audio/voice/intro-02-aim.mp3',
  text: 'Aim your launcher. Watch the wind.',
  captions: [
    { text: 'Aim your launcher.', startMs: 0 },
    { text: 'Watch the wind.', startMs: 2000 },
  ],
  durationMs: 4000,
};

const init = { muted: false, volume: 0.7 };

describe('audio: before the first tap', () => {
  it('starts locked and creates no audio context', () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    expect(a.unlocked).toBe(false);
    expect(h.contextsCreated()).toBe(0);
  });

  it('playSfx is silent', () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    for (const n of SFX_NAMES) a.playSfx(n);
    expect(h.ctx.oscillators).toHaveLength(0);
  });

  it('speak never calls play() or speechSynthesis, but captions still run', () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    const seen: Array<string | null> = [];
    const handle = a.speak(line, { onCaption: (t) => seen.push(t) });
    expect(handle.source).toBe('silent');
    expect(h.elements).toHaveLength(0);
    expect(h.speech.spoken).toHaveLength(0);
    expect(seen).toEqual(['Aim your launcher.']);
    h.clock.advance(2000);
    expect(seen).toEqual(['Aim your launcher.', 'Watch the wind.']);
    h.clock.advance(2000);
    expect(seen.at(-1)).toBeNull();
  });
});

describe('audio: unlock', () => {
  it('creates one context, resumes it, and is idempotent', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    await a.unlock();
    expect(a.unlocked).toBe(true);
    expect(h.contextsCreated()).toBe(1);
    expect(h.ctx.resumeCalls).toBeGreaterThanOrEqual(1);
  });

  it('sets unlocked synchronously inside the tap handler', () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    void a.unlock();
    expect(a.unlocked).toBe(true);
  });

  it('resolves when AudioContext is missing (returns null)', async () => {
    const h = createHarness({ noContext: true });
    const a = createAudioManager(h.env, init);
    await expect(a.unlock()).resolves.toBeUndefined();
    expect(() => a.playSfx('boing')).not.toThrow();
  });

  it('resolves when createAudioContext is not provided', async () => {
    const h = createHarness();
    const env = { ...h.env, createAudioContext: undefined };
    const a = createAudioManager(env, init);
    await expect(a.unlock()).resolves.toBeUndefined();
    expect(() => a.playSfx('horn')).not.toThrow();
  });

  it('resolves when createAudioContext throws', async () => {
    const h = createHarness();
    const env = {
      ...h.env,
      createAudioContext: () => {
        throw new Error('no audio here');
      },
    };
    const a = createAudioManager(env, init);
    await expect(a.unlock()).resolves.toBeUndefined();
    expect(() => a.playSfx('horn')).not.toThrow();
  });

  it('resolves when resume() rejects', async () => {
    const h = createHarness();
    h.ctx.resume = () => Promise.reject(new Error('nope'));
    const a = createAudioManager(h.env, init);
    await expect(a.unlock()).resolves.toBeUndefined();
  });
});

describe('audio: synthesized effects', () => {
  it.each(SFX_NAMES)('%s makes and starts at least one oscillator', async (name) => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.playSfx(name);
    expect(h.ctx.oscillators.length).toBeGreaterThan(0);
    for (const o of h.ctx.oscillators) {
      expect(o.started).toBe(true);
      expect(o.stopped).toBe(true);
    }
  });

  it('launch is a slide whistle: pitch rises', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.playSfx('launch');
    const calls = h.ctx.oscillators[0]!.frequency.calls;
    const start = calls.find((c) => c[0] === 'set')![1];
    const end = calls.filter((c) => c[0] !== 'set').at(-1)![1];
    expect(end).toBeGreaterThan(start * 2);
  });

  it('boing wobbles: pitch goes up then down', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.playSfx('boing');
    const values = h.ctx.oscillators[0]!.frequency.calls.map((c) => c[1]);
    const peak = Math.max(...values);
    expect(values.indexOf(peak)).toBeGreaterThan(0);
    expect(values.indexOf(peak)).toBeLessThan(values.length - 1);
  });

  it('horn layers two voices', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.playSfx('horn');
    expect(h.ctx.oscillators.length).toBeGreaterThanOrEqual(2);
  });

  it('clunk is low and short', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.playSfx('clunk');
    const freqs = h.ctx.oscillators[0]!.frequency.calls.map((c) => c[1]);
    expect(Math.max(...freqs)).toBeLessThan(300);
  });

  it('master gain follows volume and the SFX gain cap', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, { muted: false, volume: 0.5 });
    await a.unlock();
    a.playSfx('click');
    const peak = h.ctx.gains[0]!.gain.value;
    expect(peak).toBeCloseTo(0.5 * AUDIO.sfxGain);
    expect(peak).toBeGreaterThan(0);
  });

  it('muted makes no sound', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, { muted: true, volume: 0.7 });
    await a.unlock();
    a.playSfx('boing');
    expect(h.ctx.oscillators).toHaveLength(0);
  });

  it('a throwing oscillator never escapes', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    h.ctx.throwOnCreate = true;
    expect(() => a.playSfx('launch')).not.toThrow();
  });
});

describe('audio: mute and volume', () => {
  it('setMuted toggles and reports', () => {
    const a = createAudioManager(createHarness().env, init);
    a.setMuted(true);
    expect(a.muted).toBe(true);
    a.setMuted(false);
    expect(a.muted).toBe(false);
  });

  it('volume is clamped 0 to 1 and ignores junk', () => {
    const a = createAudioManager(createHarness().env, init);
    a.setVolume(5);
    expect(a.volume).toBe(1);
    a.setVolume(-3);
    expect(a.volume).toBe(0);
    a.setVolume(0.3);
    a.setVolume(Number.NaN);
    expect(a.volume).toBe(0.3);
  });

  it('clamps an out-of-range initial volume', () => {
    const a = createAudioManager(createHarness().env, { muted: false, volume: 9 });
    expect(a.volume).toBe(1);
  });

  it('reports changes so the app can save them', () => {
    const onChange = vi.fn();
    const a = createAudioManager(createHarness().env, init, onChange);
    a.setMuted(true);
    a.setVolume(0.4);
    expect(onChange).toHaveBeenLastCalledWith({ muted: true, volume: 0.4, musicOn: true });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('muting while a file plays stops the sound but keeps captions going', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const seen: Array<string | null> = [];
    const handle = a.speak(line, { onCaption: (t) => seen.push(t) });
    expect(handle.source).toBe('file');
    a.setMuted(true);
    expect(h.elements[0]!.paused).toBe(true);
    h.clock.advance(2000);
    expect(seen).toContain('Watch the wind.');
    h.clock.advance(2000);
    await expect(handle.done).resolves.toBe('ended');
  });

  it('volume changes reach the playing element', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.speak(line);
    a.setVolume(0.2);
    expect(h.elements[0]!.volume).toBeCloseTo(0.2 * AUDIO.voiceGain);
  });
});

describe('audio: speak with a file', () => {
  it('plays the file and ends when the file ends', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const handle = a.speak(line);
    expect(handle.source).toBe('file');
    expect(h.elements[0]!.src).toBe(line.audioSrc);
    expect(h.elements[0]!.played).toBe(1);
    h.elements[0]!.onended?.();
    await expect(handle.done).resolves.toBe('ended');
  });

  it('emits captions on the timeline and clears at the end', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const seen: Array<string | null> = [];
    a.speak(line, { onCaption: (t) => seen.push(t) });
    expect(seen).toEqual(['Aim your launcher.']);
    h.clock.advance(1999);
    expect(seen).toHaveLength(1);
    h.clock.advance(1);
    expect(seen).toEqual(['Aim your launcher.', 'Watch the wind.']);
    h.elements[0]!.onended?.();
    expect(seen.at(-1)).toBeNull();
  });

  it('a stalled file still ends (safety timer)', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const handle = a.speak(line);
    h.clock.advance(line.durationMs + 6000);
    await expect(handle.done).resolves.toBe('ended');
  });
});

describe('audio: fallbacks', () => {
  it('file error falls back to speechSynthesis and captions still show', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const seen: Array<string | null> = [];
    const handle = a.speak(line, { onCaption: (t) => seen.push(t) });
    h.elements[0]!.onerror?.();
    expect(handle.source).toBe('synthesis');
    expect(h.speech.spoken).toHaveLength(1);
    expect(h.speech.spoken[0]!.text).toBe(line.text);
    expect(h.speech.spoken[0]!.rate).toBe(AUDIO.speechRate);
    expect(seen[0]).toBe('Aim your launcher.');
    h.clock.advance(2000);
    expect(seen).toContain('Watch the wind.');
    h.speech.finishLast();
    await expect(handle.done).resolves.toBe('ended');
  });

  it('play() rejecting falls back to speechSynthesis', async () => {
    const h = createHarness({ elementResult: 'reject' });
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const handle = a.speak(line);
    await Promise.resolve();
    await Promise.resolve();
    expect(handle.source).toBe('synthesis');
    expect(h.speech.spoken).toHaveLength(1);
  });

  it('no audioSrc goes straight to speechSynthesis', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const { audioSrc: _unused, ...noFile } = line;
    void _unused;
    const handle = a.speak(noFile);
    expect(handle.source).toBe('synthesis');
    expect(h.elements).toHaveLength(0);
  });

  it('no file element and no speech means silent captions on a timer', async () => {
    const h = createHarness({ noElement: true, noSpeech: true });
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const seen: Array<string | null> = [];
    const handle = a.speak(line, { onCaption: (t) => seen.push(t) });
    expect(handle.source).toBe('silent');
    h.clock.advance(line.durationMs);
    await expect(handle.done).resolves.toBe('ended');
    expect(seen).toEqual(['Aim your launcher.', 'Watch the wind.', null]);
  });

  it('file error with no speech falls to silent and still finishes', async () => {
    const h = createHarness({ noSpeech: true });
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const handle = a.speak(line);
    h.elements[0]!.onerror?.();
    expect(handle.source).toBe('silent');
    h.clock.advance(line.durationMs);
    await expect(handle.done).resolves.toBe('ended');
  });

  it('a speech error ends the line without throwing', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const { audioSrc: _unused, ...noFile } = line;
    void _unused;
    const handle = a.speak(noFile);
    h.speech.spoken[0]!.onerror?.();
    h.clock.advance(line.durationMs);
    await expect(handle.done).resolves.toBe('ended');
  });

  it('muted speak is silent and plays nothing', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, { muted: true, volume: 0.7 });
    await a.unlock();
    const handle = a.speak(line);
    expect(handle.source).toBe('silent');
    expect(h.elements).toHaveLength(0);
    expect(h.speech.spoken).toHaveLength(0);
  });
});

describe('audio: one voice at a time', () => {
  it('a new speak stops the old one', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const first = a.speak(line);
    const second = a.speak({ ...line, id: 'b' });
    await expect(first.done).resolves.toBe('stopped');
    expect(h.elements[0]!.paused).toBe(true);
    expect(h.elements).toHaveLength(2);
    second.stop();
  });

  it('stop() resolves stopped, silences captions, and is safe twice', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const seen: Array<string | null> = [];
    const handle = a.speak(line, { onCaption: (t) => seen.push(t) });
    handle.stop();
    handle.stop();
    await expect(handle.done).resolves.toBe('stopped');
    h.clock.advance(10000);
    expect(seen).not.toContain('Watch the wind.');
    expect(h.clock.pending()).toBe(0);
  });

  it('stopSpeech cancels speech synthesis', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const { audioSrc: _unused, ...noFile } = line;
    void _unused;
    const handle = a.speak(noFile);
    a.stopSpeech();
    expect(h.speech.cancelCalls).toBeGreaterThan(0);
    await expect(handle.done).resolves.toBe('stopped');
  });

  it('stopSpeech with nothing playing is harmless', () => {
    const a = createAudioManager(createHarness().env, init);
    expect(() => a.stopSpeech()).not.toThrow();
  });

  it('a stale file error after stop does not start speech', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.speak(line).stop();
    h.elements[0]!.onerror?.();
    expect(h.speech.spoken).toHaveLength(0);
  });
});
