// Finds the right answer for a question the page is showing, using the bank on disk.
// Tests may know answers; the page's hook never exposes them (risk 3).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '../../src/questions/types';
import { toMathSymbols } from '../../src/ui/dom';

const DIR = join(import.meta.dirname, '../../src/questions/bank');

let cache: Question[] | null = null;
function bank(): Question[] {
  cache ??= readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Question[]);
  return cache;
}

/** The index (0..3) of the right choice for what is on screen. Throws if it is unclear. */
export function rightChoiceIndex(prompt: string, choices: readonly string[]): number {
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((x, i) => x === b[i]);
  // The page draws real minus, times and divide signs. The bank keeps ASCII.
  const found = bank().filter(
    (q) => toMathSymbols(q.prompt) === prompt && same(q.choices.map(toMathSymbols), choices),
  );
  const answers = new Set(found.map((q) => q.answer));
  if (answers.size !== 1) {
    throw new Error(
      `Expected one answer for "${prompt}" with ${JSON.stringify(choices)}, found ${answers.size}.`,
    );
  }
  const index = choices.indexOf([...answers][0]!);
  if (index < 0) throw new Error(`The answer for "${prompt}" is not among its choices.`);
  return index;
}
