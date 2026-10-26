import { resolveAmmo } from './ammo';
import { AIM, BALLISTICS, DISTURBANCE } from './config';
import { birdAt, bumpVelocity, gustPushAt, segmentGap } from './disturbance';
import type {
  BirdBump,
  ClampAim,
  GustHit,
  CollisionHit,
  Polygon,
  Rect,
  ShotInput,
  ShotResult,
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

/** A shot may name its ammo (an AmmoId). Missing or unknown counts as Standard. */
export type AmmoShotInput = ShotInput & { ammo?: string };
/** `bounced` is only present when the ammo bounces: true if it did bounce. */
export type AmmoShotResult = ShotResult & { bounced?: boolean };

/** Lift off the ground after a bounce so the next step does not start on the edge. */
const BOUNCE_LIFT = 0.01;

/** Pure and deterministic. Semi-implicit Euler at BALLISTICS.stepSeconds. */
export const simulateShot = (input: AmmoShotInput): AmmoShotResult => {
  const { origin, facing, layout, speedScale } = input;
  const ammo = resolveAmmo(input.ammo);
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
  let bounced = false;
  // Birds and the gust (DISTURBANCE). Without the input the flight is the plain physics.
  const disturbance = input.disturbance;
  const bumps: BirdBump[] = [];
  const bumped = new Set<number>();
  let gust: GustHit | undefined;
  const finish = (hit: CollisionHit, landing: Vec2): AmmoShotResult => ({
    path,
    landing,
    hit,
    steps: path.length - 1,
    ...(ammo.bounces > 0 ? { bounced } : {}),
    ...(disturbance ? { bumps } : {}),
    ...(gust ? { gust } : {}),
  });

  const buried = solids.find((s) => inside(start, s.poly));
  if (buried) return finish(buried.hit, start);

  const scale =
    Number.isFinite(speedScale) && (speedScale as number) > 0 ? (speedScale as number) : 1;
  const speed = (aim.power / 100) * BALLISTICS.maxLaunchSpeed * scale * ammo.speedScale;
  const rad = (aim.angleDeg * Math.PI) / 180;
  let vx = facing * speed * Math.cos(rad);
  let vy = -speed * Math.sin(rad);
  let pos = start;
  let bouncesLeft = ammo.bounces;
  const windPush = wind * ammo.windScale;
  const stepsPerSecond = Math.round(1 / dt);
  // The gust starts a share of the way through the plain flight, so fly that first (cheap).
  const plainFlightMs = disturbance?.gust
    ? (simulateShot({ ...input, disturbance: undefined }).steps * 1000) / stepsPerSecond
    : 0;

  for (let step = 0; step < BALLISTICS.maxSteps; step++) {
    const gustPush = disturbance
      ? gustPushAt(disturbance.gust, (step * 1000) / stepsPerSecond, plainFlightMs)
      : 0;
    if (gustPush !== 0) {
      // Path point `step` is where this step starts; the push shows from the next point on.
      gust = gust
        ? { ...gust, toStep: step + 1 }
        : {
            push: gustPush,
            fromStep: step + 1,
            toStep: step + 1,
            at: pos,
            ...(disturbance?.gust?.level ? { level: disturbance.gust.level } : {}),
          };
    }
    vx += (windPush + gustPush * ammo.windScale) * dt;
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
      if (bestHit.kind === 'ground' && bouncesLeft > 0) {
        // A real bounce: the ball turns around and keeps a share of its vertical speed.
        bouncesLeft -= 1;
        bounced = true;
        vy = -vy * ammo.restitution;
        pos = { x: contact.x, y: contact.y - BOUNCE_LIFT };
        continue;
      }
      return finish(bestHit, contact);
    }
    if (next.x < 0 || next.x > layout.width || next.y > layout.height) {
      return finish({ kind: 'out_of_bounds' }, pos);
    }
    path.push(next);
    if (disturbance && disturbance.birds.length > 0) {
      // Each bird bumps a shell at most once. Its place comes from the bird clock, so the same
      // launch time always meets the bird at the same spot.
      const flownMs = ((step + 1) * 1000) / stepsPerSecond;
      if (flownMs >= DISTURBANCE.birds.launchGraceMs) {
        const clock = Number.isFinite(disturbance.birdMs) ? disturbance.birdMs : 0;
        for (const bird of disturbance.birds) {
          if (bumped.has(bird.id)) continue;
          const at = birdAt(bird, clock + flownMs);
          if (segmentGap(at, pos, next) > DISTURBANCE.birds.hitRadius) continue;
          bumped.add(bird.id);
          bumps.push({ bird: bird.id, step: path.length - 1, at: next, birdAt: at });
          ({ vx, vy } = bumpVelocity({ vx, vy }, next, at, bird.nudgeDeg));
        }
      }
    }
    pos = next;
  }
  return finish({ kind: 'timeout' }, pos);
};
