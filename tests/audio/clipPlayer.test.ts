import { describe, expect, it } from 'vitest';
import { createAudioManager } from '../../src/audio/audioManager';
import { CLIP_START_TIMEOUT_MS, createClipPlayer } from '../../src/audio/clipPlayer';
import { clipId } from '../../src/audio/clipId';
import type { VoiceLine } from '../../src/audio/types';
import { createHarness } from './fakes';

const init = { muted: false, volume: 0.7 };
const TEXT = 'What is 7 x 8?';
const line: VoiceLine = {
  id: 'read-question',
  text: TEXT,
  captions: [
    { text: 'What is 7 x 8?', startMs: 0 },
    { text: 'Think it over.', startMs: 2000 },
  ],
  durationMs: 4000,
};

describe('clip url', () => {
  it('is the same-origin path /v1/clips/ + clipId(text), with no host in it', () => {
    const p = createClipPlayer(true);
    expect(p.enabled).toBe(true);
    expect(p.urlFor(TEXT)).toBe(`/v1/clips/${clipId(TEXT)}`);
    expect(p.urlFor(TEXT)).toBe('/v1/clips/t:a080310abdfed25d');
    expect(p.urlFor(TEXT)).not.toMatch(/https?:|\/\//);
  });

  it('ignores whitespace differences in the text', () => {
    expect(createClipPlayer(true).urlFor('a  b')).toBe(`/v1/clips/${clipId('a b')}`);
  });

  it('is OFF when the build flag is off', () => {
    const p = createClipPlayer(false);
    expect(p.enabled).toBe(false);
    expect(p.urlFor(TEXT)).toBeNull();
  });

  it('does not offer a text again after a miss', () => {
    const p = createClipPlayer(true);
    p.markMissed(TEXT);
    expect(p.urlFor(TEXT)).toBeNull();
    expect(p.urlFor('another line')).not.toBeNull();
  });
});

async function unlocked(clips = createClipPlayer(true), opts = {}) {
  const h = createHarness({ clips, ...opts });
  const a = createAudioManager(h.env, init);
  await a.unlock();
  return { h, a, clips };
}

describe('fallback order', () => {
  it('a line with its own file uses that file, never the clip', async () => {
    const { h, a } = await unlocked();
    a.speak({ ...line, audioSrc: '/audio/voice/intro-01.m4a' });
    expect(h.elements.map((e) => e.src)).toEqual(['/audio/voice/intro-01.m4a']);
  });

  it('with no file, the clip plays through the manager at the voice volume', async () => {
    const { h, a } = await unlocked();
    const handle = a.speak(line);
    expect(handle.source).toBe('file');
    expect(h.elements.map((e) => e.src)).toEqual([`/v1/clips/${clipId(TEXT)}`]);
    expect(h.elements[0]!.played).toBe(1);
    expect(h.speech.spoken).toHaveLength(0);
    h.elements[0]!.onplaying?.();
    h.elements[0]!.onended?.();
    await expect(handle.done).resolves.toBe('ended');
  });

  it('a line marked noClip never asks the voice service, and uses the device voice', async () => {
    const { h, a } = await unlocked();
    const handle = a.speak({ ...line, noClip: true });
    expect(h.elements).toHaveLength(0);
    expect(handle.source).toBe('synthesis');
    expect(h.speech.spoken.map((u) => u.text)).toEqual([TEXT]);
  });

  it('feature off: speech only, exactly as before', async () => {
    const { h, a } = await unlocked(createClipPlayer(false));
    const handle = a.speak(line);
    expect(h.elements).toHaveLength(0);
    expect(handle.source).toBe('synthesis');
    expect(a.clipsEnabled).toBe(false);
  });

  it('a clip that errors (404) falls back to speech at once and is not retried', async () => {
    const { h, a, clips } = await unlocked();
    const first = a.speak(line);
    h.elements[0]!.onerror?.();
    expect(first.source).toBe('synthesis');
    expect(h.speech.spoken).toHaveLength(1);
    expect(clips.urlFor(TEXT)).toBeNull();
    a.speak(line);
    expect(h.elements).toHaveLength(1); // no second request for the same id
    expect(h.speech.spoken).toHaveLength(2);
  });

  it('a slow clip falls back after about 1.5 s and is remembered as a miss', async () => {
    const { h, a, clips } = await unlocked();
    const handle = a.speak(line);
    h.clock.advance(CLIP_START_TIMEOUT_MS - 1);
    expect(handle.source).toBe('file');
    h.clock.advance(1);
    expect(handle.source).toBe('synthesis');
    expect(h.elements[0]!.paused).toBe(true);
    expect(clips.urlFor(TEXT)).toBeNull();
  });

  it('a clip that starts in time is not cut off', async () => {
    const { h, a } = await unlocked();
    const handle = a.speak(line);
    h.clock.advance(800);
    h.elements[0]!.onplaying?.();
    h.clock.advance(CLIP_START_TIMEOUT_MS);
    expect(handle.source).toBe('file');
    expect(h.speech.spoken).toHaveLength(0);
  });

  it('a play() rejection falls back to speech', async () => {
    const { h, a } = await unlocked(createClipPlayer(true), { elementResult: 'reject' });
    const handle = a.speak(line);
    await Promise.resolve();
    await Promise.resolve();
    expect(handle.source).toBe('synthesis');
    expect(h.speech.spoken).toHaveLength(1);
  });

  it('no speech and a dead clip: captions still run silently', async () => {
    const { h, a } = await unlocked(createClipPlayer(true), { noSpeech: true });
    const seen: Array<string | null> = [];
    const handle = a.speak(line, { onCaption: (t) => seen.push(t) });
    h.elements[0]!.onerror?.();
    expect(handle.source).toBe('silent');
    h.clock.advance(4000);
    await handle.done;
    expect(seen).toEqual(['What is 7 x 8?', 'Think it over.', null]);
  });
});

describe('rules that keep working with clips', () => {
  it('before the first tap: no request, captions still show', () => {
    const h = createHarness({ clips: createClipPlayer(true) });
    const a = createAudioManager(h.env, init);
    const handle = a.speak(line);
    expect(h.elements).toHaveLength(0);
    expect(handle.source).toBe('silent');
  });

  it('muted: no request and no speech', async () => {
    const h = createHarness({ clips: createClipPlayer(true) });
    const a = createAudioManager(h.env, { ...init, muted: true });
    await a.unlock();
    const handle = a.speak(line);
    expect(h.elements).toHaveLength(0);
    expect(handle.source).toBe('silent');
  });

  it('Mute during a clip pauses it; volume changes apply; Skip stops it', async () => {
    const { h, a } = await unlocked();
    const handle = a.speak(line);
    a.setVolume(0.2);
    expect(h.elements[0]!.volume).toBeCloseTo(0.2 * 1, 5);
    handle.stop();
    expect(h.elements[0]!.paused).toBe(true);
    await expect(handle.done).resolves.toBe('stopped');
    const again = a.speak(line);
    a.setMuted(true);
    expect(h.elements[1]!.paused).toBe(true);
    expect(again.source).toBe('silent');
  });

  it('one voice at a time: a new line stops the clip that is playing', async () => {
    const { h, a } = await unlocked();
    const first = a.speak(line);
    a.speak({ ...line, text: 'I meant to do that!' });
    expect(h.elements[0]!.paused).toBe(true);
    await expect(first.done).resolves.toBe('stopped');
  });

  it('captions follow the real clip length once it is known', async () => {
    const { h, a } = await unlocked();
    const seen: string[] = [];
    const handle = a.speak(line, { onCaption: (t) => void (t && seen.push(t)) });
    h.elements[0]!.onplaying?.();
    h.elements[0]!.duration = 8; // twice the guess: second caption moves from 2 s to 4 s
    h.elements[0]!.onloadedmetadata?.();
    h.clock.advance(3900);
    expect(seen).toEqual(['What is 7 x 8?']);
    h.clock.advance(200);
    expect(seen).toEqual(['What is 7 x 8?', 'Think it over.']);
    h.clock.advance(4100);
    h.elements[0]!.onended?.();
    await expect(handle.done).resolves.toBe('ended');
  });

  it('an odd duration (NaN, 0, Infinity) leaves the guessed timing alone', async () => {
    const { h, a } = await unlocked();
    const seen: string[] = [];
    a.speak(line, { onCaption: (t) => void (t && seen.push(t)) });
    for (const d of [NaN, 0, Infinity]) {
      h.elements[0]!.duration = d;
      h.elements[0]!.onloadedmetadata?.();
    }
    h.clock.advance(2000);
    expect(seen).toHaveLength(2);
  });
});
