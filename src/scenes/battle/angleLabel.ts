// Where the angle number ("45°") by the aim guide goes. Pure, no Phaser, so it is unit tested.
//
// It starts just past the guide's tip, out along the aim. If that spot would cover a fighter
// (its body, its letter tag or the arrow over the tag), the guide line or its handle, it tries
// spots a little further out and a little turned, nearest first, always inside the world and
// above the ground line. At Hill Fort this keeps it off Balloon A. When a spot close by is also
// clear of the solid shapes (the drawbridge deck, a tower), that spot wins, so the number does not
// hide the art. Fighters are a hard rule; solid shapes are only a preference.
import { UNITS, ridesBase } from '../../game/units';
import type { BattleLayout, Rect, Vec2 } from '../../game/types';
import { aimVector, guideTip } from './geometry';
import { ARROW_RISE, unitSpot } from './unitSpots';
import { DIAL } from './visual';

export type LabelSize = { w: number; h: number };

/**
 * The largest the label gets, in world px: the 28px readout grown to 35px on a 1024 wide screen
 * (see textScale.ts), with its padding. Chromium draws "45°" at 90x48 on a 1280 wide screen and
 * 94x51 on a 1024 wide one; this leaves room for a wider reading. The tests sweep at this size,
 * and e2e/phase2.spec.ts checks the real label fits inside it.
 */
export const ANGLE_LABEL_MAX: LabelSize = { w: 104, h: 54 };

/** How far (in try cost) the label may move just to stay off a solid shape. */
const SOFT_COST = 70;
/** Room kept between the label and anything it must not cover, and from the world's edge. */
const MARGIN = 4;
const EDGE = 8;
/** Spots further out along the aim, and turns away from it, nearest first. */
const STEP = 14;
const STEPS = 16;
const TURNS = [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 150, -150, 180];
/** Every try, cheapest first: a step out costs STEP, a degree of turn costs 1.5. Fixed order. */
const ORDER = TURNS.flatMap((turn) =>
  Array.from({ length: STEPS + 1 }, (_, k) => ({ turn, k, cost: k * STEP + Math.abs(turn) * 1.5 })),
).sort((a, b) => a.cost - b.cost || Math.abs(a.turn) - Math.abs(b.turn));

const shifted = (r: Rect, d: Vec2 | undefined): Rect =>
  d ? { x: r.x + d.x, y: r.y + d.y, w: r.w, h: r.h } : r;

/**
 * Every box the angle number must stay off: each fighter's body, and its letter tag with the
 * "picked" arrow over it. A fighter standing on its base moves with it, as the scene draws it.
 */
export function fighterKeepOut(layout: Pick<BattleLayout, 'baseShift'>): Rect[] {
  return UNITS.flatMap((def) => {
    const s = unitSpot(def);
    const d = ridesBase(def) ? layout.baseShift?.[def.team] : undefined;
    const r = s.token.r;
    const tag: Rect = {
      x: s.token.x - r,
      y: s.token.y - r - ARROW_RISE,
      w: r * 2,
      h: r * 2 + ARROW_RISE,
    };
    return [shifted(s.box, d), shifted(tag, d)];
  });
}

const overlapArea = (a: Rect, b: Rect): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

const grow = (r: Rect, m: number): Rect => ({
  x: r.x - m,
  y: r.y - m,
  w: r.w + m * 2,
  h: r.h + m * 2,
});

/** Points along the drawn guide: the flat line, the aim line and the handle's rim. */
function guidePoints(origin: Vec2, angleDeg: number, facing: 1 | -1): Vec2[] {
  const tip = guideTip(origin, angleDeg, facing);
  const flatEnd = { x: origin.x + facing * (DIAL.arcRadius + 14), y: origin.y };
  const out: Vec2[] = [];
  for (let t = 0; t <= 1.0001; t += 0.05)
    for (const end of [tip, flatEnd])
      out.push({ x: origin.x + (end.x - origin.x) * t, y: origin.y + (end.y - origin.y) * t });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    out.push({
      x: tip.x + Math.cos(a) * DIAL.handleRadius,
      y: tip.y + Math.sin(a) * DIAL.handleRadius,
    });
  }
  return out;
}

/**
 * The label's box (top left, width, height) in world px. `keepOut` is from fighterKeepOut. When no
 * spot is clear (never on a real layout, the tests sweep them all), the least covered one wins.
 */
export function angleLabelBox(
  origin: Vec2,
  angleDeg: number,
  facing: 1 | -1,
  size: LabelSize,
  keepOut: readonly Rect[],
  layout: Pick<BattleLayout, 'width' | 'height' | 'terrain'>,
): Rect {
  const solids = layout.terrain.obstacles.map((poly): Rect => {
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  });
  const o = Number.isFinite(origin.x) && Number.isFinite(origin.y) ? origin : { x: 0, y: 0 };
  const angle = Number.isFinite(angleDeg) ? angleDeg : 0;
  const floor = layout.terrain.ground[0]?.y ?? layout.height;
  const guide = guidePoints(o, angle, facing);
  const blocks = keepOut.map((r) => grow(r, MARGIN));
  const place = (cx: number, cy: number): Rect => ({
    x: Math.min(layout.width - size.w - EDGE, Math.max(EDGE, cx - size.w / 2)),
    y: Math.min(floor - size.h - MARGIN, Math.max(EDGE, cy - size.h / 2)),
    w: size.w,
    h: size.h,
  });
  const covered = (box: Rect): number => {
    let area = 0;
    for (const b of blocks) area += overlapArea(box, b);
    const g = grow(box, MARGIN);
    for (const p of guide)
      if (p.x > g.x && p.x < g.x + g.w && p.y > g.y && p.y < g.y + g.h) area += 100;
    return area;
  };

  let best: Rect | null = null;
  let bestArea = Infinity;
  let firstClear: Rect | null = null;
  for (const { turn, k, cost } of ORDER) {
    if (firstClear && cost > SOFT_COST) return firstClear;
    const v = aimVector(angle + turn, facing);
    // How far the box reaches from its center toward the guide, so it clears the handle.
    const reach = (size.w / 2) * Math.abs(v.x) + (size.h / 2) * Math.abs(v.y);
    const d = DIAL.guideLength + DIAL.labelGap + reach + k * STEP;
    const box = place(o.x + v.x * d, o.y + v.y * d);
    const area = covered(box);
    if (area === 0) {
      if (cost > SOFT_COST || solids.every((r) => overlapArea(box, r) === 0)) return box;
      firstClear ??= box;
      continue;
    }
    if (area < bestArea) {
      bestArea = area;
      best = box;
    }
  }
  return firstClear ?? best!;
}
