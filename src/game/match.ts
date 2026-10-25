import { isSpecialAmmo, radiusScale, resolveAmmo, type AmmoId } from './ammo';
import { scaleHealth } from './matchLength';
import { clampAim, simulateShot } from './ballistics';
import { withWalls } from './battlefield';
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
import {
  AIM,
  BASE_IN_BATTLE,
  BONUS,
  CHARACTER_HEALTH,
  DISTURBANCE,
  PHASE1_LAYOUT,
  RNG_SALT,
  SCRAP,
  SQUADS,
  TEAM_FACING,
  TUMBLE_LINE_COUNT,
} from './config';
import {
  aliveUnitIds,
  classifyBlast,
  freshUnitHp,
  resolveUnitBlast,
  unitDamage,
  winnerOf,
  winnerOfUnits,
} from './damage';
import {
  createBuilt,
  cutAtWalls,
  flightLayout,
  freshEvents,
  guardFor,
  hasBuilt,
  hitWall,
  isMountId,
  mountAim,
  mountOf,
  viewBricks,
  viewMounts,
  viewSpots,
  volleyAngles,
  wallDamage,
  wallsOf,
} from './builtBase';
import {
  IllegalCommandError,
  dashTargets,
  helperId,
  hitDasher,
  planDash,
  planRecall,
  planStand,
  startingCrew,
  wakeDashers,
  type Crew,
  type HelperId,
  type RecallOutcome,
} from './crew';
import {
  birdsForTurn,
  gustForTurn,
  kickAim,
  recoilFor,
  type BirdPath,
  type FlightDisturbance,
  type Gust,
} from './disturbance';
import { DEFAULT_EFFECTS } from './loadout';
import { scoreReload } from './reload';
import { createShuffleBag } from './bag';
import { createRng } from './rng';
import { createTurn, transition } from './turn';
import type { SpotRole } from './baseBuilder';
import { DEFAULT_UNIT, firingOrigin, unitById, type UnitDef, type UnitId } from './units';
import { IllegalTransitionError, MatchOverError, otherTeam } from './types';
import type {
  AimInput,
  BlastOutcome,
  BlastResult,
  CreateMatch,
  DashResult,
  FireOptions,
  Match,
  MatchController,
  MountId,
  ShooterId,
  MatchOptions,
  ReloadInput,
  ReloadResult,
  ShotResult,
  StandBonk,
  Team,
  TeamStats,
  TurnEvent,
  UnitOutcome,
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

type ShellSource =
  | { kind: 'fighter'; damageScale: number; volley: false }
  | { kind: 'mount'; damage: number; role: SpotRole; volley: boolean };

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
  const characterHealth = options.characterHealth ?? CHARACTER_HEALTH.enabled;
  // Built bases only count with character health: the win is still "all fighters out".
  const baseInBattle = (options.baseInBattle ?? BASE_IN_BATTLE.enabled) && characterHealth;
  const built = baseInBattle ? createBuilt(options.bases) : null;
  const builtTeams: Record<Team, boolean> = {
    PAST: built ? hasBuilt(built.PAST) : false,
    FUTURE: built ? hasBuilt(built.FUTURE) : false,
  };
  const flightLay = built ? flightLayout(layout, builtTeams) : layout;
  const selectedMount: Record<Team, MountId | null> = { PAST: null, FUTURE: null };
  /** Shield generators that already blocked a hit this turn. */
  const guardUsed = new Set<string>();
  /** What the shell in the air was fired by, for its damage to bricks. */
  let source: ShellSource | null = null;

  // Squads S1: a launcher and a dasher per side. Off with the flag, with character health, or with built bases.
  const squadsOn = (options.squads ?? SQUADS.enabled) && !characterHealth && !built;
  /** A dasher's full health: a fighter's, scaled by the match length like a fighter's. */
  const dasherHp = scaleHealth(CHARACTER_HEALTH.hp, options.matchLength);
  let crew: Crew = startingCrew(dasherHp);
  /** Own turns each team has started. A resting dasher wakes by this count. */
  const ownTurns: Record<Team, number> = { PAST: 0, FUTURE: 0 };
  /**
   * The own turn a dasher who tumbles or is called home now is ready again. During his own turn
   * (its start included) the next own turn; during the enemy's turn, the one after his next, so
   * a tumbled dasher always sits out one full own turn.
   */
  const readyAfterRest = (team: Team): number =>
    ownTurns[team] + (turn.team === team ? 1 : 2);
  const requireSquads = (): void => {
    if (!squadsOn) throw new IllegalCommandError('flag_off');
  };

  let turn = createTurn(firstTeam, 0);
  let wind = windForTurn(seed, 0);
  // Birds, gusts and recoil (DISTURBANCE): new birds and a new gust every turn.
  const disturbOn = options.disturbances ?? DISTURBANCE.enabled;
  let birds: BirdPath[] = disturbOn ? birdsForTurn(seed, 0) : [];
  let gust: Gust | null = disturbOn ? gustForTurn(seed, 0) : null;
  /** Shots fired so far this turn (the Power Shot is the third). Seeds the recoil. */
  let shotInTurn = 0;
  let status: Match['status'] = 'PLAYING';
  let winner: Team | null = null;
  const effects = options.effects ?? DEFAULT_EFFECTS;
  const maxHp: Record<Team, number> = {
    PAST: scaleHealth(effects.PAST.maxHp, options.matchLength),
    FUTURE: scaleHealth(effects.FUTURE.maxHp, options.matchLength),
  };
  const maxUnitHp = scaleHealth(CHARACTER_HEALTH.hp, options.matchLength);
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
  // Phase 2: special ammo and evasion.
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
  /** The field right now: the layout plus a stone wall that is standing. */
  const currentLayout = () => withWalls(layout, wallsFor(evasion));
  const unitHp = freshUnitHp(maxUnitHp);
  /**
   * Flies the active fighter (or weapon) with the current aim. Changes nothing, so a preview can
   * use it. A preview passes no disturbance, so it stays plain wind only.
   */
  const flyCurrent = (
    mount: ReturnType<typeof mountOf> | undefined,
    disturbance?: FlightDisturbance,
  ) => {
    let nextSource: ShellSource | null = null;
    const team = turn.team;
    const unit = unitOf(team);
    const shotAim = mount ? mountAim(mount.role, aim[team]) : aim[team];
    const { angleDeg, power } = shotAim;
    const origin = mount ? mount.origin : firingOrigin(team, unit.id, layout);
    // A mounted weapon fires its own shells. Fighters fire the loaded ammo.
    const ammo: AmmoId = mount ? 'standard' : loaded[team];
    const walls = wallsFor(evasion);
    const speedScale = mount
      ? BASE_IN_BATTLE.mountSpeedScale
      : effects[team].speedScale * unit.speedScale;
    const fly = (angle: number): ShotResult =>
      simulateShot({
        angleDeg: angle,
        power,
        origin,
        facing: TEAM_FACING[team],
        wind,
        layout: walls.length > 0 ? withWalls(flightLay, walls) : flightLay,
        speedScale,
        ...(ammo === 'standard' ? {} : { ammo }),
        ...(disturbance ? { disturbance } : {}),
      });
    let result: ShotResult;
    if (built) {
      const walls = wallsOf(built[otherTeam(team)]);
      // A lob, and a shot from a flier, arc over walls and only meet one coming down.
      const arcs = mount ? mount.role === 'lob' : BASE_IN_BATTLE.flierRoles.includes(unit.role);
      const volley = mount?.role === 'volley';
      const shells = (volley ? volleyAngles(angleDeg) : [angleDeg]).map((a) =>
        cutAtWalls(fly(a), walls, arcs),
      );
      result = volley
        ? { ...(shells[0] as ShotResult), volley: shells }
        : (shells[0] as ShotResult);
      nextSource = mount
        ? { kind: 'mount', damage: mount.damage, role: mount.role, volley }
        : { kind: 'fighter', damageScale: unit.damageScale, volley: false };
    } else {
      result = fly(angleDeg);
    }
    return { result, ammo, unit, angleDeg, power, team, nextSource };
  };

  /** Keeps a team's pick on a fighter that is still standing. */
  const keepSelectionStanding = (team: Team): void => {
    const picked = selectedMount[team];
    if (built && picked && !mountOf(built[team], picked)?.alive) selectedMount[team] = null;
    const standing = aliveUnitIds(unitHp, team);
    if (standing.length === 0 || standing.includes(selected[team])) return;
    selected[team] = standing.includes(DEFAULT_UNIT[team])
      ? DEFAULT_UNIT[team]
      : (standing[0] as UnitId);
  };
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
  /** Free actions (load ammo, arm an ability) only work while aiming. */
  const aimingOnly = (event: string): void => {
    if (turn.phase !== 'AIMING' && turn.phase !== 'BONUS_AIMING')
      throw new IllegalTransitionError(turn.phase, event);
  };

  /** Character health: score a landed shot against the target's standing fighters. */
  const landOnFighters = (
    team: Team,
    target: Team,
    flight: ShotResult,
    isBonus: boolean,
  ): BlastOutcome => {
    const blast = resolveUnitBlast(flight.path, flight.landing, target, unitHp, layout);
    const units: UnitOutcome[] = blast.hits.map((h) => {
      const damage = unitDamage(h.result, isBonus);
      unitHp[h.unit] = Math.max(0, unitHp[h.unit] - damage);
      const knockedOut = unitHp[h.unit] === 0;
      const tumble = h.result === 'near' || knockedOut;
      return {
        unit: h.unit,
        result: h.result,
        damage,
        hp: unitHp[h.unit],
        tumble,
        knockedOut,
        bubbleIndex: tumble ? nextBubble() : null,
      };
    });
    const direct = units.some((u) => u.result === 'direct');
    const result: BlastResult = direct ? 'direct' : units.length > 0 ? 'near' : 'miss';
    if (direct) stats[team].directHits += 1;
    else if (result === 'near') stats[team].nearHits += 1;
    keepSelectionStanding(target);
    const won = winnerOfUnits(unitHp);
    if (won) {
      status = 'OVER';
      winner = won;
    }
    const firstTumble = units.find((u) => u.tumble);
    return {
      result,
      target,
      damage: units.reduce((sum, u) => sum + u.damage, 0),
      tumble: firstTumble !== undefined,
      bubbleIndex: firstTumble ? firstTumble.bubbleIndex : null,
      units,
      knockedOut: units.filter((u) => u.knockedOut).map((u) => u.unit),
    };
  };

  /** Built bases: score a landed shot (or a volley) against fighters, bricks, weapons and guards. */
  const landBuilt = (
    team: Team,
    target: Team,
    flight: ShotResult,
    isBonus: boolean,
  ): BlastOutcome => {
    const bt = (built as NonNullable<typeof built>)[target];
    const src = source as ShellSource;
    const ev = freshEvents();
    const merged = new Map<UnitId, UnitOutcome>();
    const taken = new Map<UnitId, number>();
    const cap = isBonus ? CHARACTER_HEALTH.powerHit : BASE_IN_BATTLE.volley.maxFighterHealth;
    for (const shell of flight.volley ?? [flight]) {
      const blast = resolveUnitBlast(shell.path, shell.landing, target, unitHp, layout);
      const guard = guardFor(bt, blast.impact, guardUsed);
      if (guard) {
        guardUsed.add(guard.mount);
        ev.guardBlocked.push(guard);
        continue;
      }
      for (const h of blast.hits) {
        let damage = unitDamage(h.result, isBonus);
        if (src.volley) damage = Math.min(damage, cap - (taken.get(h.unit) ?? 0));
        taken.set(h.unit, (taken.get(h.unit) ?? 0) + damage);
        unitHp[h.unit] = Math.max(0, unitHp[h.unit] - damage);
        const knockedOut = unitHp[h.unit] === 0;
        const tumble = h.result === 'near' || knockedOut;
        const prior = merged.get(h.unit);
        merged.set(h.unit, {
          unit: h.unit,
          result: prior?.result === 'direct' || h.result === 'direct' ? 'direct' : 'near',
          damage: (prior?.damage ?? 0) + damage,
          hp: unitHp[h.unit],
          tumble: (prior?.tumble ?? false) || tumble,
          knockedOut: (prior?.knockedOut ?? false) || knockedOut,
          bubbleIndex: prior?.bubbleIndex ?? (tumble ? nextBubble() : null),
        });
      }
      // The shell burst on a wall unless a fighter was in its way first.
      const fighterFirst =
        blast.hits.some((h) => h.result === 'direct') &&
        (blast.impact.x !== shell.landing.x || blast.impact.y !== shell.landing.y);
      if (shell.stoppedBy && !fighterFirst) {
        hitWall(bt, shell.stoppedBy, wallDamage(src, isBonus), ev);
      }
    }
    const units = [...merged.values()];
    const direct = units.some((u) => u.result === 'direct');
    const result: BlastResult = direct ? 'direct' : units.length > 0 ? 'near' : 'miss';
    if (direct) stats[team].directHits += 1;
    else if (result === 'near') stats[team].nearHits += 1;
    keepSelectionStanding(target);
    const won = winnerOfUnits(unitHp);
    if (won) {
      status = 'OVER';
      winner = won;
    }
    const firstTumble = units.find((u) => u.tumble);
    return {
      result,
      target,
      damage: units.reduce((sum, u) => sum + u.damage, 0),
      tumble: firstTumble !== undefined,
      bubbleIndex: firstTumble ? firstTumble.bubbleIndex : null,
      units,
      knockedOut: units.filter((u) => u.knockedOut).map((u) => u.unit),
      built: ev,
    };
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
      characterHealth,
      unitHp: { ...unitHp },
      maxUnitHp,
      aliveCount: {
        PAST: aliveUnitIds(unitHp, 'PAST').length,
        FUTURE: aliveUnitIds(unitHp, 'FUTURE').length,
      },
      maxBaseHp: { ...maxHp },
      scrap: { ...scrap },
      aim: { PAST: { ...aim.PAST }, FUTURE: { ...aim.FUTURE } },
      selected: { ...selected },
      stats: { PAST: { ...stats.PAST }, FUTURE: { ...stats.FUTURE } },
      lastShot: lastShot ? { ...lastShot } : null,
      ammo: { ...loaded },
      ammoLeft: { PAST: { ...ammoLeft.PAST }, FUTURE: { ...ammoLeft.FUTURE } },
      evasion: { PAST: evasionView(evasion.PAST), FUTURE: evasionView(evasion.FUTURE) },
      disturbances: disturbOn,
      birds: birds.map((b) => ({ ...b })),
      ...(squadsOn
        ? {
            squads: {
              crew: { helpers: crew.helpers.map((h) => ({ ...h })), picked: { ...crew.picked } },
              picked: { ...crew.picked },
              go: Math.min(SQUADS.goesPerTurn, turn.shotsFired + 1) as 1 | 2,
              maxHp: dasherHp,
              ownTurns: { ...ownTurns },
            },
          }
        : {}),
      ...(built
        ? {
            baseInBattle: true,
            selectedMount: { ...selectedMount },
            bricks: viewBricks(built),
            mounts: viewMounts(built),
            spots: viewSpots(built),
            builtBase: { ...builtTeams },
          }
        : {}),
    }),

    currentLayout,

    ready(): StandBonk[] {
      guard('get ready');
      step({ type: 'READY' });
      if (!squadsOn) return [];
      const team = turn.team;
      ownTurns[team] += 1;
      crew = wakeDashers(crew, team, ownTurns[team], dasherHp);
      const stand = planStand(
        crew,
        team,
        { PAST: readyAfterRest('PAST'), FUTURE: readyAfterRest('FUTURE') },
        nextBubble,
      );
      crew = stand.crew;
      const out: StandBonk[] = [];
      for (const beat of stand.beats) {
        if (beat.target.kind !== 'base') {
          out.push({ ...beat, target: beat.target });
          continue;
        }
        // Once the match is over, nobody bonks.
        if (status === 'OVER') break;
        const target = beat.target.team;
        // A bonk lands at the gate: the gate's cut applies, never below 1, then the same shields as a shot.
        let damage = Math.max(1, beat.target.damage - effects[target].nearCut);
        let dodged = false;
        let blocked = false;
        if (dodgesNow(evasion[target])) {
          evasion = { ...evasion, [target]: spend(evasion[target]) };
          damage = 0;
          dodged = true;
        }
        if (damage > 0 && shield[target] > 0) {
          shield[target] -= 1;
          damage = 0;
          blocked = true;
        }
        baseHp = { ...baseHp, [target]: Math.max(0, baseHp[target] - damage) };
        const won = winnerOf(baseHp);
        if (won) {
          status = 'OVER';
          winner = won;
        }
        out.push({
          ...beat,
          target: {
            kind: 'base',
            team: target,
            damage,
            ...(blocked ? { blocked: true } : {}),
            ...(dodged ? { dodged: true } : {}),
          },
        });
      }
      return out;
    },

    setAim(input: AimInput): AimInput {
      guard('aim');
      if (turn.phase !== 'AIMING' && turn.phase !== 'BONUS_AIMING')
        throw new IllegalTransitionError(turn.phase, 'SET_AIM');
      aim[turn.team] = clampAim(input);
      const mount = built && selectedMount[turn.team];
      if (built && mount) {
        const m = mountOf(built[turn.team], mount);
        if (m) aim[turn.team] = mountAim(m.role, aim[turn.team]);
      }
      return { ...aim[turn.team] };
    },

    selectUnit(id: ShooterId): void {
      guard('pick a fighter');
      if (turn.phase !== 'AIMING' && turn.phase !== 'BONUS_AIMING')
        throw new IllegalTransitionError(turn.phase, 'SELECT_UNIT');
      if (isMountId(id)) {
        const m = built ? mountOf(built[turn.team], id) : undefined;
        if (!m) throw new RangeError(`Unknown weapon: ${id}`);
        if (!m.alive) throw new RangeError(`Weapon ${id} is down`);
        if (!m.canFire) throw new RangeError(`Weapon ${id} does not fire`);
        selectedMount[turn.team] = id;
        return;
      }
      const unit = unitById(id);
      if (!unit) throw new RangeError(`Unknown fighter: ${String(id)}`);
      if (unit.team !== turn.team) {
        throw new RangeError(`Fighter ${id} is not on ${turn.team}`);
      }
      if (characterHealth && unitHp[unit.id] <= 0) {
        throw new RangeError(`Fighter ${id} is knocked out`);
      }
      selected[turn.team] = unit.id;
      selectedMount[turn.team] = null;
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

    previewShot(): ShotResult {
      const mountId = built ? selectedMount[turn.team] : null;
      const mount = built && mountId ? mountOf(built[turn.team], mountId) : undefined;
      return flyCurrent(mount).result;
    },

    selectHelper(id: HelperId): void {
      guard('pick a helper');
      requireSquads();
      if (turn.phase !== 'AIMING') throw new IllegalTransitionError(turn.phase, 'SELECT_HELPER');
      if (!crew.helpers.some((h) => h.id === id && h.team === turn.team)) {
        throw new IllegalCommandError('not_your_helper');
      }
      crew = { ...crew, picked: { ...crew.picked, [turn.team]: id } };
    },

    helperTargets(): string[] {
      if (!squadsOn || turn.phase !== 'AIMING') return [];
      return dashTargets(crew, turn.team);
    },

    dash(to: string): DashResult {
      guard('dash');
      requireSquads();
      if (turn.phase !== 'AIMING') throw new IllegalTransitionError(turn.phase, 'DASH');
      const planned = planDash(crew, turn.team, to, dasherHp);
      step({ type: 'FIRE' });
      step({ type: 'SHOT_LANDED' });
      crew = planned.crew;
      return planned.outcome;
    },

    recall(): RecallOutcome {
      guard('call a helper home');
      requireSquads();
      if (turn.phase !== 'AIMING') throw new IllegalTransitionError(turn.phase, 'RECALL');
      const planned = planRecall(crew, turn.team, readyAfterRest(turn.team));
      step({ type: 'FIRE' });
      step({ type: 'SHOT_LANDED' });
      crew = planned.crew;
      return planned.outcome;
    },

    fire(fireOptions?: FireOptions): ShotResult {
      guard('fire');
      if (squadsOn && crew.picked[turn.team] !== helperId(turn.team, 'launcher')) {
        throw new IllegalCommandError('wrong_command');
      }
      const mountId = built ? selectedMount[turn.team] : null;
      const mount = built && mountId ? mountOf(built[turn.team], mountId) : undefined;
      if (mountId && (!mount || !mount.alive || !mount.canFire)) {
        throw new RangeError(`Weapon ${mountId} cannot fire`);
      }
      if (!mount && characterHealth && unitHp[selected[turn.team]] <= 0) {
        throw new RangeError(`Fighter ${selected[turn.team]} is knocked out and cannot fire`);
      }
      step({ type: 'FIRE' });
      const raw = fireOptions?.birdMs;
      const birdMs = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
      const disturbance: FlightDisturbance | undefined = disturbOn
        ? { birds, birdMs, gust }
        : undefined;
      const { result, ammo, unit, angleDeg, power, team, nextSource } = flyCurrent(
        mount,
        disturbance,
      );
      if (nextSource) source = nextSource;
      // Recoil: the fighter's dials slide a little for the next shot. A mounted weapon has none.
      if (disturbOn && !mount) {
        aim[team] = kickAim(aim[team], recoilFor(seed, turn.turnNumber, shotInTurn, unit.role));
      }
      shotInTurn += 1;
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
        ...(mount ? { mount: mount.id } : {}),
        ...(ammo === 'standard' ? {} : { ammo }),
        ...(disturbOn ? { birdMs } : {}),
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
      if (built) return landBuilt(team, target, flight, isBonus);
      if (characterHealth) return landOnFighters(team, target, flight, isBonus);
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
      const bubbleIndex = tumble ? nextBubble() : null;
      // Squads: the enemy dasher, if he stands near where it landed. Own shells never hit him.
      let dasher: BlastOutcome['dasher'];
      if (squadsOn && !flewAway) {
        const hit = hitDasher(
          crew,
          target,
          flight.landing,
          layout,
          isBonus,
          readyAfterRest(target),
          nextBubble,
        );
        crew = hit.crew;
        if (hit.hit) dasher = hit.hit;
      }
      return {
        result,
        target,
        damage,
        ...(blocked ? { blocked: true } : {}),
        ...(dodged ? { dodged: true } : {}),
        tumble,
        bubbleIndex,
        ...(dasher ? { dasher } : {}),
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
      // The Power Shot is the launcher's. A dasher pick from before does not carry into it.
      if (squadsOn && turn.phase === 'BONUS_AIMING') {
        crew = { ...crew, picked: { ...crew.picked, [team]: helperId(team, 'launcher') } };
      }
      return { ...score, bonus: turn.phase === 'BONUS_AIMING' };
    },

    pass(): void {
      guard('pass');
      const ending = turn.team;
      step({ type: 'PASS' });
      guardUsed.clear();
      // The squad patches up the base of the team whose turn just ended.
      const repair = effects[ending].repair;
      if (repair > 0) {
        baseHp = { ...baseHp, [ending]: Math.min(maxHp[ending], baseHp[ending] + repair) };
      }
      wind = windForTurn(seed, turn.turnNumber);
      shotInTurn = 0;
      if (disturbOn) {
        birds = birdsForTurn(seed, turn.turnNumber);
        gust = gustForTurn(seed, turn.turnNumber);
      }
      // An ability armed this turn starts guarding. The new team's guard from last time ends.
      evasion = { ...evasion, [ending]: endOwnTurn(evasion[ending]) };
      evasion = { ...evasion, [turn.team]: startOwnTurn(evasion[turn.team]) };
    },

    rematchOptions: (): MatchOptions => ({
      players,
      seed: seed + 1,
      firstTeam: otherTeam(firstTeam),
      layout,
      effects,
      ammo: { PAST: [...owned.PAST], FUTURE: [...owned.FUTURE] },
      characterHealth,
      ...(options.squads === undefined ? {} : { squads: options.squads }),
      ...(options.baseInBattle === undefined ? {} : { baseInBattle: options.baseInBattle }),
      ...(options.bases ? { bases: options.bases } : {}),
      ...(options.disturbances === undefined ? {} : { disturbances: options.disturbances }),
    }),
  };
};
