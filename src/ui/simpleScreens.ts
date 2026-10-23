// Tap-to-start, loading, and victory screens.
import {
  BUTTONS,
  LOADING,
  TAP_TO_START,
  TEAM_HOMES,
  TEAM_NAMES,
  UI_EXTRA,
  VICTORY,
  VICTORY_CHRONO,
  GAME_SUBTITLE,
  GAME_TITLE,
} from '../data/copy';
import { pickAwards } from '../game/awards';
import { CELEBRATE, TIMING } from '../game/config';
import { TEAMS, otherTeam } from '../game/types';
import { chronoFace, loadingScene, loadingTimeline, skyline } from './art';
import { LOCAL_IDS } from './constants';
import type { UiCtx } from './ctx';
import { awardIcon } from './awardIcons';
import { countRow } from './countPictures';
import { victoryMood } from './victoryMood';
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
      { class: 'tc-screen tc-tap tc-split', 'data-screen': 'tap', 'data-motion': ctx.motion() },
      skyline(doc),
      h(doc, 'div', { class: 'tc-row tc-corner' }, mute, captions),
      h(
        doc,
        'div',
        { class: 'tc-hero' },
        h(doc, 'h1', { class: 'tc-title', text: GAME_TITLE }),
        h(doc, 'p', { class: 'tc-big tc-subtitle', text: GAME_SUBTITLE }),
        play,
        h(doc, 'p', { class: 'tc-muted', text: TAP_TO_START.helper }),
      ),
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
    class: 'tc-big tc-loading-message',
    'data-testid': LOCAL_IDS.loadingMessage,
    'aria-live': 'off',
    text: messages[0] ?? '',
  });
  const percent = h(doc, 'span', { class: 'tc-percent' });
  const timeline = loadingTimeline(doc);
  const fill = timeline.querySelector('.tc-bar-fill') as SVGElement;
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
    timeline,
  );
  let errorBox: HTMLElement | null = null;
  const screen = h(
    doc,
    'section',
    { class: 'tc-screen tc-loading', 'data-screen': 'loading', 'data-motion': ctx.motion() },
    loadingScene(doc),
    // The picture is the hero here, so the name is for screen readers only.
    h(doc, 'h1', { class: 'tc-sr-only', text: GAME_TITLE }),
    h(
      doc,
      'div',
      { class: 'tc-loading-foot' },
      bar,
      h(doc, 'div', { class: 'tc-loading-line' }, message, percent),
    ),
  );
  const closeScreen = ctx.openScreen(screen);

  const paint = (): void => {
    const pct = Math.round(progress * 100);
    bar.setAttribute('aria-valuenow', String(pct));
    // The path is 100 long, so the dash length is the percent. Nothing shows at 0.
    fill.setAttribute('stroke-dasharray', `${pct} 100`);
    fill.setAttribute('visibility', pct === 0 ? 'hidden' : 'visible');
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

/** The walls turn into bouncy toy blocks. Decorative only, so nothing here is read aloud. */
function toyBlocks(doc: Document): HTMLElement {
  const blocks = Array.from({ length: 7 }, (_, i) =>
    h(doc, 'span', { class: 'tc-block', 'data-block': i + 1 }),
  );
  return h(doc, 'div', { class: 'tc-blocks', 'aria-hidden': 'true' }, ...blocks);
}

/** Paper bits that tumble down once. Decoration only: no text, no clicks, out of the layout. */
function confetti(doc: Document): HTMLElement {
  const bits = Array.from({ length: CELEBRATE.confettiCount }, (_, i) =>
    h(doc, 'span', { class: 'tc-confetti-bit', 'data-bit': i % 6 }),
  );
  bits.forEach((b, i) => {
    b.style.setProperty('--tc-bit-x', `${((i * 37) % 100) + 0.5}%`);
    b.style.setProperty('--tc-bit-delay', `${(i % 8) * 0.12}s`);
  });
  return h(doc, 'div', { class: 'tc-confetti', 'data-role': 'confetti', 'aria-hidden': 'true' }, ...bits);
}

/** One stat: the words for readers, then a picture row for counting. Screen readers hear the picture's label once. */
function statLine(
  doc: Document,
  cls: string,
  role: string,
  words: string,
  pictures: HTMLElement,
  picturesRole: string,
): HTMLElement {
  pictures.setAttribute('data-role', picturesRole);
  return h(
    doc,
    'p',
    { class: cls, 'data-role': role },
    h(doc, 'span', { class: 'tc-stat-words', 'aria-hidden': 'true', text: words }),
    pictures,
  );
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
            h(doc, 'p', { class: 'tc-team-eyebrow', text: TEAM_NAMES[t] }),
            h(doc, 'h3', { text: names[t] || TEAM_NAMES[t] }),
            statLine(
              doc,
              'tc-brain-stats',
              'brain-stats',
              `${VICTORY.brainStats}: ${VICTORY.brainStatsValue(
                stats[t].correctAnswers,
                stats[t].questionsAnswered,
              )}`,
              countRow(
                doc,
                'star',
                stats[t].correctAnswers,
                stats[t].questionsAnswered,
                VICTORY.brainStatsValue(stats[t].correctAnswers, stats[t].questionsAnswered),
              ),
              'brain-stars',
            ),
            statLine(
              doc,
              'tc-scrap-stats',
              'scrap-line',
              `${VICTORY.scrapLabel}: ${VICTORY.scrapValue(stats[t].scrapEarned)}`,
              countRow(
                doc,
                'dot',
                stats[t].scrapEarned,
                stats[t].scrapEarned,
                VICTORY.scrapValue(stats[t].scrapEarned),
              ),
              'scrap-dots',
            ),
            h(
              doc,
              'ul',
              {},
              ...awards[t].map((id) =>
                h(
                  doc,
                  'li',
                  { class: 'tc-badge', 'data-award': id },
                  h(doc, 'span', { class: 'tc-badge-icon' }, awardIcon(doc, id)),
                  h(doc, 'span', { class: 'tc-badge-name', text: VICTORY.awards[id] }),
                ),
              ),
            ),
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
      'data-testid': TEST_IDS.backToCamp,
      text: VICTORY.backToCamp,
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
      confetti(doc),
      toyBlocks(doc),
      h(doc, 'p', {
        class: 'tc-team-eyebrow',
        'data-role': 'winner-team',
        text: TEAM_NAMES[winner],
      }),
      h(doc, 'h1', { class: 'tc-title', text: VICTORY.heading(names[winner]) }),
      h(doc, 'p', { class: 'tc-big tc-wipeout', text: VICTORY.wipeoutLine(TEAM_HOMES[loser]) }),
      h(
        doc,
        'div',
        { class: 'tc-chrono-says', 'data-role': 'chrono-says', role: 'status' },
        chronoFace(doc),
        h(
          doc,
          'p',
          {},
          h(doc, 'strong', { text: `${UI_EXTRA.chronoName}: ` }),
          // Chrono's line fits the match. The dignity line belongs to the losing fighter (canvas).
          h(doc, 'span', { text: VICTORY_CHRONO[victoryMood(winner, stats)] }),
        ),
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
    back.addEventListener('click', done('back-to-camp'));
    ctx.sfx('cheer');
    rematch.focus();
  });
}
