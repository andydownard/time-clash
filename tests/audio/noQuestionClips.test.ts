// The owner removed question read-aloud (2026-10-23) and the question clips were deleted
// (2026-10-29). No voice volume may hold a question or passage clip again.
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const VOLUMES = ['voice-k4.sqlite', 'voice-5-8.sqlite', 'voice-9-12.sqlite'];

describe('voice volumes hold no question clips', () => {
  for (const name of VOLUMES) {
    it(`${name} has only wipeout (bark) rows`, () => {
      const db = new DatabaseSync(fileURLToPath(new URL(`../../db/${name}`, import.meta.url)), {
        readOnly: true,
      });
      try {
        const kinds = db.prepare('SELECT DISTINCT kind FROM voice_clip_index').all() as Array<{
          kind: string;
        }>;
        expect(kinds.map((k) => k.kind)).toEqual(['bark']);
      } finally {
        db.close();
      }
    });
  }
});
