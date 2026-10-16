// Test helpers for the question tracks. No dependency on src/game/rng.ts so this track stays independent.
import type { Rng } from '../../src/game/types';
import type { Question, QuestionBank, PickHistory } from '../../src/questions/types';
import type { StorageKey, StorageSchema, TypedStorage } from '../../src/storage/types';

export function testRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => {
    if (min > max) throw new RangeError('min > max');
    return min + Math.floor(next() * (max - min + 1));
  };
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('empty');
    return items[int(0, items.length - 1)] as T;
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };
  return { seed, next, int, pick, shuffle };
}

/** A valid math-5 question. Override any field. */
export function mq(overrides: Partial<Question> = {}): Question {
  return {
    id: 'math-5-0001',
    subject: 'math',
    grade: 5,
    kind: 'numeric',
    prompt: 'What is 7 x 8?',
    choices: ['54', '56', '58', '64'],
    answer: '56',
    hint: 'Try 7 x 10, then take away 7 x 2.',
    tags: ['times-tables'],
    ...overrides,
  };
}

/** A valid reading-0 sight word question. Override any field. */
export function rq(overrides: Partial<Question> = {}): Question {
  return {
    id: 'reading-0-0001',
    subject: 'reading',
    grade: 0,
    kind: 'sightword',
    prompt: 'Tap the word you hear.',
    choices: ['see', 'saw', 'say', 'sit'],
    answer: 'see',
    hint: 'It starts with the sound sss.',
    tags: ['dolch'],
    audioWord: 'see',
    ...overrides,
  };
}

/** Makes `n` distinct questions for one pool. */
export function pool(subject: 'math' | 'reading', grade: Question['grade'], n: number): Question[] {
  return Array.from({ length: n }, (_, i) => {
    const id = `${subject}-${grade}-${String(i + 1).padStart(4, '0')}`;
    const base = subject === 'math' ? mq() : rq();
    return {
      ...base,
      id,
      grade,
      hint: 'Count up from the first number.',
      prompt: subject === 'math' ? `What is ${i + 1} + 1?` : `Tap word number ${i + 1}.`,
      answer: subject === 'math' ? String(i + 2) : 'see',
      choices:
        subject === 'math' ? [String(i + 2), '90', '91', '92'] : ['see', 'saw', 'say', 'sit'],
    };
  });
}

export function bankOf(...groups: Question[][]): QuestionBank {
  return { questions: groups.flat() };
}

/** In-memory TypedStorage fake. `failWrites` makes set() return false. */
export function memStorage(opts: { failWrites?: boolean; initial?: unknown } = {}): TypedStorage & {
  raw: Map<string, unknown>;
} {
  const raw = new Map<string, unknown>();
  if (opts.initial !== undefined) raw.set('timeclash.history', opts.initial);
  return {
    raw,
    persistent: !opts.failWrites,
    get<K extends StorageKey>(key: K): StorageSchema[K] | null {
      return (raw.has(key) ? raw.get(key) : null) as StorageSchema[K] | null;
    },
    set<K extends StorageKey>(key: K, value: StorageSchema[K]): boolean {
      if (opts.failWrites) return false;
      raw.set(key, value);
      return true;
    },
    remove(key: StorageKey): void {
      raw.delete(key);
    },
  };
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

export const emptyHistory = (): PickHistory => ({ used: {}, lastSubject: {} });
