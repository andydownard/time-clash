// The Camp hawk as a small solid. It has a body, a head with a beak and eyes, two thick wings and
// a tail. Each is a handful of flat faces in 3D. We turn the whole bird about its upright axis,
// tilt the camera down a little, add a touch of perspective, then paint the faces back to front
// in flat colors with a thick outline, so it keeps the picture's cartoon look and still has
// volume at every angle. Pure math, no DOM, so it is easy to test. No randomness.

type V3 = readonly [number, number, number];
type Tones = readonly string[];

/** Every color the hawk uses, grouped by part. Each group is a lit, a middle and a shaded tone. */
export const HAWK_COLORS = {
  back: ['#8a6040', '#6b4a32', '#4f3524'],
  belly: ['#fbf1dc', '#f0e0c2', '#d6c19b'],
  head: ['#7b5636', '#5e4129', '#46301f'],
  beak: ['#ffe066', '#ffcf3a', '#d9a31f'],
  eyeWhite: ['#ffffff', '#f7ebcb', '#d6c9aa'],
  eyePupil: ['#12102b'],
  wingTop: ['#a4764b', '#8a5e3c', '#6b4a32'],
  wingTip: ['#5a3d27', '#4a3322', '#3b2a1f'],
  wingUnder: ['#f7ecd6', '#ecdcba', '#cdb892'],
  wingEdge: ['#6b4a32', '#5a3d27', '#4a3322'],
  tail: ['#d4602e', '#b8481f', '#8a3418'],
  tailUnder: ['#f0d2a8', '#e0b88a', '#c29a6c'],
  tailTip: ['#fbf1dc', '#f3e6cf', '#d6c19b'],
  outline: ['#3b2a1f'],
} as const satisfies Record<string, readonly string[]>;

/** One painted shape, in the hawk's own units, centred on the middle of its body. */
export type HawkPaint = { d: string; fill: string; stroke: string; width: number };
/** How the bird is turned and how high its wing tips are lifted (degrees). */
export type HawkView = { yaw: number; flap: number };

/** The still pose: three-quarter view with the wings held a little up, so thickness shows. */
export const HAWK_STILL: HawkView = { yaw: 62, flap: 10 };

/** Where the still hawk sits, as an offset from the middle of his circle (reduced motion). */
export const HAWK_STILL_AT = { x: 390, y: 96, scale: 1.05 };

/** Everything that shapes the look, in one place. */
const LOOK = {
  /** Model units to picture units. */
  size: 1.4,
  /** The camera looks up at the bird in the sky (negative), so its belly and wing undersides show. */
  pitch: -17,
  /** How far the bird leans into its circle, in degrees. */
  bank: 9,
  /** Camera distance in model units: smaller means stronger perspective. */
  lens: 700,
  /** Light from above, left and in front (in camera space). */
  light: [-0.35, 0.75, 0.55] as V3,
  /** Outline thickness around each part, and the thin seam-hiding stroke on each face. */
  outline: 4.2,
  seam: 0.9,
  /** Where each wing starts (it grows out of the body's side) and how far it reaches. */
  rootZ: 13,
  span: 70,
};

type Face = { pts: V3[]; tones: Tones };
type Part = { faces: Face[]; bias: number; wing?: boolean };

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};
const mid = (pts: readonly V3[]): V3 => {
  const n = pts.length;
  return [
    pts.reduce((s, p) => s + p[0], 0) / n,
    pts.reduce((s, p) => s + p[1], 0) / n,
    pts.reduce((s, p) => s + p[2], 0) / n,
  ];
};
/** The face's normal, from a sum over its corners (works for any simple polygon). */
function normalOf(pts: readonly V3[]): V3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}
/** Orders the corners so the face looks outward: its normal points along `want`. */
function facing(pts: V3[], want: V3): V3[] {
  return dot(normalOf(pts), want) >= 0 ? pts : [...pts].reverse();
}

/** A closed solid egg: radii along x (nose to tail), y (up) and z (side). */
function ellipsoid(c: V3, r: V3, across: number, along: number, pick: (n: V3) => Tones): Face[] {
  const ring = (i: number, j: number): V3 => {
    const phi = (Math.PI * i) / along;
    const psi = (2 * Math.PI * j) / across;
    return [
      c[0] + r[0] * Math.cos(phi),
      c[1] + r[1] * Math.sin(phi) * Math.cos(psi),
      c[2] + r[2] * Math.sin(phi) * Math.sin(psi),
    ];
  };
  const faces: Face[] = [];
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < across; j++) {
      const raw = [ring(i, j), ring(i, j + 1), ring(i + 1, j + 1), ring(i + 1, j)];
      // The poles squeeze a quad to a triangle: drop the repeated corner.
      const pts = raw.filter((p, k) => k === 0 || Math.hypot(...sub(p, raw[k - 1]!)) > 1e-6);
      if (pts.length < 3) continue;
      const out = unit(sub(mid(pts), c));
      faces.push({ pts: facing(pts, out), tones: pick(out) });
    }
  }
  return faces;
}

/** A flat plate (a wing or tail piece) seen from above as `plan` (x, z pairs), with real thickness. */
function plate(
  plan: ReadonlyArray<readonly [number, number]>,
  y: number,
  thick: number,
  tones: { top: Tones; bottom: Tones; edge: Tones },
): Face[] {
  const hi = y + thick / 2;
  const lo = y - thick / 2;
  const at = (h: number) => plan.map(([x, z]): V3 => [x, h, z]);
  const c = mid(at(y));
  const faces: Face[] = [
    { pts: facing(at(hi), [0, 1, 0]), tones: tones.top },
    { pts: facing(at(lo), [0, -1, 0]), tones: tones.bottom },
  ];
  for (let i = 0; i < plan.length; i++) {
    const [ax, az] = plan[i]!;
    const [bx, bz] = plan[(i + 1) % plan.length]!;
    const pts: V3[] = [
      [ax, hi, az],
      [bx, hi, bz],
      [bx, lo, bz],
      [ax, lo, az],
    ];
    faces.push({ pts: facing(pts, unit(sub(mid(pts), c))), tones: tones.edge });
  }
  return faces;
}

/** A pointed pyramid on a four-corner base, for the beak. */
function pyramid(base: readonly V3[], tip: V3, tones: Tones): Face[] {
  const c = mid([...base, tip]);
  return base.map((a, i) => {
    const pts: V3[] = [a, base[(i + 1) % base.length]!, tip];
    return { pts: facing(pts, unit(sub(mid(pts), c))), tones };
  });
}

// ---- The bird, in model units: x runs nose-ward, y up, z out to the bird's right wing. ----

type Plan = ReadonlyArray<readonly [number, number]>;
const WING_INNER: Plan = [
  [14, 13],
  [18, 26],
  [26, 44],
  [-6, 44],
  [-14, 28],
  [-12, 13],
];
const WING_TIP: Plan = [
  [26, 44],
  [28, 58],
  [34, 70],
  [26, 66],
  [24, 76],
  [16, 66],
  [12, 74],
  [5, 62],
  [0, 66],
  [-4, 52],
  [-6, 44],
];
const TAIL_INNER: Plan = [
  [-30, 7],
  [-52, 16],
  [-52, -16],
  [-30, -7],
];
const TAIL_TIP: Plan = [
  [-52, 16],
  [-62, 12],
  [-58, 6],
  [-64, 0],
  [-58, -6],
  [-62, -12],
  [-52, -16],
];

const bodyTones = (n: V3): Tones => (n[1] < -0.12 ? HAWK_COLORS.belly : HAWK_COLORS.back);
const headTones = (n: V3): Tones => (n[1] < -0.55 ? HAWK_COLORS.belly : HAWK_COLORS.head);

/** A wing on the bird's right (side = 1) or left (side = -1). */
function wing(side: 1 | -1): Face[] {
  const flip = (plan: Plan): Plan => plan.map(([x, z]) => [x, z * side] as const);
  return [
    ...plate(flip(WING_INNER), 0, 4.4, {
      top: HAWK_COLORS.wingTop,
      bottom: HAWK_COLORS.wingUnder,
      edge: HAWK_COLORS.wingEdge,
    }),
    ...plate(flip(WING_TIP), 0, 4.4, {
      top: HAWK_COLORS.wingTip,
      bottom: HAWK_COLORS.wingTip,
      edge: HAWK_COLORS.wingEdge,
    }),
  ];
}

function tail(): Face[] {
  const lift = (f: Face): Face => ({
    ...f,
    pts: f.pts.map((p): V3 => [p[0], p[1] + (-p[0] - 30) * 0.1, p[2]]),
  });
  return [
    ...plate(TAIL_INNER, 1, 3, {
      top: HAWK_COLORS.tail,
      bottom: HAWK_COLORS.tailUnder,
      edge: HAWK_COLORS.tail,
    }),
    ...plate(TAIL_TIP, 1, 3, {
      top: HAWK_COLORS.tailTip,
      bottom: HAWK_COLORS.tailTip,
      edge: HAWK_COLORS.tailTip,
    }),
  ].map(lift);
}

function head(): Face[] {
  const eye = (z: 1 | -1): Face[] => [
    ...ellipsoid([41, 10.5, 7.4 * z], [3.2, 3.4, 2.4], 8, 5, () => HAWK_COLORS.eyeWhite),
    ...ellipsoid([42.6, 10.5, 9.2 * z], [1.8, 2, 1.2], 8, 5, () => HAWK_COLORS.eyePupil),
  ];
  const beak = pyramid(
    [
      [44, 11, -4.5],
      [44, 11, 4.5],
      [44, 1, 4.5],
      [44, 1, -4.5],
    ],
    [56, -1, 0],
    HAWK_COLORS.beak,
  );
  return [...ellipsoid([37, 7, 0], [10, 9, 9], 12, 8, headTones), ...beak, ...eye(1), ...eye(-1)];
}

const PARTS: Part[] = [
  { faces: ellipsoid([0, 0, 0], [34, 15, 15], 14, 9, bodyTones), bias: 0 },
  { faces: head(), bias: 4 },
  { faces: tail(), bias: -2 },
  { faces: wing(1), bias: -10, wing: true },
  { faces: wing(-1), bias: -10, wing: true },
];

// ---- Turning and painting ----

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Lifts a wing's tips: the further out a point is, the more it bends up. */
function flapped(p: V3, lift: number): V3 {
  const side = p[2] < 0 ? -1 : 1;
  const out = Math.max(0, Math.abs(p[2]) - LOOK.rootZ);
  const reach = Math.min(1, out / (LOOK.span - LOOK.rootZ));
  const a = rad(lift) * (0.45 + 0.55 * reach);
  const y = p[1] * Math.cos(a) + out * Math.sin(a);
  const z = (LOOK.rootZ + out * Math.cos(a) - p[1] * Math.sin(a)) * side;
  return [p[0], y, z];
}

/** Leans into the circle, turns about the upright axis, then tilts the camera. */
function turned(p: V3, yaw: number): V3 {
  const b = rad(LOOK.bank);
  const y1 = p[1] * Math.cos(b) - p[2] * Math.sin(b);
  const z1 = p[1] * Math.sin(b) + p[2] * Math.cos(b);
  // The nose (+x) swings toward the viewer (+z) as yaw grows.
  const x2 = p[0] * Math.cos(yaw) - z1 * Math.sin(yaw);
  const z2 = p[0] * Math.sin(yaw) + z1 * Math.cos(yaw);
  const a = rad(LOOK.pitch);
  return [x2, y1 * Math.cos(a) - z2 * Math.sin(a), y1 * Math.sin(a) + z2 * Math.cos(a)];
}

const f2 = (n: number): string => (Math.round(n * 100) / 100).toString();

type Seen = { pts: V3[]; fill: string; depth: number };

/** The shapes to paint, back to front, for the bird turned by `view`. */
export function hawkPaints(view: HawkView): HawkPaint[] {
  const deg = Number.isFinite(view.yaw) ? ((view.yaw % 360) + 360) % 360 : 0;
  const yaw = rad(deg);
  const lift = Number.isFinite(view.flap) ? view.flap : 0;
  const light = unit(LOOK.light);
  const project = (p: V3): string => {
    const k = LOOK.lens / (LOOK.lens - p[2]);
    return `${f2(p[0] * k * LOOK.size)} ${f2(-p[1] * k * LOOK.size)}`;
  };

  const drawn = PARTS.map((part) => {
    const place = (p: V3): V3 => turned(part.wing ? flapped(p, lift) : p, yaw);
    const seen: Seen[] = [];
    for (const face of part.faces) {
      const pts = face.pts.map(place);
      const n = unit(normalOf(pts));
      if (n[2] <= 0) continue;
      const shade = dot(n, light);
      const band = face.tones.length === 1 ? 0 : shade > 0.55 ? 0 : shade > 0.05 ? 1 : 2;
      seen.push({ pts, fill: face.tones[band]!, depth: mid(pts)[2] });
    }
    seen.sort((a, b) => a.depth - b.depth);
    const key = place(mid(part.faces.flatMap((f) => f.pts)))[2] + part.bias;
    return { seen, key };
  }).sort((a, b) => a.key - b.key);

  const paints: HawkPaint[] = [];
  const line = HAWK_COLORS.outline[0];
  const shape = (f: Seen): string => `M${f.pts.map(project).join('L')}Z`;
  for (const part of drawn) {
    if (part.seen.length === 0) continue;
    paints.push({ d: part.seen.map(shape).join(''), fill: line, stroke: line, width: LOOK.outline });
    for (const f of part.seen) {
      paints.push({ d: shape(f), fill: f.fill, stroke: f.fill, width: LOOK.seam });
    }
  }
  return paints;
}

/** SVG paths for the paints (each part's outline comes first, so it sits behind its faces). */
export function hawkMarkup(paints: readonly HawkPaint[]): string {
  return paints
    .map(
      (p) =>
        `<path d="${p.d}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.width}" stroke-linejoin="round"/>`,
    )
    .join('');
}
