// Pass-the-mouse cover. Opaque and full viewport. It never holds question text.
import { PASS_SCREEN, TEAM_NAMES } from '../data/copy';
import { TIMING } from '../game/config';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { createCoverMute } from './muteButton';
import { passArt } from './passArt';
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
        { class: 'tc-cover-card tc-pass-card' },
        h(doc, 'p', {
          class: 'tc-team-icon',
          'data-role': 'team-icon',
          'aria-hidden': 'true',
          text: PASS_SCREEN.icon[options.nextTeam],
        }),
        passArt(doc),
        h(doc, 'p', { class: 'tc-team-tag', text: TEAM_NAMES[options.nextTeam] }),
        h(doc, 'h2', { id: 'tc-pass-heading', text: PASS_SCREEN.heading }),
        h(doc, 'p', { class: 'tc-big', text: PASS_SCREEN.upNext(options.nextName) }),
        ready,
        mute.el,
      ),
    );
    const close = ctx.openCover('pass', el);
    const stopLine = sayPassLine(ctx);
    ready.addEventListener('click', () => {
      ctx.sfx('click');
      mute.dispose();
      stopLine();
      close();
      resolve();
    });
    ready.focus();
  });
}

/**
 * Chrono reads the cover's own words aloud, with a caption. The AudioManager keeps it silent
 * before the first tap, while muted, and in a browser driven by a test tool. The caption shows
 * either way. The line is fixed text: no name (names never leave the device) and no question.
 * It never asks the voice service for a clip, so the cover makes no network request.
 * Returns a function that stops the line and clears the caption ("I'm ready!" is the Skip).
 */
function sayPassLine(ctx: UiCtx): () => void {
  const text = PASS_SCREEN.heading;
  const durationMs = Math.max(
    TIMING.bubbleHoldMs,
    text.split(/\s+/).length * TIMING.bubbleMsPerWord,
  );
  ctx.setCaption(text);
  try {
    ctx.audio?.speak(
      // noClip: the cover opens on its own, so it never makes a network request.
      { id: 'pass-line', text, captions: [{ text, startMs: 0 }], durationMs, noClip: true },
      { onCaption: (t) => ctx.setCaption(t) },
    );
  } catch {
    /* no voice: the caption still shows */
  }
  return () => {
    try {
      ctx.audio?.stopSpeech();
    } catch {
      /* nothing to stop */
    }
    ctx.setCaption(null);
  };
}
