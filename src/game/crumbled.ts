// Which sides lost bricks of their saved built base in a match. A match never changes a saved
// base, so Victory tells those sides it is safe (owner, 2026-10-25). No Phaser here.
import { TEAMS, type Match, type Team } from './types';

/** The sides with at least one built brick knocked out, Team Past first. Empty with no bricks. */
export function crumbledTeams(m: Pick<Match, 'bricks'>): Team[] {
  const bricks = Object.values(m.bricks ?? {});
  return TEAMS.filter((t) => bricks.some((b) => b.team === t && !b.alive));
}
