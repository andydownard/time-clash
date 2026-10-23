// Types for the things the e2e init scripts and the app hook put on window.
import type { TimeClashHook } from '../../src/scenes/testHook';

export type SilentState = {
  /** Every sound API call, in order. */
  log: string[];
  speakCalls: number;
  cancelCalls: number;
  audioContexts: number;
  audioPlays: number;
  /** Utterances queued and not yet cancelled. */
  speaking: number;
  /** Audio elements that started and have not been paused. */
  playing: number;
};

declare global {
  interface Window {
    __timeclash?: TimeClashHook;
    __silent?: SilentState;
    /** Added to performance.now(), so a test can make an answer "slow" without waiting. */
    __skew?: number;
    /** performance.now() (page clock) when the reload card last appeared. */
    __modalAt?: number;
  }
}
