// Sound has to keep working on a real iPad: calls, lock screens, slow voices, and hidden tabs.
import { describe, expect, it } from 'vitest';
import { createAudioManager } from '../../src/audio/audioManager';
import type { VoiceLine } from '../../src/audio/types';
import { createHarness, type FakeAudioContext } from './fakes';

const init = { muted: false, volume: 0.7 };

const longLine: VoiceLine = {
  id: 'two-shots',
  text: 'You get two shots. Hit the base. Each base has one hundred health. Empty the bar to win!',
  captions: [
    { text: 'You get two shots.', startMs: 0 },
    { text: 'Hit the base.', startMs: 2500 },
    { text: 'Each base has one hundred health.', startMs: 5000 },
    { text: 'Empty the bar to win!', startMs: 7600 },
  ],
  durationMs: 10000,
};

describe('captions never go missing', () => {
  it('a voice that finishes early still shows every caption, in order, then clears', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const seen: Array<string | null> = [];
    const handle = a.speak(longLine, { onCaption: (t) => seen.push(t) });
    expect(handle.source).toBe('synthesis');
    h.clock.advance(7000); // the voice is fast: done at 7 s, before the last caption is due
    h.speech.finishLast();
    await handle.done;
    const texts = seen.filter((t): t is string => t !== null);
    expect(texts).toEqual(longLine.captions.map((c) => c.text));
    expect(seen.at(-1)).toBeNull();
  });

  it('flushes only the captions that were still waiting, never one twice', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const seen: string[] = [];
    const handle = a.speak(longLine, { onCaption: (t) => void (t && seen.push(t)) });
    h.clock.advance(5100);
    h.speech.finishLast();
    await handle.done;
    expect(seen).toEqual(longLine.captions.map((c) => c.text));
  });

  it('stopping a line (Skip) does not dump the rest of its captions', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const seen: string[] = [];
    const handle = a.speak(longLine, { onCaption: (t) => void (t && seen.push(t)) });
    h.clock.advance(100);
    handle.stop();
    await handle.done;
    expect(seen).toEqual(['You get two shots.']);
  });
});

describe('sound comes back after an interruption', () => {
  it('playSfx resumes a context that was interrupted', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const before = h.ctx.resumeCalls;
    (h.ctx as unknown as { state: string }).state = 'interrupted';
    a.playSfx('click');
    expect(h.ctx.resumeCalls).toBeGreaterThan(before);
  });

  it('speak resumes it too', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const before = h.ctx.resumeCalls;
    (h.ctx as unknown as { state: string }).state = 'suspended';
    a.speak(longLine);
    expect(h.ctx.resumeCalls).toBeGreaterThan(before);
  });

  it('a state change to interrupted asks the context to resume', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const before = h.ctx.resumeCalls;
    (h.ctx as unknown as { state: string }).state = 'interrupted';
    (h.ctx as FakeAudioContext).onstatechange?.();
    expect(h.ctx.resumeCalls).toBeGreaterThan(before);
  });

  it('the next tap resumes it (unlock is safe to call again)', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    const before = h.ctx.resumeCalls;
    (h.ctx as unknown as { state: string }).state = 'interrupted';
    await a.unlock();
    expect(h.ctx.resumeCalls).toBeGreaterThan(before);
    expect(h.contextsCreated()).toBe(1);
  });

  it('does not resume while muted, and never throws if resume fails', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, { muted: true, volume: 0.7 });
    await a.unlock();
    h.ctx.resume = () => Promise.reject(new Error('no'));
    (h.ctx as unknown as { state: string }).state = 'interrupted';
    expect(() => a.playSfx('click')).not.toThrow();
    expect(() => (h.ctx as FakeAudioContext).onstatechange?.()).not.toThrow();
  });
});

describe('speech works on iPad', () => {
  it('unlock primes speech inside the tap, with a silent utterance', () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    void a.unlock(); // the tap handler does not await
    expect(h.speech.primers).toHaveLength(1);
    expect(h.speech.primers[0]!.volume).toBe(0);
    expect(h.speech.spoken).toHaveLength(0);
  });

  it('priming happens once, even if unlock runs again', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    await a.unlock();
    expect(h.speech.primers).toHaveLength(1);
  });

  it('a muted visit makes no speech call at all, and unmuting (a tap) primes it then', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, { muted: true, volume: 0.7 });
    await a.unlock();
    expect(h.speech.primers).toHaveLength(0);
    a.setMuted(false);
    expect(h.speech.primers).toHaveLength(1);
    a.setMuted(true);
    a.setMuted(false);
    expect(h.speech.primers).toHaveLength(1);
  });

  it('priming never breaks unlock when speech is missing or throws', async () => {
    const none = createHarness({ noSpeech: true });
    await expect(createAudioManager(none.env, init).unlock()).resolves.toBeUndefined();
    const bad = createHarness();
    bad.speech.speak = () => {
      throw new Error('nope');
    };
    await expect(createAudioManager(bad.env, init).unlock()).resolves.toBeUndefined();
  });

  it('speaks in English, and prefers a voice that stays on the device', async () => {
    const h = createHarness();
    (h.speech as unknown as { getVoices: () => unknown[] }).getVoices = () => [
      { name: 'Net', lang: 'en-US', localService: false },
      { name: 'Local', lang: 'en-GB', localService: true },
      { name: 'Hola', lang: 'es-ES', localService: true },
    ];
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.speak(longLine);
    const u = h.speech.spoken[0] as unknown as { lang: string; voice: { name: string } };
    expect(u.lang).toBe('en-US');
    expect(u.voice.name).toBe('Local');
  });

  it('with no voice list it still sets the language', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.speak(longLine);
    expect((h.speech.spoken[0] as unknown as { lang: string }).lang).toBe('en-US');
  });
});

describe('music rests when the page is hidden', () => {
  it('stops the loop and suspends the context, then brings both back', async () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    await a.unlock();
    a.setMusicTeam('PAST');
    expect(a.musicPlaying).toBe(true);
    a.setPageHidden(true);
    expect(a.musicPlaying).toBe(false);
    expect(h.ctx.suspendCalls).toBe(1);
    const before = h.ctx.resumeCalls;
    a.setPageHidden(false);
    expect(h.ctx.resumeCalls).toBeGreaterThan(before);
    expect(a.musicPlaying).toBe(true);
  });

  it('does nothing before the first tap', () => {
    const h = createHarness();
    const a = createAudioManager(h.env, init);
    a.setPageHidden(true);
    a.setPageHidden(false);
    expect(h.ctx.suspendCalls).toBe(0);
    expect(h.contextsCreated()).toBe(0);
  });
});

describe('music switch is saved', () => {
  it('starts off when the saved setting says so, and reports a change', async () => {
    const h = createHarness();
    const saved: Array<{ muted: boolean; volume: number; musicOn: boolean }> = [];
    const a = createAudioManager(h.env, { ...init, musicOn: false }, (st) => void saved.push(st));
    expect(a.musicOn).toBe(false);
    await a.unlock();
    a.setMusicTeam('PAST');
    expect(a.musicPlaying).toBe(false);
    a.setMusicOn(true);
    expect(a.musicPlaying).toBe(true);
    expect(saved.at(-1)).toEqual({ muted: false, volume: 0.7, musicOn: true });
  });
});
