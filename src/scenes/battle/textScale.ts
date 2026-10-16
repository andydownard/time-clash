// Phaser draws in a 1280x720 world that is shrunk to fit the screen. A 20px label would then
// show smaller than the 20px floor. These helpers grow the world size to cancel the shrink.
// Pure, so it is unit tested. The scene calls refresh() whenever the canvas is resized.

/** The font size, in world pixels, that draws at `minPx` or more on screen. */
export function worldFontPx(minPx: number, displayWidth: number, worldWidth: number): number {
  if (!(displayWidth > 0) || !(worldWidth > 0)) return minPx;
  const scale = displayWidth / worldWidth;
  return scale >= 1 ? minPx : Math.ceil(minPx / scale);
}

type Sizable = { setFontSize(size: string | number): unknown };

export type LabelScaler = {
  register(label: Sizable, basePx: number): void;
  refresh(): void;
  /** Smallest size, in screen pixels, any registered label is drawn at. Null with no labels. */
  minRenderedPx(): number | null;
  clear(): void;
};

export function createLabelScaler(getDisplayWidth: () => number, worldWidth: number): LabelScaler {
  const labels: Array<{ label: Sizable; basePx: number; px: number }> = [];
  const size = (basePx: number): number => worldFontPx(basePx, getDisplayWidth(), worldWidth);
  return {
    register(label, basePx) {
      const px = size(basePx);
      label.setFontSize(`${px}px`);
      labels.push({ label, basePx, px });
    },
    refresh() {
      for (const l of labels) {
        l.px = size(l.basePx);
        l.label.setFontSize(`${l.px}px`);
      }
    },
    minRenderedPx() {
      if (labels.length === 0) return null;
      const w = getDisplayWidth();
      const scale = w > 0 ? Math.min(1, w / worldWidth) : 1;
      return Math.min(...labels.map((l) => l.px * scale));
    },
    clear() {
      labels.length = 0;
    },
  };
}
