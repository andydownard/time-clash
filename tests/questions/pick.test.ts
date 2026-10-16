import { describe, expect, it } from 'vitest';
import {
  isCorrect,
  MAX_RETRY,
  noteMissed,
  pickAndRemember,
  pickQuestion,
  RETRY_AFTER_PICKS,
  sanitizeHistory,
} from '../../src/questions/pick';
import {
  EMPTY_HISTORY,
  type PickHistory,
  type PickRequest,
  type QuestionBank,
} from '../../src/questions/types';
import { bankOf, deepFreeze, memStorage, mq, pool, testRng } from './helpers';

const req = (over: Partial<PickRequest> = {}): PickRequest => ({
  subject: 'math',
  grade: 5,
  who: 'PAST',
  ...over,
});

/** Runs n picks, threading history. */
function run(bank: QuestionBank, request: PickRequest, n: number, seed = 1) {
  const rng = testRng(seed);
  let history: PickHistory = EMPTY_HISTORY;
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = pickQuestion(bank, request, history, rng);
    history = r.history;
    out.push(r);
  }
  return out;
}

describe('pickQuestion: selection', () => {
  const bank = bankOf(pool('math', 5, 5), pool('math', 6, 5), pool('reading', 5, 5));

  it('returns a question of the requested subject and grade', () => {
    const r = pickQuestion(bank, req(), EMPTY_HISTORY, testRng(1));
    expect(r.question.subject).toBe('math');
    expect(r.question.grade).toBe(5);
    expect(r.gradeUsed).toBe(5);
    expect(r.subjectUsed).toBe('math');
  });

  it('only picks from the requested pool across many seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = pickQuestion(bank, req({ subject: 'reading' }), EMPTY_HISTORY, testRng(seed));
      expect(r.question.id.startsWith('reading-5-')).toBe(true);
    }
  });

  it('is deterministic for a seed', () => {
    const a = run(bank, req(), 8, 42).map((r) => r.question.id);
    const b = run(bank, req(), 8, 42).map((r) => r.question.id);
    expect(a).toEqual(b);
  });

  it('differs between seeds (not a fixed order)', () => {
    const firsts = new Set<string>();
    for (let seed = 0; seed < 40; seed++) firsts.add(run(bank, req(), 1, seed)[0]!.question.id);
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('records the pick in history under the pool key', () => {
    const r = pickQuestion(bank, req(), EMPTY_HISTORY, testRng(3));
    expect(r.history.used['math-5']).toEqual([r.question.id]);
  });

  it('does not mutate the input history or bank', () => {
    const history = deepFreeze<PickHistory>({
      used: { 'math-5': ['math-5-0001'] },
      lastSubject: { PAST: 'math' },
    });
    const frozenBank = deepFreeze(bankOf(pool('math', 5, 3)));
    expect(() => pickQuestion(frozenBank, req(), history, testRng(1))).not.toThrow();
    expect(history.used['math-5']).toEqual(['math-5-0001']);
  });

  it('keeps other pools in history untouched', () => {
    const history: PickHistory = { used: { 'math-6': ['math-6-0001'] }, lastSubject: {} };
    const r = pickQuestion(bank, req(), history, testRng(1));
    expect(r.history.used['math-6']).toEqual(['math-6-0001']);
  });
});

describe('pickQuestion: no repeats until the pool is used up', () => {
  const bank = bankOf(pool('math', 5, 6));

  it('serves every question once before any repeat, for many seeds', () => {
    for (let seed = 0; seed < 25; seed++) {
      const ids = run(bank, req(), 6, seed).map((r) => r.question.id);
      expect(new Set(ids).size).toBe(6);
    }
  });

  it('starts a new cycle after the pool is used up and never repeats the last question', () => {
    for (let seed = 0; seed < 60; seed++) {
      const picks = run(bank, req(), 7, seed);
      expect(picks[6]!.question.id).not.toBe(picks[5]!.question.id);
      // New cycle history holds only the new pick.
      expect(picks[6]!.history.used['math-5']).toEqual([picks[6]!.question.id]);
    }
  });

  it('each full cycle is again a permutation (3 cycles)', () => {
    const ids = run(bank, req(), 18, 9).map((r) => r.question.id);
    for (const start of [0, 6, 12]) {
      expect(new Set(ids.slice(start, start + 6)).size).toBe(6);
    }
  });

  it('a pool of one repeats that question', () => {
    const one = bankOf(pool('math', 5, 1));
    const ids = run(one, req(), 3, 1).map((r) => r.question.id);
    expect(ids).toEqual(['math-5-0001', 'math-5-0001', 'math-5-0001']);
  });

  it('a pool of two alternates after the cycle ends', () => {
    const two = bankOf(pool('math', 5, 2));
    const ids = run(two, req(), 6, 5).map((r) => r.question.id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });

  it('ignores stale ids in history that are no longer in the bank', () => {
    const history: PickHistory = {
      used: { 'math-5': ['math-5-9999', 'math-5-0001'] },
      lastSubject: {},
    };
    const ids = new Set<string>();
    let h = history;
    const rng = testRng(2);
    for (let i = 0; i < 5; i++) {
      const r = pickQuestion(bank, req(), h, rng);
      ids.add(r.question.id);
      h = r.history;
    }
    expect(ids.has('math-5-0001')).toBe(false);
    expect(ids.size).toBe(5);
  });

  it('pools are separate per grade', () => {
    const b = bankOf(pool('math', 5, 2), pool('math', 6, 2));
    const rng = testRng(4);
    let h: PickHistory = EMPTY_HISTORY;
    const a1 = pickQuestion(b, req({ grade: 5 }), h, rng);
    h = a1.history;
    const g6 = pickQuestion(b, req({ grade: 6 }), h, rng);
    h = g6.history;
    const a2 = pickQuestion(b, req({ grade: 5 }), h, rng);
    expect(a2.question.id).not.toBe(a1.question.id);
  });
});

describe("pickQuestion: subject 'both'", () => {
  const bank = bankOf(pool('math', 5, 6), pool('reading', 5, 6));

  it('alternates reading, then math, per who', () => {
    const subjects = run(bank, req({ subject: 'both' }), 6).map((r) => r.subjectUsed);
    expect(subjects).toEqual(['reading', 'math', 'reading', 'math', 'reading', 'math']);
  });

  it('each who has an independent alternation', () => {
    const rng = testRng(1);
    let h: PickHistory = EMPTY_HISTORY;
    const seq: string[] = [];
    for (const who of ['PAST', 'FUTURE', 'PAST', 'FUTURE', 'PAST']) {
      const r = pickQuestion(bank, req({ subject: 'both', who }), h, rng);
      h = r.history;
      seq.push(`${who}:${r.subjectUsed}`);
    }
    expect(seq).toEqual([
      'PAST:reading',
      'FUTURE:reading',
      'PAST:math',
      'FUTURE:math',
      'PAST:reading',
    ]);
  });

  it('the question matches the subject used', () => {
    for (const r of run(bank, req({ subject: 'both' }), 8)) {
      expect(r.question.subject).toBe(r.subjectUsed);
    }
  });

  it('uses the other subject if one is empty', () => {
    const onlyMath = bankOf(pool('math', 5, 4));
    const subjects = run(onlyMath, req({ subject: 'both' }), 4).map((r) => r.subjectUsed);
    expect(subjects).toEqual(['math', 'math', 'math', 'math']);
  });

  it('a fixed subject does not alternate', () => {
    const subjects = run(bank, req({ subject: 'math' }), 4).map((r) => r.subjectUsed);
    expect(subjects).toEqual(['math', 'math', 'math', 'math']);
  });

  it('survives a corrupt lastSubject value', () => {
    const h = { used: {}, lastSubject: { PAST: 'banana' } } as unknown as PickHistory;
    const r = pickQuestion(bank, req({ subject: 'both' }), h, testRng(1));
    expect(r.subjectUsed).toBe('reading');
  });
});

describe('pickQuestion: nearest grade fallback', () => {
  const grades = (gs: number[]): QuestionBank =>
    bankOf(...gs.map((g) => pool('math', g as never, 3)));

  it('uses the exact grade when present', () => {
    expect(
      pickQuestion(grades([2, 5, 8]), req({ grade: 5 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(5);
  });

  it('uses the nearer grade', () => {
    expect(
      pickQuestion(grades([2, 5]), req({ grade: 4 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(5);
    expect(
      pickQuestion(grades([2, 5]), req({ grade: 3 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(2);
  });

  it('breaks ties toward the easier (lower) grade', () => {
    expect(
      pickQuestion(grades([2, 4]), req({ grade: 3 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(2);
    expect(
      pickQuestion(grades([8, 2, 5]), req({ grade: 11 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(8);
  });

  it('handles the ends of the range', () => {
    expect(
      pickQuestion(grades([5, 8]), req({ grade: 0 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(5);
    expect(
      pickQuestion(grades([5, 8]), req({ grade: 12 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(8);
  });

  it('K (grade 0) is a normal grade', () => {
    expect(
      pickQuestion(grades([0, 5]), req({ grade: 0 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(0);
  });

  it('tracks history under the grade actually used', () => {
    const r = pickQuestion(grades([2]), req({ grade: 9 }), EMPTY_HISTORY, testRng(1));
    expect(r.gradeUsed).toBe(2);
    expect(r.history.used['math-2']).toHaveLength(1);
    expect(r.history.used['math-9']).toBeUndefined();
  });

  it('fallback ignores grades that only exist for the other subject', () => {
    const b = bankOf(pool('math', 2, 2), pool('reading', 5, 2));
    expect(
      pickQuestion(b, req({ subject: 'math', grade: 5 }), EMPTY_HISTORY, testRng(1)).gradeUsed,
    ).toBe(2);
  });
});

describe('pickQuestion: errors', () => {
  it('throws when the bank has nothing for the subject', () => {
    expect(() =>
      pickQuestion(
        bankOf(pool('reading', 5, 2)),
        req({ subject: 'math' }),
        EMPTY_HISTORY,
        testRng(1),
      ),
    ).toThrow(Error);
  });
  it('throws on an empty bank', () => {
    expect(() => pickQuestion(bankOf(), req(), EMPTY_HISTORY, testRng(1))).toThrow(Error);
  });
  it("throws on an empty bank for 'both'", () => {
    expect(() =>
      pickQuestion(bankOf(), req({ subject: 'both' }), EMPTY_HISTORY, testRng(1)),
    ).toThrow(Error);
  });
});

describe('isCorrect', () => {
  const q = mq();
  it('matches exactly', () => expect(isCorrect(q, '56')).toBe(true));
  it('trims both sides', () => {
    expect(isCorrect(q, '  56 ')).toBe(true);
    expect(isCorrect({ ...q, answer: ' 56' }, '56')).toBe(true);
  });
  it('rejects a wrong choice', () => expect(isCorrect(q, '54')).toBe(false));
  it('rejects the empty string', () => expect(isCorrect(q, '')).toBe(false));
  it('is case sensitive', () => expect(isCorrect({ ...q, answer: 'See' }, 'see')).toBe(false));
  it('does not accept a partial match', () => expect(isCorrect(q, '5')).toBe(false));
});

describe('sanitizeHistory', () => {
  it('passes a good history through', () => {
    const h: PickHistory = {
      used: { 'math-5': ['math-5-0001'] },
      lastSubject: { PAST: 'reading' },
    };
    expect(sanitizeHistory(h)).toEqual(h);
  });
  it.each([null, undefined, 5, 'x', [], { used: 5 }, { used: {}, lastSubject: 7 }])(
    'falls back to empty for %j',
    (junk) => {
      expect(sanitizeHistory(junk)).toEqual(EMPTY_HISTORY);
    },
  );
  it('drops bad entries but keeps good ones', () => {
    const junk = {
      used: { 'math-5': ['math-5-0001', 7, null], bogus: ['x'], 'math-6': 'nope' },
      lastSubject: { PAST: 'reading', FUTURE: 'banana' },
    };
    expect(sanitizeHistory(junk)).toEqual({
      used: { 'math-5': ['math-5-0001'] },
      lastSubject: { PAST: 'reading' },
    });
  });
});

describe('pickAndRemember (storage injected)', () => {
  const bank = bankOf(pool('math', 5, 5));

  it('saves history to timeclash.history', () => {
    const storage = memStorage();
    const r = pickAndRemember(storage, bank, req(), testRng(1));
    expect(storage.raw.get('timeclash.history')).toEqual(r.history);
  });

  it('reloads history so a new session does not repeat', () => {
    const storage = memStorage();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      // A fresh rng with the same seed each time would repeat without persisted history.
      ids.push(pickAndRemember(storage, bank, req(), testRng(7)).question.id);
    }
    expect(new Set(ids).size).toBe(5);
  });

  it('treats corrupt stored history as empty', () => {
    const storage = memStorage({ initial: { used: 'garbage' } });
    const r = pickAndRemember(storage, bank, req(), testRng(1));
    expect(r.history.used['math-5']).toHaveLength(1);
  });

  it('still returns a question when writes fail', () => {
    const storage = memStorage({ failWrites: true });
    const r = pickAndRemember(storage, bank, req(), testRng(1));
    expect(r.question.subject).toBe('math');
    expect(storage.raw.size).toBe(0);
  });

  it('works when storage has nothing saved', () => {
    expect(() => pickAndRemember(memStorage(), bank, req(), testRng(1))).not.toThrow();
  });
});

describe('missed questions come back (no penalty, seeded)', () => {
  const bank = bankOf(pool('math', 5, 12));

  it('a missed question is asked again within RETRY_AFTER_PICKS picks', () => {
    const rng = testRng(7);
    let history: PickHistory = EMPTY_HISTORY;
    const first = pickQuestion(bank, req(), history, rng);
    history = noteMissed(first.history, first.question.id);
    const later: string[] = [];
    for (let i = 0; i < RETRY_AFTER_PICKS; i++) {
      const r = pickQuestion(bank, req(), history, rng);
      history = r.history;
      later.push(r.question.id);
    }
    expect(later).toContain(first.question.id);
    expect(later.indexOf(first.question.id)).toBe(RETRY_AFTER_PICKS - 1);
  });

  it('is repeatable under the same seed', () => {
    const go = () => {
      const rng = testRng(99);
      let history: PickHistory = EMPTY_HISTORY;
      const a = pickQuestion(bank, req(), history, rng);
      history = noteMissed(a.history, a.question.id);
      const ids: string[] = [a.question.id];
      for (let i = 0; i < 6; i++) {
        const r = pickQuestion(bank, req(), history, rng);
        history = r.history;
        ids.push(r.question.id);
      }
      return ids;
    };
    expect(go()).toEqual(go());
  });

  it('asks the missed question once, not forever', () => {
    const rng = testRng(3);
    let history: PickHistory = EMPTY_HISTORY;
    const a = pickQuestion(bank, req(), history, rng);
    history = noteMissed(a.history, a.question.id);
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) {
      const r = pickQuestion(bank, req(), history, rng);
      history = r.history;
      ids.push(r.question.id);
    }
    expect(ids.filter((id) => id === a.question.id)).toHaveLength(1);
    expect(history.retry ?? []).toEqual([]);
  });

  it('noteMissed does not change its input, ignores repeats, and caps the list', () => {
    const frozen = deepFreeze({ ...EMPTY_HISTORY });
    const once = noteMissed(frozen, 'math-5-0001');
    expect(frozen.retry).toBeUndefined();
    expect(noteMissed(once, 'math-5-0001').retry).toHaveLength(1);
    let h = once;
    for (let i = 2; i < 20; i++) h = noteMissed(h, `math-5-${String(i).padStart(4, '0')}`);
    expect(h.retry!.length).toBeLessThanOrEqual(MAX_RETRY);
  });

  it('a missed question from another pool waits instead of being lost', () => {
    const both = bankOf(pool('math', 5, 6), pool('math', 6, 6));
    const rng = testRng(5);
    let history = noteMissed(EMPTY_HISTORY, 'math-6-0001');
    for (let i = 0; i < 5; i++) {
      const r = pickQuestion(both, req({ grade: 5 }), history, rng);
      history = r.history;
      expect(r.question.grade).toBe(5);
    }
    expect(history.retry?.map((e) => e.id)).toContain('math-6-0001');
    const r = pickQuestion(both, req({ grade: 6 }), history, rng);
    expect(r.question.id).toBe('math-6-0001');
  });

  it('sanitizeHistory keeps good retry entries and drops bad ones', () => {
    const h = sanitizeHistory({
      used: {},
      lastSubject: {},
      retry: [{ id: 'math-5-0001', picksLeft: 2 }, { id: 5 }, 'x', { id: 'a', picksLeft: -1 }],
    });
    expect(h.retry).toEqual([{ id: 'math-5-0001', picksLeft: 2 }]);
  });
});
