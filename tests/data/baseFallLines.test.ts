// The funny lines a fighter says when the brick under it falls (owner, 2026-10-25). Short, kind
// and cheeky. Nobody is hurt. Each team has its own pool, as long as the bag expects.
import { describe, expect, it } from 'vitest';
import { BASE_FALL_LINE_COUNT, RNG_SALT } from '../../src/game/config';
import { createShuffleBag } from '../../src/game/bag';
import { createRng } from '../../src/game/rng';
import {
  BASE_FALL_LINES,
  BASE_FALL_LINES_FUTURE,
  BASE_FALL_LINES_PAST,
  baseFallPool,
  tumblePool,
} from '../../src/data/copy';

const words = (line: string): number => line.split(/\s+/).filter(Boolean).length;
const TEAMS = ['PAST', 'FUTURE'] as const;
const all = [...new Set([...baseFallPool('PAST'), ...baseFallPool('FUTURE')])];

describe('base fall lines', () => {
  it('each team has at least 12, exactly as many as the bag expects', () => {
    for (const team of TEAMS) {
      expect(baseFallPool(team)).toHaveLength(BASE_FALL_LINE_COUNT);
      expect(baseFallPool(team).length).toBeGreaterThanOrEqual(12);
    }
  });

  it('a few are shared; each team never says the other team’s own lines', () => {
    expect(BASE_FALL_LINES.length).toBeGreaterThanOrEqual(2);
    for (const l of BASE_FALL_LINES_PAST) expect(baseFallPool('FUTURE')).not.toContain(l);
    for (const l of BASE_FALL_LINES_FUTURE) expect(baseFallPool('PAST')).not.toContain(l);
    expect(BASE_FALL_LINES_PAST).toHaveLength(BASE_FALL_LINES_FUTURE.length);
  });

  it('has no repeats in a pool, and none is a wipeout line', () => {
    for (const team of TEAMS) {
      const pool = baseFallPool(team);
      expect(new Set(pool).size).toBe(pool.length);
      for (const l of pool) expect(tumblePool(team)).not.toContain(l);
    }
  });

  it('every line is at most 8 words', () => {
    for (const l of all) expect(words(l), l).toBeLessThanOrEqual(8);
  });

  it('never says a banned or scary word', () => {
    const banned =
      /\b(kill|die|dies|died|dead|blood|gore|defeat|buy|price|shop|hurt|pain|bleed|broke|broken|cry|scared|hospital|death)\b/i;
    for (const l of all) expect(l).not.toMatch(banned);
  });

  it('a seeded bag never says the same line twice in a row, even across a refill (Regression 9)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const bag = createShuffleBag(
        createRng((seed ^ RNG_SALT.baseFalls) >>> 0),
        BASE_FALL_LINE_COUNT,
      );
      const seen = Array.from({ length: BASE_FALL_LINE_COUNT * 3 }, () => bag.next());
      for (let i = 1; i < seen.length; i++) expect(seen[i], `seed ${seed}`).not.toBe(seen[i - 1]);
      expect(new Set(seen.slice(0, BASE_FALL_LINE_COUNT)).size).toBe(BASE_FALL_LINE_COUNT);
    }
  });
});
