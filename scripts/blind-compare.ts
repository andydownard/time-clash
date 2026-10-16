// npm run blind:compare -- math-5 picks.json   Compares [{id, choice}] to the answer key.
// Prints a JSON report. Exits 1 if anything differs.
import { readFileSync } from 'node:fs';
import { compareCell } from '../src/questions/blind';
import type { Question } from '../src/questions/types';
import { loadBankFiles } from './load-bank-files';

const [cell, picksPath] = process.argv.slice(2);
if (!cell || !picksPath) {
  console.error('usage: blind-compare <subject>-<grade> <picks.json>');
  process.exit(2);
}
try {
  const picks: unknown = JSON.parse(readFileSync(picksPath, 'utf8'));
  const questions = loadBankFiles().flatMap((f) =>
    Array.isArray(f.data) ? (f.data as Question[]) : [],
  );
  const report = compareCell(questions, cell, picks);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
