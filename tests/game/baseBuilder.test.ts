// Base builder rules: the catalog, placing, turning, undo, saving, and bad saved data.
import { describe, expect, it } from 'vitest';
import {
  PIECES,
  emptySpots,
  PLOT_STEPS,
  baseBuilderOn,
  basesOf,
  check,
  chooseSlot,
  chosenBase,
  clampToPlot,
  clearBuild,
  findSpot,
  footprint,
  freshBases,
  movePiece,
  newBuild,
  ownedPieceIds,
  parseBases,
  pieceById,
  pieceScrap,
  piecesOf,
  placePiece,
  positionFromPoint,
  rectOf,
  removePiece,
  repairBase,
  saveSlot,
  serializeBase,
  slotPieces,
  toSaved,
  turnPiece,
  undoBuild,
  type BuildState,
  type Placed,
  type Pos,
} from '../../src/game/baseBuilder';
import { BASE_BUILDER as B } from '../../src/game/config';

const S = B.freeSteps;
const at = (x: number, y: number): Pos => ({ x, y, ox: 0, oy: 0 });
const groundRow = B.rows - B.groundRows - 1;

type Rot = 0 | 90 | 180 | 270;
function placeAll(
  state: BuildState,
  list: Array<[string, number, number] | [string, number, number, Rot]>,
) {
  let s = state;
  for (const [id, x, y, rot] of list) {
    const r = placePiece(s, id, at(x, y), rot ?? 0);
    if (!r.ok) throw new Error(`could not place ${id}: ${r.reason}`);
    s = r.state;
  }
  return s;
}

describe('catalog', () => {
  it('has unique ids and real sizes and hit points', () => {
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
    for (const p of PIECES) {
      expect(p.w).toBeGreaterThanOrEqual(1);
      expect(p.h).toBeGreaterThanOrEqual(1);
      expect(p.hp).toBeGreaterThan(0);
    }
  });
  it('gives each team free pieces and locked pieces', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      expect(piecesOf(team).filter((p) => p.free).length).toBeGreaterThanOrEqual(4);
      expect(piecesOf(team).filter((p) => !p.free).length).toBeGreaterThanOrEqual(3);
    }
    expect(piecesOf('FUTURE').map((p) => p.id)).toEqual(
      expect.arrayContaining(['panel', 'solar', 'antenna', 'laserBase', 'hangarDoor', 'powerCore']),
    );
  });
  it('a piece costs Scrap exactly when it is locked, and every cost is a whole number above 0', () => {
    for (const p of PIECES) {
      const cost = pieceScrap(p);
      if (p.free) expect(cost).toBeNull();
      else {
        expect(Number.isInteger(cost)).toBe(true);
        expect(cost as number).toBeGreaterThan(0);
      }
    }
  });
  it('owned pieces are the free ones plus the unlocked ones of the same team', () => {
    expect(ownedPieceIds('PAST', undefined).has('arch')).toBe(false);
    expect(ownedPieceIds('PAST', ['arch', 'laserBase', 'nope']).has('arch')).toBe(true);
    expect(ownedPieceIds('PAST', ['laserBase']).has('laserBase')).toBe(false);
    expect(ownedPieceIds('PAST', undefined).has('stone')).toBe(true);
  });
  it('is off by default and the query string turns it on', () => {
    expect(B.enabled).toBe(false);
    expect(baseBuilderOn('')).toBe(false);
    expect(baseBuilderOn('?builder=1')).toBe(true);
    expect(baseBuilderOn('?e2e=1&builder=1')).toBe(true);
    expect(baseBuilderOn('?builder=0')).toBe(false);
    expect(baseBuilderOn('?builder=true')).toBe(false);
  });
});

describe('placing', () => {
  const empty = newBuild('PAST');

  it('puts a brick inside the plot and keeps its hit points', () => {
    const r = placePiece(empty, 'stone', at(3, groundRow));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.pieces).toHaveLength(1);
      expect(r.state.pieces[0]!.hp).toBe(pieceById('stone')!.hp);
    }
  });
  it('never changes the state it was given', () => {
    const r = placePiece(empty, 'stone', at(3, 3));
    expect(empty.pieces).toHaveLength(0);
    expect(r.ok && r.state).not.toBe(empty);
  });
  it('refuses a brick outside the plot on every side, and in the foundation rows', () => {
    expect(placePiece(empty, 'stone', at(-1, 3))).toEqual({ ok: false, reason: 'outside' });
    expect(placePiece(empty, 'stone', at(B.cols - 1, 3))).toEqual({ ok: false, reason: 'outside' });
    expect(placePiece(empty, 'stone', at(3, -1))).toEqual({ ok: false, reason: 'outside' });
    expect(placePiece(empty, 'stone', at(3, groundRow + 1))).toEqual({
      ok: false,
      reason: 'outside',
    });
    expect(placePiece(empty, 'stone', at(B.cols - 2, groundRow)).ok).toBe(true);
    expect(placePiece(empty, 'stone', at(0, 0)).ok).toBe(true);
  });
  it('refuses a free offset that pushes the brick out', () => {
    const r = placePiece(empty, 'stone', { x: B.cols - 2, y: 3, ox: 1, oy: 0 });
    expect(r).toEqual({ ok: false, reason: 'outside' });
  });
  it('refuses two bricks in the same spot, but touching edges are fine', () => {
    const one = placeAll(empty, [['stone', 3, 5]]);
    expect(placePiece(one, 'stone', at(3, 5))).toEqual({ ok: false, reason: 'overlap' });
    expect(placePiece(one, 'stone', at(4, 5))).toEqual({ ok: false, reason: 'overlap' });
    expect(placePiece(one, 'stone', at(5, 5)).ok).toBe(true);
    expect(placePiece(one, 'stone', at(3, 6)).ok).toBe(true);
    expect(placePiece(one, 'stone', at(3, 4)).ok).toBe(true);
  });
  it('lets a brick stand on another, hang beside a wall, and float with no support', () => {
    const wall = placeAll(empty, [['tower', 5, groundRow - 1]]);
    expect(placePiece(wall, 'stone', at(6, groundRow - 1)).ok).toBe(true);
    expect(placePiece(wall, 'stone', at(3, groundRow - 1)).ok).toBe(true);
    expect(placePiece(wall, 'plank', at(10, 0)).ok).toBe(true);
  });
  it('lets a free offset sit between whole cells, and still refuses a real overlap', () => {
    const tight = placeAll(empty, [['tower', 2, 5]]);
    expect(placePiece(tight, 'tower', { x: 3, y: 5, ox: 4, oy: 0 }).ok).toBe(true);
    expect(placePiece(tight, 'tower', { x: 2, y: 5, ox: 4, oy: 0 })).toEqual({
      ok: false,
      reason: 'overlap',
    });
    expect(placePiece(tight, 'tower', { x: 3, y: 6, ox: 0, oy: 4 }).ok).toBe(true);
    expect(placePiece(tight, 'tower', { x: 2, y: 6, ox: 0, oy: 4 })).toEqual({
      ok: false,
      reason: 'overlap',
    });
  });
  it('refuses a piece that is unknown or belongs to the other team', () => {
    expect(placePiece(empty, 'nope', at(1, 1))).toEqual({ ok: false, reason: 'unknown' });
    expect(placePiece(empty, 'panel', at(1, 1))).toEqual({ ok: false, reason: 'unknown' });
    expect(placePiece(newBuild('FUTURE'), 'stone', at(1, 1))).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
  it('refuses a bad offset (negative, too big, or a fraction)', () => {
    for (const bad of [{ ox: -1 }, { ox: S }, { oy: 0.5 }, { oy: Number.NaN }]) {
      const r = placePiece(empty, 'stone', { ...at(3, 3), ...bad });
      expect(r).toEqual({ ok: false, reason: 'unknown' });
    }
  });
  it('stops at the most bricks a base can hold', () => {
    let s = empty;
    for (let i = 0; i < B.maxPieces; i++) {
      s = {
        ...s,
        pieces: [...s.pieces, { piece: 'stone', x: 0, y: 0, ox: 0, oy: 0, rot: 0, hp: 1 }],
      };
    }
    expect(placePiece(s, 'stone', at(10, 10))).toEqual({ ok: false, reason: 'full' });
  });
  it('rect and footprint swap width and height for a quarter turn', () => {
    const tower = pieceById('tower')!;
    expect(footprint(tower, 0)).toEqual({ w: 1, h: 2 });
    expect(footprint(tower, 90)).toEqual({ w: 2, h: 1 });
    expect(footprint(tower, 180)).toEqual({ w: 1, h: 2 });
    expect(footprint(tower, 270)).toEqual({ w: 2, h: 1 });
    const r = rectOf({ piece: 'tower', x: 2, y: 3, ox: 1, oy: 2, rot: 90, hp: 1 })!;
    expect(r).toEqual({ l: 2 * S + 1, t: 3 * S + 2, r: 2 * S + 1 + 2 * S, b: 3 * S + 2 + S });
  });
});

describe('turning', () => {
  it('turns about the middle and goes through four turns back to where it began', () => {
    let s = placeAll(newBuild('PAST'), [['long', 8, 5]]);
    const start = s.pieces[0]!;
    for (let i = 0; i < 4; i++) {
      const r = turnPiece(s, 0);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
    expect(s.pieces[0]).toEqual(start);
  });
  it('a quarter turn swaps the footprint and stays inside the plot at every edge', () => {
    const spots: Array<[number, number]> = [
      [0, 0],
      [B.cols - 4, 0],
      [0, groundRow],
      [B.cols - 4, groundRow],
    ];
    for (const [x, y] of spots) {
      const s = placeAll(newBuild('PAST'), [['long', x, y]]);
      const r = turnPiece(s, 0);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const p = r.state.pieces[0]!;
        expect(p.rot).toBe(90);
        const rect = rectOf(p)!;
        expect(rect.l).toBeGreaterThanOrEqual(0);
        expect(rect.t).toBeGreaterThanOrEqual(0);
        expect(rect.r).toBeLessThanOrEqual(PLOT_STEPS.w);
        expect(rect.b).toBeLessThanOrEqual(PLOT_STEPS.h);
      }
    }
  });
  it('slides to the nearest free spot when the turned brick would overlap', () => {
    const s = placeAll(newBuild('PAST'), [
      ['long', 4, 5],
      ['stone', 5, 4],
    ]);
    const r = turnPiece(s, 0);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(
        check(
          r.state.pieces.filter((_, i) => i !== 0),
          r.state.pieces[0]!,
        ),
      ).toBeNull();
  });
  it('says no when there is no room anywhere near', () => {
    // Fill the whole plot with stones, then free one stone and try to turn a long brick in it.
    let pieces: Placed[] = [];
    for (let y = 0; y <= groundRow; y++)
      for (let x = 0; x < B.cols; x += 2)
        pieces.push({ piece: 'stone', x, y, ox: 0, oy: 0, rot: 0, hp: 1 });
    pieces = pieces.filter((p) => !(p.y === 3 && p.x >= 4 && p.x <= 6));
    pieces.push({ piece: 'plank', x: 4, y: 3, ox: 0, oy: 0, rot: 0, hp: 1 });
    pieces = pieces.slice(0, B.maxPieces + 100);
    const s: BuildState = { team: 'PAST', pieces, spots: emptySpots(), undo: [] };
    const idx = pieces.length - 1;
    expect(turnPiece(s, idx)).toEqual({ ok: false, reason: 'overlap' });
  });
  it('turning a missing brick does nothing', () => {
    expect(turnPiece(newBuild('PAST'), 0)).toEqual({ ok: false, reason: 'nothing' });
  });
});

describe('moving, removing, clearing and undo', () => {
  it('moves a brick, refuses an overlap, and ignores itself', () => {
    const s = placeAll(newBuild('PAST'), [
      ['stone', 2, 5],
      ['stone', 8, 5],
    ]);
    expect(movePiece(s, 0, at(2, 6)).ok).toBe(true);
    expect(movePiece(s, 0, at(3, 5)).ok).toBe(true);
    expect(movePiece(s, 0, at(7, 5))).toEqual({ ok: false, reason: 'overlap' });
    expect(movePiece(s, 5, at(1, 1))).toEqual({ ok: false, reason: 'nothing' });
  });
  it('removes one brick', () => {
    const s = placeAll(newBuild('PAST'), [
      ['stone', 2, 5],
      ['stone', 8, 5],
    ]);
    const r = removePiece(s, 0);
    expect(r.ok && r.state.pieces.map((p) => p.x)).toEqual([8]);
    expect(removePiece(s, 9)).toEqual({ ok: false, reason: 'nothing' });
  });
  it('Clear takes everything off and Undo brings it back', () => {
    const s = placeAll(newBuild('PAST'), [
      ['stone', 2, 5],
      ['stone', 8, 5],
    ]);
    const cleared = clearBuild(s);
    expect(cleared.pieces).toHaveLength(0);
    expect(undoBuild(cleared).pieces).toHaveLength(2);
    expect(clearBuild(cleared)).toBe(cleared);
  });
  it('Undo walks back one step at a time and stops at the start', () => {
    const s0 = newBuild('PAST');
    const s1 = placeAll(s0, [['stone', 2, 5]]);
    const s2 = placeAll(s1, [['stone', 8, 5]]);
    expect(undoBuild(s2).pieces).toHaveLength(1);
    expect(undoBuild(undoBuild(s2)).pieces).toHaveLength(0);
    expect(undoBuild(undoBuild(undoBuild(s2)))).toEqual(undoBuild(undoBuild(s2)));
    expect(undoBuild(s0)).toBe(s0);
  });
  it('Undo reverses a turn and a move', () => {
    const s = placeAll(newBuild('PAST'), [['long', 8, 5]]);
    const turned = turnPiece(s, 0);
    if (!turned.ok) throw new Error('turn');
    expect(undoBuild(turned.state).pieces[0]!.rot).toBe(0);
    const moved = movePiece(s, 0, at(2, 2));
    if (!moved.ok) throw new Error('move');
    expect(undoBuild(moved.state).pieces[0]!.x).toBe(8);
  });
  it('remembers at most undoDepth steps', () => {
    let s = newBuild('PAST');
    for (let i = 0; i < B.undoDepth + 10; i++) {
      const r = movePiece(i === 0 ? placeAll(s, [['stone', 0, 0]]) : s, 0, at(i % 2 ? 4 : 2, 0));
      if (!r.ok) throw new Error('move');
      s = r.state;
    }
    expect(s.undo.length).toBeLessThanOrEqual(B.undoDepth);
  });
});

describe('positions', () => {
  it('Snap rounds to whole cells and Snap off keeps finer steps', () => {
    expect(positionFromPoint(3.4, 5.6, true)).toEqual({ x: 3, y: 6, ox: 0, oy: 0 });
    expect(positionFromPoint(3.5, 5.49, true)).toEqual({ x: 4, y: 5, ox: 0, oy: 0 });
    expect(positionFromPoint(3.5, 5.25, false)).toEqual({ x: 3, y: 5, ox: S / 2, oy: S / 4 });
    expect(positionFromPoint(-0.5, -1.25, false)).toEqual({
      x: -1,
      y: -2,
      ox: S / 2,
      oy: S * 0.75,
    });
  });
  it('clamps a drop near an edge back inside, for any turn', () => {
    const long = pieceById('long')!;
    expect(clampToPlot(long, 0, at(-5, -5))).toEqual(at(0, 0));
    expect(clampToPlot(long, 0, at(100, 100))).toEqual(at(B.cols - 4, groundRow));
    expect(clampToPlot(long, 90, at(100, 100))).toEqual(at(B.cols - 1, groundRow - 3));
    expect(
      check([], { piece: 'long', ...clampToPlot(long, 90, at(100, 100)), rot: 90, hp: 1 }),
    ).toBeNull();
  });
  it('finds the nearest free spot, or null when none is near', () => {
    const s = placeAll(newBuild('PAST'), [['stone', 5, 5]]);
    const cand: Placed = { piece: 'stone', ...at(5, 5), rot: 0, hp: 1 };
    const spot = findSpot(s.pieces, cand, null)!;
    expect(check(s.pieces, { ...cand, ...spot })).toBeNull();
    expect(findSpot(s.pieces, { ...cand, piece: 'nope' }, null)).toBeNull();
    expect(findSpot(s.pieces, cand, null, 0)).toBeNull();
  });
});

describe('saving and bad saved data', () => {
  const sample = placeAll(newBuild('PAST'), [
    ['long', 4, groundRow],
    ['tower', 5, groundRow - 2],
    ['arch', 9, groundRow - 1, 90],
  ]).pieces;

  it('round trips through a small JSON', () => {
    const json = serializeBase(sample);
    expect(json.length).toBeLessThan(200);
    expect(repairBase(json, 'PAST')).toEqual(sample);
    expect(repairBase(toSaved(sample), 'PAST')).toEqual(sample);
  });
  it('rejects things that are not a saved base', () => {
    for (const bad of [null, undefined, 7, 'x', '{', '[]', [], {}, { p: 5 }, { v: 1 }, true]) {
      expect(repairBase(bad, 'PAST')).toEqual([]);
    }
  });
  it('drops bad bricks and keeps the good ones', () => {
    const raw = {
      v: 1,
      p: [
        ['stone', 1, 1, 0, 0, 0, 20],
        ['nope', 3, 3, 0, 0, 0, 5],
        ['panel', 3, 3, 0, 0, 0, 5],
        ['stone', 1.5, 1, 0, 0, 0, 5],
        ['stone', 5, 5, 0, 0, 45, 5],
        ['stone', 5, 5, 99, 0, 0, 5],
        ['stone', 99, 5, 0, 0, 0, 5],
        ['stone', 1, 1, 0, 0, 0, 20],
        'junk',
        ['stone'],
        null,
        ['stone', 8, 8, 0, 0, 0, 20],
      ],
    };
    expect(repairBase(raw, 'PAST').map((p) => [p.piece, p.x, p.y])).toEqual([
      ['stone', 1, 1],
      ['stone', 8, 8],
    ]);
  });
  it('caps hit points at full strength and fills a bad value', () => {
    const raw = {
      v: 1,
      p: [
        ['stone', 1, 1, 0, 0, 0, 9999],
        ['stone', 5, 1, 0, 0, 0, -3],
        ['stone', 9, 1, 0, 0, 0, 'x'],
      ],
    };
    const full = pieceById('stone')!.hp;
    expect(repairBase(raw, 'PAST').map((p) => p.hp)).toEqual([full, full, full]);
    const half = { v: 1, p: [['stone', 1, 1, 0, 0, 0, 5]] };
    expect(repairBase(half, 'PAST')[0]!.hp).toBe(5);
  });
  it('drops pieces the player does not own when asked to', () => {
    const raw = toSaved(sample);
    const owned = ownedPieceIds('PAST', undefined);
    expect(repairBase(raw, 'PAST', owned).map((p) => p.piece)).toEqual(['long', 'tower']);
    expect(repairBase(raw, 'PAST', ownedPieceIds('PAST', ['arch']))).toHaveLength(3);
  });
  it('drops the other team pieces', () => {
    expect(repairBase(toSaved(sample), 'FUTURE')).toEqual([]);
  });
  it('keeps no more than the most bricks, even from a huge file', () => {
    const rows = Array.from({ length: 5000 }, (_, i) => [
      'plank',
      i % 24,
      Math.floor(i / 24) % 11,
      0,
      0,
      0,
      1,
    ]);
    expect(repairBase({ v: 1, p: rows }, 'PAST').length).toBeLessThanOrEqual(B.maxPieces);
  });
});

describe('three saved bases per player and side', () => {
  const one = placeAll(newBuild('PAST'), [['stone', 2, 5]]).pieces;

  it('starts with three empty slots and slot 1 chosen', () => {
    const t = basesOf(freshBases(), 'Alex', 'PAST');
    expect(t.slots).toEqual([null, null, null]);
    expect(t.chosen).toBe(0);
  });
  it('keeps a base in a slot and chooses it', () => {
    let st = saveSlot(freshBases(), 'Alex', 'PAST', 1, one);
    st = chooseSlot(st, 'Alex', 'PAST', 1);
    expect(basesOf(st, 'Alex', 'PAST').chosen).toBe(1);
    expect(slotPieces(st, 'Alex', 'PAST', 1)).toEqual(one);
    expect(slotPieces(st, 'Alex', 'PAST', 0)).toEqual([]);
    expect(chosenBase(st, 'Alex', 'PAST')).toEqual(one);
  });
  it('finds a player by name without caring about capitals or spaces, and keeps sides apart', () => {
    const st = saveSlot(freshBases(), 'Alex', 'PAST', 0, one);
    expect(chosenBase(st, '  alex ', 'PAST')).toEqual(one);
    expect(chosenBase(st, 'ALEX', 'FUTURE')).toEqual([]);
    expect(chosenBase(st, 'Sam', 'PAST')).toEqual([]);
  });
  it('an empty base empties the slot, and bad slots or names change nothing', () => {
    const st = saveSlot(freshBases(), 'Alex', 'PAST', 0, one);
    expect(basesOf(saveSlot(st, 'Alex', 'PAST', 0, []), 'Alex', 'PAST').slots[0]).toBeNull();
    for (const bad of [-1, 3, 1.5, Number.NaN]) {
      expect(saveSlot(st, 'Alex', 'PAST', bad, one)).toBe(st);
      expect(chooseSlot(st, 'Alex', 'PAST', bad)).toBe(st);
    }
    expect(saveSlot(st, '   ', 'PAST', 0, one)).toBe(st);
  });
  it('never changes the state it was given', () => {
    const before = JSON.stringify(freshBases());
    const fresh = freshBases();
    saveSlot(fresh, 'Alex', 'PAST', 0, one);
    expect(JSON.stringify(fresh)).toBe(before);
  });
  it('repairs hand-edited storage', () => {
    expect(parseBases(null)).toBeNull();
    expect(parseBases([])).toBeNull();
    expect(parseBases({})).toBeNull();
    const parsed = parseBases({
      players: {
        '  ALEX ': {
          PAST: { chosen: 9, slots: [toSaved(one), 'junk', { p: [['nope']] }, toSaved(one)] },
          FUTURE: 'x',
        },
        '   ': { PAST: {} },
        Sam: 5,
      },
    })!;
    expect(Object.keys(parsed.players)).toEqual(['alex']);
    const t = parsed.players.alex!.PAST;
    expect(t.chosen).toBe(0);
    expect(t.slots).toHaveLength(B.slots);
    expect(t.slots[0]).toEqual(toSaved(one));
    expect(t.slots[1]).toBeNull();
    expect(t.slots[2]).toBeNull();
    expect(parsed.players.alex!.FUTURE.slots).toEqual([null, null, null]);
  });
  it('keeps at most maxPlayers names', () => {
    const players = Object.fromEntries(
      Array.from({ length: B.maxPlayers + 20 }, (_, i) => [
        `p${i}`,
        { PAST: { chosen: 0, slots: [] } },
      ]),
    );
    expect(Object.keys(parseBases({ players })!.players)).toHaveLength(B.maxPlayers);
  });
});
