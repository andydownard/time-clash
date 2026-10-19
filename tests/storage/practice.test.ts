import { describe, expect, it } from 'vitest';
import { clearMyData, createStorage, loadPractice } from '../../src/storage/storage';

function fakeBacking(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
    data,
  };
}
const KEY = 'timeclash.practice';

describe('saved Play with choice', () => {
  it('is null when nothing is saved', () => {
    expect(loadPractice(createStorage(fakeBacking()))).toBeNull();
  });

  it('keeps the last level across a reload of the page', () => {
    const backing = fakeBacking();
    createStorage(backing).set(KEY, { opponent: 'computer', level: 'hard' });
    expect(loadPractice(createStorage(backing))).toEqual({ opponent: 'computer', level: 'hard' });
  });

  it('cleans junk: a bad level becomes Medium, a bad opponent is dropped', () => {
    const bad = createStorage(
      fakeBacking({ [KEY]: JSON.stringify({ opponent: 'robot', level: 'hard' }) }),
    );
    expect(loadPractice(bad)).toBeNull();
    const odd = createStorage(
      fakeBacking({ [KEY]: JSON.stringify({ opponent: 'computer', level: 'impossible' }) }),
    );
    expect(loadPractice(odd)).toEqual({ opponent: 'computer', level: 'medium' });
    expect(loadPractice(createStorage(fakeBacking({ [KEY]: '{not json' })))).toBeNull();
  });

  it('survives storage that throws, and Clear my data removes it', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const s = createStorage(throwing);
    expect(s.set(KEY, { opponent: 'computer', level: 'easy' })).toBe(false);
    expect(loadPractice(s)).toEqual({ opponent: 'computer', level: 'easy' });
    const backing = fakeBacking();
    const real = createStorage(backing);
    real.set(KEY, { opponent: 'computer', level: 'easy' });
    clearMyData(real);
    expect(loadPractice(real)).toBeNull();
  });
});
