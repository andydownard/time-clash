// Spoken clips from the app server's /v1/clips route (voice-server/, docs/APP_SERVER.md).
// This file only decides WHICH url a line uses and remembers misses. The AudioManager plays it,
// so mute, volume, Skip, one-voice-at-a-time and captions all keep working.
// The url holds a hash of the line's text and nothing else: no names, no player data.
import { clipId } from './clipId';

/** A clip that has not started playing by now is dropped and the browser voice takes over. */
export const CLIP_START_TIMEOUT_MS = 1500;

export type ClipPlayer = {
  /** True when this build was made with VITE_VOICE=on. When false the game behaves as it always did. */
  readonly enabled: boolean;
  /** The clip url for this exact spoken text, or null when off or the clip already missed. */
  urlFor(text: string): string | null;
  /** Remember that this text has no usable clip, so it is not asked for again this session. */
  markMissed(text: string): void;
};

/** Where the app server hands out clips: the SAME origin as the game, so no CORS and no extra CSP. */
export const CLIP_PATH = '/v1/clips';

/** `enabled` comes from the build flag VITE_VOICE=on (set for production builds). */
export function createClipPlayer(enabled: boolean): ClipPlayer {
  const missed = new Set<string>();
  return {
    enabled,
    urlFor(text) {
      if (!enabled) return null;
      const id = clipId(text);
      if (missed.has(id)) return null;
      return `${CLIP_PATH}/${id}`;
    },
    markMissed(text) {
      missed.add(clipId(text));
    },
  };
}
