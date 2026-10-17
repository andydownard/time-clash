import { describe, expect, it } from 'vitest';
import { WORLD } from '../../../src/game/config';
import { aspenLayers } from '../../../src/scenes/battle/aspens';

const HORIZON = 620;
const [far, near] = aspenLayers(WORLD.width, HORIZON);

describe('aspenLayers', () => {
  it('is the same every time (fixed seed)', () => {
    expect(aspenLayers(WORLD.width, HORIZON)).toEqual([far, near]);
  });

  it('has more, thinner, fainter trees behind and fewer, thicker, stronger trees in front', () => {
    expect(far.trees.length).toBeGreaterThan(near.trees.length);
    expect(far.trees[0]!.w).toBeLessThan(near.trees[0]!.w);
    expect(far.alpha).toBeLessThan(near.alpha);
  });

  it('is muted: no layer is more than half see-through', () => {
    expect(far.alpha).toBeLessThanOrEqual(0.5);
    expect(near.alpha).toBeLessThanOrEqual(0.5);
  });

  it('keeps every trunk inside the world and standing on the ground', () => {
    for (const layer of [far, near]) {
      for (const t of layer.trees) {
        expect(t.x).toBeGreaterThan(0);
        expect(t.x).toBeLessThan(WORLD.width);
        expect(t.bottom).toBeLessThan(HORIZON);
        expect(t.top).toBeLessThan(t.bottom);
      }
    }
  });

  it('keeps the tops below the sky (leaves never leave the top of the world)', () => {
    for (const layer of [far, near]) {
      for (const t of layer.trees) {
        for (const l of t.leaves) expect(l.y - l.r).toBeGreaterThan(0);
      }
    }
  });

  it('gives every tree leaves and bark marks that sit on its trunk', () => {
    for (const layer of [far, near]) {
      for (const t of layer.trees) {
        expect(t.leaves.length).toBeGreaterThanOrEqual(4);
        expect(t.marks.length).toBeGreaterThan(0);
        for (const y of t.marks) {
          expect(y).toBeGreaterThan(t.top);
          expect(y).toBeLessThan(t.bottom);
        }
      }
    }
  });

  it('spreads the trees across the whole width, left to right', () => {
    for (const layer of [far, near]) {
      const xs = layer.trees.map((t) => t.x);
      expect(Math.min(...xs)).toBeLessThan(WORLD.width * 0.15);
      expect(Math.max(...xs)).toBeGreaterThan(WORLD.width * 0.85);
    }
  });
});
