// Fighters on a built base. Pure, no Phaser.
//
// A fighter that stood on the old castle or secret base (`ridesBase`: the Archer, the Cannon
// Knight, the Tank and the Laser Gun Robot) stands on the top brick of a built base instead of in
// the air over a small one (owner, 2026-10-25). It stands on the highest standing brick under its
// feet; with no brick there it stands on the ground under the base. A base taller than the old
// castle lifts it (at most BASE_RIDERS.maxRise higher than the old castle; owner, 2026-10-28:
// the bases are drawn big). When that brick falls, the fighter lands on whatever is below. Nobody is hurt.
// Only the height changes, never the x. The shot, the Computer player, the preview and the angle
// guide all read `riderOrigin`, so the shell leaves from where the fighter is drawn.
import { BASE_RIDERS, TEAM_FACING } from './config';
import type { BattleLayout, BrickView, Match, Rect, Team, Vec2 } from './types';
import { UNITS, firingOrigin, ridesBase, unitById, type UnitId } from './units';

/** The part of a brick a rider stands on. */
export type RiderBrick = Pick<BrickView, 'team' | 'box' | 'alive'>;

/** The fighters that stand on their base, in roster order. */
export const RIDER_IDS: readonly UnitId[] = UNITS.filter(ridesBase).map((u) => u.id);

type RiderLayout = Pick<BattleLayout, 'launchOrigins' | 'baseShift' | 'bases'>;

/**
 * Where a rider's feet are on the old castle: the span they stand on (the middle of the drawing,
 * `BASE_RIDERS.footShare` of its width) and their height. Null for a fighter that is not a rider.
 */
export function riderFeet(
  team: Team,
  unitId: string,
  layout: RiderLayout,
): { left: number; right: number; y: number } | null {
  const unit = unitById(unitId);
  if (!unit || unit.team !== team || !ridesBase(unit)) return null;
  const foot = BASE_RIDERS.foot[unit.role];
  if (!foot) return null;
  const o = firingOrigin(team, unitId, layout);
  const facing = TEAM_FACING[team];
  const a = o.x + foot.l * facing;
  const b = o.x + foot.r * facing;
  const mid = (a + b) / 2;
  const half = (Math.abs(b - a) * BASE_RIDERS.footShare) / 2;
  return { left: mid - half, right: mid + half, y: o.y + foot.b };
}

const under = (box: Rect, left: number, right: number): boolean =>
  box.x < right && box.x + box.w > left;

/**
 * How far below its old spot a rider stands, in world px. Negative means it stands higher than on
 * the old castle (on the top of a tall base), by at most `BASE_RIDERS.maxRise`. `bricks` null
 * means the team has no built base in play: nothing moves. Any order of bricks gives the same
 * answer.
 */
export function riderDrop(
  team: Team,
  unitId: string,
  layout: RiderLayout,
  bricks: readonly RiderBrick[] | null,
): number {
  if (!bricks) return 0;
  const feet = riderFeet(team, unitId, layout);
  if (!feet) return 0;
  const base = layout.bases[team];
  let surface = base.y + base.h;
  for (const b of bricks) {
    if (b.team !== team || !b.alive || !under(b.box, feet.left, feet.right)) continue;
    surface = Math.min(surface, b.box.y);
  }
  return Math.max(-BASE_RIDERS.maxRise, surface - feet.y);
}

/** Where this fighter's shot starts, standing on its built base. Same as firingOrigin without one. */
export function riderOrigin(
  team: Team,
  unitId: string,
  layout: RiderLayout,
  bricks: readonly RiderBrick[] | null,
): Vec2 {
  const o = firingOrigin(team, unitId, layout);
  const drop = riderDrop(team, unitId, layout, bricks);
  return drop !== 0 ? { x: o.x, y: o.y + drop } : o;
}

type RiderSnapshot = Pick<Match, 'characterHealth' | 'builtBase' | 'bricks'>;

/**
 * The bricks a team's riders stand on, or null when riders do not move: no built base in play for
 * that team, or character health is on (its fighter hit boxes stay where they were).
 */
export function riderBricks(snap: RiderSnapshot, team: Team): RiderBrick[] | null {
  if (snap.characterHealth || !snap.builtBase?.[team] || !snap.bricks) return null;
  return Object.values(snap.bricks).filter((b) => b.team === team);
}

/** Every rider that stands lower than on the old castle right now, and by how much. */
export function riderDrops(
  snap: RiderSnapshot,
  layout: RiderLayout,
): Partial<Record<UnitId, number>> {
  const out: Partial<Record<UnitId, number>> = {};
  for (const id of RIDER_IDS) {
    const team = (unitById(id) as NonNullable<ReturnType<typeof unitById>>).team;
    const d = riderDrop(team, id, layout, riderBricks(snap, team));
    if (d !== 0) out[id] = d;
  }
  return out;
}

/** Where the picked fighter's shot starts in this match right now. */
export const shooterOrigin = (
  snap: RiderSnapshot,
  team: Team,
  unitId: string,
  layout: RiderLayout,
): Vec2 => riderOrigin(team, unitId, layout, riderBricks(snap, team));
