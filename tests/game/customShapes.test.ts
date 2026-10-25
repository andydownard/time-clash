// Your own shapes: the drawing pad rules, the canonical key, turning, and bad data.
import { describe, expect, it } from 'vitest';
import {
  cellsFromKey,
  customId,
  defaultMaterial,
  forTeam,
  isConnected,
  materialOf,
  materialsOf,
  normalizeCells,
  parseCustomId,
  rotateCells,
  shapeHp,
  shapeKey,
  shapeNameProblem,
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
  it('uses a 6 by 6 pad, 12 squares, 8 saved shapes and 14-letter names', () => {
    expect(B.shapePad).toBe(6);
    expect(B.maxShapeCells).toBe(12);
    expect(B.maxShapes).toBe(8);
    expect(B.shapeNameMax).toBe(14);
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
    const twelve: Cell[] = [0, 1, 2, 3, 4, 5].flatMap((c): Cell[] => [
      [c, 0],
      [c, 1],
    ]);
    expect(shapeProblem(twelve)).toBeNull();
    expect(shapeProblem([...twelve, [0, 2]])).toBe('big');
  });
  it('allows a shape that is not a box, such as a U or a plus', () => {
    const u: Cell[] = [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 0],
    ];
    expect(shapeProblem(u)).toBeNull();
    expect(
      shapeProblem([
        [1, 0],
        [0, 1],
        [1, 1],
        [2, 1],
        [1, 2],
      ]),
    ).toBeNull();
  });
  it('refuses squares off the pad and bad numbers', () => {
    expect(shapeProblem([[6, 0]])).toBe('outside');
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
    ['too wide', '1111111'],
    ['too tall', '1/1/1/1/1/1/1'],
    ['apart', '101'],
    ['too many squares', '111111/111111/1'],
    ['not trimmed', '110/110/000'],
    ['an unknown material letter', '1x'],
    ['a material letter in caps', '1W'],
  ])('refuses %s', (_why, key) => {
    expect(cellsFromKey(key)).toBeNull();
  });
});

describe('materials', () => {
  it('gives each side four materials, its own first, each with its own sturdiness', () => {
    expect(materialsOf('PAST')).toEqual(['stone', 'wood', 'glass', 'jelly']);
    expect(materialsOf('FUTURE')).toEqual(['panel', 'metal', 'glass', 'jelly']);
    expect(defaultMaterial('PAST')).toBe('stone');
    expect(defaultMaterial('FUTURE')).toBe('panel');
    for (const team of ['PAST', 'FUTURE'] as const) {
      const hp = materialsOf(team).map((m) => B.materialHp[m]);
      expect(new Set(hp).size).toBe(hp.length);
      expect(hp.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    }
    // The default keeps the old 8 a square, so a shape saved before materials is as strong.
    expect(B.materialHp.stone).toBe(8);
    expect(B.materialHp.panel).toBe(8);
  });
  it('reads a square with no material as the side default', () => {
    expect(materialOf('PAST', [0, 0])).toBe('stone');
    expect(materialOf('FUTURE', [0, 0])).toBe('panel');
    expect(materialOf('PAST', [0, 0, 'glass'])).toBe('glass');
  });
  it('adds up hit points from each square material', () => {
    const mixed: Cell[] = [
      [0, 0, 'wood'],
      [1, 0],
      [2, 0, 'glass'],
      [2, 1, 'jelly'],
    ];
    expect(shapeHp('PAST', mixed)).toBe(5 + 8 + 3 + 6);
    expect(shapeHp('PAST', L)).toBe(4 * 8);
    expect(shapeHp('FUTURE', [[0, 0, 'metal']])).toBe(12);
  });
  it('writes a material letter in the key, and the default stays 1', () => {
    const cells: Cell[] = [
      [0, 0, 'wood'],
      [1, 0],
      [1, 1, 'glass'],
    ];
    expect(shapeKey(cells)).toBe('w1/0g');
    expect(cellsFromKey('w1/0g')).toEqual([
      [0, 0, 'wood'],
      [1, 0],
      [1, 1, 'glass'],
    ]);
  });
  it('the same squares in another material are another shape', () => {
    expect(shapeKey([[0, 0, 'wood']])).not.toBe(shapeKey([[0, 0]]));
  });
  it('forTeam trims the shape and drops a material that is the side default', () => {
    expect(
      forTeam('PAST', [
        [2, 2, 'stone'],
        [3, 2, 'wood'],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0, 'wood'],
    ]);
  });
  it('turning keeps each square material', () => {
    const cells: Cell[] = [
      [0, 0, 'wood'],
      [0, 1],
    ];
    expect(rotateCells(cells, 90)).toEqual([
      [0, 0],
      [1, 0, 'wood'],
    ]);
    expect(shapeKey(rotateCells(cells, 180))).toBe('1/w');
  });
  it('refuses a material the side does not have, or a made-up one', () => {
    expect(shapeProblem([[0, 0, 'metal']], 'PAST')).toBe('material');
    expect(shapeProblem([[0, 0, 'wood']], 'FUTURE')).toBe('material');
    expect(shapeProblem([[0, 0, 'lava' as never]])).toBe('material');
    expect(shapeProblem([[0, 0, 'metal']], 'FUTURE')).toBeNull();
    expect(cellsFromKey('m1', 'PAST')).toBeNull();
    expect(cellsFromKey('m1', 'FUTURE')).not.toBeNull();
  });
  it('a key that spells the default by its letter is not clean for that side', () => {
    expect(cellsFromKey('s1', 'PAST')).toBeNull();
    expect(cellsFromKey('p1', 'FUTURE')).toBeNull();
  });
  it('a shape of many materials still must be one piece joined by its sides', () => {
    expect(
      shapeProblem([
        [0, 0, 'wood'],
        [1, 1, 'glass'],
      ]),
    ).toBe('apart');
  });
});

describe('names', () => {
  it('allows short names of letters, numbers and spaces', () => {
    expect(shapeNameProblem('Tower 2')).toBeNull();
    expect(shapeNameProblem('Big jelly top')).toBeNull();
  });
  it('refuses long names, odd letters, blocked words and a player name', () => {
    expect(shapeNameProblem('A very long shape')).toBe('long');
    expect(shapeNameProblem('<b>hi</b>')).toBe('letters');
    expect(shapeNameProblem('Poop tower')).toBe('blocked');
    expect(shapeNameProblem('Alex wall', ['Alex'])).toBe('private');
    expect(shapeNameProblem('   ')).toBe('empty');
    expect(shapeNameProblem(7)).toBe('empty');
  });
});

describe('ids', () => {
  it('carry the side and the cells', () => {
    const id = customId('PAST', '10/10/11');
    expect(id).toBe('own:P:10/10/11');
    expect(parseCustomId(id)).toEqual({ team: 'PAST', key: '10/10/11', cells: normalizeCells(L) });
    expect(parseCustomId(customId('FUTURE', '11'))?.team).toBe('FUTURE');
  });
  it('carry the materials too', () => {
    const id = customId('FUTURE', 'm1/0g');
    expect(parseCustomId(id)?.cells).toEqual([
      [0, 0, 'metal'],
      [1, 0],
      [1, 1, 'glass'],
    ]);
  });
  it('refuses a bad id', () => {
    for (const bad of [
      'own:X:11',
      'own:P:',
      'own:P:1 1',
      'stone',
      'own:P:101',
      'own:P:m1',
      'own:F:w1',
      'own:P:s1',
      7,
      null,
      undefined,
    ])
      expect(parseCustomId(bad)).toBeNull();
  });
});
