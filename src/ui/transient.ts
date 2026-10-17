// Short-lived pieces: speech bubbles.
import { TIMING, WORLD } from '../game/config';
import type { Team } from '../game/types';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { TEST_IDS, type BubbleOptions } from './types';

const holdFor = (text: string): number =>
  Math.max(TIMING.bubbleHoldMs, text.trim().split(/\s+/).length * TIMING.bubbleMsPerWord);

const bubbles = new WeakMap<UiCtx, Map<Team, { el: HTMLElement; timer: unknown }>>();

export function showSpeechBubble(
  ctx: UiCtx,
  options: BubbleOptions,
  getCanvas: () => HTMLCanvasElement | null,
): void {
  const { doc, env } = ctx;
  let byTeam = bubbles.get(ctx);
  if (!byTeam) {
    byTeam = new Map();
    bubbles.set(ctx, byTeam);
  }
  const old = byTeam.get(options.team);
  if (old) {
    env.clearTimeout(old.timer);
    old.el.remove();
  }
  const rect = getCanvas()?.getBoundingClientRect();
  const view = doc.defaultView;
  const box =
    rect && rect.width > 0 && rect.height > 0
      ? rect
      : {
          left: 0,
          top: 0,
          width: view?.innerWidth || WORLD.width,
          height: view?.innerHeight || WORLD.height,
        };
  // One scale for both axes: the canvas is taller than the world (the control band).
  const k = box.width / WORLD.width;
  const x = Math.round((box.left + options.anchor.x * k) * 100) / 100;
  const y = Math.round((box.top + options.anchor.y * k) * 100) / 100;
  const el = h(doc, 'div', {
    class: 'tc-bubble',
    'data-testid': TEST_IDS.speechBubble,
    'data-team': options.team,
    role: 'status',
    text: options.text,
  });
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (options.tailTarget) {
    // How far the speaker is from the bubble center, in screen pixels. CSS slides the tail by it.
    const dx = (options.tailTarget.x - options.anchor.x) * k;
    el.style.setProperty('--tc-tail-shift', `${Math.round(dx * 100) / 100}px`);
  }
  ctx.layer.bubble.append(el);
  const timer = env.setTimeout(
    () => {
      el.remove();
      if (byTeam.get(options.team)?.el === el) byTeam.delete(options.team);
    },
    options.durationMs ?? holdFor(options.text),
  );
  byTeam.set(options.team, { el, timer });
}
