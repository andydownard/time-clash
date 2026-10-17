// The Camp hub: the home base between Setup and Battle. A sunset field with both camps and four
// buttons. Time to Clash! starts the match. Forge Weapon and Upgrade Base open their own screens.
// Change players goes back to Setup.
import { CAMP, GAME_TITLE } from '../data/copy';
import { campScene } from './campArt';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { TEST_IDS, type CampChoice } from './types';

export function showCamp(ctx: UiCtx): Promise<CampChoice> {
  const { doc } = ctx;
  return new Promise<CampChoice>((resolve) => {
    /** A side button. It leaves the Camp for its own screen. */
    const side = (testId: string, label: string, kind: 'past' | 'future'): HTMLButtonElement =>
      h(doc, 'button', {
        type: 'button',
        class: `tc-btn tc-btn-${kind} tc-camp-side`,
        'data-testid': testId,
        text: label,
      });
    const forge = side(TEST_IDS.campForge, CAMP.forge, 'past');
    const upgrade = side(TEST_IDS.campUpgrade, CAMP.upgrade, 'future');

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
        h(doc, 'div', { class: 'tc-camp-slot', 'data-kind': 'future' }, upgrade),
      ),
      players,
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
    upgrade.addEventListener('click', () => {
      close();
      resolve('upgrade');
    });
    players.addEventListener('click', () => {
      close();
      resolve('players');
    });
    start.focus();
  });
}
