// Decides which effect a landed shot gets. Pure, so it is unit tested.
import { HITS } from '../../data/copy';
import { WORLD } from '../../game/config';
import type { BlastOutcome, ShotResult, Team } from '../../game/types';
import type { EffectKind, ImpactInfo } from './types';
import { IMPACT_SCALE } from './visual';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

const AMMO: Record<Team, EffectKind> = { PAST: 'confetti', FUTURE: 'plasma' };

export function describeImpact(
  shooter: Team,
  shot: ShotResult,
  outcome: BlastOutcome,
  chosenLabel?: string,
): ImpactInfo {
  const position = {
    x: clamp(shot.landing.x, 0, WORLD.width),
    y: clamp(shot.landing.y, 0, WORLD.height),
  };
  let kind: EffectKind;
  let label: string;
  switch (outcome.result) {
    case 'direct':
      kind = 'blocks';
      label = HITS.direct;
      break;
    case 'near':
      kind = AMMO[shooter];
      label = HITS.near;
      break;
    default:
      kind = 'puff';
      label = HITS.miss;
  }
  return {
    kind,
    position,
    target: outcome.target,
    shooter,
    result: outcome.result,
    damage: outcome.damage,
    scale: IMPACT_SCALE[outcome.result],
    label: chosenLabel ?? label,
  };
}
