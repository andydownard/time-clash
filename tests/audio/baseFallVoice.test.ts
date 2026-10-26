// The base fall lines (2026-10-25) are recorded in all three clip volumes. If a clip ever goes
// missing, the app server answers 404 and the game falls back to the browser voice at once, with
// its caption. Never silent, never uncaptioned.
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createAudioManager } from '../../src/audio/audioManager';
import { clipId } from '../../src/audio/clipId';
import { createClipPlayer } from '../../src/audio/clipPlayer';
import { baseFallPool } from '../../src/data/copy';
import { createHarness } from './fakes';

const VOLUMES = ['voice-k4.sqlite', 'voice-5-8.sqlite', 'voice-9-12.sqlite'];

function recordedIds(volume: string): Set<string> {
  const db = new DatabaseSync(fileURLToPath(new URL(`../../db/${volume}`, import.meta.url)), {
    readOnly: true,
  });
  try {
    const rows = db.prepare('SELECT id FROM voice_clip_index').all() as Array<{ id: string }>;
    return new Set(rows.map((r) => r.id));
  } finally {
    db.close();
  }
}

const allLines = [...new Set([...baseFallPool('PAST'), ...baseFallPool('FUTURE')])];

describe('base fall lines and the voice', () => {
  it.each(VOLUMES)('every line has a recorded clip in %s', (volume) => {
    const recorded = recordedIds(volume);
    expect(allLines.filter((l) => !recorded.has(clipId(l)))).toEqual([]);
  });

  it.each(allLines)(
    '"%s": a missing clip falls back to the browser voice with a caption',
    async (text) => {
      const h = createHarness({ clips: createClipPlayer(true) });
      const a = createAudioManager(h.env, { muted: false, volume: 0.7 });
      await a.unlock();
      const seen: Array<string | null> = [];
      // The same line shape the battle flow speaks for a base fall.
      const handle = a.speak(
        { id: 'base-fall-line', text, captions: [{ text, startMs: 0 }], durationMs: 2000 },
        { onCaption: (t) => seen.push(t) },
      );
      expect(h.elements.map((e) => e.src)).toEqual([`/v1/clips/${clipId(text)}`]);
      h.elements[0]!.onerror?.();
      expect(handle.source).toBe('synthesis');
      expect(h.speech.spoken.map((u) => u.text)).toEqual([text]);
      expect(seen[0]).toBe(text);
    },
  );
});
