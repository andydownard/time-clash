// Blind-solve helpers: a solver sees questions without answers, then picks are compared to the key.
import type { Question } from './types';
import { parseBankFileName } from './checkBank';

export type Cell = { subject: 'math' | 'reading'; grade: number };

export type BlindQuestion = {
  id: string;
  subject: Question['subject'];
  grade: Question['grade'];
  kind: Question['kind'];
  prompt: string;
  choices: string[];
  passage?: string;
  audioWord?: string;
};

export type Pick = { id: string; choice: string };
export type Mismatch = { id: string; choice: string; expected: string };
export type CompareResult = {
  cell: string;
  ok: boolean;
  checked: number;
  mismatches: Mismatch[];
  missing: string[];
  unknown: string[];
  duplicates: string[];
};

export function parseCell(cell: string): Cell {
  const parsed = parseBankFileName(`${cell}.json`);
  if (!parsed) throw new Error(`Bad cell "${cell}". Use <math|reading>-<0..12>, like math-5.`);
  return parsed;
}

function inCell(q: Question, cell: Cell): boolean {
  return q.subject === cell.subject && q.grade === cell.grade;
}

/** The cell's questions with answer, hint, and tags removed. */
export function exportCell(questions: readonly Question[], cellName: string): BlindQuestion[] {
  const cell = parseCell(cellName);
  return questions
    .filter((q) => inCell(q, cell))
    .map((q) => {
      const out: BlindQuestion = {
        id: q.id,
        subject: q.subject,
        grade: q.grade,
        kind: q.kind,
        prompt: q.prompt,
        choices: [...q.choices],
      };
      if (q.passage !== undefined) out.passage = q.passage;
      if (q.audioWord !== undefined) out.audioWord = q.audioWord;
      return out;
    });
}

export function compareCell(
  questions: readonly Question[],
  cellName: string,
  picks: unknown,
): CompareResult {
  const cell = parseCell(cellName);
  if (!Array.isArray(picks)) throw new Error('Picks must be a JSON array of {id, choice}.');
  const key = new Map(questions.filter((q) => inCell(q, cell)).map((q) => [q.id, q.answer.trim()]));

  const mismatches: Mismatch[] = [];
  const unknown: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  for (const p of picks as unknown[]) {
    if (typeof p !== 'object' || p === null) throw new Error('Each pick must be {id, choice}.');
    const { id, choice } = p as Record<string, unknown>;
    if (typeof id !== 'string' || typeof choice !== 'string')
      throw new Error('Each pick must be {id: string, choice: string}.');
    if (seen.has(id)) {
      if (!duplicates.includes(id)) duplicates.push(id);
      continue;
    }
    seen.add(id);
    const expected = key.get(id);
    if (expected === undefined) unknown.push(id);
    else if (expected !== choice.trim()) mismatches.push({ id, choice, expected });
  }
  const missing = [...key.keys()].filter((id) => !seen.has(id));
  return {
    cell: cellName,
    ok:
      mismatches.length === 0 &&
      missing.length === 0 &&
      unknown.length === 0 &&
      duplicates.length === 0,
    checked: key.size - missing.length - unknown.length,
    mismatches,
    missing,
    unknown,
    duplicates,
  };
}
