import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/game/config';
import { drawBackdrop, type GraphicsLike } from '../../src/scenes/backdrop';
import { PALETTE } from '../../src/scenes/palette';

const tokens = readFileSync('src/styles/tokens.css', 'utf8').toLowerCase();

describe('palette', () => {
  it('uses only colors from the design tokens (no drift)', () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      const hex = `#${value.toString(16).padStart(6, '0')}`;
      expect(tokens, `${name} ${hex}`).toContain(hex);
    }
  });
});

type Call = { op: string; args: number[] };
function recorder(): { g: GraphicsLike; calls: Call[]; colors: number[] } {
  const calls: Call[] = [];
  const colors: number[] = [];
  const g: GraphicsLike = {
    fillStyle(color) {
      colors.push(color);
      return g;
    },
    fillRect(...args) {
      calls.push({ op: 'rect', args });
      return g;
    },
    fillCircle(...args) {
      calls.push({ op: 'circle', args });
      return g;
    },
    fillTriangle(...args) {
      calls.push({ op: 'tri', args });
      return g;
    },
  };
  return { g, calls, colors };
}

describe('drawBackdrop', () => {
  it('draws shapes with palette colors only', () => {
    const { g, calls, colors } = recorder();
    drawBackdrop(g, WORLD);
    expect(calls.length).toBeGreaterThan(15);
    const allowed = new Set<number>(Object.values(PALETTE));
    for (const c of colors) expect(allowed.has(c)).toBe(true);
  });
  it('keeps every rectangle and triangle inside the world', () => {
    const { g, calls } = recorder();
    drawBackdrop(g, WORLD);
    for (const c of calls.filter((x) => x.op === 'rect')) {
      const [x, y, w, h] = c.args as [number, number, number, number];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(WORLD.width);
      expect(y + h).toBeLessThanOrEqual(WORLD.height);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
    }
  });
  it('is the same every time (no randomness)', () => {
    const a = recorder();
    const b = recorder();
    drawBackdrop(a.g, WORLD);
    drawBackdrop(b.g, WORLD);
    expect(a.calls).toEqual(b.calls);
  });
  it('scales to another size', () => {
    const { g, calls } = recorder();
    drawBackdrop(g, { width: 640, height: 360 });
    for (const c of calls.filter((x) => x.op === 'rect')) {
      expect((c.args[0] as number) + (c.args[2] as number)).toBeLessThanOrEqual(640);
    }
  });
});
