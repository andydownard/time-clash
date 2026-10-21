// Your own shapes: the drawing pad rules, the canonical key, turning, and bad data.
import { describe, expect, it } from 'vitest';
import {
  cellsFromKey,
  customId,
  isConnected,
  normalizeCells,
  parseCustomId,
  rotateCells,
  shapeKey,
  shapeProblem,
  shapeSize,
  type Cell,
} from '../../src/game/customShapes';
import { BASE_BUILDER as B } from '../../src/game/config';

const L: Cell[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
];

describe('limits', () => {
  it('uses a 4 by 4 pad, 8 squares and 6 saved shapes', () => {
    expect(B.shapePad).toBe(4);
    expect(B.maxShapeCells).toBe(8);
    expect(B.maxShapes).toBe(6);
  });
});

describe('normalize and key', () => {
  it('trims empty rows and columns and sorts', () => {
    const moved: Cell[] = [
      [3, 3],
      [2, 3],
      [2, 2],
    ];
    expect(normalizeCells(moved)).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
    ]);
  });
  it('gives the same key wherever the shape sits on the pad', () => {
    const shifted = L.map(([c, r]): Cell => [c + 2, r + 1]);
    expect(shapeKey(shifted)).toBe(shapeKey(L));
    expect(shapeKey(L)).toBe('10/10/11');
  });
  it('ignores a square drawn twice', () => {
    expect(shapeKey([...L, [0, 0]])).toBe('10/10/11');
  });
  it('gives different keys for different shapes', () => {
    expect(
      shapeKey([
        [0, 0],
        [1, 0],
      ]),
    ).not.toBe(
      shapeKey([
        [0, 0],
        [0, 1],
      ]),
    );
  });
});

describe('what a shape may be', () => {
  it('accepts one connected group', () => {
    expect(shapeProblem(L)).toBeNull();
    expect(shapeProblem([[1, 1]])).toBeNull();
  });
  it('refuses an empty pad', () => {
    expect(shapeProblem([])).toBe('empty');
  });
  it('refuses squares that only touch at a corner', () => {
    expect(
      shapeProblem([
        [0, 0],
        [1, 1],
      ]),
    ).toBe('apart');
  });
  it('refuses two separate groups', () => {
    expect(
      shapeProblem([
        [0, 0],
        [1, 0],
        [3, 3],
      ]),
    ).toBe('apart');
    expect(
      isConnected([
        [0, 0],
        [2, 0],
      ]),
    ).toBe(false);
  });
  it('allows exactly the most squares and refuses one more', () => {
    const eight: Cell[] = [0, 1, 2, 3].flatMap((c): Cell[] => [
      [c, 0],
      [c, 1],
    ]);
    expect(shapeProblem(eight)).toBeNull();
    expect(shapeProblem([...eight, [0, 2]])).toBe('big');
  });
  it('refuses squares off the pad and bad numbers', () => {
    expect(shapeProblem([[4, 0]])).toBe('outside');
    expect(shapeProblem([[-1, 0]])).toBe('outside');
    expect(shapeProblem([[0.5, 0]])).toBe('outside');
    expect(shapeProblem([[Number.NaN, 0]])).toBe('outside');
  });
});

describe('turning', () => {
  it('turns the L a quarter turn and trims it again', () => {
    expect(shapeKey(rotateCells(L, 90))).toBe('111/100');
    expect(shapeKey(rotateCells(L, 180))).toBe('11/01/01');
    expect(shapeKey(rotateCells(L, 270))).toBe('001/111');
  });
  it('is the same shape after four quarter turns', () => {
    expect(rotateCells(L, 0)).toEqual(normalizeCells(L));
    let c: readonly Cell[] = L;
    for (let i = 0; i < 4; i++) c = rotateCells(c, 90);
    expect(c).toEqual(normalizeCells(L));
  });
  it('swaps width and height on a quarter turn', () => {
    expect(shapeSize(L)).toEqual({ w: 2, h: 3 });
    expect(shapeSize(rotateCells(L, 90))).toEqual({ w: 3, h: 2 });
  });
});

describe('reading a key back', () => {
  it('round trips', () => {
    expect(cellsFromKey('10/10/11')).toEqual(normalizeCells(L));
  });
  it.each([
    ['not a string', 7],
    ['empty', ''],
    ['letters', 'ab/cd'],
    ['ragged rows', '10/1'],
    ['an empty top row', '00/11'],
    ['an empty side column', '01/01'],
    ['too wide', '11111'],
    ['too tall', '1/1/1/1/1'],
    ['apart', '101'],
    ['too many squares', '1111/1111/1'],
    ['not trimmed', '110/110/000'],
  ])('refuses %s', (_why, key) => {
    expect(cellsFromKey(key)).toBeNull();
  });
});

describe('ids', () => {
  it('carry the side and the cells', () => {
    const id = customId('PAST', '10/10/11');
    expect(id).toBe('own:P:10/10/11');
    expect(parseCustomId(id)).toEqual({ team: 'PAST', key: '10/10/11', cells: normalizeCells(L) });
    expect(parseCustomId(customId('FUTURE', '11'))?.team).toBe('FUTURE');
  });
  it('refuses a bad id', () => {
    for (const bad of ['own:X:11', 'own:P:', 'own:P:1 1', 'stone', 'own:P:101', 7, null, undefined])
      expect(parseCustomId(bad)).toBeNull();
  });
});
