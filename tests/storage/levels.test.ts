import { describe, expect, it } from 'vitest';
import { recordFor, withRecord } from '../../src/questions/calibration';
import { clearMyData, createStorage, loadLevels } from '../../src/storage/storage';

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
const KEY = 'timeclash.levels';
const saved = (value: unknown) => fakeBacking({ [KEY]: JSON.stringify(value) });

describe('saved levels', () => {
  it('is empty when nothing is saved', () => {
    expect(loadLevels(createStorage(fakeBacking()))).toEqual({});
  });

  it('round-trips', () => {
    const s = createStorage(fakeBacking());
    const levels = { alex: { math: { offset: 1, recent: [true, false] } } };
    s.set(KEY, levels);
    expect(loadLevels(s)).toEqual(levels);
  });

  it('cleans junk and drops bad entries', () => {
    const s = createStorage(
      saved({
        good: { reading: { offset: -1, recent: [true] } },
        badOffset: { math: { offset: 7, recent: [] } },
        floaty: { math: { offset: 0.5, recent: [] } },
        badRecent: { math: { offset: 0, recent: [true, 'x'] } },
        tooLong: { math: { offset: 0, recent: [true, true, true, true, true, true] } },
        notObject: 5,
        nan: { reading: { offset: null, recent: [] } },
      }),
    );
    expect(loadLevels(s)).toEqual({ good: { reading: { offset: -1, recent: [true] } } });
  });

  it('gives empty for a non-object', () => {
    expect(loadLevels(createStorage(saved([1, 2])))).toEqual({});
    expect(loadLevels(createStorage(saved('x')))).toEqual({});
  });

  it('caps the number of names at 50', () => {
    const many: Record<string, unknown> = {};
    for (let i = 0; i < 80; i++) many[`kid${i}`] = { math: { offset: 1, recent: [] } };
    expect(Object.keys(loadLevels(createStorage(saved(many))))).toHaveLength(50);
  });

  it('finds the same child whatever the capitals or spaces', () => {
    const s = createStorage(fakeBacking());
    s.set(KEY, withRecord({}, 'ALEX', 'math', { offset: 2, recent: [] }));
    expect(recordFor(loadLevels(s), '  alex ', 'math').offset).toBe(2);
    expect(recordFor(loadLevels(s), 'Alex', 'math').offset).toBe(2);
  });

  it('survives blocked storage', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    const s = createStorage({ getItem: boom, setItem: boom, removeItem: boom });
    expect(loadLevels(s)).toEqual({});
    expect(s.set(KEY, { a: { math: { offset: 1, recent: [] } } })).toBe(false);
    expect(loadLevels(s)).toEqual({ a: { math: { offset: 1, recent: [] } } });
  });

  it('Clear my data removes it', () => {
    const b = saved({ alex: { math: { offset: 1, recent: [] } } });
    const s = createStorage(b);
    clearMyData(s);
    expect(b.data.has(KEY)).toBe(false);
    expect(loadLevels(s)).toEqual({});
  });
});
