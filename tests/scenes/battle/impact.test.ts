import { describe, expect, it } from 'vitest';
import { HITS } from '../../../src/data/copy';
import { WORLD } from '../../../src/game/config';
import type { BlastOutcome, ShotResult } from '../../../src/game/types';
import { describeImpact } from '../../../src/scenes/battle/impact';

const outcome = (result: BlastOutcome['result'], target: 'PAST' | 'FUTURE'): BlastOutcome => ({
  result,
  target,
  damage: result === 'direct' ? 25 : result === 'near' ? 10 : 0,
  tumble: result === 'near',
  bubbleIndex: result === 'near' ? 0 : null,
});
const shotAt = (x: number, y: number, hit: ShotResult['hit'] = { kind: 'ground' }): ShotResult => ({
  path: [{ x, y }],
  landing: { x, y },
  hit,
  steps: 1,
});

describe('describeImpact', () => {
  it('a direct hit turns walls into toy blocks', () => {
    const i = describeImpact(
      'PAST',
      shotAt(1100, 520, { kind: 'base', team: 'FUTURE' }),
      outcome('direct', 'FUTURE'),
    );
    expect(i.kind).toBe('blocks');
    expect(i.label).toBe(HITS.direct);
    expect(i.target).toBe('FUTURE');
    expect(i.damage).toBe(25);
  });
  it('a near miss uses the shooter ammo: confetti for Past, plasma for Future', () => {
    expect(describeImpact('PAST', shotAt(900, 610), outcome('near', 'FUTURE')).kind).toBe(
      'confetti',
    );
    expect(describeImpact('FUTURE', shotAt(300, 610), outcome('near', 'PAST')).kind).toBe('plasma');
    expect(describeImpact('PAST', shotAt(900, 610), outcome('near', 'FUTURE')).label).toBe(
      HITS.near,
    );
  });
  it('a clear miss is a small effect with the miss label', () => {
    const far = describeImpact('PAST', shotAt(700, 610), outcome('miss', 'FUTURE'));
    const near = describeImpact('PAST', shotAt(900, 610), outcome('near', 'FUTURE'));
    const direct = describeImpact('PAST', shotAt(1100, 520), outcome('direct', 'FUTURE'));
    expect(far.label).toBe(HITS.miss);
    expect(far.scale).toBeLessThan(near.scale);
    expect(near.scale).toBeLessThan(direct.scale);
  });
  it('keeps the effect inside the world when a shot left the map', () => {
    const gone = describeImpact(
      'PAST',
      shotAt(WORLD.width + 400, WORLD.height + 90, { kind: 'out_of_bounds' }),
      outcome('miss', 'FUTURE'),
    );
    expect(gone.position.x).toBeLessThanOrEqual(WORLD.width);
    expect(gone.position.y).toBeLessThanOrEqual(WORLD.height);
    const left = describeImpact(
      'FUTURE',
      shotAt(-300, 100, { kind: 'out_of_bounds' }),
      outcome('miss', 'PAST'),
    );
    expect(left.position.x).toBeGreaterThanOrEqual(0);
  });
  it('never uses scary words in a label', () => {
    for (const r of ['direct', 'near', 'miss'] as const) {
      expect(describeImpact('PAST', shotAt(1, 1), outcome(r, 'FUTURE')).label).not.toMatch(
        /\b(kill|die|dead|blood|gore|defeat)\b/i,
      );
    }
  });

  it('uses a chosen label when one is given, and falls back to the plain one', () => {
    const shot = shotAt(900, 610);
    expect(
      describeImpact('PAST', shot, outcome('near', 'FUTURE'), 'Whoa, that was near!').label,
    ).toBe('Whoa, that was near!');
    expect(describeImpact('PAST', shot, outcome('near', 'FUTURE')).label).toBe(HITS.near);
  });
});
