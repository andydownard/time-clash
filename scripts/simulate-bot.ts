// Plays seeded practice-opponent matches and prints win rates. Run: npx tsx scripts/simulate-bot.ts [matches]
import { profileOf } from '../src/game/bot';
import { playBotMatch } from '../src/game/botPlay';
import { BOT_LEVELS, PRACTICE_BOT, type BotProfile } from '../src/game/config';
import type { Team } from '../src/game/types';

const N = Number(process.argv[2] ?? 2000);

type Entry = { name: string; profile: BotProfile };
const entries: Entry[] = [
  ...BOT_LEVELS.map((l) => ({ name: l, profile: profileOf(l) })),
  { name: 'human', profile: PRACTICE_BOT.scriptedHuman },
];

/** `a` plays `b` N times. Sides and the first turn alternate so the board gives nobody an edge. */
const duel = (
  a: Entry,
  b: Entry,
  seedBase: number,
): { aWins: number; ended: number; turns: number } => {
  let aWins = 0;
  let ended = 0;
  let turns = 0;
  for (let i = 0; i < N; i++) {
    const aTeam: Team = i % 2 === 0 ? 'PAST' : 'FUTURE';
    const bTeam: Team = aTeam === 'PAST' ? 'FUTURE' : 'PAST';
    const r = playBotMatch({
      seed: seedBase + i,
      profiles: { [aTeam]: a.profile, [bTeam]: b.profile } as Record<Team, BotProfile>,
      firstTeam: (i >> 1) % 2 === 0 ? 'PAST' : 'FUTURE',
    });
    if (r.ended) ended++;
    turns += r.turns;
    if (r.winner === aTeam) aWins++;
  }
  return { aWins, ended, turns };
};

const pct = (n: number): string => `${((100 * n) / N).toFixed(1)}%`;

console.log(`Matches per pairing: ${N}`);
console.log('\nBot vs scripted average player (bot win rate)');
for (const level of BOT_LEVELS) {
  const r = duel(entries.find((e) => e.name === level) as Entry, entries[3] as Entry, 10_000);
  console.log(
    `  ${level.padEnd(7)} wins ${pct(r.aWins).padStart(6)}   ended ${r.ended}/${N}   avg turns ${(r.turns / N).toFixed(1)}`,
  );
}
console.log('\nBot vs bot (row win rate vs column)');
console.log(`  ${''.padEnd(7)}${BOT_LEVELS.map((l) => l.padStart(8)).join('')}`);
for (const row of BOT_LEVELS) {
  const cells = BOT_LEVELS.map((col) =>
    row === col
      ? '       -'
      : pct(
          duel(
            entries.find((e) => e.name === row) as Entry,
            entries.find((e) => e.name === col) as Entry,
            50_000,
          ).aWins,
        ).padStart(8),
  );
  console.log(`  ${row.padEnd(7)}${cells.join('')}`);
}
