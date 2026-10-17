// The DOM layer on top of the Phaser canvas. All buttons, text, banners, and covers are
// plain DOM. See src/ui/types.ts for the contract and docs/CONTRACTS.md decision 18.
import type { AudioManager, SfxName } from '../audio/types';
import { DEFAULT_SETTINGS } from '../game/config';
import { createStorage } from '../storage/storage';
import type { Settings, TypedStorage } from '../storage/types';
import { COVER_BG_FALLBACK } from './constants';
import type { LayerName, UiCtx } from './ctx';
import { h, styleAsCover, trapTab } from './dom';
import { createHud } from './hudView';
import { showIntro } from './introScreen';
import type { LoadingEnv } from './loadingLogic';
import { isReducedMotion } from './motion';
import { showCamp } from './campScreen';
import { showForge } from './forgeScreen';
import { showPassScreen } from './passScreen';
import { showReloadModal } from './reloadModal';
import { showSetup } from './setupScreen';
import { showLoading, showTapToStart, showVictory } from './simpleScreens';
import { showSpeechBubble, showTurnBanner } from './transient';
import { TEST_IDS, Z, type CoverKind, type CreateOverlay, type Overlay } from './types';

export type OverlayDeps = {
  audio?: AudioManager;
  storage?: TypedStorage;
  env?: LoadingEnv;
  /** Used for matchMedia. Defaults to the document's window. */
  win?: Pick<Window, 'matchMedia'> | null;
};

const LAYERS: ReadonlyArray<[LayerName, number]> = [
  ['hud', Z.hud],
  ['bubble', Z.bubble],
  ['banner', Z.banner],
  ['caption', Z.caption],
  ['screen', Z.screen],
  ['cover', Z.cover],
];
/** Layers that show the board. They are hidden and locked while a cover is up. */
const BOARD_LAYERS: readonly LayerName[] = ['hud', 'bubble', 'banner'];

/** Same as CreateOverlay, plus optional dependencies (audio, storage, timers). */
export type CreateOverlayWithDeps = (
  ...args: [...Parameters<CreateOverlay>, deps?: OverlayDeps]
) => Overlay;

export const createOverlay: CreateOverlayWithDeps = (
  doc: Document,
  deps: OverlayDeps = {},
): Overlay => {
  const view = doc.defaultView;
  const env: LoadingEnv = deps.env ?? {
    now: () => (view?.performance ?? performance).now(),
    setTimeout: (fn, ms) => (view ?? globalThis).setTimeout(fn, ms),
    clearTimeout: (id) => (view ?? globalThis).clearTimeout(id as number),
  };
  const win = deps.win === undefined ? view : deps.win;
  const storage = deps.storage ?? createStorage();
  const audio = deps.audio;

  let settings: Settings = { ...DEFAULT_SETTINGS };
  const listeners = new Set<() => void>();
  let boardRoot: HTMLElement | null = null;
  let canvasEl: HTMLCanvasElement | null = null;
  let host: HTMLElement | null = null;
  const covers: Array<{ kind: CoverKind; el: HTMLElement }> = [];
  let screensOpen = 0;
  let captionText: string | null = null;

  const layer = {} as Record<LayerName, HTMLElement>;
  for (const [name, z] of LAYERS) {
    const el = h(doc, 'div', { 'data-layer': name });
    const st = el.style;
    st.position = 'fixed';
    st.top = '0';
    st.right = '0';
    st.bottom = '0';
    st.left = '0';
    st.zIndex = String(z);
    st.pointerEvents = 'none';
    layer[name] = el;
  }

  const captionBar = h(doc, 'div', {
    class: 'tc-caption',
    'data-testid': TEST_IDS.captionBar,
    'aria-live': 'off',
    hidden: true,
  });
  layer.caption.append(captionBar);

  const notify = (): void => listeners.forEach((fn) => fn());

  const renderCaption = (): void => {
    const show = settings.captions && Boolean(captionText);
    captionBar.textContent = captionText ?? '';
    captionBar.hidden = !show;
  };

  const refreshBoard = (): void => {
    const hidden = covers.length > 0;
    const top = covers[covers.length - 1];
    if (top) doc.body.dataset.cover = top.kind;
    else delete doc.body.dataset.cover;
    const lock = (el: HTMLElement | null): void => {
      if (!el) return;
      if (hidden) {
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
        el.style.visibility = 'hidden';
      } else {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
        el.style.visibility = '';
      }
    };
    lock(boardRoot);
    for (const name of BOARD_LAYERS) lock(layer[name]);
  };

  const raiseCaptions = (): void => {
    // The question cover reads its text aloud, so its captions must show above it.
    const above = covers.some((c) => c.kind === 'reload') ? Z.cover + 1 : null;
    layer.caption.style.zIndex = String(above ?? (screensOpen > 0 ? Z.screen + 1 : Z.caption));
  };

  const ctx: UiCtx = {
    doc,
    env,
    audio,
    storage,
    layer,
    settings: () => settings,
    patchSettings(patch) {
      settings = { ...settings, ...patch };
      renderCaption();
      notify();
    },
    onSettings(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reduced: () => isReducedMotion(settings.reducedMotion, win),
    motion: () => (isReducedMotion(settings.reducedMotion, win) ? 'reduced' : 'full'),
    sfx(name: SfxName) {
      audio?.playSfx(name);
    },
    setCaption(text) {
      captionText = text && text.length > 0 ? text : null;
      renderCaption();
    },
    openCover(kind, el) {
      const previousFocus = doc.activeElement as HTMLElement | null;
      styleAsCover(el);
      el.style.pointerEvents = 'auto';
      el.style.backgroundColor = COVER_BG_FALLBACK;
      el.classList.add('tc-cover');
      trapTab(el);
      covers.push({ kind, el });
      layer.cover.append(el);
      refreshBoard();
      raiseCaptions();
      return () => {
        const at = covers.findIndex((c) => c.el === el);
        if (at >= 0) covers.splice(at, 1);
        el.remove();
        refreshBoard();
        raiseCaptions();
        if (previousFocus && doc.contains(previousFocus) && covers.length === 0) {
          previousFocus.focus?.();
        }
      };
    },
    openScreen(el) {
      el.style.pointerEvents = 'auto';
      layer.screen.append(el);
      screensOpen++;
      raiseCaptions();
      let closed = false;
      return () => {
        if (closed) return;
        closed = true;
        el.remove();
        screensOpen--;
        raiseCaptions();
      };
    },
    coverKind: () => covers[covers.length - 1]?.kind ?? null,
  };

  const hud = createHud(ctx);

  return {
    mount(root, canvas) {
      boardRoot = root;
      canvasEl = canvas;
      if (host && host.isConnected) return;
      host = h(doc, 'div', { 'data-tc-root': '', 'data-motion': ctx.motion() });
      for (const [name] of LAYERS) host.append(layer[name]);
      doc.body.append(host);
    },
    applySettings(next) {
      settings = { ...DEFAULT_SETTINGS, ...next };
      host?.setAttribute('data-motion', ctx.motion());
      renderCaption();
      notify();
    },
    showTapToStart: (handlers) => showTapToStart(ctx, handlers),
    showIntro: (script, play) => showIntro(ctx, script, play),
    showLoading: (messages) => showLoading(ctx, messages),
    showSetup: (initial) => showSetup(ctx, initial),
    showCamp: () => showCamp(ctx),
    showForge: (options) => showForge(ctx, options),
    showVictory: (options) => showVictory(ctx, options),
    showHud: (handlers) => hud.show(handlers),
    updateHud: (state) => hud.update(state),
    hideHud: () => hud.hide(),
    showTurnBanner: (options) => showTurnBanner(ctx, options),
    showPassScreen: (options) => showPassScreen(ctx, options),
    showReloadModal: (options) => showReloadModal(ctx, options),
    showSpeechBubble: (options) => showSpeechBubble(ctx, options, () => canvasEl),
    setCaption: (text) => ctx.setCaption(text),
    get cover() {
      return ctx.coverKind();
    },
  };
};
