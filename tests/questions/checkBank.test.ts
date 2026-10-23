import { describe, expect, it } from 'vitest';
import { checkBankFiles } from '../../src/questions/checkBank';
import { mq, pool, rq } from './helpers';

const has = (list: string[], text: string): boolean => list.some((p) => p.includes(text));

describe('checkBankFiles', () => {
  it('passes a clean bank and counts per cell', () => {
    const r = checkBankFiles([
      {
        file: 'math-5.json',
        data: [
          mq(),
          mq({
            id: 'math-5-0002',
            prompt: 'What is 6 x 6?',
            choices: ['30', '36', '42', '46'],
            answer: '36',
          }),
        ],
      },
      { file: 'reading-0.json', data: [rq()] },
    ]);
    expect(r.problems).toEqual([]);
    expect(r.counts).toEqual({ 'math-5': 2, 'reading-0': 1 });
  });

  it('catches a wrong answer key and names the file and id', () => {
    const r = checkBankFiles([{ file: 'math-5.json', data: [mq({ answer: '54' })] }]);
    expect(
      r.problems.some(
        (p) => p.includes('math-5.json') && p.includes('math-5-0001') && p.includes('recomputed'),
      ),
    ).toBe(true);
  });

  it('catches a duplicate id inside one file', () => {
    const r = checkBankFiles([
      {
        file: 'math-5.json',
        data: [
          mq(),
          mq({ prompt: 'What is 3 x 3?', choices: ['6', '9', '12', '15'], answer: '9' }),
        ],
      },
    ]);
    expect(has(r.problems, 'duplicate id')).toBe(true);
  });

  it('catches a duplicate id across files', () => {
    const r = checkBankFiles([
      { file: 'math-5.json', data: [mq()] },
      { file: 'math-6.json', data: [mq({ grade: 6 })] },
    ]);
    expect(has(r.problems, 'duplicate id')).toBe(true);
  });

  it('catches a duplicate prompt in one cell', () => {
    const r = checkBankFiles([{ file: 'math-5.json', data: [mq(), mq({ id: 'math-5-0002' })] }]);
    expect(has(r.problems, 'duplicate prompt')).toBe(true);
  });

  it('treats the same prompt with a different passage as different', () => {
    const base = {
      kind: 'mainidea' as const,
      grade: 5 as const,
      prompt: 'What is the main idea?',
      hint: 'Think big.',
    };
    const a = rq({
      ...base,
      id: 'reading-5-0001',
      passage: 'Bees make honey. Honey is sweet.',
      choices: ['Bees make honey', 'Dogs bark', 'Cats nap', 'Fish swim'],
      answer: 'Bees make honey',
    });
    const b = rq({
      ...base,
      id: 'reading-5-0002',
      passage: 'Dogs bark loud. Dogs guard homes.',
      choices: ['Dogs bark', 'Bees buzz', 'Cats nap', 'Fish swim'],
      answer: 'Dogs bark',
    });
    expect(checkBankFiles([{ file: 'reading-5.json', data: [a, b] }]).problems).toEqual([]);
  });

  it('allows the same prompt in different grades', () => {
    const r = checkBankFiles([
      { file: 'math-5.json', data: [mq()] },
      { file: 'math-6.json', data: [mq({ id: 'math-6-0001', grade: 6 })] },
    ]);
    expect(r.problems).toEqual([]);
  });

  it('catches an answer that is not in choices', () => {
    const r = checkBankFiles([{ file: 'math-5.json', data: [mq({ answer: '57' })] }]);
    expect(has(r.problems, 'answer is not in choices')).toBe(true);
  });

  it('catches a grade that does not match the file', () => {
    const r = checkBankFiles([
      { file: 'math-5.json', data: [mq({ id: 'math-6-0001', grade: 6 })] },
    ]);
    expect(has(r.problems, 'file math-5.json')).toBe(true);
  });

  it('catches a subject that does not match the file', () => {
    const r = checkBankFiles([{ file: 'math-0.json', data: [rq()] }]);
    expect(has(r.problems, 'file math-0.json')).toBe(true);
  });

  it('rejects a bad file name', () => {
    expect(
      has(checkBankFiles([{ file: 'maths-5.json', data: [mq()] }]).problems, 'file name'),
    ).toBe(true);
    expect(has(checkBankFiles([{ file: 'math-13.json', data: [] }]).problems, 'file name')).toBe(
      true,
    );
    expect(
      has(checkBankFiles([{ file: 'math-05.json', data: [mq()] }]).problems, 'file name'),
    ).toBe(true);
    expect(has(checkBankFiles([{ file: 'math-k.json', data: [mq()] }]).problems, 'file name')).toBe(
      true,
    );
  });

  it('rejects a file that is not an array', () => {
    expect(has(checkBankFiles([{ file: 'math-5.json', data: { a: 1 } }]).problems, 'array')).toBe(
      true,
    );
    expect(has(checkBankFiles([{ file: 'math-5.json', data: null }]).problems, 'array')).toBe(true);
  });

  it('rejects an empty file', () => {
    expect(has(checkBankFiles([{ file: 'math-5.json', data: [] }]).problems, 'empty')).toBe(true);
  });

  it('rejects an empty bank', () => {
    expect(has(checkBankFiles([]).problems, 'no question files')).toBe(true);
  });

  it('reports a non-object entry without crashing', () => {
    const r = checkBankFiles([{ file: 'math-5.json', data: [mq(), 7, null] }]);
    expect(r.problems.length).toBeGreaterThanOrEqual(2);
  });

  it('handles a big bank', () => {
    const r = checkBankFiles([{ file: 'math-3.json', data: pool('math', 3, 40) }]);
    expect(r.problems).toEqual([]);
    expect(r.counts['math-3']).toBe(40);
  });

  it('rejects a word-choice item whose choices include a homophone of the answer', () => {
    const r = checkBankFiles([
      { file: 'reading-0.json', data: [rq({ choices: ['see', 'sea', 'saw', 'say'] })] },
    ]);
    expect(has(r.problems, 'homophone')).toBe(true);
    expect(has(r.problems, 'reading-0-0001')).toBe(true);
  });

  it('accepts a word-choice item with no homophones', () => {
    const r = checkBankFiles([
      { file: 'reading-0.json', data: [rq({ choices: ['see', 'saw', 'say', 'sit'] })] },
    ]);
    expect(r.problems).toEqual([]);
  });

  it('does not apply the homophone rule to vocab items', () => {
    const r = checkBankFiles([
      {
        file: 'reading-5.json',
        data: [
          rq({
            id: 'reading-5-0001',
            grade: 5,
            kind: 'vocab',
            prompt: 'Which word means a body of salt water?',
            choices: ['sea', 'see', 'saw', 'say'],
            answer: 'sea',
          }),
        ],
      },
    ]);
    expect(has(r.problems, 'homophone')).toBe(false);
  });

  it('still applies the homophone rule to reading choices, but not to a fill-in with a sentence', () => {
    const fill = rq({
      prompt: 'Fill in the blank: Please ___ the door.',
      choices: ['close', 'clothes', 'cloud', 'clove'],
      answer: 'close',
      hint: 'It is what you do to shut a door.',
    });
    const r = checkBankFiles([{ file: 'reading-0.json', data: [fill] }]);
    expect(has(r.problems, 'homophone')).toBe(false);
  });
});
