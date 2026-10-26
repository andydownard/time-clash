// Plays whole matches with computer shooters. Used by tests and the simulation script. Pure.
import { answerReloadWith, chooseHelperGo, chooseShotWith, type BotQuestion } from './bot';
import { PRACTICE_BOT, type BotHelperPlan, type BotProfile } from './config';
import { helperId } from './crew';
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
  /** Helper walk-outs and calls home per team. */
  dashes?: Record<Team, number>;
  recalls?: Record<Team, number>;
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
  /** How each side uses its walking helper (Squads). A side with no plan never walks him out. */
  helpers?: Partial<Record<Team, BotHelperPlan>>;
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
  const dashes: Record<Team, number> = { PAST: 0, FUTURE: 0 };
  const recalls: Record<Team, number> = { PAST: 0, FUTURE: 0 };
  const over = (): boolean => match.snapshot().status === 'OVER';
  const shoot = (team: Team): boolean => {
    const state = match.snapshot();
    // A walk-out leaves the helper picked. Firing needs the launcher, as for a child.
    const launcher = helperId(team, 'launcher');
    if (state.squads && state.squads.picked[team] !== launcher) match.selectHelper(launcher);
    const shot = chooseShotWith(state, team, opts.profiles[team], rng, {
      ...(opts.layout ? { layout: opts.layout } : {}),
    });
    match.selectUnit(shot.mount ?? shot.unit);
    match.setAim(shot);
    match.fire();
    match.shotLanded();
    return over();
  };
  /** One go: a helper go when the side's plan picks one, otherwise a shot. */
  const go = (team: Team): boolean => {
    const plan = opts.helpers?.[team];
    const helperGo = plan ? chooseHelperGo(match.snapshot(), team, plan, rng) : null;
    if (!helperGo) return shoot(team);
    match.selectHelper(helperId(team, 'dasher'));
    if (helperGo.kind === 'dash') {
      match.dash(helperGo.to);
      dashes[team] += 1;
    } else {
      match.recall();
      recalls[team] += 1;
    }
    return over();
  };
  const finish = (turns: number): SimResult => {
    const m = match.snapshot();
    return { winner: m.winner, turns, ended: true, wallRaised, dashes, recalls };
  };
  let wallRaised = false;
  const cap = opts.maxTurns ?? PRACTICE_BOT.maxSimTurns;
  for (let turns = 0; turns < cap; turns++) {
    const team = match.snapshot().turn.team;
    match.ready();
    // A helper's bonk at the start of the turn can end the match.
    if (over()) return finish(turns + 1);
    if (opts.raiseWall && match.snapshot().evasion[team].id === 'barricade') {
      const view = match.snapshot().evasion[team];
      if (view.phase === 'ready' && view.usesLeft > 0 && rng.next() < 0.5) {
        match.armEvasion();
        wallRaised = true;
      }
    }
    if (go(team) || go(team)) return finish(turns + 1);
    const answer = answerReloadWith(stubQuestion(grade), opts.profiles[team], rng);
    match.reloadDone({ correct: answer.correct, elapsedMs: answer.delayMs, kind: 'choice', grade });
    if (answer.correct && shoot(team)) return finish(turns + 1);
    match.pass();
  }
  return { winner: null, turns: cap, ended: false, wallRaised, dashes, recalls };
};

export { TEAMS };
