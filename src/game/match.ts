import { clampAim, simulateShot } from './ballistics';
import {
  AIM,
  DAMAGE,
  PHASE1_LAYOUT,
  RNG_SALT,
  SCRAP,
  TEAM_FACING,
  TUMBLE_LINE_COUNT,
} from './config';
import { applyBlast, blastDamage, classifyBlast, winnerOf } from './damage';
import { scoreReload } from './reload';
import { createShuffleBag } from './bag';
import { createRng } from './rng';
import { createTurn, transition } from './turn';
import { IllegalTransitionError, MatchOverError, otherTeam } from './types';
import type {
  AimInput,
  BlastOutcome,
  BlastResult,
  CreateMatch,
  Match,
  MatchController,
  MatchOptions,
  ReloadInput,
  ReloadScore,
  ShotResult,
  Team,
  TeamStats,
  TurnEvent,
} from './types';
import { windForTurn } from './wind';

const freshStats = (): TeamStats => ({
  shotsFired: 0,
  directHits: 0,
  nearHits: 0,
  questionsAnswered: 0,
  correctAnswers: 0,
  fastestAnswerMs: null,
  scrapEarned: 0,
});

const perTeam = <T>(make: () => T): Record<Team, T> => ({ PAST: make(), FUTURE: make() });

export const createMatch: CreateMatch = (options: MatchOptions): MatchController => {
  const { players, seed } = options;
  const layout = options.layout ?? PHASE1_LAYOUT;
  const firstTeam = options.firstTeam ?? 'PAST';

  let turn = createTurn(firstTeam, 0);
  let wind = windForTurn(seed, 0);
  let status: Match['status'] = 'PLAYING';
  let winner: Team | null = null;
  let baseHp: Record<Team, number> = perTeam(() => DAMAGE.startingBaseHp);
  const scrap: Record<Team, number> = perTeam(() => SCRAP.starting);
  const aim: Record<Team, AimInput> = perTeam(() => ({
    angleDeg: AIM.defaultAngleDeg,
    power: AIM.defaultPower,
  }));
  const stats: Record<Team, TeamStats> = perTeam(freshStats);
  let lastShot: Match['lastShot'] = null;
  let inFlight: ShotResult | null = null;

  const bubbleRng = createRng((seed ^ RNG_SALT.bubbles) >>> 0);
  const bubbleBag = createShuffleBag(bubbleRng, TUMBLE_LINE_COUNT);
  const nextBubble = (): number => bubbleBag.next();

  const guard = (action: string): void => {
    if (status === 'OVER') throw new MatchOverError(action);
  };
  const step = (event: TurnEvent): void => {
    turn = transition(turn, event);
  };

  return {
    layout,

    snapshot: (): Match => ({
      seed,
      players: [{ ...players[0] }, { ...players[1] }],
      status,
      winner,
      turn: { ...turn },
      wind,
      baseHp: { ...baseHp },
      scrap: { ...scrap },
      aim: { PAST: { ...aim.PAST }, FUTURE: { ...aim.FUTURE } },
      stats: { PAST: { ...stats.PAST }, FUTURE: { ...stats.FUTURE } },
      lastShot: lastShot ? { ...lastShot } : null,
    }),

    ready(): void {
      guard('get ready');
      step({ type: 'READY' });
    },

    setAim(input: AimInput): AimInput {
      guard('aim');
      if (turn.phase !== 'AIMING') throw new IllegalTransitionError(turn.phase, 'SET_AIM');
      aim[turn.team] = clampAim(input);
      return { ...aim[turn.team] };
    },

    fire(): ShotResult {
      guard('fire');
      step({ type: 'FIRE' });
      const team = turn.team;
      const { angleDeg, power } = aim[team];
      const result = simulateShot({
        angleDeg,
        power,
        origin: layout.launchOrigins[team],
        facing: TEAM_FACING[team],
        wind,
        layout,
      });
      inFlight = result;
      lastShot = { angleDeg, power, team, wind, turnNumber: turn.turnNumber };
      stats[team].shotsFired += 1;
      return result;
    },

    shotLanded(): BlastOutcome {
      guard('land a shot');
      step({ type: 'SHOT_LANDED' });
      const team = turn.team;
      const target = otherTeam(team);
      const flight = inFlight as ShotResult;
      inFlight = null;
      const flewAway = flight.hit.kind === 'out_of_bounds' || flight.hit.kind === 'timeout';
      const result: BlastResult = flewAway
        ? 'miss'
        : classifyBlast(flight.landing, layout.bases[target]);
      const tumble = result === 'near';
      baseHp = applyBlast(baseHp, target, result);
      if (result === 'direct') stats[team].directHits += 1;
      if (result === 'near') stats[team].nearHits += 1;
      const won = winnerOf(baseHp);
      if (won) {
        status = 'OVER';
        winner = won;
      }
      return {
        result,
        target,
        damage: blastDamage(result),
        tumble,
        bubbleIndex: tumble ? nextBubble() : null,
      };
    },

    reloadDone(input: ReloadInput): ReloadScore {
      guard('reload');
      step({ type: 'RELOAD_DONE' });
      const score = scoreReload(input);
      const team = turn.team;
      const s = stats[team];
      scrap[team] += score.scrap;
      s.scrapEarned += score.scrap;
      s.questionsAnswered += 1;
      if (input.correct) {
        s.correctAnswers += 1;
        if (Number.isFinite(input.elapsedMs) && input.elapsedMs >= 0) {
          s.fastestAnswerMs =
            s.fastestAnswerMs === null
              ? input.elapsedMs
              : Math.min(s.fastestAnswerMs, input.elapsedMs);
        }
      }
      return score;
    },

    pass(): void {
      guard('pass');
      step({ type: 'PASS' });
      wind = windForTurn(seed, turn.turnNumber);
    },

    rematchOptions: (): MatchOptions => ({
      players,
      seed: seed + 1,
      firstTeam: otherTeam(firstTeam),
      layout,
    }),
  };
};
