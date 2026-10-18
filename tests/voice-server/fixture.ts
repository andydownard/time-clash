// A tiny clip database for tests. Bytes are fake but the mime and table match the contract.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { clipId } from '../../src/audio/clipId';

export const FIXTURE_TEXTS = ['What is 7 x 8?', 'I meant to do that!', 'Ouch, my pride!'];

/** 100 recognizable bytes: byte i has value i. */
export const fixtureBytes = (): Uint8Array => Uint8Array.from({ length: 100 }, (_, i) => i);

export function makeFixtureDir(file = 'voice-test.sqlite', texts = FIXTURE_TEXTS): string {
  const dir = mkdtempSync(join(tmpdir(), 'tc-voice-'));
  const db = new DatabaseSync(join(dir, file));
  db.exec(`CREATE TABLE voice_clip_index (id TEXT PRIMARY KEY, kind TEXT, text TEXT, text_sha256 TEXT,
    mime TEXT, duration_ms INTEGER, bytes INTEGER, audio BLOB, voice TEXT, engine TEXT, created_at TEXT)`);
  const ins = db.prepare(
    `INSERT INTO voice_clip_index (id, kind, text, mime, duration_ms, bytes, audio) VALUES (?, 'q', ?, 'audio/mp4', 1234, 100, ?)`,
  );
  for (const t of texts) ins.run(clipId(t), t, fixtureBytes());
  db.close();
  return dir;
}

export const removeDir = (dir: string): void => rmSync(dir, { recursive: true, force: true });
