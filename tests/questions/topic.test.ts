import { describe, expect, it } from 'vitest';
import { QUESTION_TOPICS } from '../../src/game/config';
import { BANK } from '../../src/questions/bank';
import { checkBankFiles } from '../../src/questions/checkBank';
import { pickQuestion, sanitizeHistory } from '../../src/questions/pick';
import { EMPTY_HISTORY, type PickHistory } from '../../src/questions/types';
import { recomputeMathAnswer, validateQuestion } from '../../src/questions/validate';
import { bankOf, mq, pool, testRng } from './helpers';

const TAG = QUESTION_TOPICS.tags.multiplication;
const mult = (over = {}) => mq({ tags: [TAG], ...over });

describe('topic tag on a question', () => {
  it('accepts a multiplication question with the topic tag', () => {
    expect(validateQuestion(mult())).toEqual([]);
  });
  it('rejects an unknown topic tag', () => {
    expect(validateQuestion(mq({ tags: ['topic:juggling'] })).join()).toContain('unknown topic');
  });
  it('rejects a topic tag on a reading question', () => {
    const q = {
      ...mult(),
      subject: 'reading' as const,
      id: 'reading-5-0001',
      kind: 'vocab' as const,
    };
    expect(validateQuestion(q).join()).toContain('topic tag is for math');
  });
  it('rejects a multiplication-topic question that is not multiplication', () => {
    const q = mult({ prompt: 'What is 7 + 8?', choices: ['15', '14', '16', '13'], answer: '15' });
    expect(validateQuestion(q).join()).toContain('does not multiply');
  });
  it('rejects a topic question that needs a manual check', () => {
    const q = mult({ prompt: 'Sam has some boxes. How many?', tags: [TAG, 'manual'] });
    expect(validateQuestion(q).join()).toContain('must be checkable');
  });
});

describe('ambiguous distractors', () => {
  it('rejects two choices with the same value written differently', () => {
    const q = mult({ choices: ['56', '56.0', '58', '64'] });
    expect(validateQuestion(q).join()).toContain('same value');
  });
  it('rejects a choice that is the answer written another way', () => {
    const q = mult({ prompt: 'What is 0.5 x 4?', choices: ['2', '2.0', '1', '3'], answer: '2' });
    expect(validateQuestion(q).join()).toContain('same value');
  });
});

describe('word problem pattern', () => {
  it('recomputes "N things have M each" answers', () => {
    expect(recomputeMathAnswer('3 baskets have 4 apples each. How many apples in all?')).toBe('12');
  });
  it('catches a wrong key on a word problem', () => {
    const q = mult({
      prompt: '3 baskets have 4 apples each. How many apples in all?',
      choices: ['7', '12', '10', '14'],
      answer: '7',
    });
    expect(validateQuestion(q).join()).toContain('recomputed');
  });
});

describe('checkBankFiles topic coverage', () => {
  it('names a math grade that lacks enough topic questions', () => {
    const r = checkBankFiles([{ file: 'math-5.json', data: [mult()] }], { requireTopics: true });
    expect(r.problems.join()).toContain('multiplication');
    expect(r.problems.join()).toContain(String(QUESTION_TOPICS.minPerGrade));
  });
  it('does not ask for topic questions unless told to', () => {
    const r = checkBankFiles([{ file: 'math-5.json', data: [mq()] }]);
    expect(r.problems).toEqual([]);
  });
});

describe('the real bank', () => {
  const topical = BANK.questions.filter((q) => q.tags.includes(TAG));
  it('has the minimum per grade, K to 12', () => {
    for (let g = 0; g <= 12; g++) {
      expect(topical.filter((q) => q.grade === g).length).toBeGreaterThanOrEqual(
        QUESTION_TOPICS.minPerGrade,
      );
    }
  });
  it('every topic question passes the checks and is numeric', () => {
    for (const q of topical) {
      expect(validateQuestion(q), q.id).toEqual([]);
      expect(q.kind).toBe('numeric');
    }
  });
});

describe('pickQuestion after the Focus switch was retired', () => {
  it('mixes topic questions in with the other math questions', () => {
    const topical = pool('math', 5, 4).map((q, i) => ({
      ...q,
      id: `math-5-01${i}0`,
      prompt: `What is ${i + 2} x 3?`,
      tags: [TAG],
    }));
    const bank = bankOf(pool('math', 5, 6), topical);
    const rng = testRng(3);
    let h: PickHistory = EMPTY_HISTORY;
    const seen = new Set<boolean>();
    for (let i = 0; i < 20; i++) {
      const r = pickQuestion(bank, { subject: 'math', grade: 5, who: 'PAST' }, h, rng);
      seen.add(r.question.tags.includes(TAG));
      h = r.history;
    }
    expect(seen).toEqual(new Set([true, false]));
    expect(Object.keys(h.used)).toEqual(['math-5']);
  });
  it('drops old topic pool keys from saved history', () => {
    const h = {
      used: { 'math-5-multiplication': ['math-5-0100'], 'math-5': ['math-5-0001'] },
      lastSubject: {},
    };
    expect(sanitizeHistory(h).used).toEqual({ 'math-5': ['math-5-0001'] });
  });
});

describe('division topic', () => {
  const DIV = QUESTION_TOPICS.tags.division;
  const div = (over = {}) =>
    mq({
      tags: [DIV],
      prompt: 'What is 56 / 7?',
      choices: ['8', '7', '9', '6'],
      answer: '8',
      ...over,
    });

  it('has its own tag', () => {
    expect(DIV).toBe('topic:division');
  });
  it('accepts a division question with the topic tag', () => {
    expect(validateQuestion(div())).toEqual([]);
  });
  it('rejects a division-topic question that does not divide', () => {
    const q = div({ prompt: 'What is 7 + 8?', choices: ['15', '14', '16', '13'], answer: '15' });
    expect(validateQuestion(q).join()).toContain('does not divide');
  });
  it('rejects a division-topic question that needs a manual check', () => {
    expect(validateQuestion(div({ tags: [DIV, 'manual'] })).join()).toContain('must be checkable');
  });
  it('rejects the division tag on a reading question', () => {
    const q = {
      ...div(),
      subject: 'reading' as const,
      id: 'reading-5-0001',
      kind: 'vocab' as const,
    };
    expect(validateQuestion(q).join()).toContain('topic tag is for math');
  });
  it('recomputes shared-equally word problems', () => {
    expect(
      recomputeMathAnswer(
        '12 cookies are shared equally by 3 kids. How many cookies does each kid get?',
      ),
    ).toBe('4');
    expect(
      recomputeMathAnswer('20 apples are put in groups of 5. How many groups are there?'),
    ).toBe('4');
  });
  it('catches a wrong key on a shared-equally problem', () => {
    const q = div({
      prompt: '12 cookies are shared equally by 3 kids. How many cookies does each kid get?',
      choices: ['3', '4', '9', '36'],
      answer: '3',
    });
    expect(validateQuestion(q).join()).toContain('recomputed');
  });
  it('recomputes a remainder', () => {
    expect(recomputeMathAnswer('What is the remainder when 17 is divided by 5?')).toBe('2');
    expect(recomputeMathAnswer('What is the remainder when 20 is divided by 5?')).toBe('0');
    expect(recomputeMathAnswer('What is the remainder when 20 is divided by 0?')).toBeNull();
  });
  it('recomputes a fraction divided by a fraction', () => {
    expect(recomputeMathAnswer('What is (3/4) \u00f7 (1/4)?')).toBe('3');
  });
  it('the real bank has the minimum per grade, K to 12, all numeric and valid', () => {
    const topical = BANK.questions.filter((q) => q.tags.includes(DIV));
    for (let g = 0; g <= 12; g++) {
      expect(topical.filter((q) => q.grade === g).length, `grade ${g}`).toBeGreaterThanOrEqual(
        QUESTION_TOPICS.minPerGrade,
      );
    }
    for (const q of topical) {
      expect(validateQuestion(q), q.id).toEqual([]);
      expect(q.kind).toBe('numeric');
      expect(q.subject).toBe('math');
    }
  });
});
