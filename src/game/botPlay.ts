// Plays whole matches with computer shooters. Used by tests and the simulation script. Pure.
import { answerReloadWith, chooseShotWith, type BotQuestion } from './bot';
import { PRACTICE_BOT, type BotProfile } from './config';
import { createMatch } from './match';
import { createRng } from './rng';
import type { BattleLayout, Grade, MatchOptions, Players, Team } from './types';
import { TEAMS } from './types';

export type SimResult = {
  winner: Team | null;
  turns: number;
  ended: boolean;
  /** True when a Stone Wall was raised at least once. */
  wallRaised?: boolean;
};

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
  /** Character health on or off. Default: the game's own setting. */
  characterHealth?: boolean;
  /** Built bases in battle on or off. Default: the game's own setting. */
  baseInBattle?: boolean;
  /** Each team's built base (with `baseInBattle`). */
  bases?: MatchOptions['bases'];
  /** The field (biome and spot). Default: the Phase 1 layout. */
  layout?: BattleLayout;
  /** Team Past raises its Stone Wall (about half its turns while it is ready). */
  raiseWall?: boolean;
  /** Birds, gusts and recoil on or off. Default: the game's own setting (DISTURBANCE). */
  disturbances?: boolean;
};

/** Plays one match to the end (or to the safety cap). */
export const playBotMatch = (opts: SimOptions): SimResult => {
  const grade = opts.grade ?? 3;
  const match = createMatch({
    players: [player('PAST', grade), player('FUTURE', grade)],
    seed: opts.seed,
    firstTeam: opts.firstTeam ?? 'PAST',
    ...(opts.characterHealth === undefined ? {} : { characterHealth: opts.characterHealth }),
    ...(opts.baseInBattle === undefined ? {} : { baseInBattle: opts.baseInBattle }),
    ...(opts.bases ? { bases: opts.bases } : {}),
    ...(opts.layout ? { layout: opts.layout } : {}),
    ...(opts.disturbances === undefined ? {} : { disturbances: opts.disturbances }),
  });
  const rng = createRng((opts.seed ^ 0x626f74) >>> 0);
  const shoot = (team: Team): boolean => {
    const state = match.snapshot();
    const shot = chooseShotWith(state, team, opts.profiles[team], rng, {
      ...(opts.layout ? { layout: opts.layout } : {}),
    });
    match.selectUnit(shot.mount ?? shot.unit);
    match.setAim(shot);
    match.fire();
    match.shotLanded();
    return match.snapshot().status === 'OVER';
  };
  let wallRaised = false;
  const cap = opts.maxTurns ?? PRACTICE_BOT.maxSimTurns;
  for (let turns = 0; turns < cap; turns++) {
    const team = match.snapshot().turn.team;
    match.ready();
    if (opts.raiseWall && match.snapshot().evasion[team].id === 'barricade') {
      const view = match.snapshot().evasion[team];
      if (view.phase === 'ready' && view.usesLeft > 0 && rng.next() < 0.5) {
        match.armEvasion();
        wallRaised = true;
      }
    }
    if (shoot(team) || shoot(team)) return finish(match.snapshot(), turns + 1, wallRaised);
    const answer = answerReloadWith(stubQuestion(grade), opts.profiles[team], rng);
    match.reloadDone({ correct: answer.correct, elapsedMs: answer.delayMs, kind: 'choice', grade });
    if (answer.correct && shoot(team)) return finish(match.snapshot(), turns + 1, wallRaised);
    match.pass();
  }
  return { winner: null, turns: cap, ended: false, wallRaised };
};

const finish = (m: { winner: Team | null }, turns: number, wallRaised: boolean): SimResult => ({
  winner: m.winner,
  turns,
  ended: true,
  wallRaised,
});

export { TEAMS };
