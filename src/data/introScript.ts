// The five "How to Play" cards. Text is exactly docs/NARRATION.md, split into one
// caption per sentence. tests/data/introScript.test.ts reads that file and compares.
// Each durationMs is estimated from the text length (estimateSpeechMs, about 70 ms a character,
// measured from the first recorded clips). Re-render the clips from docs/NARRATION.md with
// scripts/build-voice-db.py, then scripts/extract-voice-clips.py, so the voice matches the captions.
import type { IntroCard, IntroCardId, IntroScript } from './types';

/** Milliseconds of Chrono's voice per character (measured: 66 to 72 across the first five clips). */
const MS_PER_CHAR = 70;

/** Estimated speech length for a card, rounded to 100 ms. */
export function estimateSpeechMs(text: string): number {
  return Math.round((text.length * MS_PER_CHAR) / 100) * 100;
}

/**
 * Spreads caption start times across the card in proportion to sentence length,
 * so each caption appears about when its words are spoken.
 */
export function timeCaptions(
  sentences: readonly string[],
  durationMs: number,
): Array<{ text: string; startMs: number }> {
  const total = sentences.reduce((n, s) => n + s.length, 0);
  // Leave a short tail so the last caption has time on screen.
  const span = durationMs * 0.9;
  let before = 0;
  return sentences.map((text) => {
    const startMs = Math.round((before / total) * span);
    before += text.length;
    return { text, startMs };
  });
}

function card(
  id: IntroCardId,
  title: string,
  audio: string,
  sentences: readonly string[],
): IntroCard {
  const durationMs = estimateSpeechMs(sentences.join(' '));
  return {
    id,
    title,
    audio,
    fallbackText: sentences.join(' '),
    captions: timeCaptions(sentences, durationMs),
    art: id,
    durationMs,
  };
}

export const INTRO_SCRIPT: IntroScript = [
  card('welcome', 'Welcome', '/audio/voice/intro-01-welcome.m4a', [
    'Welcome to Time Clash!',
    'One of you commands a castle from the Past.',
    'The other commands a secret base from the Future.',
  ]),
  card('aim', 'Aim', '/audio/voice/intro-02-aim.m4a', [
    'Aim with the angle dial.',
    'Slide the power meter to shoot far or near.',
    'Watch the wind.',
    'It pushes your shot sideways!',
  ]),
  card('two-shots', 'Two Shots', '/audio/voice/intro-03-shoot-twice.m4a', [
    'You get two shots each turn.',
    'Hit the other base to lower its health.',
    'Empty the bar to win!',
  ]),
  card('reload', 'Reload', '/audio/voice/intro-04-reload.m4a', [
    'After shot two, answer a question to reload.',
    'Get it right and win a Power Shot!',
    'Get it wrong? Shh, nobody saw.',
    'You still reload!',
  ]),
  card(
    'wipeouts',
    'Wipeouts and Turns',
    '/audio/voice/intro-05-wipeouts-and-passing-the-screen.m4a',
    [
      'A blast can make you do a silly wipeout!',
      'You just lose a little dignity!',
      'Between turns, pass the screen.',
      'No peeking at their question.',
      "Let's clash across time!",
    ],
  ),
];
