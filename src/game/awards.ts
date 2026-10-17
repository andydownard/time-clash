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

// When one team wins every contest, the other team shares the first of these where it scored
// something. A tie already gives an award to both, so this reads the same way. Brain-based
// awards come first because learning is the point of the game.
const SHARE_ORDER: readonly AwardId[] = [
  'brainPower',
  'scrapCollector',
  'sharpestShot',
  'mostWobbles',
  'quickestBrain',
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
  for (const t of TEAMS) {
    if (out[t].some((id) => id !== 'goodSport')) continue;
    for (const id of SHARE_ORDER) {
      const c = CONTESTS.find((x) => x.id === id) as Contest;
      const mine = c.score(stats[t]);
      if (mine !== null && mine > 0) {
        out[t].push(id);
        break;
      }
    }
  }
  // Everyone is a Good Sport. It is never a booby prize, so both teams get it.
  for (const t of TEAMS) out[t].push('goodSport');
  return out;
}
