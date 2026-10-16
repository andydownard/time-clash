// Question checks used by `npm run check:questions` and the tests. Pure TypeScript.
import {
  add,
  div,
  equalRational,
  evaluateExpression,
  formatRational,
  fromInt,
  mul,
  parseAnswerValue,
  parseDecimal,
  sub,
  type Rational,
} from './mathEval';
import type { QuestionKind, RecomputeMathAnswer, ValidateQuestion } from './types';

export const KINDS: readonly QuestionKind[] = [
  'numeric',
  'choice',
  'sightword',
  'vocab',
  'mainidea',
  'grammar',
];
const READING_ONLY_KINDS: readonly QuestionKind[] = ['sightword', 'vocab', 'mainidea', 'grammar'];
export const MIN_CHOICES = 3;
export const MAX_CHOICES = 4;
export const MANUAL_TAG = 'manual';

/** Banned words (AGENTS.md). Stems catch endings such as "killed" without catching "skill". */
const BANNED: readonly RegExp[] = [
  /\bkill\w*/i,
  /\b(?:die|dies|died|dying)\b/i,
  /\bdead\w*/i,
  /\bblood\w*/i,
  /\b(?:gore|gory)\b/i,
  /\bdefeat\w*/i,
  /\bbuy\w*/i,
  /\bprice\w*/i,
];

export function findBannedWord(text: string): string | null {
  for (const re of BANNED) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

// ---------- Recompute math answers ----------

const EXPR_CHARS = /^[\d\s+\-x*×÷/^().]+$/;
const NUM = String.raw`\d+(?:\.\d+)?`;

function decimalOf(text: string): Rational | null {
  return parseDecimal(text);
}

function recomputeValue(prompt: string): Rational | null {
  if (typeof prompt !== 'string') return null;

  // Solve for x: ax + b = c   or   ax - b = c
  const solve = new RegExp(String.raw`^Solve for x: (-?\d*)x ([+-]) (${NUM}) = (-?${NUM})$`).exec(
    prompt,
  );
  if (solve) {
    const coefText = solve[1]!;
    const digits = coefText.replace('-', '');
    const magnitude = digits === '' ? fromInt(1) : decimalOf(digits);
    const b = decimalOf(solve[3]!);
    const cMagnitude = decimalOf(solve[4]!.replace('-', ''));
    if (!magnitude || !b || !cMagnitude) return null;
    const coef = coefText.startsWith('-') ? mul(magnitude, fromInt(-1)) : magnitude;
    const c = solve[4]!.startsWith('-') ? mul(cMagnitude, fromInt(-1)) : cMagnitude;
    if (!coef || !c) return null;
    const rhs = solve[2] === '+' ? sub(c, b) : add(c, b);
    return rhs ? div(rhs, coef) : null;
  }

  if (!prompt.startsWith('What is ') || !prompt.endsWith('?')) return null;
  const inner = prompt.slice('What is '.length, -1);

  // What is N% of M?
  const pct = new RegExp(String.raw`^(${NUM})% of (${NUM})$`).exec(inner);
  if (pct) {
    const n = decimalOf(pct[1]!);
    const m = decimalOf(pct[2]!);
    if (!n || !m) return null;
    const product = mul(n, m);
    return product ? div(product, fromInt(100)) : null;
  }

  // What is the area of a rectangle with length L and width W?
  const area = new RegExp(
    String.raw`^the area of a rectangle with length (${NUM}) and width (${NUM})$`,
  ).exec(inner);
  if (area) {
    const l = decimalOf(area[1]!);
    const w = decimalOf(area[2]!);
    return l && w ? mul(l, w) : null;
  }

  // What is the value of E?   and   What is A op B?  (fractions are just division)
  const expr = inner.startsWith('the value of ') ? inner.slice('the value of '.length) : inner;
  if (!EXPR_CHARS.test(expr) || !/\d/.test(expr)) return null;
  return evaluateExpression(expr);
}

/** Canonical answer text ("56", "-3", "5/6") when the prompt matches a supported pattern, else null. */
export const recomputeMathAnswer: RecomputeMathAnswer = (prompt) => {
  const v = recomputeValue(prompt);
  return v ? formatRational(v) : null;
};

// ---------- Question validation ----------

const ID_FORMAT = /^(math|reading)-(0|[1-9]|1[0-2])-(\d{4})$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonBlank(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if the hint spells out the answer as a whole word or number. */
function hintLeaks(hint: string, answer: string): boolean {
  const a = answer.trim().toLowerCase();
  const minLength = /\d/.test(a) ? 2 : 3;
  if (a.length < minLength) return false;
  const re = new RegExp(`(?<![\\w.])${escapeRegExp(a)}(?![\\w]|\\.\\d)`, 'i');
  return re.test(hint);
}

export const validateQuestion: ValidateQuestion = (input) => {
  const problems: string[] = [];
  const q: unknown = input;
  if (!isRecord(q)) return ['question is not an object'];

  // id, subject, grade
  const idMatch = typeof q.id === 'string' ? ID_FORMAT.exec(q.id) : null;
  if (!idMatch)
    problems.push(
      `id ${JSON.stringify(q.id)} must look like "math-5-0001" (subject-grade-4 digits)`,
    );

  const subjectOk = q.subject === 'math' || q.subject === 'reading';
  if (!subjectOk) problems.push(`subject ${JSON.stringify(q.subject)} must be "math" or "reading"`);

  const gradeOk =
    typeof q.grade === 'number' && Number.isInteger(q.grade) && q.grade >= 0 && q.grade <= 12;
  if (!gradeOk)
    problems.push(`grade ${JSON.stringify(q.grade)} must be a whole number from 0 (K) to 12`);

  if (idMatch) {
    if (subjectOk && idMatch[1] !== q.subject)
      problems.push(`id subject "${idMatch[1]}" does not match subject "${String(q.subject)}"`);
    if (gradeOk && Number(idMatch[2]) !== q.grade)
      problems.push(`id grade ${idMatch[2]} does not match grade ${String(q.grade)}`);
  }

  // kind
  const kindOk = typeof q.kind === 'string' && (KINDS as readonly string[]).includes(q.kind);
  if (!kindOk) problems.push(`kind ${JSON.stringify(q.kind)} is not one of ${KINDS.join(', ')}`);
  if (kindOk && subjectOk) {
    const kind = q.kind as QuestionKind;
    if (q.subject === 'math' && READING_ONLY_KINDS.includes(kind))
      problems.push(`kind "${kind}" is for reading, not math`);
    if (q.subject === 'reading' && kind === 'numeric')
      problems.push(`kind "numeric" is for math, not reading`);
  }

  // text fields
  if (!nonBlank(q.prompt)) problems.push('prompt is missing or blank');
  if (!nonBlank(q.hint)) problems.push('hint is missing or blank');
  if (!Array.isArray(q.tags) || !q.tags.every((t) => typeof t === 'string'))
    problems.push('tags must be an array of strings');

  // choices and answer
  const choices = q.choices;
  let choicesOk = false;
  if (!Array.isArray(choices)) {
    problems.push('choices must be an array');
  } else if (choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
    problems.push(
      `choices must have ${MIN_CHOICES} to ${MAX_CHOICES} items (found ${choices.length})`,
    );
  } else if (!choices.every(nonBlank)) {
    problems.push('choices must all be non-blank strings');
  } else {
    choicesOk = true;
    if (new Set(choices.map((c: string) => c.trim())).size !== choices.length)
      problems.push('choices must be unique');
  }
  if (typeof q.answer !== 'string' || q.answer === '') {
    problems.push('answer is missing');
  } else if (choicesOk && !(choices as string[]).includes(q.answer)) {
    problems.push(`answer is not in choices (answer ${JSON.stringify(q.answer)})`);
  }

  if (nonBlank(q.hint) && typeof q.answer === 'string' && hintLeaks(q.hint, q.answer)) {
    problems.push('hint gives away the answer');
  }

  // kind-specific fields
  if (q.kind === 'sightword' && !nonBlank(q.audioWord))
    problems.push('sightword needs a non-blank audioWord');
  if (q.kind === 'mainidea' && !nonBlank(q.passage)) problems.push('mainidea needs a passage');

  // banned words in everything a child can see or hear
  const visible: unknown[] = [
    q.prompt,
    q.hint,
    q.passage,
    q.audioWord,
    q.answer,
    ...(Array.isArray(choices) ? choices : []),
  ];
  for (const text of visible) {
    if (typeof text !== 'string') continue;
    const bad = findBannedWord(text);
    if (bad)
      problems.push(
        `banned word "${bad}" in ${JSON.stringify(text.length > 40 ? `${text.slice(0, 40)}...` : text)}`,
      );
  }

  // math answer key
  if (q.subject === 'math' && typeof q.prompt === 'string') {
    const tags = Array.isArray(q.tags) ? q.tags : [];
    const recomputed = recomputeMathAnswer(q.prompt);
    if (recomputed === null) {
      if (!tags.includes(MANUAL_TAG)) {
        problems.push(
          `prompt does not match a checkable pattern; rewrite it or tag it "${MANUAL_TAG}" for the blind-solve check`,
        );
      }
    } else if (typeof q.answer === 'string') {
      const given = parseAnswerValue(q.answer);
      const want = parseAnswerValue(recomputed)!;
      if (!given || !equalRational(given, want)) {
        problems.push(
          `answer ${JSON.stringify(q.answer)} does not match recomputed answer ${recomputed}`,
        );
      } else if (q.answer.includes('/') && formatRational(given) !== q.answer.trim()) {
        problems.push(
          `answer ${JSON.stringify(q.answer)} must be in simplest form (${recomputed})`,
        );
      }
    }
  }

  return problems;
};
