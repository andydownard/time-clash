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
      'One of you commands a castle from the Past.',
      'The other commands a secret base from the Future.',
      "Let's learn how to win!",
    ],
    9400,
  ),
  card(
    'aim',
    'Aim',
    '/audio/voice/intro-02-aim.m4a',
    [
      'On your turn, aim your launcher.',
      'Turn the angle dial to point up or down.',
      'Slide the power meter to shoot far or near.',
      'Watch the wind.',
      'It pushes your shot sideways!',
    ],
    11800,
  ),
  card(
    'two-shots',
    'Two Shots',
    '/audio/voice/intro-03-shoot-twice.m4a',
    [
      'You get two shots each turn.',
      'Hit the other base to lower its health.',
      'Each base starts with one hundred health.',
      'Empty the bar to win!',
    ],
    8900,
  ),
  card(
    'reload',
    'Reload',
    '/audio/voice/intro-04-reload.m4a',
    [
      'After shot two, you reload your launcher.',
      'Answer a question to reload it.',
      'Reading players find the right word.',
      'Math players solve the problem.',
      'Answer fast to earn bonus scrap.',
      "Don't worry about mistakes.",
      'You always get to reload.',
    ],
    15900,
  ),
  card(
    'wipeouts',
    'Wipeouts and Turns',
    '/audio/voice/intro-05-wipeouts-and-passing-the-screen.m4a',
    [
      'A blast can bump you.',
      'Then you do a silly wipeout!',
      'Nobody gets hurt.',
      'You just lose a little dignity!',
      'Between turns, pass the screen.',
      'No peeking at their question.',
      'Ready?',
      "Let's clash across time!",
    ],
    13800,
  ),
];
