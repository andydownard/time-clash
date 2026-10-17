import { DAMAGE } from './config';
import type {
  ApplyBlast,
  BlastDamage,
  BlastResult,
  IsWipeout,
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
