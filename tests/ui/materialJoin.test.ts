// @vitest-environment jsdom
// Same-material squares that touch join into one piece (src/ui/materialJoin.ts and
// materialTiles.ts): which edges are shared, and that no seam outline is drawn between them.
import { describe, expect, it } from 'vitest';
import type { Placed } from '../../src/game/baseBuilder';
import { MATERIALS, type Material } from '../../src/game/customShapes';
import type { BrickId, BrickView } from '../../src/game/types';
import { brickJoins } from '../../src/scenes/battle/baseJoin';
import { brickSprites } from '../../src/scenes/battle/basePlan';
import { brickSvg, materialSquare, shapeIcon } from '../../src/ui/baseBuilderArt';
import {
  cellsOfPiece,
  diagonalSegments,
  isJoined,
  joinKey,
  joinsFor,
  mirrorJoins,
  noJoins,
  openSpans,
  plotJoins,
  type Span,
  type Tile,
} from '../../src/ui/materialJoin';
import { joinedShapeMarkup } from '../../src/ui/materialTiles';

const sq = (c: number, r: number, mat: Material = 'stone'): Tile => ({
  l: c,
  t: r,
  r: c + 1,
  b: r + 1,
  mat,
});

describe('joinsFor: which edges are shared', () => {
  it('a lone square shares nothing', () => {
    const a = sq(0, 0);
    expect(isJoined(joinsFor(a, [a]))).toBe(false);
  });

  it('two squares side by side share one edge each, the whole edge', () => {
    const a = sq(0, 0);
    const b = sq(1, 0);
    const j = joinsFor(a, [a, b]);
    expect(j.e).toEqual([[0, 1]]);
    expect([j.n, j.s, j.w]).toEqual([[], [], []]);
    expect(joinsFor(b, [a, b]).w).toEqual([[0, 1]]);
  });

  it('a different material does not join', () => {
    const a = sq(0, 0, 'stone');
    const b = sq(1, 0, 'wood');
    expect(isJoined(joinsFor(a, [a, b]))).toBe(false);
  });

  it('a corner touch does not join', () => {
    const a = sq(0, 0);
    const b = sq(1, 1);
    expect(isJoined(joinsFor(a, [a, b]))).toBe(false);
  });

  it('a 2 by 2 block joins every inside edge and leaves the outer edges open', () => {
    const all = [sq(0, 0), sq(1, 0), sq(0, 1), sq(1, 1)];
    const nw = joinsFor(all[0]!, all);
    expect(nw.e.length).toBe(1);
    expect(nw.s.length).toBe(1);
    expect(nw.n).toEqual([]);
    expect(nw.w).toEqual([]);
    expect(openSpans(nw.n)).toEqual([[0, 1]]);
  });

  it('a half-offset neighbour covers half the edge', () => {
    const a = sq(0, 0);
    const b: Tile = { l: 1, t: 0.5, r: 2, b: 1.5, mat: 'stone' };
    expect(joinsFor(a, [a, b]).e).toEqual([[0.5, 1]]);
    expect(openSpans([[0.5, 1]])).toEqual([[0, 0.5]]);
  });

  it('openSpans gives the gaps, merging touching spans', () => {
    expect(openSpans([])).toEqual([[0, 1]]);
    expect(openSpans([[0, 1]])).toEqual([]);
    const covered: Span[] = [
      [0.4, 0.6],
      [0.2, 0.4],
    ];
    expect(openSpans(covered)).toEqual([
      [0, 0.2],
      [0.6, 1],
    ]);
  });

  it('mirroring swaps east and west and flips the stretches', () => {
    const j = { ...noJoins(), e: [[0, 1]] as Span[], n: [[0, 0.25]] as Span[] };
    const m = mirrorJoins(j);
    expect(m.w).toEqual([[0, 1]]);
    expect(m.e).toEqual([]);
    expect(m.n).toEqual([[0.75, 1]]);
    expect(joinKey(m)).not.toBe(joinKey(j));
  });
});

describe('glass shine runs on across squares', () => {
  it('the same line continues from one square to the next', () => {
    const left = diagonalSegments(0, 0, 40, 40, 24);
    const right = diagonalSegments(40, 0, 80, 40, 24);
    // A line crossing x = 40 ends there on the left and starts there on the right.
    const ends = left.filter(([, , xb]) => xb === 40).map(([, , , yb]) => yb);
    const starts = right.filter(([xa]) => xa === 40).map(([, ya]) => ya);
    expect(ends.length).toBeGreaterThan(0);
    expect(starts).toEqual(expect.arrayContaining(ends));
  });
});

const outlines = (svg: string): number =>
  (svg.match(/stroke="#12102b" stroke-width="4"/g) ?? []).length;

describe('the drawing has no seam between same-material squares', () => {
  it('a lone square is drawn exactly as before', () => {
    for (const m of MATERIALS) {
      expect(joinedShapeMarkup([{ c: 0, r: 0, mat: m }])).toBe(materialSquare(m, 0, 0));
    }
  });

  it('a row of squares has one outline path each, and no outlined rect per square', () => {
    for (const m of MATERIALS) {
      const row = [0, 1, 2, 3].map((c) => ({ c, r: 0, mat: m }));
      const svg = joinedShapeMarkup(row);
      expect(svg).not.toContain('<rect');
      expect(outlines(svg)).toBe(4);
    }
  });

  it('the seam between two squares is not outlined', () => {
    const svg = joinedShapeMarkup([
      { c: 0, r: 0, mat: 'wood' },
      { c: 1, r: 0, mat: 'wood' },
    ]);
    const d = [...svg.matchAll(/<path d="([^"]+)" stroke="#12102b" stroke-width="4"/g)].map(
      (x) => x[1]!,
    );
    // Nothing draws a vertical line down the seam at x = 40.
    expect(d.join(' ')).not.toMatch(/M40,[\d.]+ V/);
  });

  it('squares of different materials keep their own outlines', () => {
    const svg = joinedShapeMarkup([
      { c: 0, r: 0, mat: 'wood' },
      { c: 1, r: 0, mat: 'stone' },
    ]);
    expect(svg).toBe(materialSquare('wood', 0, 0) + materialSquare('stone', 40, 0));
  });

  it('the saved shape tile uses the joined drawing', () => {
    const doc = document;
    const icon = shapeIcon(
      doc,
      'PAST',
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      72,
    );
    expect(icon.querySelectorAll('rect').length).toBe(0);
    expect(icon.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});

describe('bricks on the plot', () => {
  const placed = (piece: string, x: number, y: number): Placed => ({
    piece,
    x,
    y,
    ox: 0,
    oy: 0,
    rot: 0,
    hp: 10,
  });

  it('cuts the plain bricks into squares and ignores the others', () => {
    expect(cellsOfPiece('stone', 0).length).toBe(2);
    expect(cellsOfPiece('plank', 0).every((q) => q.mat === 'wood')).toBe(true);
    expect(cellsOfPiece('tower', 0)).toEqual([]);
    expect(cellsOfPiece('stone', 90).map((q) => [q.c, q.r])).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });

  it('two stone bricks side by side join; far apart they do not', () => {
    const near = plotJoins([placed('stone', 0, 5), placed('stone', 2, 5)]);
    expect(near[0]).not.toBeNull();
    expect(near[1]).not.toBeNull();
    expect(plotJoins([placed('stone', 0, 5), placed('stone', 5, 5)])).toEqual([null, null]);
  });

  it('a stone beside a plank stays apart (different material)', () => {
    expect(plotJoins([placed('plank', 0, 5), placed('stone', 3, 5)])).toEqual([null, null]);
  });

  it('a stone stacked on a stone joins along the shared edge', () => {
    const j = plotJoins([placed('stone', 0, 5), placed('stone', 0, 4)]);
    expect(j[0]![0]!.n.length).toBe(1);
    expect(j[1]![0]!.s.length).toBe(1);
  });
});

describe('built bases in battle', () => {
  const view = (
    piece: string,
    team: BrickView['team'],
    x: number,
    y: number,
    alive = true,
  ): BrickView => ({
    team,
    piece,
    hp: 5,
    maxHp: 5,
    box: { x, y, w: piece === 'plank' ? 120 : 80, h: 40 },
    alive,
    rot: 0,
  });
  const id = (s: string): BrickId => s as BrickId;

  it('joins two touching stone bricks and gives the lone one no joins', () => {
    const b = {
      b1: view('stone', 'PAST', 0, 100),
      b2: view('stone', 'PAST', 80, 100),
      b3: view('stone', 'PAST', 400, 100),
    } as Record<BrickId, BrickView>;
    const j = brickJoins('PAST', b);
    expect([...j.keys()].sort()).toEqual(['b1', 'b2']);
    expect(j.get(id('b1'))![1]!.e.length).toBe(1);
    expect(j.get(id('b2'))![0]!.w.length).toBe(1);
  });

  it('a Team Future brick is drawn mirrored, so its joins are mirrored too', () => {
    const b = {
      a: view('stone', 'FUTURE', 0, 100),
      c: view('stone', 'FUTURE', 80, 100),
    } as Record<BrickId, BrickView>;
    // The left brick, once flipped, has its picture's first square on the seam side.
    expect(brickJoins('FUTURE', b).get(id('a'))![0]!.w.length).toBe(1);
  });

  it('a fallen neighbour is no neighbour: the outline comes back', () => {
    const alive = {
      b1: view('stone', 'PAST', 0, 100),
      b2: view('stone', 'PAST', 80, 100),
    } as Record<BrickId, BrickView>;
    const gone = { ...alive, b2: view('stone', 'PAST', 80, 100, false) } as Record<BrickId, BrickView>;
    expect(brickJoins('PAST', alive).has(id('b1'))).toBe(true);
    expect(brickJoins('PAST', gone).has(id('b1'))).toBe(false);
    const k1 = brickSprites('PAST', alive, brickJoins('PAST', alive))[0]!.key;
    const k2 = brickSprites('PAST', gone, brickJoins('PAST', gone))[0]!.key;
    expect(k1).not.toBe(k2);
  });

  it('the joined picture draws no outlined rect and keeps the picture size', () => {
    const b = {
      b1: view('plank', 'PAST', 0, 100),
      b2: view('plank', 'PAST', 120, 100),
    } as Record<BrickId, BrickView>;
    const svg = brickSvg('plank', 0, 240, 80, brickJoins('PAST', b).get(id('b1')));
    expect(svg).toContain('viewBox="0 0 120 40"');
    expect(svg).not.toContain('<rect');
  });
});
