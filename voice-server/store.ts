// Read-only clip store. Opens every voice-*.sqlite in a folder, indexes the ids once,
// and loads one clip's bytes per request. Parameterized SQL only. No writes, ever.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

export type ClipStore = {
  /** Number of clips indexed. */
  readonly count: number;
  /** The clip's bytes, or null when the id is unknown. */
  load(id: string): Uint8Array | null;
  close(): void;
};

type Source = { db: DatabaseSync; read: StatementSync };

export function openClipStore(dir: string): ClipStore {
  const files = readdirSync(dir)
    .filter((n) => /^voice-[A-Za-z0-9_.-]+\.sqlite$/.test(n))
    .sort();
  const sources: Source[] = [];
  const index = new Map<string, { source: number; rowid: number }>();
  for (const name of files) {
    const db = new DatabaseSync(join(dir, name), { readOnly: true });
    const read = db.prepare('SELECT audio FROM voice_clip_index WHERE rowid = ?');
    const at = sources.push({ db, read }) - 1;
    const rows = db.prepare('SELECT rowid AS rowid, id FROM voice_clip_index').all();
    for (const row of rows) {
      const id = String(row.id);
      if (!index.has(id)) index.set(id, { source: at, rowid: Number(row.rowid) });
    }
  }
  return {
    get count() {
      return index.size;
    },
    load(id) {
      const hit = index.get(id);
      if (!hit) return null;
      const row = sources[hit.source]?.read.get(hit.rowid);
      const audio = row?.audio;
      return audio instanceof Uint8Array ? audio : null;
    },
    close() {
      for (const s of sources) s.db.close();
    },
  };
}
