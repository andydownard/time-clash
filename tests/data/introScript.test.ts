import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTRO_SCRIPT } from '../../src/data/introScript';

const md = readFileSync(new URL('../../docs/NARRATION.md', import.meta.url), 'utf8');

/** duration_ms of the intro rows in db/voice.sqlite (table voice_clips), in card order. */
const DB_DURATIONS_MS = [9365, 11819, 8896, 15872, 13803];

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

  it.each([0, 1, 2, 3, 4])('card %i last caption keeps at least 1.5 s on screen', (i) => {
    const card = INTRO_SCRIPT[i]!;
    expect(card.durationMs - card.captions.at(-1)!.startMs).toBeGreaterThanOrEqual(1500);
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

  it('every card has an art id', () => {
    INTRO_SCRIPT.forEach((c) => expect(c.art.length).toBeGreaterThan(0));
  });
});
