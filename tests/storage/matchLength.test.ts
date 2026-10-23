import { describe, expect, it } from 'vitest';
import { clearMyData, createStorage, loadMatchLength } from '../../src/storage/storage';
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
const KEY = 'timeclash.matchLength';

describe('saved match length', () => {
  it('is a known storage key', () => expect(STORAGE_KEYS).toContain(KEY));
  it('is Normal when nothing is saved', () => {
    expect(loadMatchLength(createStorage(fakeBacking()))).toBe('normal');
  });
  it('round-trips Short and Long', () => {
    const backing = fakeBacking();
    for (const v of ['short', 'long'] as const) {
      createStorage(backing).set(KEY, v);
      expect(loadMatchLength(createStorage(backing))).toBe(v);
    }
  });
  it('treats junk as Normal', () => {
    for (const raw of ['"epic"', '7', 'null', '{"a":1}', 'not json']) {
      expect(loadMatchLength(createStorage(fakeBacking({ [KEY]: raw })))).toBe('normal');
    }
  });
  it('Clear my data resets it', () => {
    const backing = fakeBacking({ [KEY]: '"long"' });
    const storage = createStorage(backing);
    clearMyData(storage);
    expect(loadMatchLength(storage)).toBe('normal');
    expect(backing.data.has(KEY)).toBe(false);
  });
});
