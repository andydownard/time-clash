// Plays whole matches with computer shooters. Used by tests and the simulation script. Pure.
import { answerReloadWith, chooseShotWith, type BotQuestion } from './bot';
import { PRACTICE_BOT, type BotProfile } from './config';
import { createMatch } from './match';
import { createRng } from './rng';
import type { Grade, Players, Team } from './types';
import { TEAMS } from './types';

export type SimResult = { winner: Team | null; turns: number; ended: boolean };

const player = (team: Team, grade: Grade): Players[number] => ({
  name: team === 'PAST' ? 'Knight' : 'Rocket',
  team,
  grade,
  subject: 'math',
});

/** A stand-in question: only grade, kind and choices matter to the reload model. */
const stubQuestion = (grade: number): BotQuestion => ({
  grade,
  kind: 'choice',
  choices: ['a', 'b', 'c', 'd'],
  answer: 'a',
});

export type SimOptions = {
  seed: number;
  profiles: Record<Team, BotProfile>;
  firstTeam?: Team;
  grade?: Grade;
  /** Safety cap on turns. Default PRACTICE_BOT.maxSimTurns. */
  maxTurns?: number;
};

/** Plays one match to the end (or to the safety cap). */
export const playBotMatch = (opts: SimOptions): SimResult => {
  const grade = opts.grade ?? 3;
  const match = createMatch({
    players: [player('PAST', grade), player('FUTURE', grade)],
    seed: opts.seed,
    firstTeam: opts.firstTeam ?? 'PAST',
  });
  const rng = createRng((opts.seed ^ 0x626f74) >>> 0);
  const shoot = (team: Team): boolean => {
    const state = match.snapshot();
    const shot = chooseShotWith(state, team, opts.profiles[team], rng);
    match.selectUnit(shot.unit);
    match.setAim(shot);
    match.fire();
    match.shotLanded();
    return match.snapshot().status === 'OVER';
  };
  const cap = opts.maxTurns ?? PRACTICE_BOT.maxSimTurns;
  for (let turns = 0; turns < cap; turns++) {
    const team = match.snapshot().turn.team;
    match.ready();
    if (shoot(team) || shoot(team)) return finish(match.snapshot(), turns + 1);
    const answer = answerReloadWith(stubQuestion(grade), opts.profiles[team], rng);
    match.reloadDone({ correct: answer.correct, elapsedMs: answer.delayMs, kind: 'choice', grade });
    if (answer.correct && shoot(team)) return finish(match.snapshot(), turns + 1);
    match.pass();
  }
  return { winner: null, turns: cap, ended: false };
};

const finish = (m: { winner: Team | null }, turns: number): SimResult => ({
  winner: m.winner,
  turns,
  ended: true,
});

export { TEAMS };
