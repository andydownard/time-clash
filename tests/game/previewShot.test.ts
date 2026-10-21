import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/game/match';
import { unitsOf } from '../../src/game/units';
import type { Players } from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 5, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'reading' },
];

describe('previewShot', () => {
  it('flies the same path fire() flies, for every fighter (their range differs)', () => {
    for (const unit of unitsOf('PAST')) {
      const c = createMatch({ players: PLAYERS, seed: 3 });
      c.ready();
      c.selectUnit(unit.id);
      c.setAim({ angleDeg: 52, power: 77 });
      const preview = c.previewShot();
      expect(c.fire().path).toEqual(preview.path);
    }
  });

  it('gives different arcs for fighters with different range', () => {
    const reach = new Set<number>();
    for (const unit of unitsOf('PAST')) {
      const c = createMatch({ players: PLAYERS, seed: 3 });
      c.ready();
      c.selectUnit(unit.id);
      c.setAim({ angleDeg: 45, power: 60 });
      const p = c.previewShot().path;
      reach.add(Math.round(Math.abs(p[p.length - 1]!.x - p[0]!.x)));
    }
    expect(reach.size).toBeGreaterThan(1);
  });

  it('takes no shot and changes nothing', () => {
    const c = createMatch({ players: PLAYERS, seed: 3 });
    c.ready();
    const before = JSON.stringify(c.snapshot());
    c.previewShot();
    c.previewShot();
    expect(JSON.stringify(c.snapshot())).toBe(before);
    expect(c.snapshot().stats.PAST.shotsFired).toBe(0);
  });
});
