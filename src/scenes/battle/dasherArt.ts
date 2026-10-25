// The walking dasher, Sir Bonk (Team Past) and Robo Bonk (Team Future). Pure drawing data and
// timelines, no Phaser, so tests can check them. The layer (dasherLayer.ts) paints the shapes.
//
// Each drawing faces right with the feet at 0,0, about DASHER_HEIGHT tall. The layer flips it to
// face left. Gear is toys only: a pink foam mallet and a glow noodle. Nothing sharp, nobody hurt.
//
// The walk is a straight line along the ground. Hills, mounds, pillars and walls never block it:
// the dasher is simply drawn in front of them, with a little bounce in his step.
import { SQUADS } from '../../game/config';
import type { Team, Vec2 } from '../../game/types';
import type { ArtShape } from './obstacleArt';
import { ART, PALETTE } from './visual';

const INK = PALETTE.shared.ink;

/** How tall a dasher is drawn, feet to plume, in world px. */
export const DASHER_HEIGHT = 92;
/** Where the health pips sit, above the feet. */
export const PIPS_RISE = DASHER_HEIGHT + 16;
/** How high one step bounces, in world px. */
export const STEP_BOB = 4;
/** How far a step swings each foot, in world px. */
const STRIDE_PX = 9;
/** Steps per second while walking. */
const STEPS_PER_SEC = 3.2;
/** A dizzy walk home is this much slower. */
export const DIZZY_SLOW = 0.7;

export type DasherPose = {
  /** -1..1: which foot is forward and by how much. */
  stride: number;
  /** 0 is the toy raised up behind the head, 1 is swung all the way down in front. */
  swing: number;
  /** Lean in degrees (a dizzy sway). The layer turns this into the container angle. */
  lean: number;
};

/** Standing ready: the toy held up in front. */
export const STANDING: DasherPose = { stride: 0, swing: 0.6, lean: 0 };

type Pt = Vec2;
const rad = (deg: number): number => (deg * Math.PI) / 180;
const add = (a: Pt, len: number, deg: number): Pt => ({
  x: a.x + Math.cos(rad(deg)) * len,
  y: a.y + Math.sin(rad(deg)) * len,
});

/** A thick bar with an ink edge: a wider ink line under a colored one. */
function limb(a: Pt, b: Pt, width: number, color: number): ArtShape[] {
  return [
    { op: 'line', a, b, width: width + 4, color: INK, alpha: 1 },
    { op: 'line', a, b, width, color, alpha: 1 },
  ];
}

/** A filled polygon with an ink outline. */
function shape(pts: Pt[], color: number): ArtShape[] {
  return [
    { op: 'poly', pts, color, alpha: 1 },
    { op: 'outline', pts, width: 2, color: INK },
  ];
}

/** A circle as a polygon, so it can carry an outline. */
export function ring(cx: number, cy: number, r: number, n = 14): Pt[] {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + Math.cos((i / n) * Math.PI * 2) * r,
    y: cy + Math.sin((i / n) * Math.PI * 2) * r,
  }));
}

function disc(cx: number, cy: number, r: number, color: number): ArtShape[] {
  return shape(ring(cx, cy, r), color);
}

/** A box turned to `deg`, centered on `c`. */
function box(c: Pt, w: number, h: number, deg: number): Pt[] {
  const ux = { x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) };
  const uy = { x: -ux.y, y: ux.x };
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([a, b]) => ({
    x: c.x + ux.x * (a as number) + uy.x * (b as number),
    y: c.y + ux.y * (a as number) + uy.y * (b as number),
  }));
}

/** The arm angle in degrees for a swing: from up behind the head to down in front. */
export const swingAngle = (swing: number): number => -135 + Math.max(0, Math.min(1, swing)) * 165;

/** Every shape of one dasher in one pose, feet at 0,0, facing right. Same pose in, same shapes out. */
export function dasherShapes(team: Team, pose: DasherPose): ArtShape[] {
  const past = team === 'PAST';
  const out: ArtShape[] = [];
  // A soft shadow on the ground.
  out.push({
    op: 'poly',
    pts: ring(0, 0, 1, 16).map((p) => ({ x: p.x * 20, y: p.y * 4 })),
    color: INK,
    alpha: 0.3,
  });
  const hip: Pt = { x: 0, y: -28 };
  const lift = (s: number): number => (s > 0 ? -4 * s : 0);
  const legColor = past ? ART.knightSteel : PALETTE.future.edge;
  const front = { x: pose.stride * STRIDE_PX, y: lift(pose.stride) };
  const backFoot = { x: -pose.stride * STRIDE_PX, y: lift(-pose.stride) };
  out.push(...limb(hip, backFoot, 7, legColor));
  out.push(...limb(hip, front, 7, legColor));
  // Boots.
  out.push(
    ...shape(
      box({ x: backFoot.x + 3, y: backFoot.y - 2 }, 12, 6, 0),
      past ? PALETTE.past.wood : PALETTE.future.night,
    ),
  );
  out.push(
    ...shape(
      box({ x: front.x + 3, y: front.y - 2 }, 12, 6, 0),
      past ? PALETTE.past.wood : PALETTE.future.night,
    ),
  );
  // The back arm hangs down.
  const shoulderBack: Pt = { x: -5, y: -50 };
  out.push(...limb(shoulderBack, { x: -12, y: -32 }, 6, legColor));
  // Body.
  if (past) {
    out.push(
      ...shape(
        [
          { x: -12, y: -56 },
          { x: 12, y: -56 },
          { x: 15, y: -26 },
          { x: -15, y: -26 },
        ],
        PALETTE.past.banner,
      ),
    );
    out.push(...shape(box({ x: 0, y: -40 }, 6, 16, 0), PALETTE.past.gold));
  } else {
    out.push(...shape(box({ x: 0, y: -41 }, 26, 30, 0), PALETTE.future.neon));
    out.push(...disc(0, -42, 5, PALETTE.future.glow));
  }
  // Head.
  if (past) {
    out.push(...disc(1, -66, 13, ART.knightSteel));
    out.push(...shape(box({ x: 6, y: -64 }, 11, 9, 0), ART.skin));
    out.push({ op: 'circle', x: 9, y: -65, r: 1.8, color: INK, alpha: 1 });
    out.push(
      ...shape(
        [
          { x: -2, y: -78 },
          { x: 4, y: -80 },
          { x: -6, y: -90 },
          { x: -14, y: -84 },
        ],
        ART.flame,
      ),
    );
  } else {
    out.push(...shape(box({ x: 1, y: -66 }, 26, 22, 0), ART.visor));
    out.push(...shape(box({ x: 5, y: -66 }, 16, 7, 0), PALETTE.future.glow));
    out.push(...limb({ x: 0, y: -77 }, { x: -4, y: -86 }, 2, ART.metal));
    out.push(...disc(-4, -88, 3.5, ART.pink));
  }
  // The arm with the toy swings from the front shoulder.
  const shoulder: Pt = { x: 6, y: -50 };
  const a = swingAngle(pose.swing);
  const hand = add(shoulder, 17, a);
  out.push(...limb(shoulder, hand, 6, legColor));
  if (past) {
    // A pink foam mallet: a wooden handle and a big soft head.
    const tip = add(hand, 24, a);
    out.push(...limb(hand, tip, 4, PALETTE.past.wood));
    out.push(...shape(box(add(tip, 5, a), 14, 24, a), ART.pink));
  } else {
    // A glow noodle: a fat bendy tube with a bright core.
    const tip = add(hand, 34, a);
    out.push(...limb(hand, tip, 8, PALETTE.future.glow));
    out.push({ op: 'line', a: hand, b: tip, width: 3, color: PALETTE.shared.white, alpha: 0.8 });
  }
  out.push(...disc(hand.x, hand.y, 4, past ? ART.knightSteel : ART.visor));
  return out;
}

// ---------- Health pips ----------

/** Pip size and gap, in world px. */
export const PIP = { r: 6, gap: 6, heart: 9 } as const;

/**
 * A heart, then one pip per health point, centered on 0,0. A full pip is a filled dot; an empty
 * pip is a hollow ring. The shapes differ, so the count never rests on color alone.
 */
export function healthPips(hp: number, max: number): ArtShape[] {
  const n = Math.max(0, Math.round(max));
  const have = Math.max(0, Math.min(n, Math.round(hp)));
  const width = PIP.heart * 2 + PIP.gap + n * (PIP.r * 2) + Math.max(0, n - 1) * PIP.gap;
  const left = -width / 2;
  const out: ArtShape[] = [];
  // A plate behind, so the pips read on grass, stone and sky.
  out.push({
    op: 'rect',
    x: left - 6,
    y: -PIP.heart - 5,
    w: width + 12,
    h: PIP.heart * 2 + 10,
    color: INK,
    alpha: 0.75,
  });
  const hx = left + PIP.heart;
  const heart: Pt[] = [
    { x: hx, y: PIP.heart * 0.9 },
    { x: hx - PIP.heart, y: -PIP.heart * 0.1 },
    { x: hx - PIP.heart * 0.85, y: -PIP.heart * 0.7 },
    { x: hx - PIP.heart * 0.45, y: -PIP.heart },
    { x: hx, y: -PIP.heart * 0.55 },
    { x: hx + PIP.heart * 0.45, y: -PIP.heart },
    { x: hx + PIP.heart * 0.85, y: -PIP.heart * 0.7 },
    { x: hx + PIP.heart, y: -PIP.heart * 0.1 },
  ];
  out.push({ op: 'poly', pts: heart, color: ART.pink, alpha: 1 });
  out.push({ op: 'outline', pts: heart, width: 2, color: PALETTE.shared.white });
  let x = left + PIP.heart * 2 + PIP.gap + PIP.r;
  for (let i = 0; i < n; i++) {
    if (i < have)
      out.push({ op: 'circle', x, y: 0, r: PIP.r, color: PALETTE.shared.white, alpha: 1 });
    else
      out.push({
        op: 'outline',
        pts: ring(x, 0, PIP.r - 1, 12),
        width: 2,
        color: PALETTE.shared.white,
      });
    x += PIP.r * 2 + PIP.gap;
  }
  return out;
}

// ---------- Walking ----------

/** How long a walk from `from` to `to` takes, in ms. A dizzy walk home is slower. */
export function walkDurationMs(from: Vec2, to: Vec2, dizzy = false): number {
  const speed = SQUADS.walkPxPerSec * (dizzy ? DIZZY_SLOW : 1);
  return Math.round((Math.abs(to.x - from.x) / speed) * 1000);
}

export type WalkFrame = { x: number; y: number; facing: 1 | -1; pose: DasherPose };

/**
 * Where a walker is `ms` into a walk. The path is the ground line from `from` to `to`: obstacles
 * never move it. Feet stay within STEP_BOB of the ground. A dizzy walker sways as he goes.
 */
export function walkFrame(ms: number, from: Vec2, to: Vec2, dizzy = false): WalkFrame {
  const total = walkDurationMs(from, to, dizzy);
  const t = total <= 0 ? 1 : Math.max(0, Math.min(1, ms / total));
  const facing: 1 | -1 = to.x >= from.x ? 1 : -1;
  const phase = (ms / 1000) * STEPS_PER_SEC * Math.PI * 2;
  const moving = t < 1;
  const stride = moving ? Math.sin(phase) : 0;
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t - (moving ? Math.abs(Math.sin(phase)) * STEP_BOB : 0),
    facing,
    pose: {
      stride,
      swing: STANDING.swing,
      lean: dizzy && moving ? Math.sin(phase * 0.5) * 12 : 0,
    },
  };
}

// ---------- Bonk ----------

/** How long one bonk swing takes, in ms. */
export const BONK_MS = 520;
/** How far the dasher lunges toward what he bonks, in world px. */
export const LUNGE_PX = 14;

/** A bonk `t` (0..1) of the way through: wind up, swing down hard, settle. */
export function bonkFrame(t: number): { pose: DasherPose; lunge: number } {
  const c = Math.max(0, Math.min(1, t));
  const rest = STANDING.swing;
  const swing =
    c < 0.35
      ? rest * (1 - c / 0.35)
      : c < 0.6
        ? (c - 0.35) / 0.25
        : 1 - ((c - 0.6) / 0.4) * (1 - rest);
  const lunge = c < 0.35 ? 0 : Math.sin(((c - 0.35) / 0.65) * Math.PI) * LUNGE_PX;
  return { pose: { stride: c > 0.35 && c < 0.6 ? 0.6 : 0, swing, lean: 0 }, lunge };
}

/** The moment in a bonk when the toy lands: the puff and the word show here. */
export const BONK_CONTACT = 0.6;
