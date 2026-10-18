// Child-facing words must be easy to read (AGENTS.md "Voice and writing": third-grade level).
import { describe, expect, it } from 'vitest';
import * as COPY from '../../src/data/copy';
import { INTRO_SCRIPT } from '../../src/data/introScript';

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
 * Two owner-written robot jokes for Team Future's wipeout use words on the hard list. They are
 * short, funny to say aloud, and a parent can read them. Nothing else may use these words.
 */
const ROBOT_JOKES = ['Error 404: balance not found.', 'I was calibrating the floor.'];

function allStrings(): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') visit((v as (...a: unknown[]) => unknown)('Alex', 1, 'Sam'));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(COPY);
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
    const hit = strings.filter((s) => !ROBOT_JOKES.includes(s) && s.toLowerCase().includes(word));
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
