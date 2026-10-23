import { describe, expect, it } from 'vitest';
import { clearMyData, createStorage, loadSetupPicks } from '../../src/storage/storage';
import { STORAGE_KEYS } from '../../src/storage/types';

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
const KEY = 'timeclash.setupPicks';
const saved = (v: unknown) => createStorage(fakeBacking({ [KEY]: JSON.stringify(v) }));

describe('remembered Setup picks', () => {
  it('is a known storage key', () => {
    expect(STORAGE_KEYS).toContain(KEY);
  });

  it('is empty when nothing is saved', () => {
    expect(loadSetupPicks(createStorage(fakeBacking()))).toEqual({});
  });

  it('round-trips grade, subject and focus for each side', () => {
    const backing = fakeBacking();
    const picks = {
      PAST: { grade: 4, subject: 'math', topic: 'multiplication' },
      FUTURE: { grade: 0, subject: 'reading' },
    } as const;
    createStorage(backing).set(KEY, picks);
    expect(loadSetupPicks(createStorage(backing))).toEqual(picks);
  });

  it('drops a side with a grade out of range, a fraction, or a string', () => {
    for (const grade of [13, -1, 2.5, '3', null]) {
      expect(loadSetupPicks(saved({ PAST: { grade, subject: 'math' } }))).toEqual({});
    }
  });

  it('keeps the good side when the other is junk', () => {
    const s = saved({ PAST: { grade: 99, subject: 'math' }, FUTURE: { grade: 7, subject: 'both' } });
    expect(loadSetupPicks(s)).toEqual({ FUTURE: { grade: 7, subject: 'both' } });
  });

  it('drops a bad subject, and a focus this side is not offered', () => {
    expect(loadSetupPicks(saved({ PAST: { grade: 3, subject: 'art' } }))).toEqual({});
    const s = saved({
      PAST: { grade: 3, subject: 'math', topic: 'juggling' },
      FUTURE: { grade: 3, subject: 'math', topic: 'multiplication' },
    });
    expect(loadSetupPicks(s)).toEqual({
      PAST: { grade: 3, subject: 'math' },
      FUTURE: { grade: 3, subject: 'math' },
    });
  });

  it('ignores corrupt JSON and non-object values', () => {
    expect(loadSetupPicks(createStorage(fakeBacking({ [KEY]: '{not json' })))).toEqual({});
    for (const v of [null, 5, 'x', [1, 2], true]) expect(loadSetupPicks(saved(v))).toEqual({});
  });

  it('survives storage that throws', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    const s = createStorage({ getItem: boom, setItem: boom, removeItem: boom });
    expect(loadSetupPicks(s)).toEqual({});
    expect(s.set(KEY, { PAST: { grade: 5, subject: 'math' } })).toBe(false);
    expect(loadSetupPicks(s)).toEqual({ PAST: { grade: 5, subject: 'math' } });
  });

  it('is removed by Clear my data', () => {
    const backing = fakeBacking();
    const s = createStorage(backing);
    s.set(KEY, { PAST: { grade: 5, subject: 'math' } });
    clearMyData(s);
    expect(backing.data.has(KEY)).toBe(false);
    expect(loadSetupPicks(s)).toEqual({});
  });
});
