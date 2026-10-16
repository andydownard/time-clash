import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTRO_SCRIPT } from '../../src/data/introScript';

const md = readFileSync(new URL('../../docs/NARRATION.md', import.meta.url), 'utf8');

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

  it('audio paths follow the file layout', () => {
    expect(INTRO_SCRIPT.map((c) => c.audio)).toEqual([
      '/audio/voice/intro-01-welcome.mp3',
      '/audio/voice/intro-02-aim.mp3',
      '/audio/voice/intro-03-two-shots.mp3',
      '/audio/voice/intro-04-reload.mp3',
      '/audio/voice/intro-05-wipeouts.mp3',
    ]);
  });

  it('lengths are about 10, 12, 10, 15, 13 seconds', () => {
    expect(INTRO_SCRIPT.map((c) => c.durationMs)).toEqual([10000, 12000, 10000, 15000, 13000]);
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
