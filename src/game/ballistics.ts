import { AIM, BALLISTICS } from './config';
import type {
  ClampAim,
  CollisionHit,
  Polygon,
  Rect,
  ShotResult,
  SimulateShot,
  Team,
  Vec2,
} from './types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const clampAim: ClampAim = ({ angleDeg, power }) => ({
  angleDeg: Number.isNaN(angleDeg)
    ? AIM.defaultAngleDeg
    : clamp(angleDeg, AIM.angleMinDeg, AIM.angleMaxDeg),
  power: Number.isNaN(power) ? AIM.defaultPower : clamp(power, AIM.powerMin, AIM.powerMax),
});

const rectPolygon = (r: Rect): Polygon => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];

/** Smallest t in [0, 1] where segment a->b crosses an edge of the polygon, or null. */
const firstCrossing = (a: Vec2, b: Vec2, poly: Polygon): number | null => {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i] as Vec2;
    const q = poly[(i + 1) % poly.length] as Vec2;
    const sx = q.x - p.x;
    const sy = q.y - p.y;
    const denom = rx * sy - ry * sx;
    if (denom === 0) continue; // parallel
    const t = ((p.x - a.x) * sy - (p.y - a.y) * sx) / denom;
    const u = ((p.x - a.x) * ry - (p.y - a.y) * rx) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  return best;
};

const inside = (pt: Vec2, poly: Polygon): boolean => {
  let in_ = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec2;
    const b = poly[j] as Vec2;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x)
      in_ = !in_;
  }
  return in_;
};

type Solid = { poly: Polygon; hit: CollisionHit };

/** Pure and deterministic. Semi-implicit Euler at BALLISTICS.stepSeconds. */
export const simulateShot: SimulateShot = (input) => {
  const { origin, facing, layout } = input;
  const aim = clampAim(input);
  const wind = Number.isFinite(input.wind) ? input.wind : 0;
  const dt = BALLISTICS.stepSeconds;

  const solids: Solid[] = [
    ...(['PAST', 'FUTURE'] as Team[]).map((team) => ({
      poly: rectPolygon(layout.bases[team]),
      hit: { kind: 'base', team } as CollisionHit,
    })),
    ...layout.terrain.obstacles.map((poly, index) => ({
      poly,
      hit: { kind: 'obstacle', index } as CollisionHit,
    })),
    { poly: layout.terrain.ground, hit: { kind: 'ground' } as CollisionHit },
  ];

  const start: Vec2 = { x: origin.x, y: origin.y };
  const path: Vec2[] = [start];
  const finish = (hit: CollisionHit, landing: Vec2): ShotResult => ({
    path,
    landing,
    hit,
    steps: path.length - 1,
  });

  const buried = solids.find((s) => inside(start, s.poly));
  if (buried) return finish(buried.hit, start);

  const speed = (aim.power / 100) * BALLISTICS.maxLaunchSpeed;
  const rad = (aim.angleDeg * Math.PI) / 180;
  let vx = facing * speed * Math.cos(rad);
  let vy = -speed * Math.sin(rad);
  let pos = start;

  for (let step = 0; step < BALLISTICS.maxSteps; step++) {
    vx += wind * dt;
    vy += BALLISTICS.gravity * dt;
    const next: Vec2 = { x: pos.x + vx * dt, y: pos.y + vy * dt };

    let bestT: number | null = null;
    let bestHit: CollisionHit | null = null;
    for (const s of solids) {
      const t = firstCrossing(pos, next, s.poly);
      if (t !== null && (bestT === null || t < bestT)) {
        bestT = t;
        bestHit = s.hit;
      }
    }
    if (bestT !== null && bestHit) {
      const contact = { x: pos.x + (next.x - pos.x) * bestT, y: pos.y + (next.y - pos.y) * bestT };
      path.push(contact);
      return finish(bestHit, contact);
    }
    if (next.x < 0 || next.x > layout.width || next.y > layout.height) {
      return finish({ kind: 'out_of_bounds' }, pos);
    }
    path.push(next);
    pos = next;
  }
  return finish({ kind: 'timeout' }, pos);
};
