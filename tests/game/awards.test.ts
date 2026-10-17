import { describe, expect, it } from 'vitest';
import { AWARD_IDS, pickAwards } from '../../src/game/awards';
import type { TeamStats } from '../../src/game/types';

const stats = (over: Partial<TeamStats> = {}): TeamStats => ({
  shotsFired: 4,
  directHits: 1,
  nearHits: 1,
  questionsAnswered: 2,
  correctAnswers: 1,
  fastestAnswerMs: 3000,
  scrapEarned: 2,
  ...over,
});

describe('pickAwards', () => {
  it('gives the quickest brain to the faster answerer', () => {
    const a = pickAwards({
      PAST: stats({ fastestAnswerMs: 2000 }),
      FUTURE: stats({ fastestAnswerMs: 5000 }),
    });
    expect(a.PAST).toContain('quickestBrain');
    expect(a.FUTURE).not.toContain('quickestBrain');
  });
  it('a missing time never wins quickest brain', () => {
    const a = pickAwards({
      PAST: stats({ fastestAnswerMs: null }),
      FUTURE: stats({ fastestAnswerMs: 9000 }),
    });
    expect(a.FUTURE).toContain('quickestBrain');
    expect(a.PAST).not.toContain('quickestBrain');
  });
  it('a tie gives the award to both', () => {
    const a = pickAwards({ PAST: stats(), FUTURE: stats() });
    expect(a.PAST).toContain('quickestBrain');
    expect(a.FUTURE).toContain('quickestBrain');
  });
  it('most wobbles, sharpest shot, brain power and scrap collector go to the leader', () => {
    const a = pickAwards({
      PAST: stats({ nearHits: 3, directHits: 0, correctAnswers: 0, scrapEarned: 0 }),
      FUTURE: stats({ nearHits: 0, directHits: 4, correctAnswers: 3, scrapEarned: 6 }),
    });
    expect(a.PAST).toContain('mostWobbles');
    expect(a.FUTURE).toEqual(
      expect.arrayContaining(['sharpestShot', 'brainPower', 'scrapCollector']),
    );
  });
  it('does not hand out a prize for zero', () => {
    const a = pickAwards({
      PAST: stats({
        nearHits: 0,
        directHits: 0,
        correctAnswers: 0,
        scrapEarned: 0,
        fastestAnswerMs: null,
      }),
      FUTURE: stats({
        nearHits: 0,
        directHits: 0,
        correctAnswers: 0,
        scrapEarned: 0,
        fastestAnswerMs: null,
      }),
    });
    for (const id of [
      'mostWobbles',
      'sharpestShot',
      'brainPower',
      'scrapCollector',
      'quickestBrain',
    ] as const) {
      expect(a.PAST).not.toContain(id);
      expect(a.FUTURE).not.toContain(id);
    }
  });
  it('every player gets at least one award, whatever the numbers', () => {
    const nums = [0, 1, 3];
    for (const n of nums) {
      for (const m of nums) {
        for (const f of [null, 1500, 9000]) {
          const a = pickAwards({
            PAST: stats({
              nearHits: n,
              directHits: m,
              correctAnswers: n,
              scrapEarned: m,
              fastestAnswerMs: f,
            }),
            FUTURE: stats({
              nearHits: m,
              directHits: n,
              correctAnswers: m,
              scrapEarned: n,
              fastestAnswerMs: null,
            }),
          });
          expect(a.PAST.length).toBeGreaterThan(0);
          expect(a.FUTURE.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it('a player with nothing else gets Good Sport', () => {
    const a = pickAwards({
      PAST: stats({
        nearHits: 0,
        directHits: 0,
        correctAnswers: 0,
        scrapEarned: 0,
        fastestAnswerMs: null,
      }),
      FUTURE: stats({
        nearHits: 5,
        directHits: 5,
        correctAnswers: 5,
        scrapEarned: 5,
        fastestAnswerMs: 1000,
      }),
    });
    expect(a.PAST).toEqual(['goodSport']);
  });
  it('only known award ids come back, and none repeat for a player', () => {
    const a = pickAwards({ PAST: stats(), FUTURE: stats({ nearHits: 9 }) });
    for (const list of [a.PAST, a.FUTURE]) {
      expect(new Set(list).size).toBe(list.length);
      for (const id of list) expect(AWARD_IDS).toContain(id);
    }
  });
});

describe('pickAwards: nobody leaves with a lone consolation prize', () => {
  const none = {
    nearHits: 0,
    directHits: 0,
    correctAnswers: 0,
    scrapEarned: 0,
    fastestAnswerMs: null,
  };
  it('both teams always get Good Sport', () => {
    const a = pickAwards({
      PAST: stats({ nearHits: 5, directHits: 5, correctAnswers: 5, scrapEarned: 5 }),
      FUTURE: stats({ nearHits: 1, directHits: 1, correctAnswers: 1, scrapEarned: 1 }),
    });
    expect(a.PAST).toContain('goodSport');
    expect(a.FUTURE).toContain('goodSport');
  });
  it('a team that scored something shares one real award, so the sweep is not 4 to 1', () => {
    const a = pickAwards({
      PAST: stats({
        nearHits: 5,
        directHits: 5,
        correctAnswers: 5,
        scrapEarned: 5,
        fastestAnswerMs: 1000,
      }),
      FUTURE: stats({
        nearHits: 0,
        directHits: 0,
        correctAnswers: 1,
        scrapEarned: 0,
        fastestAnswerMs: 9000,
      }),
    });
    const real = (l: string[]) => l.filter((id) => id !== 'goodSport');
    expect(real(a.FUTURE).length).toBeGreaterThanOrEqual(1);
    expect(a.FUTURE).toContain('brainPower');
  });
  it('a team that scored nothing at all still gets only Good Sport, never a made-up prize', () => {
    const a = pickAwards({
      PAST: stats({ nearHits: 5, directHits: 5, correctAnswers: 5, scrapEarned: 5 }),
      FUTURE: stats(none),
    });
    expect(a.FUTURE).toEqual(['goodSport']);
  });
  it('is repeatable: same numbers, same awards', () => {
    const s = { PAST: stats({ nearHits: 4 }), FUTURE: stats({ correctAnswers: 0 }) };
    expect(pickAwards(s)).toEqual(pickAwards(s));
  });
});
