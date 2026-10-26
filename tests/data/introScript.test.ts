import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAPTION_LEAD_MS, INTRO_SCRIPT, timeCaptions } from '../../src/data/introScript';
import timings from '../../src/data/introTimings.json';

interface MeasuredClip {
  durationMs: number;
  gaps: Array<{ startMs: number; endMs: number }>;
}
/** Decoded length vs MP4 header: AAC adds encoder padding (about 130 ms). Same bound as the check above. */
const DURATION_TOLERANCE_MS = 300;
/** How far the plain length-based estimate may sit from the measured caption start. */
const ESTIMATE_TOLERANCE_MS = 1500;

const md = readFileSync(new URL('../../docs/NARRATION.md', import.meta.url), 'utf8');

/** duration_ms of the intro rows in db/voice.sqlite (table voice_clips), in card order. */
const DB_DURATIONS_MS = [6443, 7381, 9600, 11328, 9600];

/** Reads the length of an MP4/M4A file from its moov > mvhd box. */
function mp4DurationMs(buf: Buffer): number {
  const find = (start: number, end: number, name: string): [number, number] | null => {
    let at = start;
    while (at + 8 <= end) {
      const size = buf.readUInt32BE(at);
      if (size < 8) return null;
      if (buf.toString('latin1', at + 4, at + 8) === name) return [at + 8, at + size];
      at += size;
    }
    return null;
  };
  const moov = find(0, buf.length, 'moov');
  const mvhd = moov && find(moov[0], moov[1], 'mvhd');
  if (!mvhd) throw new Error('no mvhd box');
  const [start] = mvhd;
  const version = buf.readUInt8(start);
  const timescale = buf.readUInt32BE(start + (version === 1 ? 20 : 12));
  const duration =
    version === 1 ? Number(buf.readBigUInt64BE(start + 24)) : buf.readUInt32BE(start + 16);
  return (duration / timescale) * 1000;
}

/** Pulls each card's quoted narration and title out of NARRATION.md. */
function parseNarration(): Array<{ heading: string; text: string; title: string | null }> {
  const section = md.split('## Script (5 cards)')[1]!.split('**Total:**')[0]!;
  const parts = section.split(/\n(?=\*\*Card \d)/).filter((p) => p.startsWith('**Card'));
  return parts.map((p) => {
    const heading = /\*\*(Card \d[^*]*)\*\*/.exec(p)![1]!;
    const text = p
      .split('\n')
      .filter((l) => l.startsWith('> '))
      .map((l) => l.slice(2))
      .join(' ')
      .trim();
    const title = /Card title: "([^"]+)"/.exec(p)?.[1] ?? null;
    return { heading, text, title };
  });
}

describe('INTRO_SCRIPT matches docs/NARRATION.md', () => {
  const narration = parseNarration();

  it('NARRATION.md still has 5 cards (guards the parser)', () => {
    expect(narration).toHaveLength(5);
    narration.forEach((n) => expect(n.text.length).toBeGreaterThan(50));
  });

  it('has exactly 5 cards in order', () => {
    expect(INTRO_SCRIPT.map((c) => c.id)).toEqual([
      'welcome',
      'aim',
      'two-shots',
      'reload',
      'wipeouts',
    ]);
  });

  it.each([0, 1, 2, 3, 4])('card %i narration text is exactly the document text', (i) => {
    expect(INTRO_SCRIPT[i]!.fallbackText).toBe(narration[i]!.text);
  });

  it.each([1, 2, 3, 4])('card %i title matches the document', (i) => {
    expect(INTRO_SCRIPT[i]!.title).toBe(narration[i]!.title);
  });

  it('card 1 title is Welcome and its first caption is the cue text', () => {
    expect(INTRO_SCRIPT[0]!.title).toBe('Welcome');
    expect(INTRO_SCRIPT[0]!.captions[0]!.text).toBe('Welcome to Time Clash!');
  });

  it('audio paths follow the file layout (m4a: AAC in MP4, plays in Chromium, WebKit and iPad Safari)', () => {
    expect(INTRO_SCRIPT.map((c) => c.audio)).toEqual([
      '/audio/voice/intro-01-welcome.m4a',
      '/audio/voice/intro-02-aim.m4a',
      '/audio/voice/intro-03-shoot-twice.m4a',
      '/audio/voice/intro-04-reload.m4a',
      '/audio/voice/intro-05-wipeouts-and-passing-the-screen.m4a',
    ]);
  });

  it('durations are the real clip lengths, rounded to the nearest 100 ms', () => {
    expect(INTRO_SCRIPT.map((c) => c.durationMs)).toEqual(
      DB_DURATIONS_MS.map((d) => Math.round(d / 100) * 100),
    );
  });

  it.each([0, 1, 2, 3, 4])('card %i audio file exists and its length matches the script', (i) => {
    const card = INTRO_SCRIPT[i]!;
    const file = new URL(`../../public${card.audio}`, import.meta.url);
    expect(existsSync(file), `${card.audio} is missing; run scripts/extract-voice-clips.py`).toBe(
      true,
    );
    const real = mp4DurationMs(readFileSync(file));
    // Read from the MP4 header itself, so the file and the script cannot drift apart.
    expect(Math.abs(real - card.durationMs)).toBeLessThanOrEqual(300);
    // And it agrees with the database row it was extracted from.
    expect(Math.abs(DB_DURATIONS_MS[i]! - card.durationMs)).toBeLessThanOrEqual(300);
  });

  it.each([0, 1, 2, 3, 4])('card %i last caption keeps at least 1 s on screen', (i) => {
    const card = INTRO_SCRIPT[i]!;
    expect(card.durationMs - card.captions.at(-1)!.startMs).toBeGreaterThanOrEqual(1000);
  });

  it.each([0, 1, 2, 3, 4])('card %i captions rebuild the full text and are timed in order', (i) => {
    const card = INTRO_SCRIPT[i]!;
    expect(card.captions.map((c) => c.text).join(' ')).toBe(card.fallbackText);
    expect(card.captions[0]!.startMs).toBe(0);
    for (let k = 1; k < card.captions.length; k++) {
      expect(card.captions[k]!.startMs).toBeGreaterThan(card.captions[k - 1]!.startMs);
    }
    expect(card.captions.at(-1)!.startMs).toBeLessThan(card.durationMs);
  });

  it('every caption is one short sentence a 2nd grader can follow', () => {
    for (const card of INTRO_SCRIPT) {
      for (const c of card.captions) expect(c.text.length).toBeLessThanOrEqual(60);
    }
  });

  it('the intro runs about 40 seconds and Card 4 has 4 captions or fewer', () => {
    const total = INTRO_SCRIPT.reduce((n, c) => n + c.durationMs, 0);
    expect(total).toBeGreaterThanOrEqual(35_000);
    expect(total).toBeLessThanOrEqual(45_000);
    expect(INTRO_SCRIPT[3]!.captions.length).toBeLessThanOrEqual(4);
  });

  it('captions are spread in proportion to sentence length (timeCaptions)', () => {
    const [a, b, c] = timeCaptions(['aaaa', 'bbbb', 'cccc'], 10_000);
    expect([a!.startMs, b!.startMs, c!.startMs]).toEqual([0, 3000, 6000]);
  });

  it('every card has an art id', () => {
    INTRO_SCRIPT.forEach((c) => expect(c.art.length).toBeGreaterThan(0));
  });

  it('timeCaptions starts each later caption where a measured pause ends (longest pauses win)', () => {
    const gaps = [
      { startMs: 1000, endMs: 1400 },
      { startMs: 2000, endMs: 2100 },
      { startMs: 3000, endMs: 3500 },
    ];
    const c = timeCaptions(['a', 'b', 'c'], 6000, gaps);
    expect(c.map((x) => x.startMs)).toEqual([0, 1400 - CAPTION_LEAD_MS, 3500 - CAPTION_LEAD_MS]);
  });

  it('timeCaptions falls back to the length estimate when there are too few pauses', () => {
    const c = timeCaptions(['aaaa', 'bbbb', 'cccc'], 10_000, [{ startMs: 1000, endMs: 1400 }]);
    expect(c.map((x) => x.startMs)).toEqual([0, 3000, 6000]);
  });
});

// Measured data: src/data/introTimings.json, written by scripts/measure-intro-timings.py.
describe('intro caption times against the measured clips', () => {
  const clipName = (i: number): string => INTRO_SCRIPT[i]!.audio.split('/').pop()!;
  const measured = (i: number) => (timings as Record<string, MeasuredClip>)[clipName(i)]!;

  it('measured data exists for every intro clip', () => {
    INTRO_SCRIPT.forEach((_, i) => expect(measured(i), clipName(i)).toBeDefined());
  });

  it.each([0, 1, 2, 3, 4])('card %i measured length matches the MP4 header and the script', (i) => {
    const real = mp4DurationMs(readFileSync(new URL(`../../public${INTRO_SCRIPT[i]!.audio}`, import.meta.url)));
    expect(Math.abs(measured(i).durationMs - real)).toBeLessThanOrEqual(DURATION_TOLERANCE_MS);
    expect(Math.abs(measured(i).durationMs - INTRO_SCRIPT[i]!.durationMs)).toBeLessThanOrEqual(
      DURATION_TOLERANCE_MS,
    );
  });

  it.each([0, 1, 2, 3, 4])('card %i captions all start inside the real clip, with at least 1 s left', (i) => {
    const real = measured(i).durationMs;
    for (const c of INTRO_SCRIPT[i]!.captions) expect(c.startMs).toBeLessThan(real - 1000);
  });

  it.each([0, 1, 2, 3, 4])('card %i has a measured pause for every sentence break', (i) => {
    expect(measured(i).gaps.length).toBeGreaterThanOrEqual(INTRO_SCRIPT[i]!.captions.length - 1);
  });

  it.each([0, 1, 2, 3, 4])('card %i caption starts sit right after a measured pause', (i) => {
    const gaps = measured(i).gaps;
    for (const c of INTRO_SCRIPT[i]!.captions.slice(1)) {
      const near = gaps.some((g) => Math.abs(g.endMs - CAPTION_LEAD_MS - c.startMs) <= 10);
      expect(near, `caption "${c.text}" at ${c.startMs}`).toBe(true);
    }
  });

  it.each([0, 1, 2, 3, 4])(
    'card %i old length estimate stays within %i ms of the measured start',
    (i) => {
      const card = INTRO_SCRIPT[i]!;
      const estimate = timeCaptions(
        card.captions.map((c) => c.text),
        measured(i).durationMs,
      );
      estimate.forEach((e, k) => {
        expect(Math.abs(e.startMs - card.captions[k]!.startMs)).toBeLessThanOrEqual(
          ESTIMATE_TOLERANCE_MS,
        );
      });
    },
  );
});
