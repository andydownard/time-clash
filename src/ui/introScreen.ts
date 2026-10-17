// The spoken "How to Play" screen. Card order, Skip, and Replay live in introController.ts.
// This file draws the cards, the step dots, and the buttons.
import type { SpeakOptions, SpeechHandle, VoiceLine } from '../audio/types';
import { INTRO, UI_EXTRA } from '../data/copy';
import type { IntroScript } from '../data/types';
import { chronoFace, introArt } from './art';
import { LOCAL_IDS } from './constants';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { createIntroController } from './introController';
import { TEST_IDS, type IntroResult } from './types';

/**
 * With no AudioManager, the caller's `play(cardIndex)` decides how long each card lasts.
 * Captions still run on a timer, so the intro works silently.
 */
function playHookSpeaker(
  ctx: UiCtx,
  script: IntroScript,
  play: (cardIndex: number) => Promise<void>,
): (line: VoiceLine, options: SpeakOptions) => SpeechHandle & { stop(): void } {
  return (line, options) => {
    const timers: unknown[] = [];
    let finished = false;
    let resolveDone: (e: 'ended' | 'stopped') => void = () => undefined;
    const done = new Promise<'ended' | 'stopped'>((r) => (resolveDone = r));
    const finish = (how: 'ended' | 'stopped'): void => {
      if (finished) return;
      finished = true;
      timers.splice(0).forEach((t) => ctx.env.clearTimeout(t));
      if (how === 'ended') options.onCaption?.(null);
      resolveDone(how);
    };
    for (const c of line.captions) {
      if (c.startMs <= 0) options.onCaption?.(c.text);
      else timers.push(ctx.env.setTimeout(() => options.onCaption?.(c.text), c.startMs));
    }
    const index = Math.max(
      0,
      script.findIndex((c) => c.id === line.id),
    );
    Promise.resolve(play(index)).then(
      () => finish('ended'),
      () => finish('ended'),
    );
    return { done, source: 'silent', stop: () => finish('stopped') };
  };
}

export function showIntro(
  ctx: UiCtx,
  script: IntroScript,
  play: (cardIndex: number) => Promise<void>,
): Promise<IntroResult> {
  const { doc, audio } = ctx;
  const motion = ctx.motion();
  const total = script.length;

  const cardHolder = h(doc, 'div', { class: 'tc-intro-stage' });
  const dots = h(doc, 'div', {
    class: 'tc-dots',
    'data-testid': LOCAL_IDS.introDots,
    role: 'group',
    'aria-label': UI_EXTRA.stepsLabel,
  });
  const dotEls = script.map((_, i) => {
    const d = h(doc, 'span', { class: 'tc-dot', 'data-dot': i + 1 });
    dots.append(d);
    return d;
  });

  const button = (testid: string, label: string, cls = 'tc-btn tc-btn-neutral') =>
    h(doc, 'button', { type: 'button', class: cls, 'data-testid': testid, text: label });
  // Gold primary marks the forward step (Next), not the way out. Skip stays one clear tap away.
  const skip = button(TEST_IDS.introSkip, INTRO.skip);
  const replay = button(TEST_IDS.introReplay, INTRO.replay);
  const next = button(LOCAL_IDS.introNext, INTRO.next, 'tc-btn tc-btn-primary');
  const mute = button(LOCAL_IDS.introMute, INTRO.mute);
  const isMuted = (): boolean => (audio ? audio.muted : ctx.settings().muted);
  const paintMute = (): void => void (mute.textContent = isMuted() ? INTRO.unmute : INTRO.mute);
  paintMute();

  const screen = h(
    doc,
    'section',
    { class: 'tc-screen tc-intro', 'data-screen': 'intro', 'data-motion': motion },
    h(
      doc,
      'header',
      { class: 'tc-intro-head' },
      chronoFace(doc),
      h(doc, 'span', { class: 'tc-chrono', text: UI_EXTRA.chronoName }),
      h(doc, 'h1', { text: INTRO.heading }),
    ),
    cardHolder,
    dots,
    h(doc, 'div', { class: 'tc-row' }, replay, next, mute, skip),
  );
  const closeScreen = ctx.openScreen(screen);

  return new Promise<IntroResult>((resolve) => {
    const speaker = audio
      ? (line: VoiceLine, o: SpeakOptions) => audio.speak(line, o)
      : playHookSpeaker(ctx, script, play);
    const controller = createIntroController({
      script,
      speak: speaker,
      stop: () => audio?.stopSpeech(),
      storage: ctx.storage,
      onCaption: (t) => ctx.setCaption(t),
      onCard: (i, card) => {
        // A fresh element each time, so the slide-in plays again for every card.
        const el = h(
          doc,
          'article',
          {
            class: ctx.reduced() ? 'tc-intro-card' : 'tc-intro-card tc-slide-in',
            'data-testid': TEST_IDS.introCard,
            'data-art': card.art,
          },
          h(doc, 'p', { class: 'tc-muted', text: INTRO.cardOf(i + 1, total) }),
          h(doc, 'h2', { 'data-role': 'title', text: card.title }),
          h(
            doc,
            'div',
            { class: 'tc-art', 'data-art': card.art, 'aria-hidden': 'true' },
            introArt(doc, card.art),
          ),
        );
        cardHolder.replaceChildren(el);
        dotEls.forEach((d, k) => {
          if (k === i) d.setAttribute('aria-current', 'step');
          else d.removeAttribute('aria-current');
        });
      },
    });

    skip.addEventListener('click', () => controller.skip());
    replay.addEventListener('click', () => controller.replay());
    next.addEventListener('click', () => controller.next());
    mute.addEventListener('click', () => {
      if (audio) {
        audio.setMuted(!audio.muted);
        ctx.patchSettings({ muted: audio.muted });
      } else {
        ctx.patchSettings({ muted: !ctx.settings().muted });
      }
      paintMute();
    });

    void controller.start().then((result) => {
      closeScreen();
      resolve(result);
    });
    skip.focus();
  });
}
