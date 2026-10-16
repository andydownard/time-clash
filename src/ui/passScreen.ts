// Pass-the-mouse cover. Opaque and full viewport. It never holds question text.
import { PASS_SCREEN } from '../data/copy';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { createCoverMute } from './muteButton';
import { TEST_IDS, type PassScreenOptions } from './types';

export function showPassScreen(ctx: UiCtx, options: PassScreenOptions): Promise<void> {
  const { doc } = ctx;
  return new Promise<void>((resolve) => {
    const ready = h(doc, 'button', {
      type: 'button',
      class: `tc-btn tc-btn-${options.nextTeam.toLowerCase()}`,
      'data-testid': TEST_IDS.passReady,
      text: PASS_SCREEN.ready,
    });
    const mute = createCoverMute(ctx);
    const el = h(
      doc,
      'section',
      {
        class: 'tc-pass',
        'data-testid': TEST_IDS.passScreen,
        'data-team': options.nextTeam,
        'data-motion': ctx.motion(),
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'tc-pass-heading',
      },
      h(
        doc,
        'div',
        { class: 'tc-cover-card' },
        h(doc, 'p', {
          class: 'tc-team-icon',
          'data-role': 'team-icon',
          'aria-hidden': 'true',
          text: PASS_SCREEN.icon[options.nextTeam],
        }),
        h(doc, 'h2', { id: 'tc-pass-heading', text: PASS_SCREEN.heading }),
        h(doc, 'p', { class: 'tc-big', text: PASS_SCREEN.upNext(options.nextName) }),
        h(doc, 'p', { text: PASS_SCREEN.noPeeking }),
        ready,
        mute.el,
      ),
    );
    const close = ctx.openCover('pass', el);
    ready.addEventListener('click', () => {
      ctx.sfx('click');
      mute.dispose();
      close();
      resolve();
    });
    ready.focus();
  });
}
