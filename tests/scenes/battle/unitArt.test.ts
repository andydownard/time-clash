import { describe, expect, it, vi } from 'vitest';
import { drawUnits, shieldPoints } from '../../../src/scenes/battle/unitArt';
import { unitSpots } from '../../../src/scenes/battle/unitSpots';
import { createLabelScaler } from '../../../src/scenes/battle/textScale';

// A stand-in scene: every draw call is accepted, text and tweens are recorded.
function fakeScene() {
  const texts: Array<{ text: string; size: string }> = [];
  const tweens: unknown[] = [];
  const stopped: unknown[] = [];
  const shapes = { polys: [] as unknown[], circles: [] as Array<[number, number, number]> };
  const gfx = () => {
    const visibility = { visible: true, y: 0 };
    return new Proxy(visibility as Record<string, unknown>, {
      get(t, k) {
        if (k === 'setVisible') return (v: boolean) => ((t.visible = v), t);
        if (k === 'fillCircle')
          return (x: number, y: number, r: number) => void shapes.circles.push([x, y, r]);
        if (k === 'fillPoints') return (pts: unknown) => void shapes.polys.push(pts);
        if (k in t) return t[k as string];
        return () => undefined;
      },
      set(t, k, v) {
        t[k as string] = v;
        return true;
      },
    });
  };
  const scene = {
    add: {
      graphics: gfx,
      container: () => ({ setScale() {}, destroy() {}, setAlpha() {}, setDepth() {} }),
      text: (_x: number, _y: number, text: string) => {
        const entry = { text, size: '' };
        texts.push(entry);
        const t = {
          setOrigin: () => t,
          setFontSize: (s: string) => ((entry.size = s), t),
        };
        return t;
      },
    },
    tweens: {
      add: () => {
        const tw = { stop: () => stopped.push(tw) };
        tweens.push(tw);
        return tw;
      },
    },
  };
  return { scene, texts, tweens, stopped, shapes };
}

describe('drawUnits tags', () => {
  it('Past wears its letter on a shield and Future its number on a round tag', () => {
    const { scene, shapes } = fakeScene();
    drawUnits(scene as never, null, () => false);
    for (const sp of unitSpots()) {
      const t = sp.token;
      const shield = shapes.polys.some(
        (p) => JSON.stringify(p) === JSON.stringify(shieldPoints(t)),
      );
      const round = shapes.circles.some(([x, y, r]) => x === t.x && y === t.y && r === t.r);
      expect(shield, sp.id).toBe(sp.team === 'PAST');
      expect(round, sp.id).toBe(sp.team === 'FUTURE');
    }
  });
});

describe('shieldPoints', () => {
  it('is a heater shield that fits inside the tag circle, flat on top and pointed below', () => {
    const t = { x: 100, y: 50, r: 17 };
    const pts = shieldPoints(t);
    for (const p of pts) expect(Math.hypot(p.x - t.x, p.y - t.y)).toBeLessThanOrEqual(t.r + 0.5);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...ys)).toBeGreaterThan(t.y + t.r * 0.8);
    expect(pts.filter((p) => p.y === Math.min(...ys)).length).toBeGreaterThanOrEqual(2);
  });
});

describe('drawUnits', () => {
  it('draws one token per fighter, with its letter or number, at one size', () => {
    const { scene, texts } = fakeScene();
    const labels = createLabelScaler(() => 1280, 1280);
    drawUnits(scene as never, labels, () => false);
    expect(texts.map((t) => t.text).sort()).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
    expect(new Set(texts.map((t) => t.size))).toEqual(new Set(['20px']));
  });

  it('grows the token text on a small screen so it stays 20px or more', () => {
    const { scene } = fakeScene();
    const labels = createLabelScaler(() => 768, 1280);
    drawUnits(scene as never, labels, () => false);
    expect(labels.minRenderedPx()).toBeGreaterThanOrEqual(20);
  });

  it('bobs the arrow of the selected fighter, and stops when it is deselected', () => {
    const { scene, tweens, stopped } = fakeScene();
    const art = drawUnits(scene as never, null, () => false);
    art['C'].setSelected(true);
    expect(tweens).toHaveLength(1);
    art['C'].setSelected(false);
    expect(stopped).toHaveLength(1);
  });

  it('does not move the arrow when motion is reduced', () => {
    const { scene, tweens } = fakeScene();
    const add = vi.spyOn(scene.tweens, 'add');
    const art = drawUnits(scene as never, null, () => true);
    art['1'].setSelected(true);
    art['2'].setSelected(true);
    expect(add).not.toHaveBeenCalled();
    expect(tweens).toHaveLength(0);
  });
});
