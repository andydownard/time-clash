// Picks which Chrono line fits the end of a match. Pure, so it is unit tested.
// It reads only the match stats the Victory screen already has. Nothing here judges a child:
// it only tells "close" from "one side landed nothing" so Chrono's words fit what happened.
import type { VictoryMood } from '../data/copy';
import { otherTeam, type Team, type TeamStats } from '../game/types';

/** A stat that is missing, negative, or not a number counts as zero. */
const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
const hits = (s: TeamStats): number => safe(s.directHits) + safe(s.nearHits);

/** A loss by this many hits or fewer is a close match. */
const CLOSE_GAP = 1;

export function victoryMood(winner: Team, stats: Record<Team, TeamStats>): VictoryMood {
  const won = hits(stats[winner]);
  const lost = hits(stats[otherTeam(winner)]);
  if (won === 0 && lost === 0) return 'solid';
  if (lost === 0) return 'shutout';
  if (won - lost <= CLOSE_GAP) return 'close';
  return 'solid';
}
