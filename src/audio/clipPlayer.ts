// Spoken clips from the voice service (voice-server/, docs/VOICE_SERVICE.md).
// This file only decides WHICH url a line uses and remembers misses. The AudioManager plays it,
// so mute, volume, Skip, one-voice-at-a-time and captions all keep working.
// The url holds a hash of the line's text and nothing else: no names, no player data.
import { clipId } from './clipId';

/** A clip that has not started playing by now is dropped and the browser voice takes over. */
export const CLIP_START_TIMEOUT_MS = 1500;

export type ClipPlayer = {
  /** True when a voice service is configured. When false the game behaves as it always did. */
  readonly enabled: boolean;
  /** The clip url for this exact spoken text, or null when off or the clip already missed. */
  urlFor(text: string): string | null;
  /** Remember that this text has no usable clip, so it is not asked for again this session. */
  markMissed(text: string): void;
};

/** Reads the service address. Anything that is not an http(s) address turns the feature off. */
export function normalizeVoiceUrl(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export function createClipPlayer(rawBase: string | undefined | null): ClipPlayer {
  const base = normalizeVoiceUrl(rawBase);
  const missed = new Set<string>();
  return {
    enabled: base !== null,
    urlFor(text) {
      if (base === null) return null;
      const id = clipId(text);
      if (missed.has(id)) return null;
      return `${base}/v1/clips/${id}`;
    },
    markMissed(text) {
      missed.add(clipId(text));
    },
  };
}
