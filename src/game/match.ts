import { isSpecialAmmo, radiusScale, resolveAmmo, type AmmoId } from './ammo';
import { clampAim, simulateShot } from './ballistics';
import { unitOrigin, withWalls } from './battlefield';
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
import {
  arm,
  disarm,
  dodgesNow,
  endOwnTurn,
  evasionView,
  freshEvasion,
  spend,
  startOwnTurn,
  wallsFor,
  type EvasionState,
} from './evasion';
import { DEFAULT_EFFECTS } from './loadout';
import { scoreReload } from './reload';
import { createShuffleBag } from './bag';
import { createRng } from './rng';
import { createTurn, transition } from './turn';
import { DEFAULT_UNIT, unitById, type UnitDef, type UnitId } from './units';
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

/** The special kinds a team owns, once each, in a fixed order. Junk and Standard are dropped. */
const ownedAmmo = (list: readonly AmmoId[] | undefined): AmmoId[] => {
  const ids = new Set((list ?? []).filter(isSpecialAmmo));
  return (['confetti', 'plasma', 'bowling'] as const).filter((id) => ids.has(id));
};

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
  const owned: Record<Team, AmmoId[]> = {
    PAST: ownedAmmo(options.ammo?.PAST),
    FUTURE: ownedAmmo(options.ammo?.FUTURE),
  };
  /** Shots left of each special kind. Standard is unlimited and never listed. */
  const ammoLeft: Record<Team, Partial<Record<AmmoId, number>>> = {
    PAST: Object.fromEntries(owned.PAST.map((id) => [id, resolveAmmo(id).uses])),
    FUTURE: Object.fromEntries(owned.FUTURE.map((id) => [id, resolveAmmo(id).uses])),
  };
  const loaded: Record<Team, AmmoId> = { PAST: 'standard', FUTURE: 'standard' };
  let inFlightAmmo: AmmoId = 'standard';
  let evasion: Record<Team, EvasionState> = {
    PAST: freshEvasion('PAST'),
    FUTURE: freshEvasion('FUTURE'),
  };
  /** The field right now: the layout plus a wall that is standing. */
  const currentLayout = () => withWalls(layout, wallsFor(evasion));
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
  /** Free actions (pick a fighter, load ammo, arm an ability) only work while aiming. */
  const aimingOnly = (event: string): void => {
    if (turn.phase !== 'AIMING' && turn.phase !== 'BONUS_AIMING')
      throw new IllegalTransitionError(turn.phase, event);
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
      ammo: { ...loaded },
      ammoLeft: { PAST: { ...ammoLeft.PAST }, FUTURE: { ...ammoLeft.FUTURE } },
      evasion: { PAST: evasionView(evasion.PAST), FUTURE: evasionView(evasion.FUTURE) },
    }),

    currentLayout,

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
      aimingOnly('SELECT_UNIT');
      const unit = unitById(id);
      if (!unit) throw new RangeError(`Unknown fighter: ${String(id)}`);
      if (unit.team !== turn.team) {
        throw new RangeError(`Fighter ${id} is not on ${turn.team}`);
      }
      selected[turn.team] = unit.id;
    },

    selectAmmo(id: AmmoId): void {
      guard('load ammo');
      aimingOnly('SELECT_AMMO');
      const team = turn.team;
      if (id !== 'standard' && !((ammoLeft[team][id] ?? 0) > 0)) {
        throw new RangeError(`${team} has no ${String(id)} ammo left`);
      }
      loaded[team] = id;
    },

    armEvasion(): void {
      guard('arm an ability');
      aimingOnly('ARM_EVASION');
      evasion = { ...evasion, [turn.team]: arm(evasion[turn.team]) };
    },

    disarmEvasion(): void {
      guard('take back an ability');
      aimingOnly('DISARM_EVASION');
      evasion = { ...evasion, [turn.team]: disarm(evasion[turn.team]) };
    },

    fire(): ShotResult {
      guard('fire');
      step({ type: 'FIRE' });
      const team = turn.team;
      const { angleDeg, power } = aim[team];
      const unit = unitOf(team);
      // The default fighter shoots from the layout's own launcher, so a fresh game is unchanged.
      const origin = unitOrigin(layout, unit);
      const ammo = loaded[team];
      const result = simulateShot({
        angleDeg,
        power,
        origin,
        facing: TEAM_FACING[team],
        wind,
        layout: currentLayout(),
        speedScale: effects[team].speedScale * unit.speedScale,
        ...(ammo === 'standard' ? {} : { ammo }),
      });
      inFlight = result;
      inFlightAmmo = ammo;
      if (ammo !== 'standard') {
        const left = Math.max(0, (ammoLeft[team][ammo] ?? 0) - 1);
        ammoLeft[team] = { ...ammoLeft[team], [ammo]: left };
        if (left === 0) loaded[team] = 'standard';
      }
      lastShot = {
        angleDeg,
        power,
        team,
        wind,
        turnNumber: turn.turnNumber,
        unit: unit.id,
        ...(ammo === 'standard' ? {} : { ammo }),
      };
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
        : classifyBlast(flight.landing, layout.bases[target], radiusScale(inFlightAmmo));
      const tumble = result === 'near';
      const shooter = effects[team];
      const defender = effects[target];
      // The fighter and the ammo both scale the weapon. Standard ammo scales by exactly 1.
      const scale = unitOf(team).damageScale * resolveAmmo(inFlightAmmo).damageScale;
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
      // A Hoverboard Dodge makes the first damaging hit miss. It goes before the force field.
      let dodged = false;
      if (damage > 0 && dodgesNow(evasion[target])) {
        evasion = { ...evasion, [target]: spend(evasion[target]) };
        damage = 0;
        dodged = true;
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
        ...(dodged ? { dodged: true } : {}),
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
      // An ability armed this turn starts guarding. The new team's guard from last time ends.
      evasion = {
        ...evasion,
        [ending]: endOwnTurn(evasion[ending]),
      };
      evasion = { ...evasion, [turn.team]: startOwnTurn(evasion[turn.team]) };
    },

    rematchOptions: (): MatchOptions => ({
      players,
      seed: seed + 1,
      firstTeam: otherTeam(firstTeam),
      layout,
      effects,
      ammo: { PAST: [...owned.PAST], FUTURE: [...owned.FUTURE] },
    }),
  };
};
