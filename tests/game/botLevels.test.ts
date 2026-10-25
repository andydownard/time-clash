// Pins how often each Computer player level beats the scripted "decent human", in the live setup
// (disturbances and squads on, flat base health, no built base). docs/GAME_SPEC.md "Practice
// opponent" has the targets and a 2,000-match measurement from scripts/simulate-bot.ts. The sample
// here is small and seeded, so the result repeats exactly; the bands are wider than the targets to
// leave room for a small change elsewhere in the rules without a false alarm.
import { describe, expect, it } from 'vitest';
import { profileOf } from '../../src/game/bot';
import { playBotMatch } from '../../src/game/botPlay';
import { BOT_LEVELS, PRACTICE_BOT, type BotLevel, type BotProfile } from '../../src/game/config';
import type { Team } from '../../src/game/types';

const N = 200;

/** The bot's win share over N matches. Sides and the first turn alternate, as in the script. */
const winRate = (level: BotLevel, seedBase = 10_000): number => {
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const bot: Team = i % 2 === 0 ? 'PAST' : 'FUTURE';
    const human: Team = bot === 'PAST' ? 'FUTURE' : 'PAST';
    const r = playBotMatch({
      seed: seedBase + i,
      profiles: { [bot]: profileOf(level), [human]: PRACTICE_BOT.scriptedHuman } as Record<
        Team,
        BotProfile
      >,
      firstTeam: (i >> 1) % 2 === 0 ? 'PAST' : 'FUTURE',
    });
    expect(r.ended).toBe(true);
    if (r.winner === bot) wins++;
  }
  return wins / N;
};

/** Targets: Easy 25 to 35, Medium about even, Hard 60 to 65 (percent). Bands allow sample noise. */
const BANDS: Record<BotLevel, [number, number]> = {
  easy: [0.2, 0.4],
  medium: [0.4, 0.6],
  hard: [0.54, 0.72],
};

describe('Computer player levels against the scripted decent human', () => {
  const rates = Object.fromEntries(BOT_LEVELS.map((l) => [l, winRate(l)])) as Record<
    BotLevel,
    number
  >;

  for (const level of BOT_LEVELS) {
    it(`${level} wins inside its band (${N} seeded matches)`, () => {
      const [lo, hi] = BANDS[level];
      expect(rates[level]).toBeGreaterThanOrEqual(lo);
      expect(rates[level]).toBeLessThanOrEqual(hi);
    });
  }

  it('each level is harder than the one before it', () => {
    expect(rates.easy).toBeLessThan(rates.medium);
    expect(rates.medium).toBeLessThan(rates.hard);
  });

  it('a harder level never aims or answers worse than an easier one', () => {
    for (let i = 1; i < BOT_LEVELS.length; i++) {
      const easier = profileOf(BOT_LEVELS[i - 1] as BotLevel);
      const harder = profileOf(BOT_LEVELS[i] as BotLevel);
      expect(harder.angleSpreadDeg).toBeLessThan(easier.angleSpreadDeg);
      expect(harder.powerSpreadPct).toBeLessThan(easier.powerSpreadPct);
      expect(harder.windSkill).toBeGreaterThan(easier.windSkill);
      expect(harder.reloadAccuracy).toBeGreaterThan(easier.reloadAccuracy);
    }
  });

  it('Hard is no longer far too strong, and Easy no longer far too weak', () => {
    // The 2026-10-25 measurement before the retune: Easy 15.8%, Hard 89.3% (2,000 matches).
    expect(rates.hard).toBeLessThan(0.8);
    expect(rates.easy).toBeGreaterThan(0.18);
  });
});
