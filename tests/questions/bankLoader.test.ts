import { describe, expect, it } from 'vitest';
import { buildBank } from '../../src/questions/bankLoader';
import { BANK } from '../../src/questions/bank';
import { checkBankFiles } from '../../src/questions/checkBank';
import { mq, rq } from './helpers';

describe('buildBank', () => {
  it('flattens files in a stable order (subject, grade, id)', () => {
    const bank = buildBank({
      './reading-0.json': [rq()],
      './math-5.json': [mq({ id: 'math-5-0002', prompt: 'What is 1 + 1?' }), mq()],
      './math-0.json': [mq({ id: 'math-0-0001', grade: 0 })],
    });
    expect(bank.questions.map((q) => q.id)).toEqual([
      'math-0-0001',
      'math-5-0001',
      'math-5-0002',
      'reading-0-0001',
    ]);
  });

  it('accepts bundler-style paths', () => {
    const bank = buildBank({
      '/src/questions/bank/math-12.json': [mq({ id: 'math-12-0001', grade: 12 })],
    });
    expect(bank.questions).toHaveLength(1);
  });

  it('accepts a module shape with a default export', () => {
    const bank = buildBank({ './math-5.json': { default: [mq()] } });
    expect(bank.questions).toHaveLength(1);
  });

  it('ignores files that are not bank files', () => {
    const bank = buildBank({ './README.json': [], './math-5.json': [mq()] });
    expect(bank.questions).toHaveLength(1);
  });

  it('throws on a bank file that is not an array', () => {
    expect(() => buildBank({ './math-5.json': { a: 1 } })).toThrow(/math-5\.json/);
  });

  it('does not mutate its input', () => {
    const arr = [mq({ id: 'math-5-0002', prompt: 'x' }), mq()];
    buildBank({ './math-5.json': arr });
    expect(arr[0]!.id).toBe('math-5-0002');
  });

  it('handles an empty input', () => {
    expect(buildBank({}).questions).toEqual([]);
  });
});

describe('BANK (the real bundled bank)', () => {
  it('is not empty', () => {
    expect(BANK.questions.length).toBeGreaterThan(0);
  });

  it('passes every check the CI checker runs', () => {
    const cells = new Map<string, unknown[]>();
    for (const q of BANK.questions) {
      const key = `${q.subject}-${q.grade}`;
      cells.set(key, [...(cells.get(key) ?? []), q]);
    }
    const files = [...cells].map(([k, data]) => ({ file: `${k}.json`, data }));
    expect(checkBankFiles(files).problems).toEqual([]);
  });

  it('has globally unique ids', () => {
    const ids = BANK.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
