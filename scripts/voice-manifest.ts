// Lists every line the voice database must hold: `tsx scripts/voice-manifest.ts [--grades 0-4|all]`.
// Prints JSON [{id, kind, text, spoken}]. `text` is exactly what the game passes to speak() (it is hashed
// into the id). `spoken` is the same text reworded for the voice (toSpoken). Offline tool, not in the web build.
import { pathToFileURL } from 'node:url';
import { clipId } from '../src/audio/clipId';
import { toSpoken } from '../src/audio/toSpoken';
import { TUMBLE_LINES, TUMBLE_LINES_FUTURE, TUMBLE_LINES_PAST } from '../src/data/copy';
import { spokenText } from '../src/questions/spoken';
import type { Question } from '../src/questions/types';
import { loadBankFiles } from './load-bank-files';

export type ClipKind = 'bark' | 'question' | 'passage';
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

export function buildManifest(
  questions: readonly Question[],
  barks: readonly string[],
): ManifestEntry[] {
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
  for (const q of questions) add('question', spokenText(q));
  return [...byId.values()];
}

export function loadQuestions(lo: number, hi: number): Question[] {
  const out: Question[] = [];
  for (const f of loadBankFiles()) {
    if (!Array.isArray(f.data)) throw new Error(`${f.file}: not an array`);
    for (const q of f.data as Question[]) if (q.grade >= lo && q.grade <= hi) out.push(q);
  }
  return out;
}

export const ALL_BARKS: string[] = [
  ...new Set([...TUMBLE_LINES, ...TUMBLE_LINES_PAST, ...TUMBLE_LINES_FUTURE]),
];

function main(): void {
  const i = process.argv.indexOf('--grades');
  const [lo, hi] = parseGrades(i > 0 ? (process.argv[i + 1] ?? '0-4') : '0-4');
  process.stdout.write(JSON.stringify(buildManifest(loadQuestions(lo, hi), ALL_BARKS), null, 1) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
