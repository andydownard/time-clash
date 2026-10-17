// The Camp hub: the home base between Setup and Battle. A sunset field with both camps, a
// campfire in the middle, and three buttons. Time to Clash! starts the match. Forge Weapon and
// Upgrade Base is not open yet, so it says so and changes nothing. Forge Weapon opens the Forge.
import { CAMP, GAME_TITLE } from '../data/copy';
import { TIMING } from '../game/config';
import { campScene } from './campArt';
import { LOCAL_IDS } from './constants';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { TEST_IDS, type CampChoice } from './types';

export function showCamp(ctx: UiCtx): Promise<CampChoice> {
  const { doc, env } = ctx;
  return new Promise<CampChoice>((resolve) => {
    // A polite status line. Cleared first so a second tap is read out again.
    const status = h(doc, 'p', {
      class: 'tc-sr-only',
      role: 'status',
      'data-testid': LOCAL_IDS.campStatus,
    });

    /** A side button that is not open yet. It stays focusable and tappable, and it says why. */
    const comingSoon = (
      testId: string,
      label: string,
      kind: 'past' | 'future',
      line: string,
    ): HTMLElement => {
      const ribbon = h(doc, 'span', { class: 'tc-camp-soon', text: CAMP.soon });
      const button = h(doc, 'button', {
        type: 'button',
        class: `tc-btn tc-btn-${kind} tc-camp-side`,
        'aria-disabled': 'true',
        'data-testid': testId,
        text: label,
      });
      let pending: unknown = null;
      button.addEventListener('click', () => {
        status.textContent = '';
        status.textContent = line;
        ribbon.setAttribute('data-nudge', 'true');
        if (pending !== null) env.clearTimeout(pending);
        pending = env.setTimeout(() => {
          ribbon.removeAttribute('data-nudge');
          pending = null;
        }, TIMING.campNudgeMs);
      });
      return h(doc, 'div', { class: 'tc-camp-slot', 'data-kind': kind }, ribbon, button);
    };

    /** A side button that works. It leaves the Camp for its own screen. */
    const openSide = (testId: string, label: string, kind: 'past' | 'future'): HTMLButtonElement =>
      h(doc, 'button', {
        type: 'button',
        class: `tc-btn tc-btn-${kind} tc-camp-side`,
        'data-testid': testId,
        text: label,
      });
    const forge = openSide(TEST_IDS.campForge, CAMP.forge, 'past');

    const start = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-primary tc-btn-big tc-camp-start',
      'data-testid': TEST_IDS.campStart,
      text: CAMP.start,
    });

    const players = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-camp-players',
      'data-testid': TEST_IDS.campPlayers,
      text: CAMP.players,
    });

    const screen = h(
      doc,
      'section',
      { class: 'tc-screen tc-camp', 'data-screen': 'camp', 'data-motion': ctx.motion() },
      campScene(doc),
      h(doc, 'h1', { class: 'tc-sr-only', text: `${GAME_TITLE} ${CAMP.heading}` }),
      // The logo is the name. The h1 above says it to a screen reader.
      h(
        doc,
        'p',
        { class: 'tc-camp-logo', 'aria-hidden': 'true' },
        h(doc, 'span', { class: 'tc-camp-time', text: CAMP.logoTime }),
        ' ',
        h(doc, 'span', { class: 'tc-camp-clash', text: CAMP.logoClash }),
      ),
      h(doc, 'div', { class: 'tc-camp-start-slot' }, start),
      h(
        doc,
        'div',
        { class: 'tc-camp-sides' },
        h(doc, 'div', { class: 'tc-camp-slot', 'data-kind': 'past' }, forge),
        comingSoon(TEST_IDS.campUpgrade, CAMP.upgrade, 'future', CAMP.upgradeSoon),
      ),
      players,
      status,
    );
    const close = ctx.openScreen(screen);
    start.addEventListener('click', () => {
      close();
      resolve('battle');
    });
    forge.addEventListener('click', () => {
      close();
      resolve('forge');
    });
    players.addEventListener('click', () => {
      close();
      resolve('players');
    });
    start.focus();
  });
}
