import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { compareCell, exportCell, parseCell } from '../../src/questions/blind';
import { mq, pool } from './helpers';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

const questions = [
  ...pool('math', 5, 3),
  mq({ id: 'math-6-0001', grade: 6 }),
  ...pool('reading', 5, 2),
];

describe('parseCell', () => {
  it('parses subject and grade', () => {
    expect(parseCell('math-5')).toEqual({ subject: 'math', grade: 5 });
    expect(parseCell('reading-0')).toEqual({ subject: 'reading', grade: 0 });
    expect(parseCell('math-12')).toEqual({ subject: 'math', grade: 12 });
  });
  it.each(['art-5', 'math-13', 'math-x', 'Math-5', 'math', 'math-05', 'math-5-1', '', 'math--1'])(
    'rejects %j',
    (c) => {
      expect(() => parseCell(c)).toThrow();
    },
  );
});

describe('exportCell', () => {
  it('returns only that cell', () => {
    const out = exportCell(questions, 'math-5');
    expect(out.map((q) => q.id)).toEqual(['math-5-0001', 'math-5-0002', 'math-5-0003']);
  });
  it('never includes the answer or hint', () => {
    const json = JSON.stringify(exportCell(questions, 'math-5'));
    expect(json).not.toContain('"answer"');
    expect(json).not.toContain('"hint"');
    expect(json).not.toContain('Try 7 x 10');
  });
  it('keeps what a solver needs', () => {
    const [first] = exportCell(questions, 'math-5');
    expect(first).toMatchObject({ id: 'math-5-0001', prompt: 'What is 1 + 1?', kind: 'numeric' });
    expect(first!.choices).toHaveLength(4);
  });
  it('keeps passage and audioWord for reading cells', () => {
    const out = exportCell(
      [{ ...pool('reading', 5, 1)[0]!, passage: 'A short passage.' }],
      'reading-5',
    );
    expect(out[0]).toMatchObject({ passage: 'A short passage.' });
  });
  it('returns an empty list for an empty cell', () => {
    expect(exportCell(questions, 'math-9')).toEqual([]);
  });
  it('does not leak the answer through tags', () => {
    const out = exportCell([mq({ tags: ['answer-56'] })], 'math-5');
    expect(JSON.stringify(out)).not.toContain('answer-56');
  });
});

describe('compareCell', () => {
  const key = (id: string) => questions.find((q) => q.id === id)!.answer;

  it('reports no mismatches when every pick is right', () => {
    const picks = ['math-5-0001', 'math-5-0002', 'math-5-0003'].map((id) => ({
      id,
      choice: key(id),
    }));
    const r = compareCell(questions, 'math-5', picks);
    expect(r.mismatches).toEqual([]);
    expect(r.checked).toBe(3);
    expect(r.ok).toBe(true);
  });

  it('reports a wrong pick with the expected answer', () => {
    const r = compareCell(questions, 'math-5', [
      { id: 'math-5-0001', choice: key('math-5-0001') },
      { id: 'math-5-0002', choice: '90' },
      { id: 'math-5-0003', choice: key('math-5-0003') },
    ]);
    expect(r.ok).toBe(false);
    expect(r.mismatches).toEqual([
      { id: 'math-5-0002', choice: '90', expected: key('math-5-0002') },
    ]);
  });

  it('flags a question nobody answered', () => {
    const r = compareCell(questions, 'math-5', [{ id: 'math-5-0001', choice: key('math-5-0001') }]);
    expect(r.missing).toEqual(['math-5-0002', 'math-5-0003']);
    expect(r.ok).toBe(false);
  });

  it('flags a pick for an id outside the cell', () => {
    const r = compareCell(questions, 'math-5', [{ id: 'math-6-0001', choice: '56' }]);
    expect(r.unknown).toEqual(['math-6-0001']);
    expect(r.ok).toBe(false);
  });

  it('flags a duplicate pick', () => {
    const r = compareCell(questions, 'math-5', [
      { id: 'math-5-0001', choice: key('math-5-0001') },
      { id: 'math-5-0001', choice: '90' },
    ]);
    expect(r.duplicates).toEqual(['math-5-0001']);
    expect(r.ok).toBe(false);
  });

  it('trims the choice before comparing', () => {
    const r = compareCell(
      questions,
      'math-5',
      ['math-5-0001', 'math-5-0002', 'math-5-0003'].map((id) => ({ id, choice: ` ${key(id)} ` })),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects picks that are not an array of {id, choice}', () => {
    expect(() => compareCell(questions, 'math-5', { id: 'x' } as never)).toThrow();
    expect(() => compareCell(questions, 'math-5', [{ id: 1, choice: 'x' }] as never)).toThrow();
    expect(() => compareCell(questions, 'math-5', [null] as never)).toThrow();
  });
});

describe('blind scripts (CLI smoke)', () => {
  const run = (script: string, ...args: string[]) =>
    execFileSync(process.execPath, ['--import', 'tsx', script, ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

  it('blind-export prints JSON with no answers', () => {
    const out = run('scripts/blind-export.ts', 'math-5');
    const parsed = JSON.parse(out) as { id: string }[];
    expect(parsed.length).toBeGreaterThan(0);
    expect(out).not.toContain('"answer"');
    expect(out).not.toContain('"hint"');
  });

  it('blind-compare passes on the answer key and fails on a wrong pick', () => {
    const dir = mkdtempSync(join(tmpdir(), 'blind-'));
    const exported = JSON.parse(run('scripts/blind-export.ts', 'math-5')) as {
      id: string;
      choices: string[];
    }[];
    const wrong = join(dir, 'wrong.json');
    // Choice that is not any real answer: an out-of-range string.
    writeFileSync(
      wrong,
      JSON.stringify(exported.map((q) => ({ id: q.id, choice: 'definitely not this' }))),
    );
    let failed = false;
    try {
      run('scripts/blind-compare.ts', 'math-5', wrong);
    } catch (e) {
      failed = true;
      const out = (e as { stdout: string }).stdout;
      expect(JSON.parse(out).mismatches.length).toBe(exported.length);
    }
    expect(failed).toBe(true);
  });

  it('check-questions passes on the bundled bank', () => {
    const out = run('scripts/check-questions.ts');
    expect(out).toContain('check:questions: OK');
  });
});
