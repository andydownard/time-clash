// Shared data shapes for src/data/. Intro shape from docs/NARRATION.md.
import type { Caption } from '../audio/types';

export type IntroCardId = 'welcome' | 'aim' | 'two-shots' | 'reload' | 'wipeouts';

export type IntroCard = {
  id: IntroCardId;
  /** Card title, e.g. "Aim". */
  title: string;
  /** e.g. "/audio/voice/intro-02-aim.mp3". The file may be missing; speech synthesis covers it. */
  audio: string;
  /** Full text for speechSynthesis and the caption fallback. */
  fallbackText: string;
  captions: Caption[];
  /** Illustration id from the design. Placeholder shapes until art lands. */
  art: string;
  /** Rough length, used to time captions when no voice is available. */
  durationMs: number;
};

/** Exactly 5 cards in this order: welcome, aim, two-shots, reload, wipeouts. */
export type IntroScript = readonly IntroCard[];
