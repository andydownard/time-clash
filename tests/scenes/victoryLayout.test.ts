import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/game/config';
import {
  LOSER_FLAT_MS,
  LOSER_POP_MS,
  confettiFor,
  hoverOffset,
  loserSquash,
  victoryLayout,
} from '../../src/scenes/battle/victoryLayout';

const teams = ['PAST', 'FUTURE'] as const;

describe('victoryLayout', () => {
  it('puts the winner on the podium above the loser, in the world', () => {
    for (const winner of teams) {
      const l = victoryLayout(winner, WORLD);
      expect(l.winnerFeet.y).toBeLessThan(l.loserFeet.y);
      expect(l.podium.y).toBe(l.winnerFeet.y);
      for (const p of [l.winnerFeet, l.loserFeet]) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(WORLD.width);
        expect(p.y).toBeLessThanOrEqual(WORLD.height);
      }
      expect(l.podium.x).toBeGreaterThanOrEqual(0);
      expect(l.podium.x + l.podium.w).toBeLessThanOrEqual(WORLD.width);
      expect(l.podium.y + l.podium.h).toBeLessThanOrEqual(WORLD.height);
    }
  });
  it('keeps the loser on the side of their own base', () => {
    expect(victoryLayout('FUTURE', WORLD).loserFeet.x).toBeLessThan(WORLD.width / 2);
    expect(victoryLayout('PAST', WORLD).loserFeet.x).toBeGreaterThan(WORLD.width / 2);
  });
  it('fits 1024x576 and 768x432 worlds too (the canvas scales, the layout is in world units)', () => {
    for (const size of [
      { width: 1024, height: 576 },
      { width: 768, height: 432 },
    ]) {
      const l = victoryLayout('PAST', size);
      expect(l.podium.x + l.podium.w).toBeLessThanOrEqual(size.width);
      expect(l.loserFeet.x).toBeLessThan(size.width);
    }
  });
});

describe('confettiFor', () => {
  it('is the same every time (seeded)', () => {
    expect(confettiFor('PAST', WORLD)).toEqual(confettiFor('PAST', WORLD));
  });
  it('differs by winner', () => {
    expect(confettiFor('PAST', WORLD)).not.toEqual(confettiFor('FUTURE', WORLD));
  });
  it('starts above the screen and lands inside it, with a color each', () => {
    const pieces = confettiFor('FUTURE', WORLD);
    expect(pieces.length).toBeGreaterThanOrEqual(40);
    for (const p of pieces) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(WORLD.width);
      expect(p.startY).toBeLessThan(0);
      expect(p.endY).toBeGreaterThan(0);
      expect(p.endY).toBeLessThanOrEqual(WORLD.height);
      expect(p.delayMs).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(p.color)).toBe(true);
    }
  });
});

describe('loserSquash', () => {
  it('starts flat, stays flat, then pops back to full height', () => {
    expect(loserSquash(0)).toBeLessThan(0.3);
    expect(loserSquash(LOSER_FLAT_MS - 1)).toBeLessThan(0.3);
    expect(loserSquash(LOSER_FLAT_MS + LOSER_POP_MS)).toBe(1);
    expect(loserSquash(LOSER_FLAT_MS + LOSER_POP_MS * 10)).toBe(1);
  });
  it('overshoots a little on the way up (a boing), never below flat or far above full', () => {
    let max = 0;
    for (let t = 0; t <= LOSER_FLAT_MS + LOSER_POP_MS; t += 10) {
      const v = loserSquash(t);
      expect(v).toBeGreaterThan(0.05);
      expect(v).toBeLessThan(1.3);
      max = Math.max(max, v);
    }
    expect(max).toBeGreaterThan(1);
  });
  it('treats bad input as flat', () => {
    expect(loserSquash(Number.NaN)).toBeLessThan(0.3);
    expect(loserSquash(-50)).toBeLessThan(0.3);
  });
});

describe('hoverOffset', () => {
  it('bobs up and down within a small range and repeats', () => {
    for (let t = 0; t < 5000; t += 50) expect(Math.abs(hoverOffset(t))).toBeLessThanOrEqual(12);
    expect(hoverOffset(0)).toBeCloseTo(hoverOffset(2400), 5);
  });
  it('treats bad input as still', () => {
    expect(hoverOffset(Number.NaN)).toBe(0);
  });
});
