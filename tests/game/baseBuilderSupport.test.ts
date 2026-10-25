// The support rule in the builder: a brick goes only where it is held up all the way down to the
// ground. A brick that holds another cannot be taken away. Old floating bases settle on load.
import { describe, expect, it } from 'vitest';
import {
  baseWasSettled,
  chooseSlot,
  chosenBase,
  chosenSpots,
  clearBuild,
  dropOnto,
  findSpot,
  PLOT_STEPS,
  heldUp,
  isHolding,
  landingFor,
  movePiece,
  newBuild,
  piecesOf,
  placePiece,
  placeProblem,
  rectOf,
  removePiece,
  repairBase,
  repairSpots,
  restOverlap,
  settleBase,
  slotPieces,
  turnPiece,
  undoBuild,
  type BasesState,
  type BuildState,
  type Placed,
  type Pos,
  type Rotation,
} from '../../src/game/baseBuilder';
import { createBuilt } from '../../src/game/builtBase';
import { BASE_BUILDER as B } from '../../src/game/config';
import { customId, shapeKey } from '../../src/game/customShapes';
import { createRng } from '../../src/game/rng';

const S = B.freeSteps;
/** The lowest buildable row: a one-high brick here stands on the foundation. */
const G = B.rows - B.groundRows - 1;
const at = (x: number, y: number, ox = 0, oy = 0): Pos => ({ x, y, ox, oy });
const brick = (piece: string, x: number, y: number, ox = 0, oy = 0, rot: Rotation = 0): Placed => ({
  piece,
  x,
  y,
  ox,
  oy,
  rot,
  hp: 10,
});

type Row = [string, number, number] | [string, number, number, number];
function build(list: Row[]): BuildState {
  let s = newBuild('PAST');
  for (const [id, x, y, ox] of list) {
    const r = placePiece(s, id, at(x, y, ox ?? 0));
    if (!r.ok) throw new Error(`could not place ${id} at ${x},${y}: ${r.reason}`);
    s = r.state;
  }
  return s;
}

const allHeld = (pieces: readonly Placed[]): boolean => heldUp(pieces).every(Boolean);
const withSlot = (raw: unknown): BasesState => ({
  players: {
    alex: {
      PAST: { chosen: 0, slots: [raw as never, null, null] },
      FUTURE: { chosen: 0, slots: [null, null, null] },
    },
  },
});

describe('what holds a brick up', () => {
  it('the foundation holds a brick whose bottom is the bottom of the plot', () => {
    expect(heldUp([brick('stone', 3, G)])).toEqual([true]);
    expect(heldUp([brick('stone', 3, G - 1)])).toEqual([false]);
  });
  it('a brick resting exactly on a held-up brick is held up, and so is the next one', () => {
    expect(
      heldUp([brick('stone', 3, G), brick('stone', 3, G - 1), brick('stone', 3, G - 2)]),
    ).toEqual([true, true, true]);
  });
  it('a gap of one free step is not resting', () => {
    const top = brick('stone', 3, G - 2, 0, S - 1);
    expect(restOverlap(top, brick('stone', 3, G))).toBe(0);
    expect(heldUp([brick('stone', 3, G), top])).toEqual([true, false]);
  });
  it('needs at least half a cell sideways: 4 steps hold, 3 steps do not', () => {
    expect(B.minSupportSteps).toBe(4);
    const base = brick('stone', 3, G);
    // The base covers steps 24 to 40. A stone 12 steps to the right overlaps it by 4.
    const four = brick('stone', 4, G - 1, 4);
    const three = brick('stone', 4, G - 1, 5);
    expect(restOverlap(four, base)).toBe(4);
    expect(restOverlap(three, base)).toBe(3);
    expect(heldUp([base, four])).toEqual([true, true]);
    expect(heldUp([base, three])).toEqual([true, false]);
  });
  it('a corner touch or a brick stuck to the side does not hold anything', () => {
    const base = brick('stone', 3, G);
    expect(heldUp([base, brick('stone', 5, G - 1)])).toEqual([true, false]);
    expect(heldUp([base, brick('stone', 1, G - 1)])).toEqual([true, false]);
    // A tower beside the stone, touching only its side, hangs in the air.
    expect(heldUp([base, brick('tower', 5, G - 2)])).toEqual([true, false]);
  });
  it('a brick resting only on a floating brick is not held up', () => {
    expect(heldUp([brick('stone', 3, G - 3), brick('stone', 3, G - 4)])).toEqual([false, false]);
  });
  it('two supports add up', () => {
    const left = brick('stone', 2, G);
    const right = brick('stone', 6, G);
    // A long stone over the gap sits on 1 cell of each.
    const bridge = brick('long', 3, G - 1);
    expect(heldUp([left, right, bridge])).toEqual([true, true, true]);
  });
  it('a shape of your own rests by its filled squares, not its box', () => {
    const L = customId(
      'PAST',
      shapeKey([
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
      ]),
    );
    // The L fills column 4 (rows G-2 to G) and column 5 of row G. Its box top is row G-2.
    const shape = brick(L, 4, G - 2);
    // A tower in the empty corner stands on the L's foot.
    expect(restOverlap(brick('tower', 5, G - 2), shape)).toBe(S);
    // A stone on the box top over the empty corner touches only the L's top square.
    expect(restOverlap(brick('stone', 4, G - 3), shape)).toBe(S);
    expect(restOverlap(brick('stone', 5, G - 3), shape)).toBe(0);
    expect(heldUp([shape, brick('stone', 5, G - 3)])).toEqual([true, false]);
  });
});

describe('placing needs support', () => {
  const empty = newBuild('PAST');
  it('refuses a brick in mid-air with the reason floating', () => {
    expect(placePiece(empty, 'stone', at(5, 3))).toEqual({ ok: false, reason: 'floating' });
    expect(placePiece(empty, 'stone', at(5, G - 1))).toEqual({ ok: false, reason: 'floating' });
  });
  it('takes a brick on the ground and a second layer on the first', () => {
    const s = build([
      ['stone', 5, G],
      ['stone', 5, G - 1],
      ['tower', 6, G - 3],
    ]);
    expect(s.pieces).toHaveLength(3);
    expect(allHeld(s.pieces)).toBe(true);
  });
  it('refuses a brick hanging off the side of a wall, and one on a corner', () => {
    const s = build([['tower', 5, G - 1]]);
    expect(placePiece(s, 'stone', at(6, G - 1))).toEqual({ ok: false, reason: 'floating' });
    expect(placePiece(s, 'stone', at(6, G - 2))).toEqual({ ok: false, reason: 'floating' });
    expect(placePiece(s, 'stone', at(5, G - 2)).ok).toBe(true);
  });
  it('checks overlap and the plot edge before support', () => {
    const s = build([['stone', 5, G]]);
    expect(placePiece(s, 'stone', at(5, G))).toEqual({ ok: false, reason: 'overlap' });
    expect(placePiece(s, 'stone', at(-1, 2))).toEqual({ ok: false, reason: 'outside' });
  });
  it('works at every edge of the plot: both bottom corners and the top row', () => {
    let s = build([
      ['stone', 0, G],
      ['stone', B.cols - 2, G],
    ]);
    for (let y = G - 1; y >= 0; y--) {
      const left = placePiece(s, 'stone', at(0, y));
      if (!left.ok) throw new Error(`left ${y}`);
      const right = placePiece(left.state, 'stone', at(B.cols - 2, y));
      if (!right.ok) throw new Error(`right ${y}`);
      s = right.state;
    }
    const tops = s.pieces.filter((p) => p.y === 0).map((p) => p.x);
    expect(tops).toEqual([0, B.cols - 2]);
    expect(allHeld(s.pieces)).toBe(true);
  });
});

describe('taking away, moving and turning a brick that holds another', () => {
  const stack = (): BuildState =>
    build([
      ['stone', 5, G],
      ['stone', 5, G - 1],
    ]);
  it('refuses to remove the bottom brick, and allows the top one, then the bottom', () => {
    const s = stack();
    expect(isHolding(s.pieces, 0)).toBe(true);
    expect(removePiece(s, 0)).toEqual({ ok: false, reason: 'holding' });
    const top = removePiece(s, 1);
    if (!top.ok) throw new Error('top');
    const bottom = removePiece(top.state, 0);
    expect(bottom.ok && bottom.state.pieces).toEqual([]);
  });
  it('lets a brick go when another brick still holds the one on top', () => {
    const s = build([
      ['stone', 2, G],
      ['stone', 4, G],
      ['long', 2, G - 1],
    ]);
    expect(removePiece(s, 0).ok).toBe(true);
    expect(removePiece(s, 1).ok).toBe(true);
  });
  it('refuses to drag the bottom brick away, but a short slide that still holds is fine', () => {
    const s = stack();
    expect(movePiece(s, 0, at(12, G))).toEqual({ ok: false, reason: 'holding' });
    const slid = movePiece(s, 0, at(5, G, 4));
    expect(slid.ok).toBe(true);
    if (slid.ok) expect(allHeld(slid.state.pieces)).toBe(true);
    // Sliding too far leaves less than half a cell under the top brick.
    expect(movePiece(s, 0, at(6, G, 5))).toEqual({ ok: false, reason: 'holding' });
  });
  it('refuses a move into mid-air, and takes a move onto another brick', () => {
    const s = build([
      ['stone', 2, G],
      ['stone', 8, G],
    ]);
    expect(movePiece(s, 0, at(2, G - 3))).toEqual({ ok: false, reason: 'floating' });
    const up = movePiece(s, 0, at(8, G - 1));
    expect(up.ok).toBe(true);
  });
  it('a brick cannot hold itself up when moved', () => {
    const s = build([['stone', 2, G]]);
    expect(movePiece(s, 0, at(2, G - 1))).toEqual({ ok: false, reason: 'floating' });
  });
  it('can move and turn in one step', () => {
    const s = build([['tower', 2, G - 1]]);
    const r = movePiece(s, 0, at(8, G), 90);
    expect(r.ok && r.state.pieces[0]).toMatchObject({ x: 8, y: G, rot: 90 });
    expect(movePiece(s, 0, at(8, G), 45 as Rotation)).toEqual({ ok: false, reason: 'unknown' });
  });
  it('refuses to turn a brick that holds another', () => {
    const s = build([
      ['long', 4, G],
      ['stone', 5, G - 1],
    ]);
    expect(turnPiece(s, 0)).toEqual({ ok: false, reason: 'holding' });
    expect(turnPiece(s, 1).ok).toBe(true);
  });
  it('a turned brick lands on what is under it', () => {
    const s = build([['tower', 5, G - 1]]);
    const r = turnPiece(s, 0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(rectOf(r.state.pieces[0]!)!.b).toBe(PLOT_STEPS.h);
  });
  it('Clear and Undo always work, and every state Undo returns to is legal', () => {
    let s = stack();
    s = clearBuild(s);
    expect(s.pieces).toEqual([]);
    s = undoBuild(s);
    expect(s.pieces).toHaveLength(2);
    // Many random edits: only legal ones are kept, so every undo step is legal too.
    const rng = createRng(20261024);
    const ids = piecesOf('PAST')
      .filter((p) => p.free)
      .map((p) => p.id);
    let t = newBuild('PAST');
    for (let i = 0; i < 400; i++) {
      const roll = rng.int(0, 9);
      let r;
      if (roll < 6)
        r = placePiece(
          t,
          rng.pick(ids),
          at(rng.int(0, B.cols - 1), rng.int(G - 3, G), rng.int(0, S - 1)),
        );
      else if (roll < 8 && t.pieces.length)
        r = movePiece(
          t,
          rng.int(0, t.pieces.length - 1),
          at(rng.int(0, B.cols - 1), rng.int(G - 3, G)),
        );
      else if (t.pieces.length) r = removePiece(t, rng.int(0, t.pieces.length - 1));
      if (r?.ok) t = r.state;
      expect(allHeld(t.pieces)).toBe(true);
    }
    expect(t.pieces.length).toBeGreaterThan(3);
    for (const snap of t.undo) expect(allHeld(snap.pieces)).toBe(true);
    while (t.undo.length) {
      t = undoBuild(t);
      expect(allHeld(t.pieces)).toBe(true);
    }
  });
});

describe('where a let-go brick lands', () => {
  it('drops a brick that is less than one cell above something onto it', () => {
    const s = build([['stone', 5, G]]);
    const near = dropOnto(s.pieces, brick('stone', 5, G - 2, 0, 3));
    expect(near && [near.y, near.oy]).toEqual([G - 1, 0]);
    expect(dropOnto([], brick('stone', 5, G, 0, 0))).toBeNull();
  });
  it('refuses a drop a whole cell or more in the air', () => {
    expect(landingFor([], brick('stone', 5, G - 1))).toEqual({ pos: null, why: 'floating' });
    expect(landingFor([], brick('stone', 5, 0))).toEqual({ pos: null, why: 'floating' });
  });
  it('lands right where it is let go when that is legal', () => {
    expect(landingFor([], brick('stone', 5, G))).toEqual({ pos: at(5, G), why: null });
  });
  it('slides an overlapping drop to the nearest legal spot, never into the air', () => {
    const s = build([['stone', 5, G]]);
    const r = landingFor(s.pieces, brick('stone', 5, G));
    expect(r.why).toBeNull();
    if (r.pos) {
      const placed = { ...brick('stone', 0, 0), ...r.pos };
      expect(placeProblem(s.pieces, placed)).toBeNull();
    }
  });
  it('says holding when the moved brick holds another', () => {
    const s = build([
      ['stone', 5, G],
      ['stone', 5, G - 1],
    ]);
    expect(landingFor(s.pieces, brick('stone', 14, G), 0)).toEqual({ pos: null, why: 'holding' });
  });
  it('findSpot only gives places that are held up', () => {
    const s = build([['stone', 5, G]]);
    const pos = findSpot(s.pieces, brick('stone', 5, G), null)!;
    expect(placeProblem(s.pieces, { ...brick('stone', 0, 0), ...pos })).toBeNull();
  });
});

describe('an old saved base with floating bricks settles when it loads', () => {
  it('drops a floating brick straight down to the ground', () => {
    const raw = { v: 1, p: [['stone', 4, 2, 0, 0, 0, 20]] };
    expect(repairBase(raw, 'PAST').map((p) => [p.x, p.y, p.ox, p.oy])).toEqual([[4, G, 0, 0]]);
    expect(baseWasSettled(raw, 'PAST')).toBe(true);
  });
  it('drops a floating brick onto a held-up brick under it', () => {
    const raw = {
      v: 1,
      p: [
        ['stone', 4, G, 0, 0, 0, 20],
        ['stone', 4, 3, 0, 5, 0, 20],
      ],
    };
    const out = repairBase(raw, 'PAST');
    expect(out[1]).toMatchObject({ x: 4, y: G - 1, oy: 0 });
    expect(allHeld(out)).toBe(true);
  });
  it('a floating stack falls together, lowest first, and keeps its shape', () => {
    const raw = {
      v: 1,
      p: [
        ['stone', 6, 2, 0, 0, 0, 20],
        ['stone', 6, 3, 0, 0, 0, 20],
      ],
    };
    const out = repairBase(raw, 'PAST');
    expect(out.map((p) => p.y)).toEqual([G - 1, G]);
    expect(allHeld(out)).toBe(true);
  });
  it('takes off a brick that can only come to rest on a corner (a last resort)', () => {
    // A stone hanging beside a tower falls onto a stone below that is under it by 2 steps only.
    const pieces = [brick('tower', 5, G - 1), brick('stone', 6, G - 3), brick('stone', 7, G, 6)];
    const out = settleBase(pieces);
    expect(out.drop).toEqual([0, null, 0]);
    expect(out.pieces).toEqual([pieces[0], pieces[2]]);
    expect(allHeld(out.pieces)).toBe(true);
    expect(allHeld(repairBase(toRaw(pieces), 'PAST'))).toBe(true);
  });
  it('leaves a legal base alone, and is the same every time', () => {
    const legal = build([
      ['stone', 5, G],
      ['stone', 5, G - 1],
    ]).pieces;
    expect(settleBase(legal)).toEqual({ pieces: legal, drop: [0, 0] });
    const raw = {
      v: 1,
      p: [
        ['plank', 1, 0, 3, 2, 0, 10],
        ['stone', 9, 4, 0, 0, 0, 20],
        ['tower', 2, 6, 0, 0, 0, 35],
      ],
    };
    expect(repairBase(raw, 'PAST')).toEqual(repairBase(JSON.parse(JSON.stringify(raw)), 'PAST'));
    expect(allHeld(repairBase(raw, 'PAST'))).toBe(true);
    expect(baseWasSettled(toRaw(legal), 'PAST')).toBe(false);
  });
  it('a pinned weapon pad rides down with its brick', () => {
    const raw = {
      v: 1,
      p: [['long', 8, 3, 0, 0, 0, 50]],
      s: [{ w: 'cannon', x: 10 * S, y: 3 * S - B.spots.padSteps }],
    };
    const spots = repairSpots(raw, 'PAST');
    const fell = (G - 3) * S;
    expect(spots[0]).toEqual({ weapon: 'cannon', x: 10 * S, y: 3 * S - B.spots.padSteps + fell });
  });
  it('the battle reads the settled base too', () => {
    const raw = { v: 1, p: [['stone', 4, 2, 0, 0, 0, 20]] };
    const st = chooseSlot(withSlot(raw), 'alex', 'PAST', 0);
    expect(chosenBase(st, 'Alex', 'PAST')).toEqual(slotPieces(st, 'Alex', 'PAST', 0));
    expect(chosenBase(st, 'Alex', 'PAST')[0]).toMatchObject({ y: G });
    expect(chosenSpots(st, 'Alex', 'PAST')).toHaveLength(B.spots.count);
  });
});

describe('a base from the builder always passes the battle support check', () => {
  it('no brick starts a battle anchored in the air, for many random bases', () => {
    const rng = createRng(7);
    const L = customId(
      'PAST',
      shapeKey([
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
      ]),
    );
    const hook = customId(
      'PAST',
      shapeKey([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    );
    const ids = [...piecesOf('PAST').map((p) => p.id), L, hook];
    for (let n = 0; n < 30; n++) {
      let s = newBuild('PAST');
      for (let i = 0; i < 120; i++) {
        const rot = rng.pick([0, 90, 180, 270] as const);
        const r = placePiece(
          s,
          rng.pick(ids),
          at(rng.int(0, B.cols - 1), rng.int(G - 4, G), rng.int(0, 1) ? 0 : rng.int(0, S - 1)),
          rot,
        );
        if (r.ok) s = r.state;
      }
      const built = createBuilt({ PAST: { pieces: s.pieces, spots: [] } });
      const anchored = (built.PAST.bricks as Array<{ anchored: boolean }>).filter(
        (b) => b.anchored,
      );
      expect(anchored).toEqual([]);
      expect(allHeld(s.pieces)).toBe(true);
    }
  });
  it('a settled old base passes the battle check too', () => {
    const raw = {
      v: 1,
      p: [
        ['stone', 4, 1, 0, 0, 0, 20],
        ['long', 2, 5, 3, 1, 0, 50],
        ['tower', 12, 0, 0, 0, 90, 35],
      ],
    };
    const pieces = repairBase(raw, 'PAST');
    const built = createBuilt({ PAST: { pieces, spots: [] } });
    expect((built.PAST.bricks as Array<{ anchored: boolean }>).some((b) => b.anchored)).toBe(false);
  });
});

function toRaw(pieces: readonly Placed[]): unknown {
  return { v: 1, p: pieces.map((q) => [q.piece, q.x, q.y, q.ox, q.oy, q.rot, q.hp]) };
}
