import { describe, expect, it } from 'vitest';
import { UI, WORLD } from '../../../src/game/config';
import { createLabelScaler, worldFontPx } from '../../../src/scenes/battle/textScale';
import { TEXT_MIN_PX } from '../../../src/scenes/battle/visual';

describe('worldFontPx', () => {
  it('keeps the size when the canvas is shown at full size or larger', () => {
    expect(worldFontPx(20, 1280, 1280)).toBe(20);
    expect(worldFontPx(20, 1920, 1280)).toBe(20);
  });
  it('grows the world size so the label still reads at the floor on a smaller screen', () => {
    for (const width of [1024, 768, 600]) {
      const px = worldFontPx(TEXT_MIN_PX, width, WORLD.width);
      expect((px * width) / WORLD.width, `${width}px wide`).toBeGreaterThanOrEqual(UI.textMinPx);
    }
    expect(worldFontPx(20, 1024, 1280)).toBe(25);
    expect(worldFontPx(20, 768, 1280)).toBe(34);
  });
  it('falls back to the plain size for a bad width', () => {
    expect(worldFontPx(20, 0, 1280)).toBe(20);
    expect(worldFontPx(20, Number.NaN, 1280)).toBe(20);
    expect(worldFontPx(20, -5, 1280)).toBe(20);
  });
});

describe('createLabelScaler', () => {
  const fake = () => {
    const sizes: string[] = [];
    return { sizes, setFontSize: (s: string | number) => void sizes.push(String(s)) };
  };

  it('sizes a label when it is registered, and again on every refresh', () => {
    let width = 1024;
    const scaler = createLabelScaler(() => width, WORLD.width);
    const a = fake();
    scaler.register(a, 20);
    expect(a.sizes).toEqual(['25px']);
    width = 768;
    scaler.refresh();
    expect(a.sizes).toEqual(['25px', '34px']);
  });

  it('reports the smallest size a label is actually drawn at', () => {
    let width = 768;
    const scaler = createLabelScaler(() => width, WORLD.width);
    expect(scaler.minRenderedPx()).toBeNull();
    scaler.register(fake(), 20);
    scaler.register(fake(), 22);
    expect(scaler.minRenderedPx()).toBeGreaterThanOrEqual(UI.textMinPx);
    width = 1280;
    scaler.refresh();
    expect(scaler.minRenderedPx()).toBe(20);
  });

  it('forgets labels on clear', () => {
    const scaler = createLabelScaler(() => 1280, WORLD.width);
    scaler.register(fake(), 20);
    scaler.clear();
    expect(scaler.minRenderedPx()).toBeNull();
  });
});
