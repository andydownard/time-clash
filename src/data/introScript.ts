// The five "How to Play" cards. Text is exactly docs/NARRATION.md, split into one
// caption per sentence. tests/data/introScript.test.ts reads that file and compares.
// Each durationMs is the real clip length in db/voice.sqlite, rounded to 100 ms. The clips are
// extracted to public/audio/voice/ by scripts/extract-voice-clips.py.
import type { IntroCard, IntroCardId, IntroScript } from './types';

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
  durationMs: number,
): IntroCard {
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
  card(
    'welcome',
    'Welcome',
    '/audio/voice/intro-01-welcome.m4a',
    [
      'Welcome to Time Clash!',
      'A Past castle fights a secret Future base.',
      "Let's learn how to win!",
    ],
    6400,
  ),
  card(
    'aim',
    'Aim',
    '/audio/voice/intro-02-aim.m4a',
    [
      'Aim your launcher with the angle and power sliders.',
      'Watch the wind.',
      'It pushes your shot sideways, the rascal!',
    ],
    7400,
  ),
  card(
    'two-shots',
    'Two Shots',
    '/audio/voice/intro-03-shoot-twice.m4a',
    [
      'You get two shots each turn.',
      'Hit the other base to lower its health.',
      'Empty the bar and you win!',
    ],
    6400,
  ),
  card(
    'reload',
    'Reload',
    '/audio/voice/intro-04-reload.m4a',
    [
      'After shot two, answer a question to reload.',
      'Answer fast to earn bonus scrap.',
      'Mistake? Even Chrono trips. You still reload!',
      'Get it right for a Power Shot!',
    ],
    11300,
  ),
  card(
    'wipeouts',
    'Wipeouts and Turns',
    '/audio/voice/intro-05-wipeouts-and-passing-the-screen.m4a',
    [
      'A blast can bump you.',
      'Then you do a silly wipeout!',
      'You just lose a little dignity!',
      'Pass the screen between turns.',
      'No peeking!',
      "Let's clash across time!",
    ],
    10600,
  ),
];
