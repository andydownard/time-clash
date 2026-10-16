import { DAMAGE } from './config';
import type {
  ApplyBlast,
  BlastDamage,
  BlastResult,
  ClassifyBlast,
  IsWipeout,
  WinnerOf,
} from './types';

/** Distance from impact to the nearest point of the rect (0 if inside). */
export const classifyBlast: ClassifyBlast = (impact, base) => {
  const dx = Math.max(base.x - impact.x, 0, impact.x - (base.x + base.w));
  const dy = Math.max(base.y - impact.y, 0, impact.y - (base.y + base.h));
  const distance = Math.hypot(dx, dy);
  if (distance <= DAMAGE.directRadius) return 'direct';
  if (distance <= DAMAGE.nearRadius) return 'near';
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
