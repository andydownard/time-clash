import { describe, expect, it } from 'vitest';
import { TIMING, TUMBLE_LINE_COUNT } from '../../../src/game/config';
import { TUMBLE_LINES } from '../../../src/data/copy';
import type { BlastOutcome } from '../../../src/game/types';
import {
  TUMBLE_STEPS,
  bubbleText,
  tumblePose,
  tumbleTimeline,
  tumblingTeam,
} from '../../../src/scenes/battle/tumble';

const outcome = (over: Partial<BlastOutcome>): BlastOutcome => ({
  result: 'near',
  target: 'FUTURE',
  damage: 10,
  tumble: true,
  bubbleIndex: 2,
  ...over,
});

describe('tumbleTimeline', () => {
  it('lists the six steps in the spec order', () => {
    expect(TUMBLE_STEPS).toEqual([
      'fold',
      'windmill',
      'pancake',
      'spring',
      'lookLeft',
      'lookRight',
    ]);
    expect(tumbleTimeline().map((s) => s.step)).toEqual([...TUMBLE_STEPS]);
  });
  it('is contiguous and adds up to TIMING.tumbleMs', () => {
    const tl = tumbleTimeline();
    expect(tl[0]!.startMs).toBe(0);
    for (let i = 1; i < tl.length; i++) expect(tl[i]!.startMs).toBe(tl[i - 1]!.endMs);
    expect(tl[tl.length - 1]!.endMs).toBe(TIMING.tumbleMs);
    for (const s of tl) expect(s.endMs).toBeGreaterThan(s.startMs);
  });
  it('scales to another total', () => {
    const tl = tumbleTimeline(500);
    expect(tl[tl.length - 1]!.endMs).toBe(500);
  });
});

describe('tumblePose', () => {
  const total = TIMING.tumbleMs;
  const mid = (name: (typeof TUMBLE_STEPS)[number]) => {
    const s = tumbleTimeline().find((x) => x.step === name)!;
    return (s.startMs + s.endMs) / 2;
  };
  it('starts and ends standing upright', () => {
    for (const t of [0, total]) {
      const p = tumblePose(t);
      expect(p.squashY).toBeCloseTo(1);
      expect(p.rotationDeg % 360).toBeCloseTo(0);
      expect(p.armSwingDeg).toBeCloseTo(0);
    }
  });
  it('is flattest in the pancake step', () => {
    const flat = tumblePose(mid('pancake')).squashY;
    expect(flat).toBeLessThan(0.3);
    for (const t of [0, mid('fold'), mid('windmill'), mid('spring'), total]) {
      expect(tumblePose(t).squashY).toBeGreaterThan(flat);
    }
  });
  it('swings the arms in the windmill step', () => {
    const a = tumblePose(mid('windmill') - 60).armSwingDeg;
    const b = tumblePose(mid('windmill') + 60).armSwingDeg;
    expect(a).not.toBeCloseTo(b);
  });
  it('lifts off the ground only while springing up', () => {
    expect(tumblePose(mid('spring')).lift).toBeGreaterThan(0);
    expect(tumblePose(mid('pancake')).lift).toBe(0);
  });
  it('looks left, then right', () => {
    expect(tumblePose(mid('lookLeft')).lookDir).toBe(-1);
    expect(tumblePose(mid('lookRight')).lookDir).toBe(1);
    expect(tumblePose(mid('pancake')).lookDir).toBe(0);
  });
  it('clamps time outside the range and survives NaN', () => {
    expect(tumblePose(-500)).toEqual(tumblePose(0));
    expect(tumblePose(total * 3)).toEqual(tumblePose(total));
    expect(Number.isFinite(tumblePose(NaN).squashY)).toBe(true);
  });
  it('reports which step is playing', () => {
    expect(tumblePose(0).step).toBe('fold');
    expect(tumblePose(total).step).toBe('lookRight');
  });
});

describe('who tumbles and what they say', () => {
  it('the defender tumbles on a near miss only', () => {
    expect(tumblingTeam(outcome({ target: 'FUTURE' }))).toBe('FUTURE');
    expect(tumblingTeam(outcome({ target: 'PAST' }))).toBe('PAST');
    expect(
      tumblingTeam(outcome({ result: 'direct', tumble: false, bubbleIndex: null })),
    ).toBeNull();
    expect(tumblingTeam(outcome({ result: 'miss', tumble: false, bubbleIndex: null }))).toBeNull();
  });
  it('picks the bubble line by the seeded index', () => {
    expect(TUMBLE_LINES).toHaveLength(TUMBLE_LINE_COUNT);
    TUMBLE_LINES.forEach((line, i) => expect(bubbleText(outcome({ bubbleIndex: i }))).toBe(line));
  });
  it('gives no line when nobody tumbled or the index is bad', () => {
    expect(bubbleText(outcome({ tumble: false, bubbleIndex: null }))).toBeNull();
    expect(bubbleText(outcome({ bubbleIndex: 99 }))).toBeNull();
    expect(bubbleText(outcome({ bubbleIndex: -1 }))).toBeNull();
  });
});
