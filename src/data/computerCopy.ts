// Words a child reads about the Computer player. The name always comes from PRACTICE_BOT.
// Never "bot", "AI" or "assistant" in anything shown (AGENTS.md vocabulary table).
import { PRACTICE_BOT, TURN, type BotLevel } from '../game/config';

/** The turn strip text while the Computer player is up. "Your turn" would be wrong for it. */
export const computerTurnBanner = (shot: number | 'POWER'): string =>
  shot === 'POWER'
    ? `${PRACTICE_BOT.displayName.toUpperCase()}, POWER SHOT!`
    : `${PRACTICE_BOT.displayName.toUpperCase()}'S TURN! (SHOT ${shot} OF ${TURN.shotsPerTurn})`;

export const COMPUTER = {
  name: PRACTICE_BOT.displayName,
  playWith: 'Play with',
  anotherPlayer: 'Another player',
  computerPlayer: PRACTICE_BOT.displayName,
  howHard: 'How hard?',
  levels: { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as Record<BotLevel, string>,
  cardNote: 'It takes its own turns. You keep the screen.',
  readBack: (level: string): string => `${PRACTICE_BOT.displayName} (${level})`,
  /** Under the Computer player's card in the battle bar while it is up. */
  playingNow: 'Playing now',
  aiming: `${PRACTICE_BOT.displayName} is aiming`,
  thinking: `${PRACTICE_BOT.displayName} is thinking`,
  pictureFuture: 'A friendly robot face',
  picturePast: 'A friendly knight helmet',
} as const;
