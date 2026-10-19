import { clampAim, simulateShot } from './ballistics';
import {
  AIM,
  BONUS,
  PHASE1_LAYOUT,
  RNG_SALT,
  SCRAP,
  TEAM_FACING,
  TUMBLE_LINE_COUNT,
} from './config';
import { classifyBlast, winnerOf } from './damage';
import { DEFAULT_EFFECTS } from './loadout';
import { scoreReload } from './reload';
import { createShuffleBag } from './bag';
import { createRng } from './rng';
import { createTurn, transition } from './turn';
import { DEFAULT_UNIT, firingOrigin, unitById, type UnitDef, type UnitId } from './units';
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
  ReloadResult,
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
  const effects = options.effects ?? DEFAULT_EFFECTS;
  const maxHp: Record<Team, number> = {
    PAST: effects.PAST.maxHp,
    FUTURE: effects.FUTURE.maxHp,
  };
  let baseHp: Record<Team, number> = { ...maxHp };
  /** Hits each base's force field can still block this match. */
  const shield: Record<Team, number> = {
    PAST: effects.PAST.shieldHits,
    FUTURE: effects.FUTURE.shieldHits,
  };
  const scrap: Record<Team, number> = perTeam(() => SCRAP.starting);
  const aim: Record<Team, AimInput> = perTeam(() => ({
    angleDeg: AIM.defaultAngleDeg,
    power: AIM.defaultPower,
  }));
  const selected: Record<Team, UnitId> = { ...DEFAULT_UNIT };
  const stats: Record<Team, TeamStats> = perTeam(freshStats);
  /** The fighter for a team. Always valid: selectUnit checks ids. */
  const unitOf = (team: Team): UnitDef => unitById(selected[team]) as UnitDef;
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
      maxBaseHp: { ...maxHp },
      scrap: { ...scrap },
      aim: { PAST: { ...aim.PAST }, FUTURE: { ...aim.FUTURE } },
      selected: { ...selected },
      stats: { PAST: { ...stats.PAST }, FUTURE: { ...stats.FUTURE } },
      lastShot: lastShot ? { ...lastShot } : null,
    }),

    ready(): void {
      guard('get ready');
      step({ type: 'READY' });
    },

    setAim(input: AimInput): AimInput {
      guard('aim');
      if (turn.phase !== 'AIMING' && turn.phase !== 'BONUS_AIMING')
        throw new IllegalTransitionError(turn.phase, 'SET_AIM');
      aim[turn.team] = clampAim(input);
      return { ...aim[turn.team] };
    },

    selectUnit(id: UnitId): void {
      guard('pick a fighter');
      if (turn.phase !== 'AIMING' && turn.phase !== 'BONUS_AIMING')
        throw new IllegalTransitionError(turn.phase, 'SELECT_UNIT');
      const unit = unitById(id);
      if (!unit) throw new RangeError(`Unknown fighter: ${String(id)}`);
      if (unit.team !== turn.team) {
        throw new RangeError(`Fighter ${id} is not on ${turn.team}`);
      }
      selected[turn.team] = unit.id;
    },

    fire(): ShotResult {
      guard('fire');
      step({ type: 'FIRE' });
      const team = turn.team;
      const { angleDeg, power } = aim[team];
      const unit = unitOf(team);
      const origin = firingOrigin(team, unit.id, layout);
      const result = simulateShot({
        angleDeg,
        power,
        origin,
        facing: TEAM_FACING[team],
        wind,
        layout,
        speedScale: effects[team].speedScale * unit.speedScale,
      });
      inFlight = result;
      lastShot = { angleDeg, power, team, wind, turnNumber: turn.turnNumber, unit: unit.id };
      stats[team].shotsFired += 1;
      return result;
    },

    shotLanded(): BlastOutcome {
      guard('land a shot');
      const isBonus = turn.phase === 'BONUS_SHOT';
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
      const shooter = effects[team];
      const defender = effects[target];
      const scale = unitOf(team).damageScale;
      // A hit's damage: the shooter's weapon, less the defender's walls, never below 1.
      // The Power Shot multiplies the weapon's damage first, then the walls cut it.
      const boost = (n: number): number => (isBonus ? Math.round(n * BONUS.damageMultiplier) : n);
      let damage = 0;
      if (result === 'direct') {
        damage = Math.max(
          1,
          boost(Math.round((shooter.direct + shooter.directBonus) * scale)) - defender.directCut,
        );
      } else if (result === 'near') {
        damage = Math.max(1, boost(Math.round(shooter.near * scale)) - defender.nearCut);
      }
      // A force field blocks the first hits that would have done damage.
      let blocked = false;
      if (damage > 0 && shield[target] > 0) {
        shield[target] -= 1;
        damage = 0;
        blocked = true;
      }
      baseHp = { ...baseHp, [target]: Math.max(0, baseHp[target] - damage) };
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
        damage,
        ...(blocked ? { blocked: true } : {}),
        tumble,
        bubbleIndex: tumble ? nextBubble() : null,
      };
    },

    reloadDone(input: ReloadInput): ReloadResult {
      guard('reload');
      step({ type: 'RELOAD_DONE', correct: input.correct === true });
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
      return { ...score, bonus: turn.phase === 'BONUS_AIMING' };
    },

    pass(): void {
      guard('pass');
      const ending = turn.team;
      step({ type: 'PASS' });
      // The squad patches up the base of the team whose turn just ended.
      const repair = effects[ending].repair;
      if (repair > 0) {
        baseHp = { ...baseHp, [ending]: Math.min(maxHp[ending], baseHp[ending] + repair) };
      }
      wind = windForTurn(seed, turn.turnNumber);
    },

    rematchOptions: (): MatchOptions => ({
      players,
      seed: seed + 1,
      firstTeam: otherTeam(firstTeam),
      layout,
      effects,
    }),
  };
};
