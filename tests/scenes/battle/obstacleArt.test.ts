// Every solid shape is painted with real detail, and the art never lies about where a shell
// hits: the silhouette is the collision polygon itself, and every detail sits inside it.
import { describe, expect, it } from 'vitest';
import { buildLayout, withWalls } from '../../../src/game/battlefield';
import { BIOME_IDS, EVASION, FORT_IDS, PHASE1_LAYOUT, SPOT_IDS } from '../../../src/game/config';
import type { FortIdValue, Polygon, SpotIdValue } from '../../../src/game/types';
import { BIOME_LOOKS } from '../../../src/scenes/battle/biomeArt';
import {
  OUTLINE_W,
  boundsOf,
  insidePolygon,
  layoutObstacleArt,
  layoutObstacleDecor,
  layoutPaint,
  obstacleArt,
  obstacleDecor,
  obstacleKinds,
  shapeInside,
  shapePoints,
  spanAt,
  topAt,
  type ArtShape,
  type ObstacleKind,
} from '../../../src/scenes/battle/obstacleArt';
import { ART, PALETTE } from '../../../src/scenes/battle/visual';

const SPOTS: Array<SpotIdValue | null> = [null, ...SPOT_IDS];
const FORTS: Array<FortIdValue | null> = [null, ...FORT_IDS];
const ALL_KINDS: ObstacleKind[] = [
  'aspenHill',
  'cherryMound',
  'templePillar',
  'tower',
  'bridgeDeck',
  'foodTruck',
  'fortRock',
  'villageWall',
  'drawbridge',
  'stoneWall',
];

const layouts = () =>
  BIOME_IDS.flatMap((biome) =>
    SPOTS.flatMap((spot) =>
      FORTS.map((fort) => ({
        name: `${biome}/${spot}/${fort}`,
        l: buildLayout({ biome, spot, fort }),
      })),
    ),
  );

/** An independent even-odd test, so the module's own check is not the only judge. */
const strictlyInsideOrOn = (poly: Polygon, p: { x: number; y: number }): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  if (inside) return true;
  // On an edge, within a hair.
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const cross = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
    const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
    if (cross < 0.02 && dot >= -0.02 && dot <= len * len + 0.02) return true;
  }
  return false;
};

const ALLOWED = new Set<number>([
  ...Object.values(ART),
  ...Object.values(PALETTE.past),
  ...Object.values(PALETTE.future),
  ...Object.values(PALETTE.shared),
  ...Object.values(BIOME_LOOKS).flatMap((b) => [b.trunk, b.bark, b.leafFar, b.leafNear]),
]);
const colorOf = (s: ArtShape): number => s.color;

describe('which obstacle is which', () => {
  it('names one look per solid shape, biome first, then the spot, then the castle place', () => {
    expect(obstacleKinds(buildLayout({ biome: 'aspen', spot: null }))).toEqual(['aspenHill']);
    expect(
      obstacleKinds(buildLayout({ biome: 'cherry', spot: 'bridge', fort: 'drawbridge' })),
    ).toEqual(['cherryMound', 'bridgeDeck', 'drawbridge']);
    expect(
      obstacleKinds(buildLayout({ biome: 'temple', spot: 'skyscraper', fort: 'hillFort' })),
    ).toEqual(['templePillar', 'tower', 'fortRock']);
    expect(
      obstacleKinds(buildLayout({ biome: 'aspen', spot: 'foodTruck', fort: 'villageWall' })),
    ).toEqual(['aspenHill', 'foodTruck', 'villageWall']);
    // The Phase 1 layout (no biome set) is the aspen hill.
    expect(obstacleKinds(PHASE1_LAYOUT)).toEqual(['aspenHill']);
  });

  it('odd ids never break it: unknown or prototype names fall back to the aspen hill', () => {
    for (const bad of ['constructor', 'toString', '__proto__', 'moon']) {
      const l = { ...PHASE1_LAYOUT, biome: bad, spot: bad, fort: bad } as never;
      expect(obstacleKinds(l)).toEqual(['aspenHill']);
    }
  });

  it('any extra shape (the Stone Wall ability) is a stone wall', () => {
    const l = withWalls(buildLayout({ biome: 'aspen', spot: 'foodTruck' }), [
      EVASION.barricade.wall,
    ]);
    expect(obstacleKinds(l)).toEqual(['aspenHill', 'foodTruck', 'stoneWall']);
  });

  it('covers every layout with exactly one look per shape', () => {
    for (const { name, l } of layouts())
      expect(obstacleKinds(l), name).toHaveLength(l.terrain.obstacles.length);
  });
});

describe('the art matches the collision shape', () => {
  for (const { name, l } of layouts()) {
    it(`${name}: silhouette is the polygon, outline is the polygon, details sit inside`, () => {
      const art = layoutObstacleArt(l);
      expect(art).toHaveLength(l.terrain.obstacles.length);
      art.forEach((shapes, i) => {
        const poly = l.terrain.obstacles[i]!;
        const first = shapes[0]!;
        const last = shapes[shapes.length - 1]!;
        expect(first.op).toBe('poly');
        expect(first.op === 'poly' && first.pts).toEqual(poly.map((p) => ({ x: p.x, y: p.y })));
        expect(first.op === 'poly' && first.alpha).toBe(1);
        expect(last.op).toBe('outline');
        expect(last.op === 'outline' && last.pts).toEqual(poly.map((p) => ({ x: p.x, y: p.y })));
        expect(last.op === 'outline' && last.width).toBe(OUTLINE_W);
        for (const s of shapes.slice(1, -1)) {
          expect(s.op).not.toBe('outline');
          for (const p of shapePoints(s))
            expect(strictlyInsideOrOn(poly, p), `${name} #${i} ${s.op} ${p.x},${p.y}`).toBe(true);
        }
      });
    });
  }

  it('the Stone Wall ability is painted inside its rectangle too', () => {
    const w = EVASION.barricade.wall;
    const poly = [
      { x: w.x, y: w.y },
      { x: w.x + w.w, y: w.y },
      { x: w.x + w.w, y: w.y + w.h },
      { x: w.x, y: w.y + w.h },
    ];
    const art = obstacleArt('stoneWall', poly);
    for (const s of art.slice(1, -1)) expect(shapeInside(poly, s)).toBe(true);
  });
});

describe('every obstacle looks like something, not a dark box', () => {
  const sample: Record<ObstacleKind, Polygon> = {
    aspenHill: buildLayout({ biome: 'aspen', spot: null }).terrain.obstacles[0]!,
    cherryMound: buildLayout({ biome: 'cherry', spot: null }).terrain.obstacles[0]!,
    templePillar: buildLayout({ biome: 'temple', spot: null }).terrain.obstacles[0]!,
    tower: buildLayout({ biome: 'aspen', spot: 'skyscraper' }).terrain.obstacles[1]!,
    bridgeDeck: buildLayout({ biome: 'aspen', spot: 'bridge' }).terrain.obstacles[1]!,
    foodTruck: buildLayout({ biome: 'aspen', spot: 'foodTruck' }).terrain.obstacles[1]!,
    fortRock: buildLayout({ biome: 'aspen', spot: null, fort: 'hillFort' }).terrain.obstacles[1]!,
    villageWall: buildLayout({ biome: 'aspen', spot: null, fort: 'villageWall' }).terrain
      .obstacles[1]!,
    drawbridge: buildLayout({ biome: 'aspen', spot: null, fort: 'drawbridge' }).terrain
      .obstacles[1]!,
    stoneWall: [
      { x: 460, y: 400 },
      { x: 500, y: 400 },
      { x: 500, y: 620 },
      { x: 460, y: 620 },
    ],
  };

  for (const kind of ALL_KINDS) {
    it(`${kind}: keeps plenty of detail in at least three colors, all from the palette`, () => {
      const art = obstacleArt(kind, sample[kind]);
      const details = art.slice(1, -1);
      expect(details.length, kind).toBeGreaterThanOrEqual(6);
      const colors = new Set(art.map(colorOf));
      expect(colors.size, kind).toBeGreaterThanOrEqual(3);
      for (const c of colors) expect(ALLOWED.has(c), `${kind} 0x${c.toString(16)}`).toBe(true);
    });
  }

  it('each kind has its own look', () => {
    const looks = ALL_KINDS.map((k) => {
      const art = obstacleArt(k, sample[k]);
      return `${colorOf(art[0]!)}:${colorOf(art[art.length - 1]!)}:${art.length}`;
    });
    expect(new Set(looks).size).toBe(ALL_KINDS.length);
  });

  it('is the same every time (no randomness)', () => {
    for (const kind of ALL_KINDS)
      expect(obstacleArt(kind, sample[kind])).toEqual(obstacleArt(kind, sample[kind]));
  });
});

describe('supports are decoration only (owner approved, 2026-10-24)', () => {
  const groundOf = (l: { terrain: { ground: ReadonlyArray<{ y: number }> } }) =>
    l.terrain.ground[0]!.y;

  it('the drawbridge and the Future bridge have visible supports; shapes on the ground need none', () => {
    const l = buildLayout({ biome: 'aspen', spot: 'bridge', fort: 'drawbridge' });
    const decor = layoutObstacleDecor(l);
    const kinds = obstacleKinds(l);
    expect(decor).toHaveLength(l.terrain.obstacles.length);
    kinds.forEach((k, i) => {
      if (k === 'drawbridge' || k === 'bridgeDeck')
        expect(decor[i]!.length, k).toBeGreaterThanOrEqual(6);
      else expect(decor[i], k).toEqual([]);
    });
    for (const kind of ['tower', 'foodTruck', 'fortRock', 'villageWall', 'stoneWall'] as const)
      expect(obstacleDecor(kind, l.terrain.obstacles[0]!, groundOf(l)), kind).toEqual([]);
  });

  it('each support reaches from the ground to the floating shape, so it looks held up', () => {
    for (const fort of [null, 'drawbridge'] as const) {
      const l = buildLayout({ biome: 'cherry', spot: 'bridge', fort });
      const ground = groundOf(l);
      layoutObstacleDecor(l).forEach((shapes, i) => {
        if (shapes.length === 0) return;
        const poly = l.terrain.obstacles[i]!;
        const b = boundsOf(poly);
        const pts = shapes.flatMap(shapePoints);
        // Something stands on the ground line.
        expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(ground, 5);
        // Something touches the shape itself (a chain end, a cable end, the top of a post).
        expect(pts.some((p) => insidePolygon(poly, p, 1))).toBe(true);
        // And something rises above the shape (a gate post or a pylon for the chains or cables).
        expect(Math.min(...pts.map((p) => p.y))).toBeLessThan(b.minY);
      });
    }
  });

  for (const { name, l } of layouts()) {
    it(`${name}: decoration is marked not solid, stays in the world and above the ground`, () => {
      const ground = groundOf(l);
      for (const shapes of layoutObstacleDecor(l))
        for (const s of shapes) {
          expect(s.solid, name).toBe(false);
          expect(s.op, name).not.toBe('outline');
          for (const p of shapePoints(s)) {
            expect(p.x, `${name} ${s.op}`).toBeGreaterThanOrEqual(0);
            expect(p.x, `${name} ${s.op}`).toBeLessThanOrEqual(l.width);
            expect(p.y, `${name} ${s.op}`).toBeGreaterThanOrEqual(0);
            expect(p.y, `${name} ${s.op} below the ground`).toBeLessThanOrEqual(ground + 1e-9);
          }
          expect(ALLOWED.has(s.color), `${name} 0x${s.color.toString(16)}`).toBe(true);
        }
    });

    it(`${name}: decoration paints first, so every solid shape and its outline sit on top`, () => {
      const paint = layoutPaint(l);
      const decor = layoutObstacleDecor(l).filter((d) => d.length > 0);
      const art = layoutObstacleArt(l);
      expect(paint).toEqual([...decor, ...art]);
      // The solid groups still start with the polygon and end with its outline.
      for (const group of paint.slice(decor.length)) {
        expect(group[0]!.op).toBe('poly');
        expect(group[group.length - 1]!.op).toBe('outline');
      }
    });
  }

  it('never moves a solid shape: the polygons and the layout stay exactly the same', () => {
    const l = buildLayout({ biome: 'temple', spot: 'bridge', fort: 'drawbridge' });
    const before = JSON.parse(JSON.stringify(l)) as unknown;
    const frozen = l.terrain.obstacles.map((o) => Object.freeze(o.map((p) => Object.freeze(p))));
    frozen.forEach((poly, i) => obstacleDecor(obstacleKinds(l)[i]!, poly, groundOf(l)));
    layoutPaint(l);
    expect(JSON.parse(JSON.stringify(l))).toEqual(before);
  });

  it('is the same every time (no randomness)', () => {
    const l = buildLayout({ biome: 'aspen', spot: 'bridge', fort: 'drawbridge' });
    expect(layoutObstacleDecor(l)).toEqual(layoutObstacleDecor(l));
  });
});

describe('geometry helpers', () => {
  const box: Polygon = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 20 },
    { x: 0, y: 20 },
  ];
  const tri: Polygon = [
    { x: 0, y: 10 },
    { x: 5, y: 0 },
    { x: 10, y: 10 },
  ];
  it('insidePolygon accepts inside and edge points, rejects outside ones', () => {
    expect(insidePolygon(box, { x: 5, y: 5 })).toBe(true);
    expect(insidePolygon(box, { x: 10, y: 5 })).toBe(true);
    expect(insidePolygon(box, { x: 10.5, y: 5 })).toBe(false);
    expect(insidePolygon(tri, { x: 1, y: 1 })).toBe(false);
  });
  it('spanAt and topAt read the edges', () => {
    expect(spanAt(box, 5)).toEqual([0, 10]);
    expect(spanAt(box, 30)).toBeNull();
    expect(spanAt(tri, 5)).toEqual([2.5, 7.5]);
    expect(topAt(tri, 5)).toBe(0);
    expect(topAt(tri, 2.5)).toBe(5);
    expect(topAt(box, 40)).toBeNull();
  });
  it('a circle that pokes past the edge is not inside', () => {
    expect(shapeInside(box, { op: 'circle', x: 5, y: 5, r: 4, color: 0, alpha: 1 })).toBe(true);
    expect(shapeInside(box, { op: 'circle', x: 8, y: 5, r: 4, color: 0, alpha: 1 })).toBe(false);
    expect(
      shapeInside(box, {
        op: 'line',
        a: { x: 1, y: 5 },
        b: { x: 9, y: 5 },
        width: 4,
        color: 0,
        alpha: 1,
      }),
    ).toBe(true);
    expect(
      shapeInside(box, {
        op: 'line',
        a: { x: 0, y: 5 },
        b: { x: 0, y: 15 },
        width: 4,
        color: 0,
        alpha: 1,
      }),
    ).toBe(false);
  });
});
