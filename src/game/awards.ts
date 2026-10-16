// End-of-match awards. Each one is a pat on the back that a player can win, never a ranking
// of who is better. Every player always gets at least one (AGENTS.md: nobody is shamed).
import { TEAMS, type Team, type TeamStats } from './types';

export const AWARD_IDS = [
  'quickestBrain',
  'mostWobbles',
  'sharpestShot',
  'brainPower',
  'scrapCollector',
  'goodSport',
] as const;
export type AwardId = (typeof AWARD_IDS)[number];

type Contest = { id: AwardId; score: (s: TeamStats) => number | null };

// Higher score wins. null or 0 never wins. A tie gives the award to both.
const CONTESTS: readonly Contest[] = [
  {
    id: 'quickestBrain',
    score: (s) => (s.fastestAnswerMs === null ? null : 1e9 - s.fastestAnswerMs),
  },
  { id: 'mostWobbles', score: (s) => s.nearHits },
  { id: 'sharpestShot', score: (s) => s.directHits },
  { id: 'brainPower', score: (s) => s.correctAnswers },
  { id: 'scrapCollector', score: (s) => s.scrapEarned },
];

export function pickAwards(stats: Record<Team, TeamStats>): Record<Team, AwardId[]> {
  const out: Record<Team, AwardId[]> = { PAST: [], FUTURE: [] };
  for (const c of CONTESTS) {
    const scores = TEAMS.map((t) => c.score(stats[t]));
    const best = Math.max(...scores.map((n) => n ?? -Infinity));
    if (!(best > 0)) continue;
    TEAMS.forEach((t, i) => {
      if (scores[i] === best) out[t].push(c.id);
    });
  }
  for (const t of TEAMS) if (out[t].length === 0) out[t].push('goodSport');
  return out;
}
