// Child-facing words must be easy to read (AGENTS.md "Voice and writing": third-grade level).
import { describe, expect, it } from 'vitest';
import * as COPY from '../../src/data/copy';
import * as COMPUTER_COPY from '../../src/data/computerCopy';
import { INTRO_SCRIPT } from '../../src/data/introScript';
import * as SHAPE_COPY from '../../src/data/shapeCopy';

const MAX_WORDS = 10;
const HARD_WORDS = [
  'cringe',
  'protocol',
  'calibrating',
  'calibrate',
  'tactical',
  'maneuver',
  'black magic',
  '404',
  'error',
  'algorithm',
  'initialize',
];

/**
 * Each copy function is called with several sets of arguments, so every branch is read. One call
 * with ('Alex', 1, 'Sam') once missed an 11-word sentence in the dasher's Hear it line.
 */
const ARG_SETS: readonly unknown[][] = [
  ['Alex', 1, 'Sam'],
  ['dasher', 'Robo Bonk'],
  ['launcher', 'Laser Crew'],
  ['Sir Bonk', 2, 4],
  [true],
  [false],
  ['Rail Cannon', 'Bounces once.', true, 12, 3],
  ['Rail Cannon', 'Bounces once.', false, 12, 3],
  [null, 3, true],
  ['POWER'],
];

function allStrings(): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      const fn = v as (...a: unknown[]) => unknown;
      visit(fn(...ARG_SETS[0]!));
      // The other sets may not fit every function's types. A call that throws is skipped.
      for (const args of ARG_SETS.slice(1)) {
        let got: unknown;
        try {
          got = fn(...args);
        } catch {
          got = null;
        }
        visit(got);
      }
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  // Every module of words a child reads: the main copy, My shape, and the Computer player.
  visit(COPY);
  visit(SHAPE_COPY);
  visit(COMPUTER_COPY);
  for (const card of INTRO_SCRIPT) for (const c of card.captions) out.push(c.text);
  return out;
}

const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

describe('child-facing copy is easy to read', () => {
  const strings = allStrings();

  it('checks a lot of strings', () => {
    expect(strings.length).toBeGreaterThan(100);
  });

  it(`no sentence runs past ${MAX_WORDS} words`, () => {
    const long = strings.flatMap(sentences).filter((s) => s.split(/\s+/).length > MAX_WORDS);
    expect(long).toEqual([]);
  });

  it.each(HARD_WORDS)('never uses the hard word "%s"', (word) => {
    const hit = strings.filter((s) => s.toLowerCase().includes(word));
    expect(hit).toEqual([]);
  });
});

describe('Chrono has plenty of lines, so jokes do not repeat quickly', () => {
  it('has at least 12 different tumble lines', () => {
    expect(new Set(COPY.TUMBLE_LINES).size).toBeGreaterThanOrEqual(12);
  });
  it.each(['direct', 'near', 'miss'] as const)('has at least 3 %s lines', (k) => {
    expect(new Set(COPY.HIT_LINES[k]).size).toBeGreaterThanOrEqual(3);
    expect(COPY.HIT_LINES[k]).toContain(COPY.HITS[k]);
  });
  it.each(['fast', 'slow', 'wrong'] as const)('has 3 to 5 warm %s reload lines', (k) => {
    const lines = COPY.RELOAD_QUIPS[k];
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length).toBeLessThanOrEqual(5);
    expect(new Set(lines).size).toBe(lines.length);
  });
});
