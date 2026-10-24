// Lists every line the voice database must hold: `tsx scripts/voice-manifest.ts [--grades 0-4|all]`.
// Prints JSON [{id, kind, text, spoken}]. `text` is exactly what the game passes to speak() (it is hashed
// into the id). `spoken` is the same text reworded for the voice (toSpoken). Offline tool, not in the web build.
// Only Chrono's wipeout lines are listed. Question text is no longer spoken (the owner removed read-aloud
// on 2026-10-23), so `--grades` is accepted for older scripts and no longer changes the list.
import { pathToFileURL } from 'node:url';
import { clipId } from '../src/audio/clipId';
import { toSpoken } from '../src/audio/toSpoken';
import { TUMBLE_LINES, TUMBLE_LINES_FUTURE, TUMBLE_LINES_PAST } from '../src/data/copy';

export type ClipKind = 'bark';
export interface ManifestEntry {
  id: string;
  kind: ClipKind;
  text: string;
  spoken: string;
}

/** Parse "0-4", "5", or "all" into an inclusive grade range. */
export function parseGrades(spec: string): [number, number] {
  if (spec === 'all') return [0, 12];
  const m = /^(\d+)(?:-(\d+))?$/.exec(spec);
  if (!m) throw new Error(`bad --grades "${spec}" (use 0-4, 5, or all)`);
  const lo = Number(m[1]);
  const hi = m[2] === undefined ? lo : Number(m[2]);
  if (lo > hi || hi > 12) throw new Error(`bad --grades "${spec}"`);
  return [lo, hi];
}

export function buildManifest(barks: readonly string[]): ManifestEntry[] {
  const byId = new Map<string, ManifestEntry>();
  const add = (kind: ClipKind, text: string): void => {
    if (!text.trim()) throw new Error(`empty ${kind} text`);
    const id = clipId(text);
    const seen = byId.get(id);
    if (seen) {
      if (seen.text.split(/\s+/).join(' ') !== text.split(/\s+/).join(' ')) {
        throw new Error(`id collision ${id}: "${seen.text}" vs "${text}"`);
      }
      return;
    }
    byId.set(id, { id, kind, text, spoken: toSpoken(text) });
  };
  for (const b of barks) add('bark', b);
  return [...byId.values()];
}

export const ALL_BARKS: string[] = [
  ...new Set([...TUMBLE_LINES, ...TUMBLE_LINES_PAST, ...TUMBLE_LINES_FUTURE]),
];

function main(): void {
  const i = process.argv.indexOf('--grades');
  parseGrades(i > 0 ? (process.argv[i + 1] ?? '0-4') : '0-4'); // checked, then ignored
  process.stdout.write(JSON.stringify(buildManifest(ALL_BARKS), null, 1) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
