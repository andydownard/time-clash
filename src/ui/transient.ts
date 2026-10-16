// Short-lived pieces: the turn banner and speech bubbles.
import { turnBanner } from '../data/copy';
import { TIMING, WORLD } from '../game/config';
import type { Team } from '../game/types';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { TEST_IDS, type BannerOptions, type BubbleOptions } from './types';

type BannerState = { el: HTMLElement; timer: unknown; resolve: () => void };
const banners = new WeakMap<UiCtx, BannerState>();

export function showTurnBanner(ctx: UiCtx, options: BannerOptions): Promise<void> {
  const { doc, env } = ctx;
  const previous = banners.get(ctx);
  if (previous) {
    env.clearTimeout(previous.timer);
    previous.el.remove();
    previous.resolve();
    banners.delete(ctx);
  }
  return new Promise<void>((resolve) => {
    const el = h(doc, 'div', {
      class: 'tc-banner',
      'data-testid': TEST_IDS.turnBanner,
      'data-team': options.team,
      'data-motion': ctx.motion(),
      role: 'status',
      text: turnBanner(options.name, options.shot),
    });
    ctx.layer.banner.append(el);
    ctx.sfx('horn');
    const timer = env.setTimeout(() => {
      el.remove();
      if (banners.get(ctx)?.el === el) banners.delete(ctx);
      resolve();
    }, TIMING.bannerHoldMs);
    banners.set(ctx, { el, timer, resolve });
  });
}

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
  const x = Math.round((box.left + (options.anchor.x / WORLD.width) * box.width) * 100) / 100;
  const y = Math.round((box.top + (options.anchor.y / WORLD.height) * box.height) * 100) / 100;
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
