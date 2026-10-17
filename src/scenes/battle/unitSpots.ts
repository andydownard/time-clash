// Where each fighter is drawn on the battlefield. Pure, no Phaser, so tests can check the layout.
// Every fighter is drawn facing right in its own space, with its muzzle (launch point) at 0,0.
// Future fighters are mirrored. The box is the space the drawing fills, relative to the muzzle.
import { UNITS, type UnitDef, type UnitId, type UnitRole } from '../../game/units';
import { TEAM_FACING } from '../../game/config';
import type { Rect, Team } from '../../game/types';

export type LocalBox = { l: number; r: number; t: number; b: number };

/** How far each drawing reaches from its muzzle, facing right. t is up (negative), b is down. */
export const UNIT_BOXES: Record<UnitRole, LocalBox> = {
  balloon: { l: -58, r: 6, t: -104, b: 16 },
  archer: { l: -34, r: 8, t: -14, b: 48 },
  cannon: { l: -66, r: 6, t: -22, b: 34 },
  catapult: { l: -52, r: 14, t: -52, b: 22 },
  spear: { l: -52, r: 8, t: -42, b: 22 },
  tank: { l: -62, r: 12, t: -36, b: 22 },
  helicopter: { l: -62, r: 8, t: -44, b: 26 },
  bunker: { l: -42, r: 42, t: -48, b: 22 },
  saber: { l: -52, r: 6, t: -42, b: 22 },
  laserGun: { l: -34, r: 8, t: -14, b: 52 },
};

/** The round letter or number token. Every fighter uses the same size. */
export const TOKEN_RADIUS = 17;
/** Gap between the top of a fighter and its token. */
export const TOKEN_GAP = 8;
/** The selected marker floats this far above the token's top edge. */
export const ARROW_RISE = 38;

export type UnitSpot = {
  id: UnitId;
  team: Team;
  role: UnitRole;
  /** The muzzle in world space (the fighter's origin from UNITS). */
  x: number;
  y: number;
  facing: 1 | -1;
  /** The space the drawing fills, in world space. */
  box: Rect;
  token: { x: number; y: number; r: number };
  /** Where the tip of the selected arrow points to. */
  arrowTip: { x: number; y: number };
};

export function unitSpot(def: UnitDef): UnitSpot {
  const facing = TEAM_FACING[def.team];
  const lb = UNIT_BOXES[def.role];
  const { x, y } = def.origin;
  const xs = [x + lb.l * facing, x + lb.r * facing];
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const box: Rect = { x: left, y: y + lb.t, w: right - left, h: lb.b - lb.t };
  const token = {
    x: left + (right - left) / 2,
    y: box.y - TOKEN_GAP - TOKEN_RADIUS,
    r: TOKEN_RADIUS,
  };
  return {
    id: def.id,
    team: def.team,
    role: def.role,
    x,
    y,
    facing,
    box,
    token,
    arrowTip: { x: token.x, y: token.y - TOKEN_RADIUS - 6 },
  };
}

export const unitSpots = (): UnitSpot[] => UNITS.map(unitSpot);

/** Share of the narrower box's width that two boxes overlap by, when they also overlap in height. */
export function overlapShare(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return w / Math.min(a.w, b.w);
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return overlapShare(a, b) > 0;
}
