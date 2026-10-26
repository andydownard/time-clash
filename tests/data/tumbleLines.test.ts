import { describe, expect, it } from 'vitest';
import { TUMBLE_LINE_COUNT } from '../../src/game/config';
import {
  TUMBLE_LINES,
  TUMBLE_LINES_FUTURE,
  TUMBLE_LINES_PAST,
  tumblePool,
} from '../../src/data/copy';

/** Lines added on 2026-10-25 (panel: a 400-health match shows far more tumbles). */
const NEW_SHARED = [
  'Boing! I bounce like a ball!',
  'That was my best cartwheel ever!',
  'I am a starfish now!',
  'Wobble, wobble, flop!',
  'My hat landed before I did!',
  'Wheee! Can we do that again?',
];
const NEW_PAST = [
  'My armor goes clink, clank, clonk!',
  'Squire! Bring me a pillow, please!',
  'My horse is laughing at me.',
  'Who left a banana peel here?',
  'Even my mustache fell over!',
];
const NEW_FUTURE = [
  'Oops. My jetpack forgot to jet.',
  'My robot socks need new batteries.',
  'I slipped on a space taco!',
  'Robot dance! Nailed it. Mostly.',
];
/** Near twins of other lines in the same pool (panel, 2026-10-24). Dropped. */
const DROPPED = [
  'I meant to do that!',
  'Whoa. The sky is sideways.',
  'I was just checking the floor.',
];

const words = (line: string): number => line.split(/\s+/).filter(Boolean).length;

describe('tumble lines', () => {
  it('both teams have a pool exactly as long as the match bag expects', () => {
    expect(tumblePool('PAST')).toHaveLength(TUMBLE_LINE_COUNT);
    expect(tumblePool('FUTURE')).toHaveLength(TUMBLE_LINE_COUNT);
    expect(TUMBLE_LINE_COUNT).toBe(30);
  });
  it('has 18 shared lines and 12 of each team’s own', () => {
    expect(TUMBLE_LINES).toHaveLength(18);
    expect(TUMBLE_LINES_PAST).toHaveLength(12);
    expect(TUMBLE_LINES_FUTURE).toHaveLength(12);
  });
  it('each team never says the other team lines', () => {
    expect(tumblePool('PAST')).toContain('Ouch! My dignity!');
    expect(tumblePool('PAST')).not.toContain('Beep boop. Ouch boop.');
    expect(tumblePool('FUTURE')).toContain('Beep boop. Ouch boop.');
    expect(tumblePool('FUTURE')).not.toContain('Ouch! My dignity!');
    for (const l of TUMBLE_LINES_PAST)
      expect(TUMBLE_LINES_FUTURE as readonly string[]).not.toContain(l);
  });
  it('has no repeated line in a pool', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const pool = tumblePool(team);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });
  it('holds the 15 new lines in the right lists', () => {
    for (const l of NEW_SHARED) expect(TUMBLE_LINES as readonly string[]).toContain(l);
    for (const l of NEW_PAST) expect(TUMBLE_LINES_PAST as readonly string[]).toContain(l);
    for (const l of NEW_FUTURE) expect(TUMBLE_LINES_FUTURE as readonly string[]).toContain(l);
  });
  it('drops the near twins, so a long match does not feel like reruns', () => {
    for (const team of ['PAST', 'FUTURE'] as const)
      for (const l of DROPPED) expect(tumblePool(team)).not.toContain(l);
  });
  it('keeps every line short: at most 10 words, and the new ones at most 6', () => {
    for (const l of [...tumblePool('PAST'), ...tumblePool('FUTURE')])
      expect(words(l), l).toBeLessThanOrEqual(10);
    for (const l of [...NEW_SHARED, ...NEW_PAST, ...NEW_FUTURE])
      expect(words(l), l).toBeLessThanOrEqual(6);
  });
  it('never says anything about getting hurt for real', () => {
    const scary = /\b(hurt|pain|blood|bleed|broke|broken|cry|scared|hospital|ouchie)\b/i;
    for (const l of [...NEW_SHARED, ...NEW_PAST, ...NEW_FUTURE]) expect(l).not.toMatch(scary);
  });
});
