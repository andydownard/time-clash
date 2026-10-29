// The message lane: one fixed place on the Battle screen for words that come and go. The coach
// line, the Squads first-go hint and Chrono's caption bar all show here, one at a time.
// It is a band of sky under the wind sign, between Balloon A and the Helicopter, and above every
// fighter's letter tag. So it never covers the team cards, the control bar, a fighter or a base
// (a built base's bricks are fitted inside the room of its place, BUILT_PLACES, which stops short
// of the lane). tests/ui/messageLane.test.ts checks
// that on every field, and e2e/layout.spec.ts checks it on screen.
import { BATTLE_BAND, WORLD } from '../game/config';
import type { Rect } from '../game/types';

/** The lane in world px (the same units as the battlefield). */
export const MESSAGE_LANE: Readonly<Rect> = { x: 364, y: 252, w: 552, h: 176 };

/** A box on screen, in CSS px. */
export type ScreenBox = { left: number; top: number; width: number; height: number };

/**
 * Where the canvas sits when Phaser fits it (FIT, centered across, top edge at the top) in a
 * viewport. Only a fallback: the real canvas box is measured when there is one.
 */
export function fitCanvas(viewport: { width: number; height: number }): ScreenBox {
  const k = Math.min(viewport.width / WORLD.width, viewport.height / (WORLD.height + BATTLE_BAND));
  const width = WORLD.width * k;
  return {
    left: (viewport.width - width) / 2,
    top: 0,
    width,
    height: (WORLD.height + BATTLE_BAND) * k,
  };
}

/** The lane on screen, for a canvas drawn at `canvas`. The canvas has one scale both ways. */
export function laneOnScreen(canvas: ScreenBox): ScreenBox {
  const k = canvas.width / WORLD.width;
  return {
    left: canvas.left + MESSAGE_LANE.x * k,
    top: canvas.top + MESSAGE_LANE.y * k,
    width: MESSAGE_LANE.w * k,
    height: MESSAGE_LANE.h * k,
  };
}

const VARS = ['--tc-lane-left', '--tc-lane-top', '--tc-lane-width', '--tc-lane-height'] as const;

/**
 * Writes the lane's screen box as CSS custom properties on the page root, so the HUD hints and
 * the caption bar (which lives in its own layer) share one box. Measures the real game canvas;
 * without one it uses the fitted size of the window.
 */
export function placeLane(doc: Document): void {
  const view = doc.defaultView;
  const canvas = doc.querySelector('#game canvas');
  const r = canvas?.getBoundingClientRect();
  const box: ScreenBox | null =
    r && r.width > 0
      ? { left: r.left, top: r.top, width: r.width, height: r.height }
      : view
        ? fitCanvas({ width: view.innerWidth, height: view.innerHeight })
        : null;
  if (!box || !(box.width > 0)) return;
  const lane = laneOnScreen(box);
  const st = doc.documentElement.style;
  const px = (n: number): string => `${Math.round(n * 10) / 10}px`;
  st.setProperty(VARS[0], px(lane.left));
  st.setProperty(VARS[1], px(lane.top));
  st.setProperty(VARS[2], px(lane.width));
  st.setProperty(VARS[3], px(lane.height));
}

/** Takes the lane away (the Battle HUD is gone), so captions go back to the bottom. */
export function clearLane(doc: Document): void {
  for (const v of VARS) doc.documentElement.style.removeProperty(v);
}
