// npm run blind:export -- math-5   Prints the cell's questions as JSON, with no answers or hints.
import { exportCell } from '../src/questions/blind';
import type { Question } from '../src/questions/types';
import { loadBankFiles } from './load-bank-files';

const cell = process.argv[2];
if (!cell) {
  console.error('usage: blind-export <subject>-<grade>, for example math-5');
  process.exit(2);
}
try {
  const questions = loadBankFiles().flatMap((f) =>
    Array.isArray(f.data) ? (f.data as Question[]) : [],
  );
  console.log(JSON.stringify(exportCell(questions, cell), null, 2));
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
