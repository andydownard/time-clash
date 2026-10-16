// Runs the five-card "How to Play" intro. No DOM in here: the overlay draws the cards
// and the caption bar from the callbacks. That keeps Skip, Replay, and card order testable.
import type { SpeakOptions, SpeechHandle, VoiceLine } from '../audio/types';
import type { IntroCard, IntroScript } from '../data/types';
import type { TypedStorage } from '../storage/types';
import type { IntroResult } from './types';

export type IntroControllerDeps = {
  script: IntroScript;
  speak: (line: VoiceLine, options: SpeakOptions) => SpeechHandle;
  stop: () => void;
  storage: TypedStorage;
  onCard: (index: number, card: IntroCard) => void;
  onCaption: (text: string | null) => void;
};

export interface IntroController {
  /** Plays from card 1. Resolves once, when the intro finishes or is skipped. */
  start(): Promise<IntroResult>;
  /** Stops the voice, remembers that the intro was seen, and ends. Works at any moment. */
  skip(): void;
  /** Stops the voice and restarts at card 1. */
  replay(): void;
  /** Jumps to the next card. On the last card it finishes. */
  next(): void;
  readonly index: number;
  readonly finished: boolean;
}

export const toVoiceLine = (card: IntroCard): VoiceLine => ({
  id: card.id,
  audioSrc: card.audio,
  text: card.fallbackText,
  captions: card.captions,
  durationMs: card.durationMs,
});

export function createIntroController(deps: IntroControllerDeps): IntroController {
  const { script } = deps;
  let index = 0;
  let finished = false;
  /** Bumped on every card start, so a stopped line can never move the intro on. */
  let token = 0;
  let resolveResult: (r: IntroResult) => void = () => undefined;
  const result = new Promise<IntroResult>((r) => (resolveResult = r));

  const end = (how: IntroResult): void => {
    if (finished) return;
    finished = true;
    token++;
    deps.stop();
    deps.onCaption(null);
    deps.storage.set('timeclash.introSeen', true);
    resolveResult(how);
  };

  const runCard = (i: number): void => {
    const card = script[i];
    if (!card) {
      end('finished');
      return;
    }
    index = i;
    const mine = ++token;
    deps.onCard(i, card);
    const handle = deps.speak(toVoiceLine(card), { onCaption: deps.onCaption });
    void handle.done.then((how) => {
      if (mine !== token || finished || how !== 'ended') return;
      runCard(i + 1);
    });
  };

  return {
    start() {
      if (!finished && token === 0) runCard(0);
      return result;
    },
    skip() {
      end('skipped');
    },
    replay() {
      if (finished) return;
      token++;
      deps.stop();
      runCard(0);
    },
    next() {
      if (finished) return;
      token++;
      deps.stop();
      runCard(index + 1);
    },
    get index() {
      return index;
    },
    get finished() {
      return finished;
    },
  };
}
