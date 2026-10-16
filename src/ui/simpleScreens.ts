// Tap-to-start, loading, and victory screens.
import {
  BUTTONS,
  LOADING,
  TAP_TO_START,
  TEAM_NAMES,
  UI_EXTRA,
  VICTORY,
  GAME_SUBTITLE,
  GAME_TITLE,
} from '../data/copy';
import { pickAwards } from '../game/awards';
import { TIMING } from '../game/config';
import { TEAMS, otherTeam } from '../game/types';
import { LOCAL_IDS } from './constants';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { TEST_IDS, type LoadingHandle, type VictoryChoice, type VictoryOptions } from './types';

export function showTapToStart(
  ctx: UiCtx,
  handlers: { onMuteToggle: () => void; onCaptionsToggle: () => void },
): Promise<void> {
  const { doc } = ctx;
  return new Promise<void>((resolve) => {
    const play = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-primary tc-btn-huge',
      'data-testid': TEST_IDS.tapToPlay,
      text: TAP_TO_START.button,
    });
    const mute = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': TEST_IDS.muteToggle,
    });
    const captions = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': TEST_IDS.captionsToggle,
    });
    const paint = (): void => {
      const s = ctx.settings();
      mute.textContent = s.muted ? BUTTONS.soundOff : BUTTONS.soundOn;
      captions.textContent = s.captions ? BUTTONS.captionsOn : BUTTONS.captionsOff;
    };
    paint();
    mute.addEventListener('click', () => {
      handlers.onMuteToggle();
      ctx.patchSettings({ muted: !ctx.settings().muted });
      paint();
    });
    captions.addEventListener('click', () => {
      handlers.onCaptionsToggle();
      ctx.patchSettings({ captions: !ctx.settings().captions });
      paint();
    });
    const screen = h(
      doc,
      'section',
      { class: 'tc-screen tc-tap', 'data-screen': 'tap', 'data-motion': ctx.motion() },
      h(doc, 'div', { class: 'tc-row tc-corner' }, mute, captions),
      h(doc, 'h1', { class: 'tc-title', text: GAME_TITLE }),
      h(doc, 'p', { class: 'tc-big', text: GAME_SUBTITLE }),
      play,
      h(doc, 'p', { class: 'tc-muted', text: TAP_TO_START.helper }),
    );
    const close = ctx.openScreen(screen);
    play.addEventListener('click', () => {
      // Sound can only start inside a tap, so unlock here, in the handler itself.
      void ctx.audio?.unlock();
      close();
      resolve();
    });
    play.focus();
  });
}

export function showLoading(ctx: UiCtx, messages: readonly string[]): LoadingHandle {
  const { doc, env } = ctx;
  let index = 0;
  let progress = 0;
  let closed = false;
  let rotation: unknown = null;
  let pendingRetry: (() => void) | null = null;

  const message = h(doc, 'p', {
    class: 'tc-big',
    'data-testid': LOCAL_IDS.loadingMessage,
    'aria-live': 'off',
    text: messages[0] ?? '',
  });
  const fill = h(doc, 'div', { class: 'tc-bar-fill' });
  const percent = h(doc, 'span', { class: 'tc-percent' });
  const bar = h(
    doc,
    'div',
    {
      class: 'tc-bar',
      role: 'progressbar',
      'aria-label': UI_EXTRA.loadingLabel,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'data-testid': LOCAL_IDS.loadingBar,
    },
    fill,
  );
  let errorBox: HTMLElement | null = null;
  const screen = h(
    doc,
    'section',
    { class: 'tc-screen tc-loading', 'data-screen': 'loading', 'data-motion': ctx.motion() },
    h(doc, 'h1', { class: 'tc-title', text: GAME_TITLE }),
    message,
    bar,
    percent,
  );
  const closeScreen = ctx.openScreen(screen);

  const paint = (): void => {
    const pct = Math.round(progress * 100);
    bar.setAttribute('aria-valuenow', String(pct));
    fill.style.width = `${pct}%`;
    percent.textContent = LOADING.percent(pct);
  };
  paint();

  const rotate = (): void => {
    if (closed || messages.length < 2) return;
    rotation = env.setTimeout(() => {
      index = (index + 1) % messages.length;
      message.textContent = messages[index] ?? '';
      rotate();
    }, TIMING.loadingMessageMs);
  };
  rotate();

  const releaseRetry = (): void => {
    const done = pendingRetry;
    pendingRetry = null;
    errorBox?.remove();
    errorBox = null;
    done?.();
  };

  return {
    setProgress(p) {
      if (closed) return;
      progress = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
      paint();
    },
    showError() {
      return new Promise<void>((resolve) => {
        if (closed) {
          resolve();
          return;
        }
        pendingRetry?.();
        pendingRetry = resolve;
        const retry = h(doc, 'button', {
          type: 'button',
          class: 'tc-btn tc-btn-primary',
          'data-testid': TEST_IDS.loadingRetry,
          text: LOADING.errorButton,
        });
        retry.addEventListener('click', releaseRetry);
        errorBox?.remove();
        errorBox = h(
          doc,
          'div',
          { class: 'tc-loading-error', 'data-testid': LOCAL_IDS.loadingError },
          h(doc, 'p', { class: 'tc-big', text: LOADING.errorTitle }),
          h(doc, 'p', { text: LOADING.errorBody }),
          retry,
        );
        screen.append(errorBox);
        retry.focus();
      });
    },
    close() {
      if (closed) return;
      closed = true;
      if (rotation !== null) env.clearTimeout(rotation);
      closeScreen();
      releaseRetry();
    },
  };
}

export function showVictory(ctx: UiCtx, options: VictoryOptions): Promise<VictoryChoice> {
  const { doc } = ctx;
  const { winner, names, stats } = options;
  const loser = otherTeam(winner);
  return new Promise<VictoryChoice>((resolve) => {
    // Awards, not a side-by-side score. Every player wins at least one (src/game/awards.ts).
    const awards = pickAwards(stats);
    const table = h(
      doc,
      'section',
      { class: 'tc-awards', 'aria-labelledby': 'tc-awards-heading' },
      h(doc, 'h2', { id: 'tc-awards-heading', text: VICTORY.awardsHeading }),
      h(
        doc,
        'div',
        { class: 'tc-row' },
        ...TEAMS.map((t) =>
          h(
            doc,
            'div',
            { class: 'tc-award-card', 'data-team': t, 'data-award-team': t },
            h(doc, 'h3', { text: names[t] || TEAM_NAMES[t] }),
            h(doc, 'ul', {}, ...awards[t].map((id) => h(doc, 'li', { text: VICTORY.awards[id] }))),
          ),
        ),
      ),
    );
    const rematch = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-primary tc-btn-big',
      'data-testid': TEST_IDS.rematch,
      text: VICTORY.rematch,
    });
    const back = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': TEST_IDS.backToStart,
      text: VICTORY.backToStart,
    });
    const screen = h(
      doc,
      'section',
      {
        class: 'tc-screen tc-victory',
        'data-screen': 'victory',
        'data-testid': TEST_IDS.victory,
        'data-team': winner,
        'data-motion': ctx.motion(),
      },
      h(doc, 'h1', { class: 'tc-title', text: VICTORY.heading(names[winner]) }),
      h(doc, 'p', { class: 'tc-big', text: `${names[loser]}: ${VICTORY.wipeout}` }),
      h(
        doc,
        'div',
        { class: 'tc-chrono-says', 'data-role': 'chrono-says', role: 'status' },
        h(doc, 'strong', { text: `${UI_EXTRA.chronoName}: ` }),
        h(doc, 'span', { text: VICTORY.goodSport }),
      ),
      table,
      h(doc, 'div', { class: 'tc-row' }, rematch, back),
    );
    const close = ctx.openScreen(screen);
    const done = (choice: VictoryChoice) => () => {
      close();
      resolve(choice);
    };
    rematch.addEventListener('click', done('rematch'));
    back.addEventListener('click', done('back-to-start'));
    ctx.sfx('cheer');
    rematch.focus();
  });
}
