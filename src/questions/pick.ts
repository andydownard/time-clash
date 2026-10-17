// Chooses the next reload question. Pure and seeded: the caller supplies the Rng.
import type { Grade, Rng } from '../game/types';
import type { TypedStorage } from '../storage/types';
import {
  EMPTY_HISTORY,
  type IsCorrect,
  type PickHistory,
  type PickQuestion,
  type PickRequest,
  type PickResult,
  type PoolKey,
  type Question,
  type QuestionBank,
  type QuestionSubject,
} from './types';

export const isCorrect: IsCorrect = (question, choice) => question.answer.trim() === choice.trim();

/** Nearest grade with questions. Ties go to the lower (easier) grade. */
function nearestGrade(grades: readonly number[], wanted: number): number {
  let best = grades[0]!;
  for (const g of grades) {
    const d = Math.abs(g - wanted);
    const bd = Math.abs(best - wanted);
    if (d < bd || (d === bd && g < best)) best = g;
  }
  return best;
}

function questionsFor(bank: QuestionBank, subject: QuestionSubject): Question[] {
  return bank.questions.filter((q) => q.subject === subject);
}

export function pickSubject(
  bank: QuestionBank,
  request: PickRequest,
  history: PickHistory,
): QuestionSubject {
  if (request.subject !== 'both') return request.subject;
  const last = history.lastSubject[request.who];
  const wanted: QuestionSubject = last === 'reading' ? 'math' : 'reading';
  const other: QuestionSubject = wanted === 'math' ? 'reading' : 'math';
  if (questionsFor(bank, wanted).length > 0) return wanted;
  return other;
}

/** A missed question comes back after this many more picks. */
export const RETRY_AFTER_PICKS = 3;
/** The most missed questions kept waiting. */
export const MAX_RETRY = 6;

/** Notes a wrong answer so the question comes back later. Never changes its input. */
export function noteMissed(history: PickHistory, id: string): PickHistory {
  const waiting = history.retry ?? [];
  if (waiting.some((e) => e.id === id)) return history;
  const retry = [...waiting, { id, picksLeft: RETRY_AFTER_PICKS }].slice(-MAX_RETRY);
  return { ...history, retry };
}

export const pickQuestion: PickQuestion = (bank, request, history, rng) => {
  const subject = pickSubject(bank, request, history);
  const ofSubject = questionsFor(bank, subject);
  if (ofSubject.length === 0) throw new Error(`The question bank has no ${subject} questions.`);

  const gradeUsed = nearestGrade(
    [...new Set(ofSubject.map((q) => q.grade))],
    request.grade,
  ) as Grade;
  const pool = ofSubject.filter((q) => q.grade === gradeUsed);
  const key = `${subject}-${gradeUsed}` as PoolKey;

  const poolIds = new Set(pool.map((q) => q.id));
  const used = (history.used[key] ?? []).filter((id) => poolIds.has(id)); // drop stale ids
  const usedSet = new Set(used);
  let fresh = pool.filter((q) => !usedSet.has(q.id));
  let reshuffled = false;
  if (fresh.length === 0) {
    reshuffled = true;
    const justAsked = used[used.length - 1];
    fresh = pool.length > 1 ? pool.filter((q) => q.id !== justAsked) : pool;
  }

  // Each pick counts down the missed questions. One that is due and fits this pool comes back.
  const counted = (history.retry ?? []).map((e) => ({
    id: e.id,
    picksLeft: Math.max(0, e.picksLeft - 1),
  }));
  const due = counted.find((e) => e.picksLeft === 0 && poolIds.has(e.id));
  const retryQuestion = due ? pool.find((q) => q.id === due.id) : undefined;
  const retry = counted.filter((e) => e !== due);
  const withRetry = (h: PickHistory): PickHistory => (retry.length > 0 ? { ...h, retry } : h);

  if (retryQuestion) {
    return {
      question: retryQuestion,
      gradeUsed,
      subjectUsed: subject,
      history: withRetry({
        used: history.used,
        lastSubject: { ...history.lastSubject, [request.who]: subject },
      }),
    };
  }

  const question = rng.pick(fresh);
  const nextUsed = reshuffled ? [question.id] : [...used, question.id];

  return {
    question,
    gradeUsed,
    subjectUsed: subject,
    history: withRetry({
      used: { ...history.used, [key]: nextUsed },
      lastSubject: { ...history.lastSubject, [request.who]: subject },
    }),
  };
};

const POOL_KEY = /^(math|reading)-\d{1,2}$/;

/** Makes any stored value safe to use. Bad parts are dropped; bad everything gives an empty history. */
export function sanitizeHistory(value: unknown): PickHistory {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return EMPTY_HISTORY;
  const raw = value as { used?: unknown; lastSubject?: unknown };
  if (typeof raw.used !== 'object' || raw.used === null || Array.isArray(raw.used))
    return EMPTY_HISTORY;
  if (
    typeof raw.lastSubject !== 'object' ||
    raw.lastSubject === null ||
    Array.isArray(raw.lastSubject)
  )
    return EMPTY_HISTORY;

  const used: Partial<Record<PoolKey, string[]>> = {};
  for (const [key, ids] of Object.entries(raw.used)) {
    if (!POOL_KEY.test(key) || !Array.isArray(ids)) continue;
    used[key as PoolKey] = ids.filter((id): id is string => typeof id === 'string');
  }
  const lastSubject: Partial<Record<string, QuestionSubject>> = {};
  for (const [who, s] of Object.entries(raw.lastSubject)) {
    if (s === 'math' || s === 'reading') lastSubject[who] = s;
  }
  const retry = Array.isArray((raw as { retry?: unknown }).retry)
    ? (
        (raw as { retry: unknown[] }).retry.filter(
          (e): e is { id: string; picksLeft: number } =>
            typeof e === 'object' &&
            e !== null &&
            typeof (e as { id?: unknown }).id === 'string' &&
            Number.isInteger((e as { picksLeft?: unknown }).picksLeft) &&
            (e as { picksLeft: number }).picksLeft >= 0,
        ) as Array<{ id: string; picksLeft: number }>
      )
        .map((e) => ({ id: e.id, picksLeft: e.picksLeft }))
        .slice(-MAX_RETRY)
    : [];
  return retry.length > 0 ? { used, lastSubject, retry } : { used, lastSubject };
}

/** Loads history from storage, picks, and saves the new history. A failed save never stops play. */
export function pickAndRemember(
  storage: TypedStorage,
  bank: QuestionBank,
  request: PickRequest,
  rng: Rng,
): PickResult {
  const history = sanitizeHistory(storage.get('timeclash.history'));
  const result = pickQuestion(bank, request, history, rng);
  storage.set('timeclash.history', result.history);
  return result;
}
