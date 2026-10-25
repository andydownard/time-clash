// Every wipeout line is spoken in production (clips on). A line with a recorded clip plays it. A
// line with no clip yet (the lines added on 2026-10-25) asks the app server, gets a 404, and falls
// back to the browser voice at once, with its caption. It is never silent and never uncaptioned.
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createAudioManager } from '../../src/audio/audioManager';
import { clipId } from '../../src/audio/clipId';
import { createClipPlayer } from '../../src/audio/clipPlayer';
import { tumblePool } from '../../src/data/copy';
import { createHarness } from './fakes';

const DB = fileURLToPath(new URL('../../db/voice-k4.sqlite', import.meta.url));

/** The ids that have a recorded wipeout clip today. The app server serves the first copy it finds. */
function recordedIds(): Set<string> {
  const db = new DatabaseSync(DB, { readOnly: true });
  try {
    const rows = db.prepare("SELECT id FROM voice_clip_index WHERE kind = 'bark'").all() as Array<{
      id: string;
    }>;
    return new Set(rows.map((r) => r.id));
  } finally {
    db.close();
  }
}

const allLines = [...new Set([...tumblePool('PAST'), ...tumblePool('FUTURE')])];

describe('wipeout lines with and without a recorded clip', () => {
  const recorded = recordedIds();
  const unrecorded = allLines.filter((l) => !recorded.has(clipId(l)));

  it('knows which lines still need a recording (the 15 added on 2026-10-25)', () => {
    expect(recorded.size).toBeGreaterThanOrEqual(27);
    expect(unrecorded).toHaveLength(15);
    expect(unrecorded).toContain('Wobble, wobble, flop!');
    expect(unrecorded).not.toContain('Ouch! My dignity!');
  });

  it.each(unrecorded)(
    '"%s": a missing clip falls back to the browser voice with a caption',
    async (text) => {
      const h = createHarness({ clips: createClipPlayer(true) });
      const a = createAudioManager(h.env, { muted: false, volume: 0.7 });
      await a.unlock();
      const seen: Array<string | null> = [];
      // The same line shape the battle flow speaks for a tumble.
      const handle = a.speak(
        { id: 'tumble-line', text, captions: [{ text, startMs: 0 }], durationMs: 2000 },
        { onCaption: (t) => seen.push(t) },
      );
      expect(h.elements.map((e) => e.src)).toEqual([`/v1/clips/${clipId(text)}`]);
      h.elements[0]!.onerror?.(); // the app server has no clip: 404
      expect(handle.source).toBe('synthesis');
      expect(h.speech.spoken.map((u) => u.text)).toEqual([text]);
      expect(seen[0]).toBe(text);
      // Asked once per session: the next time it goes straight to the browser voice.
      a.speak({ id: 'tumble-line', text, captions: [{ text, startMs: 0 }], durationMs: 2000 });
      expect(h.elements).toHaveLength(1);
      expect(h.speech.spoken).toHaveLength(2);
    },
  );
});
