// Pace (owner, 2026-10-24): "perfect aim should take about five turns; right now you can lose
// everything in one or two turns." A player who never misses and answers every reload right
// still needs five turns of their own to win, so a match is never over in one or two turns.
// `turns` counts the turns of both teams, so the first mover winning on its fifth turn is 9.
import { describe, expect, it } from 'vitest';
import { playBotMatch, type SimResult } from '../../src/game/botPlay';
import { PRACTICE_BOT, type BotProfile } from '../../src/game/config';
import type { Team } from '../../src/game/types';

/** No aim error, reads the wind fully, and always answers right (the reload ceiling still applies). */
const PERFECT: BotProfile = {
  angleSpreadDeg: 0,
  powerSpreadPct: 0,
  windSkill: 1,
  reloadAccuracy: 1,
  thinkScale: 1,
};

/** Five turns of the winner's own, plus the four turns the other team had in between. */
const OWN_TURNS_TO_WIN = 5;
const MIN_TOTAL_TURNS = 2 * OWN_TURNS_TO_WIN - 1;
const SEEDS = 40;
const GRADE = 3;

const play = (profile: BotProfile, characterHealth: boolean): SimResult[] =>
  Array.from({ length: SEEDS }, (_, i) => {
    const seed = i + 1;
    const firstTeam: Team = seed % 2 ? 'PAST' : 'FUTURE';
    return playBotMatch({
      seed,
      firstTeam,
      grade: GRADE,
      characterHealth,
      profiles: { PAST: profile, FUTURE: profile },
    });
  });

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

describe.each([
  ['base health', false],
  ['fighter health', true],
] as const)('pace with %s', (_label, characterHealth) => {
  it('perfect aim on both sides never wins before its fifth turn', () => {
    const results = play(PERFECT, characterHealth);
    for (const [i, r] of results.entries()) {
      expect(r.ended, `seed ${i + 1}`).toBe(true);
      expect(r.winner, `seed ${i + 1}`).not.toBeNull();
    }
    expect(Math.min(...results.map((r) => r.turns))).toBeGreaterThanOrEqual(MIN_TOTAL_TURNS);
  }, 300_000);

  it('a realistic player (the scripted human) takes at least as long, at the median', () => {
    const results = play(PRACTICE_BOT.scriptedHuman, characterHealth);
    for (const r of results) expect(r.ended).toBe(true);
    expect(median(results.map((r) => r.turns))).toBeGreaterThanOrEqual(MIN_TOTAL_TURNS);
  }, 300_000);
});
