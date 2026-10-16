import { describe, expect, it } from 'vitest';
import { validateQuestion } from '../../src/questions/validate';
import type { Question } from '../../src/questions/types';
import { mq, rq } from './helpers';

const problems = (q: unknown): string[] => validateQuestion(q as Question);
const has = (list: string[], text: string): boolean => list.some((p) => p.includes(text));

describe('validateQuestion: good questions', () => {
  it('accepts a good math question', () => expect(problems(mq())).toEqual([]));
  it('accepts a good sight word question', () => expect(problems(rq())).toEqual([]));
  it('accepts 3 choices', () => expect(problems(mq({ choices: ['54', '56', '58'] }))).toEqual([]));
  it('accepts a vocab question', () =>
    expect(
      problems(
        rq({
          id: 'reading-6-0001',
          grade: 6,
          kind: 'vocab',
          audioWord: undefined,
          prompt: 'The huge dog was enormous. What does enormous mean?',
          choices: ['very big', 'very small', 'very loud', 'very old'],
          answer: 'very big',
          hint: 'Think about how large a dog can be.',
        }),
      ),
    ).toEqual([]));
  it('accepts a mainidea question with a passage', () =>
    expect(
      problems(
        rq({
          id: 'reading-5-0001',
          grade: 5,
          kind: 'mainidea',
          audioWord: undefined,
          passage: 'Bees make honey. They fly from flower to flower. Honey is stored in the hive.',
          prompt: 'What is the main idea?',
          choices: ['Bees make honey', 'Flowers are red', 'Hives are cold', 'Bears are big'],
          answer: 'Bees make honey',
          hint: 'What is the whole passage about?',
        }),
      ),
    ).toEqual([]));
  it('accepts a decimal that equals the answer', () =>
    expect(
      problems(
        mq({
          prompt: 'What is 1 / 2?',
          choices: ['0.5', '2', '1', '0.25'],
          answer: '0.5',
          hint: 'Split one whole into two parts.',
        }),
      ),
    ).toEqual([]));
});

describe('validateQuestion: math answer key', () => {
  it('catches a wrong answer key', () => {
    const p = problems(mq({ answer: '54' }));
    expect(has(p, 'recomputed')).toBe(true);
  });
  it('catches a wrong key even when the key is among the choices and plausible', () => {
    const p = problems(
      mq({ prompt: 'What is 12 + 15?', choices: ['26', '27', '28', '29'], answer: '28' }),
    );
    expect(has(p, 'recomputed')).toBe(true);
  });
  it('rejects an unreduced fraction answer', () => {
    const p = problems(
      mq({ prompt: 'What is 1/4 + 1/4?', choices: ['2/4', '1/2', '1/4', '1'], answer: '2/4' }),
    );
    expect(has(p, 'simplest')).toBe(true);
  });
  it('rejects a non-numeric answer for a recomputable prompt', () => {
    const p = problems(mq({ choices: ['fifty six', '54', '58', '64'], answer: 'fifty six' }));
    expect(has(p, 'recomputed')).toBe(true);
  });
  it('flags an unverifiable math prompt that is not tagged manual', () => {
    const p = problems(
      mq({
        prompt: 'How many sides does a hexagon have?',
        choices: ['5', '6', '7', '8'],
        answer: '6',
        hint: 'Hex is a Greek word for a number.',
      }),
    );
    expect(has(p, 'manual')).toBe(true);
  });
  it('lets a manual-tagged math prompt through', () => {
    const p = problems(
      mq({
        prompt: 'How many sides does a hexagon have?',
        choices: ['5', '6', '7', '8'],
        answer: '6',
        hint: 'Count the sides of a stop sign.',
        tags: ['manual', 'geometry'],
      }),
    );
    expect(p).toEqual([]);
  });
  it('does not recompute reading questions', () => {
    expect(problems(rq({ prompt: 'What is 7 x 8?' }))).toEqual([]);
  });
});

describe('validateQuestion: structure', () => {
  it('answer not in choices', () => {
    const p = problems(mq({ answer: '57' }));
    expect(has(p, 'answer is not in choices')).toBe(true);
  });
  it('answer must match a choice exactly (no trimming)', () => {
    const p = problems(mq({ answer: '56 ' }));
    expect(has(p, 'answer is not in choices')).toBe(true);
  });
  it('duplicate choices', () => {
    const p = problems(mq({ choices: ['56', '56', '58', '64'] }));
    expect(has(p, 'unique')).toBe(true);
  });
  it('too few choices', () => {
    const p = problems(mq({ choices: ['56', '54'] }));
    expect(has(p, 'choices')).toBe(true);
  });
  it('too many choices', () => {
    const p = problems(mq({ choices: ['56', '54', '58', '64', '66'] }));
    expect(has(p, 'choices')).toBe(true);
  });
  it('empty choice string', () => {
    const p = problems(mq({ choices: ['56', '', '58', '64'] }));
    expect(has(p, 'choices')).toBe(true);
  });
  it('non-string choice', () => {
    const p = problems(mq({ choices: ['56', 54, '58', '64'] as unknown as string[] }));
    expect(has(p, 'choices')).toBe(true);
  });
  it('choices not an array', () => {
    const p = problems(mq({ choices: 'nope' as unknown as string[] }));
    expect(has(p, 'choices')).toBe(true);
  });
  it('missing hint', () => {
    expect(has(problems(mq({ hint: undefined })), 'hint')).toBe(true);
  });
  it('blank hint', () => {
    expect(has(problems(mq({ hint: '   ' })), 'hint')).toBe(true);
  });
  it('hint that gives the answer away', () => {
    expect(has(problems(mq({ hint: '7 x 8 is 56.' })), 'gives away')).toBe(true);
  });
  it('hint that gives away a word answer', () => {
    expect(has(problems(rq({ hint: 'It is the word see.' })), 'gives away')).toBe(true);
  });
  it('hint with the answer as part of a longer number is fine', () => {
    expect(problems(mq({ hint: 'Think of 560 divided by 10.' }))).toEqual([]);
  });
  it('blank prompt', () => {
    expect(has(problems(mq({ prompt: '' })), 'prompt')).toBe(true);
  });
  it('tags must be an array of strings', () => {
    expect(has(problems(mq({ tags: 'x' as unknown as string[] })), 'tags')).toBe(true);
  });
  it('rejects a non-object', () => {
    expect(problems(null).length).toBeGreaterThan(0);
    expect(problems('x').length).toBeGreaterThan(0);
    expect(problems([]).length).toBeGreaterThan(0);
  });
});

describe('validateQuestion: id, grade, subject, kind', () => {
  it.each([
    'math-5-1',
    'math-05-0001',
    'Math-5-0001',
    'math_5_0001',
    'math-5-00001',
    'k-0-0001',
    '',
  ])('bad id %j', (id) => expect(has(problems(mq({ id })), 'id')).toBe(true));
  it('id grade must match grade', () => {
    expect(has(problems(mq({ id: 'math-6-0001' })), 'id')).toBe(true);
  });
  it('id subject must match subject', () => {
    expect(has(problems(mq({ id: 'reading-5-0001' })), 'id')).toBe(true);
  });
  it('grade 13 is invalid', () => {
    expect(has(problems(mq({ grade: 13 as never, id: 'math-13-0001' })), 'grade')).toBe(true);
  });
  it('grade -1 is invalid', () => {
    expect(has(problems(mq({ grade: -1 as never })), 'grade')).toBe(true);
  });
  it('fractional grade is invalid', () => {
    expect(has(problems(mq({ grade: 1.5 as never })), 'grade')).toBe(true);
  });
  it('string grade is invalid', () => {
    expect(has(problems(mq({ grade: '5' as never })), 'grade')).toBe(true);
  });
  it('invalid subject', () => {
    expect(has(problems(mq({ subject: 'art' as never })), 'subject')).toBe(true);
  });
  it("subject 'both' is not a question subject", () => {
    expect(has(problems(mq({ subject: 'both' as never })), 'subject')).toBe(true);
  });
  it('invalid kind', () => {
    expect(has(problems(mq({ kind: 'essay' as never })), 'kind')).toBe(true);
  });
  it('grade 0 and 12 are valid', () => {
    expect(problems(rq())).toEqual([]);
    expect(
      problems(
        mq({
          id: 'math-12-0001',
          grade: 12,
          prompt: 'What is 2 + 2?',
          choices: ['4', '5', '6', '7'],
          answer: '4',
          hint: 'Count on your fingers.',
        }),
      ),
    ).toEqual([]);
  });
  it('sightword needs audioWord', () => {
    expect(has(problems(rq({ audioWord: undefined })), 'audioWord')).toBe(true);
  });
  it('sightword needs non-blank audioWord', () => {
    expect(has(problems(rq({ audioWord: ' ' })), 'audioWord')).toBe(true);
  });
  it('mainidea needs passage', () => {
    expect(
      has(
        problems(rq({ id: 'reading-5-0001', grade: 5, kind: 'mainidea', audioWord: undefined })),
        'passage',
      ),
    ).toBe(true);
  });
  it('reading kinds are not allowed on math', () => {
    expect(has(problems(mq({ kind: 'sightword', audioWord: 'x' })), 'kind')).toBe(true);
  });
  it('numeric kind is not allowed on reading', () => {
    expect(has(problems(rq({ kind: 'numeric', audioWord: undefined })), 'kind')).toBe(true);
  });
});

describe('validateQuestion: banned words', () => {
  const bad = [
    'kill',
    'Kill',
    'killed',
    'die',
    'dies',
    'died',
    'dead',
    'blood',
    'bloody',
    'gore',
    'defeat',
    'defeated',
    'buy',
    'buying',
    'price',
    'prices',
  ];
  it.each(bad)('flags %s in the prompt', (w) => {
    expect(has(problems(rq({ prompt: `Tap the word ${w} now.` })), 'banned')).toBe(true);
  });
  it('flags a banned word in a choice', () => {
    expect(has(problems(rq({ choices: ['see', 'dead', 'saw', 'say'] })), 'banned')).toBe(true);
  });
  it('flags a banned word in the hint', () => {
    expect(has(problems(rq({ hint: 'Do not buy it.' })), 'banned')).toBe(true);
  });
  it('flags a banned word in a passage', () => {
    const q = rq({
      id: 'reading-5-0001',
      grade: 5,
      kind: 'mainidea',
      audioWord: undefined,
      passage: 'The pirate shouted: kill the sail!',
    });
    expect(has(problems(q), 'banned')).toBe(true);
  });
  it.each(['skill', 'diet', 'diesel', 'prickly', 'ruler'])(
    'does not flag the safe word %s',
    (w) => {
      expect(has(problems(rq({ prompt: `Tap the word ${w} now.` })), 'banned')).toBe(false);
    },
  );
});
