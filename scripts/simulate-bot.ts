// Plays seeded practice-opponent matches and prints win rates. Run: npx tsx scripts/simulate-bot.ts [matches]
import { helperPlanOf, profileOf } from '../src/game/bot';
import { playBotMatch } from '../src/game/botPlay';
import { BOT_LEVELS, PRACTICE_BOT, type BotHelperPlan, type BotProfile } from '../src/game/config';
import type { Team } from '../src/game/types';

const N = Number(process.argv[2] ?? 2000);

/** A child who walks the helper out every time he is home and ready. */
const HUMAN_WALKS: BotHelperPlan = { dashChance: 1, replyChance: 1, recallChance: 0 };

type Entry = { name: string; profile: BotProfile; helper?: BotHelperPlan };
const entries: Entry[] = [
  ...BOT_LEVELS.map((l) => ({ name: l, profile: profileOf(l), helper: helperPlanOf(l) })),
  { name: 'human', profile: PRACTICE_BOT.scriptedHuman },
  { name: 'human who walks out', profile: PRACTICE_BOT.scriptedHuman, helper: HUMAN_WALKS },
];
const byName = (name: string): Entry => entries.find((e) => e.name === name) as Entry;

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
      helpers: {
        ...(a.helper ? { [aTeam]: a.helper } : {}),
        ...(b.helper ? { [bTeam]: b.helper } : {}),
      },
    });
    if (r.ended) ended++;
    turns += r.turns;
    if (r.winner === aTeam) aWins++;
  }
  return { aWins, ended, turns };
};

const pct = (n: number): string => `${((100 * n) / N).toFixed(1)}%`;

console.log(`Matches per pairing: ${N}`);
for (const human of ['human', 'human who walks out']) {
  console.log(
    `\nBot vs scripted average player, ${human === 'human' ? 'who never walks the helper out' : 'who walks the helper out'} (bot win rate)`,
  );
  for (const level of BOT_LEVELS) {
    const r = duel(byName(level), byName(human), 10_000);
    console.log(
      `  ${level.padEnd(7)} wins ${pct(r.aWins).padStart(6)}   ended ${r.ended}/${N}   avg turns ${(r.turns / N).toFixed(1)}`,
    );
  }
}
console.log('\nBot vs bot (row win rate vs column)');
console.log(`  ${''.padEnd(7)}${BOT_LEVELS.map((l) => l.padStart(8)).join('')}`);
for (const row of BOT_LEVELS) {
  const cells = BOT_LEVELS.map((col) =>
    row === col ? '       -' : pct(duel(byName(row), byName(col), 50_000).aWins).padStart(8),
  );
  console.log(`  ${row.padEnd(7)}${cells.join('')}`);
}
