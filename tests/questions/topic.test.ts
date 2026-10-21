import { describe, expect, it } from 'vitest';
import { TOPIC_FOCUS } from '../../src/game/config';
import { BANK } from '../../src/questions/bank';
import { checkBankFiles } from '../../src/questions/checkBank';
import { pickQuestion, sanitizeHistory } from '../../src/questions/pick';
import { EMPTY_HISTORY, type PickHistory } from '../../src/questions/types';
import { recomputeMathAnswer, validateQuestion } from '../../src/questions/validate';
import { bankOf, mq, pool, testRng } from './helpers';

const TAG = TOPIC_FOCUS.tags.multiplication;
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
    expect(r.problems.join()).toContain(String(TOPIC_FOCUS.minPerGrade));
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
        TOPIC_FOCUS.minPerGrade,
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

describe('pickQuestion with a topic', () => {
  const topical = pool('math', 5, 4).map((q, i) => ({
    ...q,
    id: `math-5-01${i}0`,
    prompt: `What is ${i + 2} x 3?`,
    tags: [TAG],
  }));
  const bank = bankOf(pool('math', 5, 6), topical);
  const ask = { subject: 'math', grade: 5, who: 'PAST', topic: 'multiplication' } as const;

  it('only asks topic questions when a topic is set', () => {
    const rng = testRng(3);
    let h: PickHistory = EMPTY_HISTORY;
    for (let i = 0; i < 12; i++) {
      const r = pickQuestion(bank, ask, h, rng);
      expect(r.question.tags).toContain(TAG);
      h = r.history;
    }
  });
  it('asks any math question when no topic is set', () => {
    const rng = testRng(3);
    let h: PickHistory = EMPTY_HISTORY;
    const seen = new Set<boolean>();
    for (let i = 0; i < 20; i++) {
      const r = pickQuestion(bank, { subject: 'math', grade: 5, who: 'PAST' }, h, rng);
      seen.add(r.question.tags.includes(TAG));
      h = r.history;
    }
    expect(seen.has(false)).toBe(true);
  });
  it('ignores the topic for a reading pick', () => {
    const b = bankOf(pool('reading', 5, 3), [mult()]);
    const r = pickQuestion(b, { ...ask, subject: 'reading' }, EMPTY_HISTORY, testRng(1));
    expect(r.question.subject).toBe('reading');
  });
  it('falls back to the nearest grade that has topic questions', () => {
    const b = bankOf(pool('math', 5, 4), [mult({ id: 'math-3-0001', grade: 3 })]);
    const r = pickQuestion(b, ask, EMPTY_HISTORY, testRng(1));
    expect(r.gradeUsed).toBe(3);
  });
  it('falls back to plain math when the bank has no topic questions at all', () => {
    const r = pickQuestion(bankOf(pool('math', 5, 4)), ask, EMPTY_HISTORY, testRng(1));
    expect(r.question.subject).toBe('math');
  });
  it('keeps topic history apart from the plain pool and repeats with the same seed', () => {
    const run = () => {
      const r = pickQuestion(bank, ask, EMPTY_HISTORY, testRng(9));
      return { id: r.question.id, keys: Object.keys(r.history.used) };
    };
    expect(run()).toEqual(run());
    expect(run().keys).toEqual(['math-5-multiplication']);
  });
  it('keeps topic history through sanitizeHistory', () => {
    const h = { used: { 'math-5-multiplication': ['math-5-0100'] }, lastSubject: {} };
    expect(sanitizeHistory(h).used['math-5-multiplication' as never]).toEqual(['math-5-0100']);
  });
});
