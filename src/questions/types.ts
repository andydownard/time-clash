// Shared contract for the question bank and picker. Pure TypeScript, no DOM, no Phaser.
import type { Grade, Rng, Subject } from '../game/types';

/** A question is always one subject. Players may pick 'both' (see Subject). */
export type QuestionSubject = 'reading' | 'math';

export type QuestionKind =
  | 'numeric' // math with a number answer; checker recomputes it from the prompt
  | 'choice' // math or reading, pick one of four
  | 'sightword' // reading K to 3; needs audioWord for the speak button
  | 'vocab' // reading 4 to 12, word in context
  | 'mainidea' // reading 4 to 12, needs passage
  | 'grammar'; // reading 4 to 12

/** One bank entry. Matches the JSON in docs/BUILD.md. */
export type Question = {
  /** `${subject}-${grade}-${4 digits}`, e.g. "math-8-0042". "k" is not used; K is grade 0. Unique. */
  id: string;
  subject: QuestionSubject;
  grade: Grade;
  kind: QuestionKind;
  /** What the child reads. Plain text. Math may use ^ for exponents and a/b for fractions. */
  prompt: string;
  /** Exactly 4 distinct strings (UI.choicesPerQuestion). Shown as 4 big buttons in Phase 1. */
  choices: string[];
  /** Must equal one of choices exactly. */
  answer: string;
  /** Short, kind, and never gives the answer away. */
  hint?: string;
  tags: string[];
  /** Required when kind is 'sightword'. Spoken by the speaker button. */
  audioWord?: string;
  /** Required when kind is 'mainidea'. 2 to 5 short sentences. */
  passage?: string;
};

/** All questions, bundled at build time (static JSON import, no network). */
export type QuestionBank = {
  readonly questions: readonly Question[];
};

/** Pool key, e.g. "math-8". */
export type PoolKey = `${QuestionSubject}-${number}`;

/** Saved in localStorage as timeclash.history. Plain JSON. */
export type PickHistory = {
  /** Ids already used in each pool since its last reshuffle. */
  used: Partial<Record<PoolKey, string[]>>;
  /** For subject 'both': the subject used last by each player name key. */
  lastSubject: Partial<Record<string, QuestionSubject>>;
  /**
   * Questions answered wrong. Each comes back once after `picksLeft` more picks. No penalty.
   * Optional so older saved history still loads.
   */
  retry?: Array<{ id: string; picksLeft: number }>;
};

export const EMPTY_HISTORY: PickHistory = { used: {}, lastSubject: {} };

export type PickRequest = {
  subject: Subject;
  grade: Grade;
  /**
   * Who is asking, so 'both' alternates per player. Use the team ('PAST' or 'FUTURE'),
   * never the child's name.
   */
  who: string;
};

export type PickResult = {
  question: Question;
  /** New history. The input history is never mutated. */
  history: PickHistory;
  /** The grade actually used. Differs from the request when the fallback kicked in. */
  gradeUsed: Grade;
  subjectUsed: QuestionSubject;
};

/**
 * Picks one question. Rules:
 * 1. 'both' alternates reading then math per `who`, starting with reading.
 * 2. If the grade has no questions for that subject, use the nearest grade that does.
 *    Ties go to the lower (easier) grade.
 * 3. Picks uniformly with rng from the questions not yet used in that pool.
 * 4. When the pool is used up, clear it and start over, but never repeat the
 *    question that was just asked (unless the pool has one question).
 * Throws Error only if the bank has no questions at all for that subject.
 */
export type PickQuestion = (
  bank: QuestionBank,
  request: PickRequest,
  history: PickHistory,
  rng: Rng,
) => PickResult;

/** Exact string compare after trimming both sides. */
export type IsCorrect = (question: Question, choice: string) => boolean;

/** Returns a list of problems. An empty list means the question is valid. Used by check:questions and tests. */
export type ValidateQuestion = (q: Question) => string[];

/** Recomputes a math answer from the prompt when the form is known, else null. */
export type RecomputeMathAnswer = (prompt: string) => string | null;
