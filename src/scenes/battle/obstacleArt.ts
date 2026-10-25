// How every solid shape on the battlefield is painted: the biome's middle shape (aspen hill,
// cherry mound, temple pillar), Team Future's tower, bridge deck and food truck, and Team Past's
// Hill Fort rock, Village Wall and Drawbridge. Pure, no Phaser, so tests can check it.
//
// The rule that keeps the art honest: the first shape is the collision polygon itself, the last
// is its outline, and every detail in between lies inside that polygon. A shell hits exactly
// what a child sees. Details that would poke out are dropped (`keepInside`). No randomness.
import { isBiomeId } from '../../game/battlefield';
import { FORTS, SPOTS } from '../../game/config';
import { isFortId } from '../../game/forts';
import { isSpotId } from '../../game/spots';
import type { BattleLayout, Polygon, Vec2 } from '../../game/types';
import { BIOME_LOOKS } from './biomeArt';
import { ART, PALETTE } from './visual';

export type ObstacleKind =
  | 'aspenHill'
  | 'cherryMound'
  | 'templePillar'
  | 'tower'
  | 'bridgeDeck'
  | 'foodTruck'
  | 'fortRock'
  | 'villageWall'
  | 'drawbridge'
  | 'stoneWall';

export type ArtShape =
  | { op: 'poly'; pts: Vec2[]; color: number; alpha: number }
  | { op: 'rect'; x: number; y: number; w: number; h: number; color: number; alpha: number }
  | { op: 'circle'; x: number; y: number; r: number; color: number; alpha: number }
  | { op: 'line'; a: Vec2; b: Vec2; width: number; color: number; alpha: number }
  | { op: 'outline'; pts: Vec2[]; width: number; color: number };

/** Outline width, the same 4px every obstacle had before. */
export const OUTLINE_W = 4;

// ---------- Which obstacle is which ----------

const BIOME_KIND = { aspen: 'aspenHill', cherry: 'cherryMound', temple: 'templePillar' } as const;
const SPOT_KIND = { skyscraper: 'tower', bridge: 'bridgeDeck', foodTruck: 'foodTruck' } as const;
const FORT_KIND = {
  hillFort: 'fortRock',
  villageWall: 'villageWall',
  drawbridge: 'drawbridge',
} as const;

/**
 * The look of each obstacle in `layout.terrain.obstacles`, in the same order. Obstacle 0 is the
 * biome's middle shape; the spot's shapes follow, then the castle place's (see buildLayout). Any
 * extra shape (the Stone Wall ability) is a stone wall.
 */
export function obstacleKinds(layout: BattleLayout): ObstacleKind[] {
  const kinds: ObstacleKind[] = [isBiomeId(layout.biome) ? BIOME_KIND[layout.biome] : 'aspenHill'];
  const spot = layout.spot;
  if (isSpotId(spot)) kinds.push(...SPOTS[spot].obstacles.map(() => SPOT_KIND[spot]));
  const fort = layout.fort;
  if (isFortId(fort)) kinds.push(...FORTS[fort].obstacles.map(() => FORT_KIND[fort]));
  return layout.terrain.obstacles.map((_, i) => kinds[i] ?? 'stoneWall');
}

// ---------- Geometry (convex polygons) ----------

type Box = { minX: number; maxX: number; minY: number; maxY: number };

export const boundsOf = (poly: Polygon): Box => ({
  minX: Math.min(...poly.map((p) => p.x)),
  maxX: Math.max(...poly.map((p) => p.x)),
  minY: Math.min(...poly.map((p) => p.y)),
  maxY: Math.max(...poly.map((p) => p.y)),
});

const distToSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/** Distance from p to the nearest edge of the polygon. */
export function edgeDistance(poly: Polygon, p: Vec2): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++)
    best = Math.min(best, distToSegment(p, poly[i]!, poly[(i + 1) % poly.length]!));
  return best;
}

/** True when p is inside the polygon or within `tol` of its edge. */
export function insidePolygon(poly: Polygon, p: Vec2, tol = 0.01): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside || edgeDistance(poly, p) <= tol;
}

/** Where a horizontal line at y crosses the polygon: [left, right], or null if it misses. */
export function spanAt(poly: Polygon, y: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (a.y === b.y) {
      if (a.y === y) xs.push(a.x, b.x);
      continue;
    }
    const t = (y - a.y) / (b.y - a.y);
    if (t >= 0 && t <= 1) xs.push(a.x + t * (b.x - a.x));
  }
  return xs.length < 2 ? null : [Math.min(...xs), Math.max(...xs)];
}

/** The top edge of the polygon above x (smallest y), or null if x misses it. */
export function topAt(poly: Polygon, x: number): number | null {
  const ys: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (a.x === b.x) {
      if (a.x === x) ys.push(a.y, b.y);
      continue;
    }
    const t = (x - a.x) / (b.x - a.x);
    if (t >= 0 && t <= 1) ys.push(a.y + t * (b.y - a.y));
  }
  return ys.length === 0 ? null : Math.min(...ys);
}

/** Every point a shape covers that must be inside the polygon (corners, rims, line edges). */
export function shapePoints(s: ArtShape): Vec2[] {
  switch (s.op) {
    case 'poly':
    case 'outline':
      return s.pts;
    case 'rect':
      return [
        { x: s.x, y: s.y },
        { x: s.x + s.w, y: s.y },
        { x: s.x + s.w, y: s.y + s.h },
        { x: s.x, y: s.y + s.h },
      ];
    case 'circle': {
      const out: Vec2[] = [];
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * Math.PI * 2;
        out.push({ x: s.x + Math.cos(t) * s.r, y: s.y + Math.sin(t) * s.r });
      }
      return out;
    }
    case 'line': {
      const dx = s.b.x - s.a.x;
      const dy = s.b.y - s.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * (s.width / 2);
      const ny = (dx / len) * (s.width / 2);
      return [s.a, s.b].flatMap((p) => [
        { x: p.x + nx, y: p.y + ny },
        { x: p.x - nx, y: p.y - ny },
      ]);
    }
  }
}

/** True when the whole shape lies inside the (convex) polygon. */
export const shapeInside = (poly: Polygon, s: ArtShape, tol = 0.01): boolean =>
  s.op === 'circle'
    ? insidePolygon(poly, { x: s.x, y: s.y }, tol) && edgeDistance(poly, s) + tol >= s.r
    : shapePoints(s).every((p) => insidePolygon(poly, p, tol));

/** Drop any detail that would poke past the silhouette. */
const keepInside = (poly: Polygon, shapes: ArtShape[]): ArtShape[] =>
  shapes.filter((s) => shapeInside(poly, s));

// ---------- Small builders ----------

const rect = (x: number, y: number, w: number, h: number, color: number, alpha = 1): ArtShape => ({
  op: 'rect',
  x,
  y,
  w,
  h,
  color,
  alpha,
});
const circle = (x: number, y: number, r: number, color: number, alpha = 1): ArtShape => ({
  op: 'circle',
  x,
  y,
  r,
  color,
  alpha,
});
const line = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  color: number,
  alpha = 1,
): ArtShape => ({ op: 'line', a: { x: ax, y: ay }, b: { x: bx, y: by }, width, color, alpha });

/** A band that follows the top edge down by `depth`: a grass cap, moss, or snow of petals. */
function topBand(poly: Polygon, depth: number, color: number, alpha = 1, step = 6): ArtShape {
  const b = boundsOf(poly);
  const upper: Vec2[] = [];
  const lower: Vec2[] = [];
  for (let x = b.minX; x <= b.maxX + 0.001; x += step) {
    const xx = Math.min(x, b.maxX);
    const top = topAt(poly, xx);
    if (top === null) continue;
    upper.push({ x: xx, y: top });
    lower.push({ x: xx, y: Math.min(top + depth, b.maxY) });
  }
  return { op: 'poly', pts: [...upper, ...lower.reverse()], color, alpha };
}

/** Little grass blades that stand inside the top edge, pointing up. */
function tufts(poly: Polygon, every: number, color: number, inset = 6): ArtShape[] {
  const b = boundsOf(poly);
  const out: ArtShape[] = [];
  for (let x = b.minX + inset; x <= b.maxX - inset; x += every) {
    const top = topAt(poly, x);
    if (top === null) continue;
    out.push({
      op: 'poly',
      pts: [
        { x: x - 4, y: top + 12 },
        { x: x - 1, y: top + 3 },
        { x: x + 1, y: top + 8 },
        { x: x + 4, y: top + 2 },
        { x: x + 5, y: top + 12 },
      ],
      color,
      alpha: 1,
    });
  }
  return out;
}

/** Stone courses: mortar lines across the shape, with staggered joints between them. */
function courses(
  poly: Polygon,
  from: number,
  rowH: number,
  brickW: number,
  color: number,
  width = 2,
): ArtShape[] {
  const b = boundsOf(poly);
  const out: ArtShape[] = [];
  let row = 0;
  for (let y = from; y < b.maxY - 2; y += rowH, row++) {
    const span = spanAt(poly, y);
    if (span) out.push(line(span[0] + 3, y, span[1] - 3, y, width, color));
    const next = Math.min(y + rowH, b.maxY);
    const inner = spanAt(poly, (y + next) / 2);
    if (!inner) continue;
    const offset = row % 2 === 0 ? brickW / 2 : 0;
    for (let x = inner[0] + offset + brickW / 2; x < inner[1] - 4; x += brickW)
      out.push(line(x, y + 2, x, next - 2, width, color));
  }
  return out;
}

/** A playful zigzag crack: a few short line segments. */
const crack = (pts: Array<[number, number]>, color: number): ArtShape[] =>
  pts.slice(1).map(([x, y], i) => line(pts[i]![0], pts[i]![1], x, y, 2, color));

// ---------- One recipe per kind ----------

const C = {
  stone: ART.stone,
  stoneLine: ART.stoneLine,
  stoneEdge: ART.stoneEdge,
  grassTop: ART.grassTop,
  grassMid: ART.grassMid,
  grassLow: ART.grassLow,
  ink: PALETTE.shared.ink,
  gold: PALETTE.past.gold,
  wood: PALETTE.past.wood,
  parchment: PALETTE.past.parchment,
  cream: ART.cream,
  metal: ART.metal,
  metalDark: ART.metalDark,
  hull: ART.hull,
  hullDark: ART.hullDark,
  visor: ART.visor,
  neon: PALETTE.future.neon,
  glow: PALETTE.future.glow,
  steel: PALETTE.future.steel,
  night: PALETTE.future.night,
  pink: ART.pink,
  flame: ART.flame,
  leafGold: ART.aspenLeafNear,
  petalDeep: BIOME_LOOKS.cherry.leafFar,
  petal: BIOME_LOOKS.cherry.leafNear,
  sand: BIOME_LOOKS.temple.trunk,
  sandLine: BIOME_LOOKS.temple.bark,
  vine: BIOME_LOOKS.temple.leafNear,
  vineDark: BIOME_LOOKS.temple.leafFar,
} as const;

type Recipe = { fill: number; line: number; details: (poly: Polygon, b: Box) => ArtShape[] };

const RECIPES: Record<ObstacleKind, Recipe> = {
  /** A rocky hill: stone layers and cracks, a grass cap with tufts and golden aspen leaves. */
  aspenHill: {
    fill: C.stone,
    line: C.stoneLine,
    details: (poly, b) => [
      ...[0.45, 0.65, 0.85].map((f) => {
        const y = b.minY + (b.maxY - b.minY) * f;
        const s = spanAt(poly, y) ?? [b.minX, b.minX];
        return line(s[0] + 8, y, s[1] - 8, y + 4, 2, C.stoneLine);
      }),
      ...crack(
        [
          [b.minX + 70, b.minY + 50],
          [b.minX + 78, b.minY + 66],
          [b.minX + 70, b.minY + 80],
          [b.minX + 80, b.minY + 98],
        ],
        C.stoneEdge,
      ),
      circle(b.minX + 130, b.maxY - 26, 9, C.stoneLine),
      circle(b.minX + 127, b.maxY - 29, 4, C.stone),
      topBand(poly, 28, C.grassMid),
      topBand(poly, 14, C.grassTop),
      ...tufts(poly, 22, C.grassLow, 10),
      circle(b.minX + 100, (topAt(poly, b.minX + 100) ?? b.minY) + 12, 4, C.leafGold),
      circle(b.minX + 150, (topAt(poly, b.minX + 150) ?? b.minY) + 12, 4, C.gold),
    ],
  },
  /** A soft green mound sprinkled with cherry petals. */
  cherryMound: {
    fill: C.grassMid,
    line: C.grassLow,
    details: (poly, b) => [
      topBand(poly, 14, C.grassTop),
      ...tufts(poly, 26, C.grassLow, 14),
      circle(b.minX + 120, b.maxY - 22, 10, C.stone),
      circle(b.minX + 117, b.maxY - 25, 4, ART.knightSteel),
      ...[30, 70, 110, 150, 190, 230].flatMap((dx, i) => {
        const x = b.minX + dx;
        const top = topAt(poly, x) ?? b.minY;
        const y = top + 18 + ((i * 11) % 30);
        return [circle(x, y, 4, i % 2 ? C.petal : C.petalDeep), circle(x + 5, y + 2, 3, C.petal)];
      }),
    ],
  },
  /** A sandstone pillar: fluting, drum joints, a crack, and green vines over the broken top. */
  templePillar: {
    fill: C.sand,
    line: C.sandLine,
    details: (poly, b) => [
      // Light and shade: a sunny left face and a shady right edge, so it reads as round stone.
      rect(b.minX + 4, b.minY + 30, 10, b.maxY - b.minY - 34, C.parchment, 0.35),
      rect(b.maxX - 12, b.minY + 30, 9, b.maxY - b.minY - 34, C.sandLine, 0.35),
      ...[b.minX + 20, b.minX + 30, b.minX + 40].map((x) =>
        line(x, (topAt(poly, x) ?? b.minY) + 22, x, b.maxY - 8, 2, C.sandLine, 0.45),
      ),
      ...[b.minY + 62, b.minY + 108].map((y) =>
        line(b.minX + 3, y, b.maxX - 3, y, 2, C.sandLine, 0.8),
      ),
      // A chipped corner and a few pebbles of broken stone at the foot.
      circle(b.minX + 14, b.maxY - 8, 4, C.sandLine, 0.7),
      circle(b.maxX - 16, b.maxY - 6, 3, C.sandLine, 0.7),
      ...crack(
        [
          [b.minX + 40, b.minY + 28],
          [b.minX + 34, b.minY + 44],
          [b.minX + 42, b.minY + 56],
        ],
        C.sandLine,
      ),
      topBand(poly, 10, C.vineDark),
      ...[b.minX + 8, b.minX + 20, b.minX + 33, b.minX + 47].map((x, i) =>
        line(
          x,
          (topAt(poly, x) ?? b.minY) + 6,
          x + (i % 2 ? 3 : -3),
          b.minY + 50 + i * 12,
          3,
          C.vine,
        ),
      ),
      ...[b.minX + 10, b.minX + 26, b.minX + 44].map((x) =>
        circle(x, (topAt(poly, x) ?? b.minY) + 9, 4, C.vine),
      ),
    ],
  },
  /** A glass-and-steel tower: neon trim, rows of windows (some lit), and a door. */
  tower: {
    fill: C.hull,
    line: C.hullDark,
    details: (_poly, b) => {
      const out: ArtShape[] = [];
      const w = b.maxX - b.minX;
      out.push(line(b.minX + 6, b.minY + 4, b.minX + 6, b.maxY - 2, 3, C.glow));
      out.push(line(b.maxX - 6, b.minY + 4, b.maxX - 6, b.maxY - 2, 3, C.glow));
      out.push(rect(b.minX + 3, b.minY + 3, w - 6, 6, C.neon));
      const cols = 5;
      const gap = (w - 24) / cols;
      let n = 0;
      for (let y = b.minY + 16; y + 14 < b.maxY - 34; y += 24) {
        out.push(line(b.minX + 10, y - 5, b.maxX - 10, y - 5, 2, C.hullDark));
        for (let c = 0; c < cols; c++, n++) {
          const lit = (n * 7) % 5 < 2;
          out.push(
            rect(b.minX + 14 + c * gap, y, gap - 8, 13, lit ? C.gold : C.visor, lit ? 1 : 0.8),
          );
        }
      }
      const doorX = b.minX + w / 2 - 14;
      out.push(rect(doorX, b.maxY - 32, 28, 30, C.night));
      out.push(line(doorX + 14, b.maxY - 30, doorX + 14, b.maxY - 2, 2, C.glow));
      return out;
    },
  },
  /** A steel bridge deck: road stripes on top, an X truss, rivets, and a neon strip below. */
  bridgeDeck: {
    fill: C.steel,
    line: C.hullDark,
    details: (_poly, b) => {
      const out: ArtShape[] = [rect(b.minX + 2, b.minY + 2, b.maxX - b.minX - 4, 12, C.hullDark)];
      for (let x = b.minX + 10; x + 16 < b.maxX; x += 30)
        out.push(rect(x, b.minY + 7, 16, 3, C.gold));
      const top = b.minY + 18;
      const bottom = b.maxY - 10;
      for (let x = b.minX + 6; x + 30 <= b.maxX - 4; x += 30) {
        out.push(line(x, top, x + 30, bottom, 3, C.metalDark));
        out.push(line(x, bottom, x + 30, top, 3, C.metalDark));
        out.push(circle(x, top, 2.5, C.ink), circle(x, bottom, 2.5, C.ink));
      }
      out.push(rect(b.minX + 3, b.maxY - 7, b.maxX - b.minX - 6, 4, C.glow));
      return out;
    },
  },
  /** The back of a taco truck: a striped awning, doors with windows, taillights and wheels. */
  foodTruck: {
    fill: C.pink,
    line: C.hullDark,
    details: (_poly, b) => {
      const w = b.maxX - b.minX;
      const out: ArtShape[] = [];
      for (let i = 0, x = b.minX + 2; x < b.maxX - 2; i++, x += 6.5)
        out.push(rect(x, b.minY + 2, Math.min(6.5, b.maxX - 2 - x), 12, i % 2 ? C.pink : C.cream));
      out.push(rect(b.minX + 2, b.minY + 14, w - 4, 3, C.hullDark));
      out.push(rect(b.minX + 4, b.minY + 22, w - 8, 30, C.cream));
      out.push(line(b.minX + w / 2, b.minY + 22, b.minX + w / 2, b.minY + 52, 2, C.hullDark));
      out.push(rect(b.minX + 6, b.minY + 26, w / 2 - 8, 10, C.visor));
      out.push(rect(b.minX + w / 2 + 2, b.minY + 26, w / 2 - 8, 10, C.visor));
      out.push(
        circle(b.minX + 5, b.maxY - 24, 3, C.flame),
        circle(b.maxX - 5, b.maxY - 24, 3, C.flame),
      );
      out.push(rect(b.minX + 2, b.maxY - 18, w - 4, 5, C.metal));
      out.push(circle(b.minX + 7, b.maxY - 7, 5, C.ink), circle(b.maxX - 7, b.maxY - 7, 5, C.ink));
      out.push(
        circle(b.minX + 7, b.maxY - 7, 2, C.metal),
        circle(b.maxX - 7, b.maxY - 7, 2, C.metal),
      );
      return out;
    },
  },
  /** The Hill Fort rock: rough layers, cracks, pebbles, and a mossy top with tufts. */
  fortRock: {
    fill: C.stoneLine,
    line: C.stoneEdge,
    details: (poly, b) => [
      // A sunlit face on the left, so the rock looks solid and round.
      {
        op: 'poly',
        pts: [
          { x: b.minX + 14, y: b.minY + 12 },
          { x: b.minX + 60, y: b.minY + 12 },
          { x: b.minX + 44, y: b.maxY - 10 },
          { x: b.minX + 10, y: b.maxY - 10 },
          { x: b.minX + 8, y: b.minY + 70 },
        ],
        color: C.stone,
        alpha: 0.45,
      },
      ...[0.3, 0.55, 0.8].map((f, i) => {
        const y = b.minY + (b.maxY - b.minY) * f;
        const s = spanAt(poly, y) ?? [b.minX, b.minX];
        return line(s[0] + 6, y + (i % 2 ? 4 : 0), s[1] - 6, y + (i % 2 ? 0 : 5), 3, C.stone, 0.7);
      }),
      ...crack(
        [
          [b.minX + 40, b.minY + 22],
          [b.minX + 50, b.minY + 40],
          [b.minX + 42, b.minY + 58],
          [b.minX + 54, b.minY + 78],
        ],
        C.stoneEdge,
      ),
      ...crack(
        [
          [b.maxX - 50, b.maxY - 50],
          [b.maxX - 40, b.maxY - 34],
          [b.maxX - 48, b.maxY - 18],
        ],
        C.stoneEdge,
      ),
      circle(b.minX + 110, b.minY + 64, 7, C.stone, 0.8),
      circle(b.minX + 30, b.maxY - 16, 6, C.stone, 0.8),
      circle(b.minX + 130, b.maxY - 14, 5, C.stone, 0.8),
      topBand(poly, 8, C.grassMid),
      ...tufts(poly, 24, C.grassTop, 12),
    ],
  },
  /** The Village Wall: neat stone blocks, a mossy cap and one tiny gold flower. */
  villageWall: {
    fill: C.stone,
    line: C.stoneEdge,
    details: (poly, b) => [
      ...courses(poly, b.minY + 16, 15, 14, C.stoneLine),
      // A darker capstone row, then moss and grass on top, and one tiny gold flower.
      rect(b.minX + 2, b.minY + 2, b.maxX - b.minX - 4, 12, C.stoneLine),
      topBand(poly, 6, C.grassMid),
      ...tufts(poly, 9, C.grassTop, 5),
      circle(b.maxX - 7, b.minY + 9, 3, C.gold),
      circle(b.minX + 8, b.maxY - 10, 4, C.grassMid, 0.8),
    ],
  },
  /** The Drawbridge: oak planks, two iron bands with rivets, and a gold crest in the middle. */
  drawbridge: {
    fill: C.wood,
    line: C.ink,
    details: (_poly, b) => {
      const out: ArtShape[] = [];
      const h = b.maxY - b.minY;
      for (let x = b.minX + 16; x < b.maxX - 4; x += 16)
        out.push(line(x, b.minY + 3, x, b.maxY - 3, 2, C.ink, 0.55));
      for (let x = b.minX + 6; x < b.maxX - 6; x += 16)
        out.push(line(x, b.minY + h * 0.35, x + 6, b.minY + h * 0.35, 2, C.gold, 0.35));
      for (const f of [0.22, 0.78]) {
        const y = b.minY + h * f;
        out.push(rect(b.minX + 3, y - 4, b.maxX - b.minX - 6, 8, C.metalDark));
        for (let x = b.minX + 8; x < b.maxX - 4; x += 16) out.push(circle(x, y, 2, C.metal));
      }
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      out.push(circle(cx, cy, 11, C.ink), circle(cx, cy, 8, C.gold), circle(cx, cy, 3, C.wood));
      return out;
    },
  },
  /** Any other wall (the Stone Wall ability): brick courses with a light top edge. */
  stoneWall: {
    fill: C.stone,
    line: C.stoneLine,
    details: (poly, b) => [
      ...courses(poly, b.minY + 24, 24, 20, C.stoneEdge),
      rect(b.minX + 3, b.minY + 3, b.maxX - b.minX - 6, 4, C.parchment, 0.35),
    ],
  },
};

/**
 * The shapes for one obstacle, in paint order: the exact collision polygon, the details (all
 * inside it), then the polygon's own outline. Same input, same shapes.
 */
export function obstacleArt(kind: ObstacleKind, poly: Polygon): ArtShape[] {
  const recipe = RECIPES[kind];
  const pts = poly.map((p) => ({ x: p.x, y: p.y }));
  return [
    { op: 'poly', pts, color: recipe.fill, alpha: 1 },
    ...keepInside(poly, recipe.details(poly, boundsOf(poly))),
    { op: 'outline', pts, width: OUTLINE_W, color: recipe.line },
  ];
}

/** Every obstacle of a layout, painted. */
export const layoutObstacleArt = (layout: BattleLayout): ArtShape[][] => {
  const kinds = obstacleKinds(layout);
  return layout.terrain.obstacles.map((o, i) => obstacleArt(kinds[i]!, o));
};
