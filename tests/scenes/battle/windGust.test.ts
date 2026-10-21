// Pre-reader cue for Wind: two short gust streaks trail behind the wind arrow, so the sign reads
// as "wind blowing this way" without the words. Calm shows no streaks (the calm dot stays).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { windArrow, windGusts } from '../../../src/scenes/battle/geometry';
import { WIND_ARROW_MAX } from '../../../src/scenes/battle/visual';

const CX = 640;
const CY = 168;

describe('wind gust streaks', () => {
  it('calm wind has no streaks', () => {
    expect(windGusts(0, CX, CY)).toEqual([]);
    expect(windGusts(Number.NaN, CX, CY)).toEqual([]);
  });

  it.each([5, -5, 40, -40, 999, -999])('wind %d has two streaks, one above and one below', (w) => {
    const g = windGusts(w, CX, CY);
    expect(g).toHaveLength(2);
    expect(g[0]!.y).toBeLessThan(CY);
    expect(g[1]!.y).toBeGreaterThan(CY);
  });

  it.each([5, -5, 40, -40, 999, -999])(
    'wind %d: streaks sit behind the tail and inside the sign',
    (w) => {
      const a = windArrow(w);
      const tail = CX - (a.dir * a.length) / 2;
      const frameHalf = (WIND_ARROW_MAX + 48) / 2;
      for (const s of windGusts(w, CX, CY)) {
        // Behind the tail: on the side the wind comes from.
        if (a.dir > 0) expect(Math.max(s.x1, s.x2)).toBeLessThanOrEqual(tail);
        else expect(Math.min(s.x1, s.x2)).toBeGreaterThanOrEqual(tail);
        // Inside the frame, even at full strength.
        expect(Math.min(s.x1, s.x2)).toBeGreaterThanOrEqual(CX - frameHalf + 4);
        expect(Math.max(s.x1, s.x2)).toBeLessThanOrEqual(CX + frameHalf - 4);
      }
    },
  );

  it('the wind sign draws the streaks', () => {
    const src = readFileSync(join(process.cwd(), 'src/scenes/battle/statusArt.ts'), 'utf8');
    expect(src).toContain('windGusts(');
  });
});
