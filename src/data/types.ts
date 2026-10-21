// Shared data shapes for src/data/. Intro shape from docs/NARRATION.md.
import type { Caption } from '../audio/types';

export type IntroCardId = 'welcome' | 'aim' | 'two-shots' | 'reload' | 'wipeouts';

export type IntroCard = {
  id: IntroCardId;
  /** Card title, e.g. "Aim". */
  title: string;
  /** e.g. "/audio/voice/intro-02-aim.m4a". If the file fails to load, speech synthesis covers it. */
  audio: string;
  /** Full text for speechSynthesis and the caption fallback. */
  fallbackText: string;
  captions: Caption[];
  /** Illustration id from the design. Placeholder shapes until art lands. */
  art: string;
  /** Real clip length (rounded to 100 ms). Times the captions, also when no voice plays. */
  durationMs: number;
};

/** Exactly 5 cards in this order: welcome, aim, two-shots, reload, wipeouts. */
export type IntroScript = readonly IntroCard[];
