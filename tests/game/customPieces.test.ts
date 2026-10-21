// Your own shapes as pieces: placing, turning, cell-by-cell collision, hit points, saving,
// the saved list per player and side, and bad data.
import { describe, expect, it } from 'vitest';
import {
  basesOf,
  check,
  chooseSlot,
  chosenBase,
  deleteShape,
  freshBases,
  movePiece,
  newBuild,
  occupiedRects,
  ownedPieceIds,
  parseBases,
  pieceById,
  pieceScrap,
  placePiece,
  rectOf,
  repairBase,
  saveShape,
  saveSlot,
  shapesOf,
  toSaved,
  turnPiece,
  type BuildState,
  type Placed,
  type Pos,
} from '../../src/game/baseBuilder';
import { BASE_BUILDER as B } from '../../src/game/config';
import { customId, shapeKey, type Cell } from '../../src/game/customShapes';

const S = B.freeSteps;
const at = (x: number, y: number): Pos => ({ x, y, ox: 0, oy: 0 });
const L: Cell[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
];
const LID = customId('PAST', shapeKey(L));

const must = (r: ReturnType<typeof placePiece>): BuildState => {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r.state;
};

describe('a shape of your own as a piece', () => {
  it('is a real piece for its side, free, with a box and hit points by square', () => {
    const def = pieceById(LID)!;
    expect(def.team).toBe('PAST');
    expect(def.free).toBe(true);
    expect(pieceScrap(def)).toBeNull();
    expect([def.w, def.h]).toEqual([2, 3]);
    expect(def.hp).toBe(4 * B.hpPerCell);
    expect(def.cells).toHaveLength(4);
  });
  it('is not a piece when the id is bad', () => {
    expect(pieceById('own:P:101')).toBeUndefined();
    expect(pieceById('own:Q:11')).toBeUndefined();
    expect(pieceById(5)).toBeUndefined();
  });
  it('is not in the tray list of normal pieces', () => {
    expect(ownedPieceIds('PAST', [LID]).has(LID)).toBe(false);
    expect(ownedPieceIds('PAST', undefined).has(LID)).toBe(false);
  });
});

describe('placing', () => {
  it('places and keeps full hit points', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 8)));
    expect(s.pieces[0]).toMatchObject({ piece: LID, x: 4, y: 8, hp: 4 * B.hpPerCell });
  });
  it('refuses the other side', () => {
    const r = placePiece(newBuild('FUTURE'), LID, at(4, 8));
    expect(r).toEqual({ ok: false, reason: 'unknown' });
  });
  it('refuses a box that sticks out of the plot', () => {
    const r = placePiece(newBuild('PAST'), LID, at(23, 8));
    expect(r).toEqual({ ok: false, reason: 'outside' });
  });
  it('counts as one piece against the most pieces', () => {
    let s = newBuild('PAST');
    for (let i = 0; i < B.maxPieces; i++) {
      s = {
        ...s,
        pieces: [...s.pieces, { piece: 'stone', x: 0, y: 0, ox: 0, oy: 0, rot: 0, hp: 1 }],
      };
    }
    expect(placePiece(s, LID, at(4, 8))).toEqual({ ok: false, reason: 'full' });
  });
});

describe('collision uses the filled squares, not the box', () => {
  it('lets a brick sit in the empty corner of the L', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    // The L fills column 0 of rows 6 to 8 and column 1 of row 8. Column 1 of rows 6 and 7 is empty.
    const small = placePiece(s, 'tower', at(5, 6));
    expect(small.ok).toBe(true);
  });
  it('refuses a brick on a filled square', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    expect(placePiece(s, 'stone', at(4, 8))).toEqual({ ok: false, reason: 'overlap' });
    expect(placePiece(s, 'stone', at(5, 8))).toEqual({ ok: false, reason: 'overlap' });
  });
  it('lets touching edges be', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    expect(placePiece(s, 'stone', at(6, 8)).ok).toBe(true);
  });
  it('works one step at a time with Snap off', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    const edge: Placed = { piece: 'tower', x: 5, y: 6, ox: 0, oy: 0, rot: 0, hp: 1 };
    // One step left of the empty corner starts to cover column 0.
    expect(check(s.pieces, { ...edge, x: 4, ox: S - 1 })).toBe('overlap');
    expect(check(s.pieces, edge)).toBeNull();
  });
  it('two shapes can hook into each other', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    // A second L (1 wide arm up) fits into the corner above the first one's foot.
    const hook = customId(
      'PAST',
      shapeKey([
        [0, 0],
        [1, 0],
      ]),
    );
    expect(placePiece(s, hook, at(5, 7)).ok).toBe(true);
    expect(placePiece(s, hook, at(4, 7))).toEqual({ ok: false, reason: 'overlap' });
  });
  it('gives one box per filled square', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    const boxes = occupiedRects(s.pieces[0]!);
    expect(boxes).toHaveLength(4);
    expect(boxes[0]).toEqual({ l: 4 * S, t: 6 * S, r: 5 * S, b: 7 * S });
    expect(occupiedRects({ ...s.pieces[0]!, piece: 'stone' })).toHaveLength(1);
    expect(occupiedRects({ ...s.pieces[0]!, piece: 'nope' })).toEqual([]);
  });
});

describe('turning', () => {
  it('turns the cells and swaps the box', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    const t = turnPiece(s, 0);
    if (!t.ok) throw new Error('turn');
    const p = t.state.pieces[0]!;
    expect(p.rot).toBe(90);
    const r = rectOf(p)!;
    expect([(r.r - r.l) / S, (r.b - r.t) / S]).toEqual([3, 2]);
    expect(occupiedRects(p)).toHaveLength(4);
    const cols = new Set(occupiedRects(p).map((q) => (q.l - r.l) / S));
    expect([...cols].sort()).toEqual([0, 1, 2]);
  });
  it('four turns come back to the start', () => {
    let s = must(placePiece(newBuild('PAST'), LID, at(8, 6)));
    const start = occupiedRects(s.pieces[0]!);
    for (let i = 0; i < 4; i++) {
      const t = turnPiece(s, 0);
      if (!t.ok) throw new Error('turn');
      s = t.state;
    }
    expect(s.pieces[0]!.rot).toBe(0);
    expect(occupiedRects(s.pieces[0]!)).toEqual(start);
  });
  it('slides to a free spot when a turned shape would hit something', () => {
    let s = must(placePiece(newBuild('PAST'), LID, at(8, 6)));
    s = must(placePiece(s, 'long', at(9, 6)));
    const t = turnPiece(s, 0);
    expect(t.ok).toBe(true);
  });
  it('moves like any piece', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    expect(movePiece(s, 0, at(10, 6)).ok).toBe(true);
    expect(movePiece(s, 0, at(23, 6)).ok).toBe(false);
  });
});

describe('saving a base with a shape in it', () => {
  it('keeps the id in the save, so old saves are untouched', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6), 90));
    const saved = toSaved(s.pieces);
    expect(saved.p[0]![0]).toBe(LID);
    expect(saved.p[0]![5]).toBe(90);
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
    const old = toSaved(must(placePiece(newBuild('PAST'), 'stone', at(1, 1))).pieces);
    expect(Object.keys(old)).toEqual(['v', 'p']);
  });
  it('loads again with the shape, even with no saved list at all', () => {
    const s = must(placePiece(newBuild('PAST'), LID, at(4, 6), 90));
    const back = repairBase(toSaved(s.pieces), 'PAST', ownedPieceIds('PAST', []));
    expect(back).toEqual(s.pieces);
  });
  it('drops a shape for the other side, a bad id, bad hit points and overlaps', () => {
    const row = (id: string, x: number, hp = 32): unknown[] => [id, x, 6, 0, 0, 0, hp];
    const raw = {
      v: 1,
      p: [
        row(LID, 2),
        row(LID, 2),
        row(customId('FUTURE', '11'), 8),
        row('own:P:1x1', 10),
        row('own:P:101', 12),
        row(LID, 15, 9999),
        row(LID, 18, 0),
      ],
    };
    const out = repairBase(raw, 'PAST');
    expect(out.map((p) => p.x)).toEqual([2, 15, 18]);
    expect(out[1]!.hp).toBe(32);
    expect(out[2]!.hp).toBe(32);
  });
  it('cleans the shape in a hand-edited save at the slot level', () => {
    const state = parseBases({
      players: {
        alex: { PAST: { chosen: 0, slots: [{ v: 1, p: [['own:P:11/01/', 1, 1, 0, 0, 0, 5]] }] } },
      },
    })!;
    expect(chosenBase(state, 'alex', 'PAST')).toEqual([]);
  });
});

describe('my shapes: saved for each player and side', () => {
  const save = (
    st = freshBases(),
    name = 'Alex',
    team: 'PAST' | 'FUTURE' = 'PAST',
    cells: readonly Cell[] = L,
  ) => saveShape(st, name, team, cells);

  it('saves a shape and lists it', () => {
    const r = save();
    if (!r.ok) throw new Error(r.reason);
    expect(r.id).toBe(LID);
    expect(shapesOf(r.state, 'Alex', 'PAST')).toEqual(['10/10/11']);
    expect(shapesOf(r.state, 'ALEX ', 'PAST')).toEqual(['10/10/11']);
    expect(shapesOf(r.state, 'Alex', 'FUTURE')).toEqual([]);
    expect(shapesOf(r.state, 'Bo', 'PAST')).toEqual([]);
  });
  it('refuses empty, apart, too big and off-pad drawings', () => {
    const reason = (cells: readonly Cell[]) => {
      const r = save(freshBases(), 'Alex', 'PAST', cells);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason([])).toBe('empty');
    expect(
      reason([
        [0, 0],
        [2, 2],
      ]),
    ).toBe('apart');
    expect(
      reason(
        [0, 1, 2, 3].flatMap((c): Cell[] => [
          [c, 0],
          [c, 1],
          [c, 2],
        ]),
      ),
    ).toBe('big');
    expect(reason([[9, 9]])).toBe('outside');
  });
  it('refuses a duplicate, wherever it was drawn on the pad', () => {
    const first = save();
    if (!first.ok) throw new Error();
    const moved = L.map(([c, r]): Cell => [c + 2, r + 1]);
    const again = saveShape(first.state, 'Alex', 'PAST', moved);
    expect(again).toEqual({ ok: false, reason: 'duplicate' });
    expect(shapesOf(first.state, 'Alex', 'PAST')).toHaveLength(1);
  });
  it('keeps the same shape for the other side as its own', () => {
    const first = save();
    if (!first.ok) throw new Error();
    expect(saveShape(first.state, 'Alex', 'FUTURE', L).ok).toBe(true);
  });
  it('stops at the most shapes, and a delete makes room', () => {
    let st = freshBases();
    for (let n = 1; n <= B.maxShapes; n++) {
      const r = save(
        st,
        'Alex',
        'PAST',
        Array.from({ length: n }, (_, c): Cell => [c % 4, Math.floor(c / 4)]),
      );
      if (!r.ok) throw new Error(`shape ${n}: ${r.reason}`);
      st = r.state;
    }
    expect(shapesOf(st, 'Alex', 'PAST')).toHaveLength(B.maxShapes);
    expect(
      save(st, 'Alex', 'PAST', [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ]),
    ).toEqual({ ok: false, reason: 'full' });
    const gone = deleteShape(st, 'Alex', 'PAST', '1');
    expect(shapesOf(gone, 'Alex', 'PAST')).toHaveLength(B.maxShapes - 1);
    expect(
      save(gone, 'Alex', 'PAST', [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ]).ok,
    ).toBe(true);
  });
  it('refuses with no player name', () => {
    expect(save(freshBases(), '  ')).toEqual({ ok: false, reason: 'noname' });
  });
  it('deletes only that shape, and leaves a base that uses it alone', () => {
    const r = save();
    if (!r.ok) throw new Error();
    const built = must(placePiece(newBuild('PAST'), LID, at(4, 6)));
    let st = saveSlot(r.state, 'Alex', 'PAST', 0, built.pieces);
    st = chooseSlot(st, 'Alex', 'PAST', 0);
    const after = deleteShape(st, 'Alex', 'PAST', '10/10/11');
    expect(shapesOf(after, 'Alex', 'PAST')).toEqual([]);
    expect(chosenBase(after, 'Alex', 'PAST')).toEqual(built.pieces);
    expect(basesOf(after, 'Alex', 'PAST')).not.toHaveProperty('shapes');
    expect(deleteShape(after, 'Alex', 'PAST', 'zzz')).toBe(after);
  });
  it('survives saving a base and picking a slot', () => {
    const r = save();
    if (!r.ok) throw new Error();
    const st = chooseSlot(saveSlot(r.state, 'Alex', 'PAST', 1, []), 'Alex', 'PAST', 1);
    expect(shapesOf(st, 'Alex', 'PAST')).toEqual(['10/10/11']);
  });
  it('is cleaned when read from storage', () => {
    const raw = {
      players: {
        alex: {
          PAST: {
            chosen: 0,
            slots: [],
            shapes: ['10/10/11', '10/10/11', 'junk', 7, null, '101', '11'],
          },
          FUTURE: { chosen: 0, slots: [], shapes: 'nope' },
        },
        bo: { PAST: { chosen: 0, slots: [], shapes: Array.from({ length: 40 }, () => '1') } },
      },
    };
    const st = parseBases(raw)!;
    expect(shapesOf(st, 'alex', 'PAST')).toEqual(['10/10/11', '11']);
    expect(shapesOf(st, 'alex', 'FUTURE')).toEqual([]);
    expect(shapesOf(st, 'bo', 'PAST')).toEqual(['1']);
  });
  it('round trips through JSON', () => {
    const r = save();
    if (!r.ok) throw new Error();
    const back = parseBases(JSON.parse(JSON.stringify(r.state)));
    expect(shapesOf(back!, 'Alex', 'PAST')).toEqual(['10/10/11']);
  });
});
