import { CHARACTER_HEALTH, DAMAGE } from './config';
import { UNIT_IDS, unitBox, unitsOf, type UnitId } from './units';
import type {
  ApplyBlast,
  BlastDamage,
  BattleLayout,
  BlastResult,
  IsWipeout,
  Team,
  Rect,
  Vec2,
  WinnerOf,
} from './types';

export type RadiusScale = number | { direct: number; near: number };

/**
 * Distance from impact to the nearest point of the rect (0 if inside).
 * `radiusScale` widens both blast distances (a number) or each one (an object). Default 1.
 * A bad scale (NaN, zero, negative) counts as 1.
 */
export const classifyBlast = (
  impact: Vec2,
  base: Rect,
  radiusScale: RadiusScale = 1,
): BlastResult => {
  const ok = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 1);
  const directScale = ok(typeof radiusScale === 'number' ? radiusScale : radiusScale.direct);
  const nearScale = ok(typeof radiusScale === 'number' ? radiusScale : radiusScale.near);
  const dx = Math.max(base.x - impact.x, 0, impact.x - (base.x + base.w));
  const dy = Math.max(base.y - impact.y, 0, impact.y - (base.y + base.h));
  const distance = Math.hypot(dx, dy);
  if (distance <= DAMAGE.directRadius * directScale) return 'direct';
  if (distance <= DAMAGE.nearRadius * nearScale) return 'near';
  return 'miss';
};

const TABLE: Record<BlastResult, number> = {
  direct: DAMAGE.direct,
  near: DAMAGE.near,
  miss: 0,
};

export const blastDamage: BlastDamage = (result) => TABLE[result];

export const applyBlast: ApplyBlast = (hp, target, result) => ({
  ...hp,
  [target]: Math.max(0, hp[target] - blastDamage(result)),
});

export const isWipeout: IsWipeout = (hp, team) => hp[team] <= 0;

export const winnerOf: WinnerOf = (hp) => {
  const pastDown = isWipeout(hp, 'PAST');
  const futureDown = isWipeout(hp, 'FUTURE');
  if (pastDown === futureDown) return null;
  return pastDown ? 'FUTURE' : 'PAST';
};

// ---------- Character health (CHARACTER_HEALTH) ----------

/** Health of every fighter, both teams, by id. */
export type UnitHp = Record<UnitId, number>;

/** Everyone at full health. */
export const freshUnitHp = (hp: number = CHARACTER_HEALTH.hp): UnitHp =>
  Object.fromEntries(UNIT_IDS.map((id) => [id, hp])) as UnitHp;

/** The fighters of `team` still standing (health above 0), in roster order. */
export const aliveUnitIds = (unitHp: Readonly<UnitHp>, team: Team): UnitId[] =>
  unitsOf(team)
    .filter((u) => unitHp[u.id] > 0)
    .map((u) => u.id);

/** True when every fighter on `team` is at 0. */
export const teamKnockedOut = (unitHp: Readonly<UnitHp>, team: Team): boolean =>
  aliveUnitIds(unitHp, team).length === 0;

/** The team whose opponent has no fighters left, or null while both have some. */
export const winnerOfUnits = (unitHp: Readonly<UnitHp>): Team | null => {
  const pastOut = teamKnockedOut(unitHp, 'PAST');
  const futureOut = teamKnockedOut(unitHp, 'FUTURE');
  if (pastOut === futureOut) return null;
  return pastOut ? 'FUTURE' : 'PAST';
};

/** Health lost to a direct hit. A near miss is 0. A Power Shot is `powerHit` (2). */
export const unitDamage = (result: BlastResult, power: boolean): number => {
  if (result === 'direct') return power ? CHARACTER_HEALTH.powerHit : CHARACTER_HEALTH.directHit;
  if (result === 'near') return CHARACTER_HEALTH.nearHit;
  return 0;
};

export type UnitBlastHit = { unit: UnitId; result: 'direct' | 'near' };

export type UnitBlast = {
  /** Where the shot burst: the first fighter it met, or its landing point. */
  impact: Vec2;
  /** At most one 'direct' (the shot stops there). Any other fighter close by is 'near'. */
  hits: UnitBlastHit[];
};

const UNIT_SCALE = {
  direct: CHARACTER_HEALTH.directScale,
  near: CHARACTER_HEALTH.nearScale,
} as const;

/**
 * Scores one shot against the standing fighters of `target`. The shell flies along `path`
 * and bursts on the first fighter box it touches (with a little slack), else where it lands.
 * Uses `classifyBlast` on each fighter's box, so air fighters can be hit in flight.
 */
export const resolveUnitBlast = (
  path: readonly Vec2[],
  landing: Vec2,
  target: Team,
  unitHp: Readonly<UnitHp>,
  layout: Pick<BattleLayout, 'launchOrigins'>,
): UnitBlast => {
  const alive = aliveUnitIds(unitHp, target).map((id) => ({
    id,
    box: unitBox(target, id, layout),
  }));
  let impact = landing;
  let direct: UnitId | null = null;
  scan: for (const pt of [...path, landing]) {
    for (const u of alive) {
      if (classifyBlast(pt, u.box, UNIT_SCALE) === 'direct') {
        direct = u.id;
        impact = pt;
        break scan;
      }
    }
  }
  const hits: UnitBlastHit[] = [];
  if (direct) hits.push({ unit: direct, result: 'direct' });
  for (const u of alive) {
    if (u.id === direct) continue;
    if (classifyBlast(impact, u.box, UNIT_SCALE) !== 'miss')
      hits.push({ unit: u.id, result: 'near' });
  }
  return { impact, hits };
};

/** Smallest distance from any point of a flight to a box. The bot scores aims with it. */
export const pathGap = (path: readonly Vec2[], box: Rect): number => {
  let best = Number.POSITIVE_INFINITY;
  for (const pt of path) {
    const d = Math.hypot(
      Math.max(box.x - pt.x, 0, pt.x - (box.x + box.w)),
      Math.max(box.y - pt.y, 0, pt.y - (box.y + box.h)),
    );
    if (d < best) best = d;
  }
  return best;
};

/** The winner in either mode: by fighters when `characterHealth`, else by base health. */
export const winnerOfMatch = (m: {
  baseHp: Record<Team, number>;
  unitHp: Readonly<UnitHp>;
  characterHealth: boolean;
}): Team | null => (m.characterHealth ? winnerOfUnits(m.unitHp) : winnerOf(m.baseHp));
