import { describe, expect, it } from 'vitest';
import { TUMBLE_LINE_COUNT } from '../../src/game/config';
import { TUMBLE_LINES_FUTURE, TUMBLE_LINES_PAST, tumblePool } from '../../src/data/copy';

describe('tumble lines', () => {
  it('both teams have a pool exactly as long as the match bag expects', () => {
    expect(tumblePool('PAST')).toHaveLength(TUMBLE_LINE_COUNT);
    expect(tumblePool('FUTURE')).toHaveLength(TUMBLE_LINE_COUNT);
  });
  it('each team has its nine own lines, and never says the other team lines', () => {
    expect(TUMBLE_LINES_PAST).toHaveLength(9);
    expect(TUMBLE_LINES_FUTURE).toHaveLength(9);
    expect(tumblePool('PAST')).toContain('Ouch! My dignity!');
    expect(tumblePool('PAST')).not.toContain('Beep boop. Ouch boop.');
    expect(tumblePool('FUTURE')).toContain('Beep boop. Ouch boop.');
    expect(tumblePool('FUTURE')).not.toContain('Ouch! My dignity!');
  });
  it('has no repeated line in a pool', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const pool = tumblePool(team);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });
});
