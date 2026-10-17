import { describe, expect, it, vi } from 'vitest';
import { drawUnits } from '../../../src/scenes/battle/unitArt';
import { createLabelScaler } from '../../../src/scenes/battle/textScale';

// A stand-in scene: every draw call is accepted, text and tweens are recorded.
function fakeScene() {
  const texts: Array<{ text: string; size: string }> = [];
  const tweens: unknown[] = [];
  const stopped: unknown[] = [];
  const gfx = () => {
    const visibility = { visible: true, y: 0 };
    return new Proxy(visibility as Record<string, unknown>, {
      get(t, k) {
        if (k === 'setVisible') return (v: boolean) => ((t.visible = v), t);
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
  return { scene, texts, tweens, stopped };
}

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
