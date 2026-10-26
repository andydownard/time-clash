// The base fall lines (2026-10-25) have no recorded clip yet. Each one asks the app server, gets
// a 404, and falls back to the browser voice at once, with its caption. Never silent, never
// uncaptioned. INBOX.md tracks recording them.
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createAudioManager } from '../../src/audio/audioManager';
import { clipId } from '../../src/audio/clipId';
import { createClipPlayer } from '../../src/audio/clipPlayer';
import { baseFallPool } from '../../src/data/copy';
import { createHarness } from './fakes';

const DB = fileURLToPath(new URL('../../db/voice-k4.sqlite', import.meta.url));

function recordedIds(): Set<string> {
  const db = new DatabaseSync(DB, { readOnly: true });
  try {
    const rows = db.prepare('SELECT id FROM voice_clip_index').all() as Array<{ id: string }>;
    return new Set(rows.map((r) => r.id));
  } finally {
    db.close();
  }
}

const allLines = [...new Set([...baseFallPool('PAST'), ...baseFallPool('FUTURE')])];

describe('base fall lines and the voice', () => {
  it('none has a recorded clip yet', () => {
    const recorded = recordedIds();
    expect(allLines.filter((l) => recorded.has(clipId(l)))).toEqual([]);
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
