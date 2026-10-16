// Turns bundled JSON modules into a QuestionBank. Pure, so tests can feed it fake files.
import { parseBankFileName } from './checkBank';
import type { Question, QuestionBank } from './types';

/** `files` maps a path such as "./math-5.json" to its parsed JSON (or a module with `default`). */
export function buildBank(files: Record<string, unknown>): QuestionBank {
  const all: Question[] = [];
  for (const [path, mod] of Object.entries(files)) {
    const file = path.slice(path.lastIndexOf('/') + 1);
    if (!parseBankFileName(file)) continue; // not a bank file
    const data =
      mod && typeof mod === 'object' && !Array.isArray(mod) && 'default' in mod
        ? (mod as { default: unknown }).default
        : mod;
    if (!Array.isArray(data)) throw new Error(`Question file ${file} must hold a JSON array.`);
    all.push(...(data as Question[]));
  }
  const order = (q: Question): [number, number, string] => [
    q.subject === 'math' ? 0 : 1,
    q.grade,
    q.id,
  ];
  all.sort((a, b) => {
    const x = order(a);
    const y = order(b);
    return x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0);
  });
  return { questions: all };
}
