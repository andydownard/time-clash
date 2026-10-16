// Reload modal: the learning moment. A full-viewport cover (the other player cannot see it).
// A wrong answer shows the right one kindly and still reloads. It never blocks play.
import { RELOAD as COPY, UI_EXTRA } from '../data/copy';
import { RELOAD, UI } from '../game/config';
import { fastWindowMs } from '../game/reload';
import { spokenSentences, spokenText } from '../questions/spoken';
import type { UiCtx } from './ctx';
import { h, renderMath } from './dom';
import { LOCAL_IDS } from './constants';
import { createCoverMute } from './muteButton';
import { TEST_IDS, type ReloadAnswer, type ReloadModalOptions } from './types';

const hasMath = (nodes: Node[]): boolean => nodes.some((n) => n.nodeType === 1);

function layoutOf(o: ReloadModalOptions): 'math' | 'reading-young' | 'reading' {
  const { subject, grade } = o.question;
  if (subject === 'math') return 'math';
  return grade <= UI.youngReadingMaxGrade ? 'reading-young' : 'reading';
}

export function showReloadModal(ctx: UiCtx, options: ReloadModalOptions): Promise<ReloadAnswer> {
  const { doc, env } = ctx;
  const { question } = options;
  const now = options.now ?? (() => env.now());
  const openedAt = now();

  return new Promise<ReloadAnswer>((resolve) => {
    // ---- prompt ----
    const promptNodes = renderMath(doc, question.prompt);
    const prompt = h(doc, 'div', {
      id: 'tc-reload-prompt',
      class: 'tc-prompt',
      'data-testid': LOCAL_IDS.reloadPrompt,
    });
    const paintPrompt = (): void => {
      // With sound off, a sight word item cannot be heard, so it shows the word to match.
      if (question.kind === 'sightword' && question.audioWord && ctx.settings().muted) {
        prompt.replaceChildren(doc.createTextNode(COPY.matchWord(question.audioWord)));
        prompt.removeAttribute('role');
        prompt.removeAttribute('aria-label');
        return;
      }
      prompt.replaceChildren(...renderMath(doc, question.prompt));
      if (hasMath(promptNodes)) {
        prompt.setAttribute('role', 'math');
        prompt.setAttribute('aria-label', question.prompt);
      }
    };
    paintPrompt();
    const offSettings = ctx.onSettings(paintPrompt);

    // ---- choices ----
    const choiceButtons = question.choices.slice(0, UI.choicesPerQuestion).map((text, i) => {
      const nodes = renderMath(doc, text);
      const b = h(doc, 'button', {
        type: 'button',
        class: 'tc-choice',
        'data-testid': TEST_IDS.reloadChoice(i),
      });
      b.append(...nodes);
      if (hasMath(nodes)) b.setAttribute('aria-label', text);
      return b;
    });

    // ---- feedback, hint, speak ----
    const feedback = h(doc, 'div', {
      class: 'tc-feedback',
      'data-testid': LOCAL_IDS.reloadFeedback,
      'aria-live': 'polite',
    });
    const hintArea = h(doc, 'div', { class: 'tc-hint-area', 'aria-live': 'polite' });
    let hintRow: HTMLElement | null = null;
    let hintButton: HTMLButtonElement | null = null;
    if (question.hint) {
      hintButton = h(
        doc,
        'button',
        {
          type: 'button',
          class: 'tc-btn tc-btn-neutral tc-hint-btn',
          'data-testid': TEST_IDS.reloadHint,
        },
        h(doc, 'span', { 'aria-hidden': 'true', text: `${COPY.hintIcon} ` }),
        COPY.hint,
      );
      hintButton.addEventListener('click', () => {
        hintArea.replaceChildren(
          h(doc, 'p', {
            class: 'tc-hint-text',
            'data-testid': 'reload-hint-text',
            text: question.hint,
          }),
        );
        if (hintButton) hintButton.disabled = true;
      });
      hintRow = h(doc, 'div', { class: 'tc-hint-row' }, hintButton);
    }
    // Hear it: every question can be read aloud. The captions are the words already on screen.
    const speakButton = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-speak-btn',
      'data-testid': TEST_IDS.reloadSpeak,
      text: COPY.speak,
    });
    speakButton.addEventListener('click', () => {
      try {
        options.speak?.(spokenText(question), spokenSentences(question));
      } catch {
        /* no sound is not a problem; everything is on screen */
      }
    });
    const mute = createCoverMute(ctx);

    const timer = h(doc, 'div', {
      class: 'tc-timer-ring',
      'data-testid': LOCAL_IDS.reloadTimer,
      'aria-hidden': 'true',
    });
    const fastMs = fastWindowMs(question.kind, question.grade);
    timer.style.setProperty('--tc-fast-ms', `${fastMs}ms`);

    const nextSlot = h(doc, 'div', { class: 'tc-next-row' });
    const card = h(
      doc,
      'div',
      { class: 'tc-cover-card tc-reload-card' },
      h(
        doc,
        'header',
        { class: 'tc-reload-head' },
        h(doc, 'h2', { id: 'tc-reload-heading', tabindex: -1, text: COPY.heading }),
        h(doc, 'p', { class: 'tc-reload-who', text: options.playerName }),
        h(doc, 'p', { text: COPY.instructions }),
      ),
      h(
        doc,
        'div',
        { class: 'tc-timer' },
        timer,
        h(doc, 'p', { class: 'tc-muted', text: COPY.timerLabel }),
      ),
      question.passage
        ? h(doc, 'p', { id: 'tc-reload-passage', class: 'tc-passage', text: question.passage })
        : null,
      prompt,
      speakButton,
      h(
        doc,
        'div',
        { class: 'tc-choices', role: 'group', 'aria-label': UI_EXTRA.choicesLabel },
        ...choiceButtons,
      ),
      hintRow,
      hintArea,
      feedback,
      nextSlot,
      mute.el,
    );
    const el = h(
      doc,
      'section',
      {
        class: 'tc-reload',
        'data-testid': TEST_IDS.reloadModal,
        'data-layout': layoutOf(options),
        'data-team': options.team,
        'data-motion': ctx.motion(),
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'tc-reload-heading',
        'aria-describedby': question.passage
          ? 'tc-reload-passage tc-reload-prompt'
          : 'tc-reload-prompt',
      },
      card,
    );

    const close = ctx.openCover('reload', el);
    let answered = false;

    const finish = (answer: ReloadAnswer): void => {
      offSettings();
      mute.dispose();
      // Nothing keeps talking, and no caption is left behind, once the card is gone.
      try {
        ctx.audio?.stopSpeech();
      } catch {
        /* nothing to stop */
      }
      ctx.setCaption(null);
      close();
      resolve(answer);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= choiceButtons.length) choose(n - 1);
    };

    function addQuip(outcome: 'fast' | 'slow' | 'wrong'): void {
      const line = options.quip?.(outcome);
      if (line) feedback.append(h(doc, 'p', { class: 'tc-quip', text: line }));
    }

    function choose(index: number): void {
      const text = question.choices[index];
      if (answered || text === undefined) return;
      answered = true;
      doc.removeEventListener('keydown', onKey);
      const raw = now() - openedAt;
      // A broken clock counts as slow, never as an error (docs/CONTRACTS.md decision 11).
      const elapsedMs = Number.isFinite(raw) && raw >= 0 ? raw : fastMs;
      const correct = text === question.answer;
      choiceButtons.forEach((b, i) => {
        b.setAttribute('aria-disabled', 'true');
        if (question.choices[i] === question.answer) b.setAttribute('data-state', 'right');
        else if (i === index) b.setAttribute('data-state', 'tried');
      });
      if (correct) {
        ctx.sfx('clunk');
        const bonus = elapsedMs < fastMs ? COPY.fastBonus : COPY.slowCorrect;
        feedback.setAttribute('data-state', 'right');
        feedback.replaceChildren(
          h(doc, 'p', { class: 'tc-big', text: COPY.reloaded }),
          h(doc, 'p', { text: bonus }),
        );
        addQuip(elapsedMs < fastMs ? 'fast' : 'slow');
      } else {
        ctx.sfx('boing');
        feedback.setAttribute('data-state', 'oops');
        feedback.replaceChildren(
          h(doc, 'p', { class: 'tc-big', text: COPY.wrong(question.answer) }),
          h(doc, 'p', { text: COPY.wrongReloaded }),
        );
        addQuip('wrong');
        // The clue is the teaching moment, so it shows after a miss even if never opened.
        if (question.hint) {
          feedback.append(
            h(doc, 'p', {
              class: 'tc-why',
              'data-testid': 'reload-why',
              text: COPY.why(question.hint),
            }),
          );
        }
      }
      // Got it: tap or Enter to move on. A short delay stops a stray key press from skipping the clue.
      const answeredAt = env.now();
      const result: ReloadAnswer = { correct, elapsedMs, choice: text };
      let timer: unknown = null;
      const next = h(doc, 'button', {
        type: 'button',
        class: 'tc-btn tc-btn-primary',
        'data-testid': TEST_IDS.reloadNext,
        text: COPY.gotIt,
      });
      next.addEventListener('click', () => {
        if (env.now() - answeredAt < RELOAD.gotItDelayMs) return;
        env.clearTimeout(timer);
        finish(result);
      });
      nextSlot.replaceChildren(next);
      next.focus();
      timer = env.setTimeout(
        () => finish(result),
        correct ? RELOAD.rightAnswerBeatMs : RELOAD.wrongAnswerMaxMs,
      );
    }

    choiceButtons.forEach((b, i) =>
      b.addEventListener('click', () => {
        if (!answered) ctx.sfx('click');
        choose(i);
      }),
    );
    doc.addEventListener('keydown', onKey);
    el.querySelector<HTMLElement>('#tc-reload-heading')?.focus();
  });
}
