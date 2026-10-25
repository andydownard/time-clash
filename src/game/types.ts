// Shared contract for the pure game rules. No Phaser imports (AGENTS.md pattern 6).
// Coordinates: world pixels, origin top-left, y grows DOWN (same as Phaser, so no conversion).
// See docs/CONTRACTS.md for the reasons behind each choice.

import type { AmmoId } from './ammo';
import type { Crew, DashOutcome, GroundSpotId, HelperId } from './crew';
import type { BIOME_IDS, FORT_IDS, SPOT_IDS } from './config';
import type { BirdPath, FlightDisturbance } from './disturbance';
import type { EvasionId, EvasionPhase } from './evasion';
import type { Placed, ResolvedSpot, SpotRole } from './baseBuilder';
import type { MatchEffects } from './loadout';
import type { MatchLength } from './matchLength';
import type { UnitId } from './units';

// ---------- Basics ----------

export type Team = 'PAST' | 'FUTURE';
export const TEAMS: readonly Team[] = ['PAST', 'FUTURE'];
export const otherTeam = (t: Team): Team => (t === 'PAST' ? 'FUTURE' : 'PAST');

/** 0 = Kindergarten, 1..12 = that grade. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** What a family picks on Setup. 'both' alternates reading and math, reading first. */
export type Subject = 'reading' | 'math' | 'both';

/** A math topic a parent can focus a side on at Setup. Off by default. */
export type Topic = 'multiplication' | 'division';

export type Player = {
  /** Trimmed, 1 to 12 characters. Never leaves the device. */
  name: string;
  team: Team;
  grade: Grade;
  subject: Subject;
  /** Optional math focus. Absent means no focus. Only changes which math questions are asked. */
  topic?: Topic;
};

/** Index 0 is always Team Past, index 1 is always Team Future. */
export type Players = readonly [Player, Player];

export type Vec2 = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
/** Closed polygon, points in order. The last point joins back to the first. */
export type Polygon = readonly Vec2[];

export type Terrain = {
  /** The solid floor. */
  ground: Polygon;
  /** Hills and walls a shot can hit. */
  obstacles: readonly Polygon[];
};

export type Bases = Record<Team, Rect>;

/** A place to fight (Phase 2). Each has its own backdrop and middle obstacle. */
export type BiomeId = (typeof BIOME_IDS)[number];
/** Where Team Future hides its base (Phase 2). */
export type SpotIdValue = (typeof SPOT_IDS)[number];
/** Where Team Past puts its castle. */
export type FortIdValue = (typeof FORT_IDS)[number];

/** Everything static about one battlefield. Phase 2 adds more layouts. */
export type BattleLayout = {
  width: number;
  height: number;
  terrain: Terrain;
  bases: Bases;
  launchOrigins: Record<Team, Vec2>;
  /** The place, for the backdrop. Missing means aspen (Phase 1). */
  biome?: BiomeId;
  /** Team Future's base spot. Missing or null means the Phase 1 spot. */
  spot?: SpotIdValue | null;
  /** Team Past's castle place. Missing or null means the Phase 1 castle. */
  fort?: FortIdValue | null;
  /** How far each base moved from its Phase 1 place. Fighters standing on it move too. */
  baseShift?: Partial<Record<Team, Vec2>>;
};

// ---------- RNG (rng.ts) ----------

/** mulberry32. Same seed, same sequence. The only randomness allowed in src/game/. */
export type Rng = {
  readonly seed: number;
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. Throws RangeError if min > max. */
  int(min: number, max: number): number;
  /** One item. Throws RangeError on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** A new shuffled array (Fisher-Yates). Never mutates the input. */
  shuffle<T>(items: readonly T[]): T[];
};
export type CreateRng = (seed: number) => Rng;

// ---------- Aim and ballistics (ballistics.ts) ----------

export type AimInput = {
  /** 0 = flat toward the other base, 90 = straight up. Clamped to config AIM limits. */
  angleDeg: number;
  /** 0 to 100. Speed = power / 100 * BALLISTICS.maxLaunchSpeed. Clamped. */
  power: number;
};

/** One fired shot, enough to replay it exactly. Wind is fixed per turn. */
export type Shot = AimInput & {
  team: Team;
  wind: number;
  turnNumber: number;
  unit: UnitId;
  /** What the shot was made of. Missing means Standard. */
  ammo?: AmmoId;
  /** Only when a mounted weapon fired (BASE_IN_BATTLE on). Then `unit` is the fighter that stayed picked. */
  mount?: MountId;
  /** Only with disturbances on: the bird clock (ms) when it fired, so the flight can be replayed. */
  birdMs?: number;
};

/** What fire() may be told. `birdMs` is the bird clock: ms since this turn's birds took off. */
export type FireOptions = { birdMs?: number };

export type ShotInput = AimInput & {
  origin: Vec2;
  /** +1 fires toward +x (Team Past), -1 toward -x (Team Future). */
  facing: 1 | -1;
  /** Horizontal acceleration in px/s². Positive pushes toward +x. */
  wind: number;
  layout: BattleLayout;
  /** Multiplies the launch speed (a longer-range weapon). Default 1. */
  speedScale?: number;
  /** Birds and the turn's gust (DISTURBANCE). Missing means the plain physics, as before. */
  disturbance?: FlightDisturbance;
};

/** A bird the shell bumped: which one, the shell's path step and spot, and where the bird was. */
export type BirdBump = { bird: number; step: number; at: Vec2; birdAt: Vec2 };

/** The turn's gust as it blew during this flight: path steps it pushed on, and its push. */
export type GustHit = { push: number; fromStep: number; toStep: number; at: Vec2 };

export type CollisionHit =
  | { kind: 'base'; team: Team }
  | { kind: 'ground' }
  | { kind: 'obstacle'; index: number }
  /** Left the world on the left, right, or bottom. There is no ceiling. */
  | { kind: 'out_of_bounds' }
  /** Ran past BALLISTICS.maxSteps without landing. */
  | { kind: 'timeout' };

export type ShotResult = {
  /** One point per fixed 1/60 s step, starting at origin. Last point is the landing point. */
  path: Vec2[];
  /** Exact contact point (segment intersection), or last in-bounds point. */
  landing: Vec2;
  hit: CollisionHit;
  /** Number of simulated steps. path.length === steps + 1. */
  steps: number;
  /**
   * Only when BASE_IN_BATTLE is on: the brick or mounted weapon the shell burst on. The path and
   * `landing` stop at its box. `hit` is then the original flight's and should be ignored.
   */
  stoppedBy?: { kind: 'brick' | 'mount'; id: string };
  /** Only for a volley: every small shell (the first is also this result). */
  volley?: ShotResult[];
  /** Only when the shot flew with disturbances: every bird it bumped, in order (often none). */
  bumps?: BirdBump[];
  /** Only when the turn's gust blew while this shell was in the air. */
  gust?: GustHit;
};

/** Pure and deterministic. Same input, same output, bit for bit. */
export type SimulateShot = (input: ShotInput) => ShotResult;
/** Clamp an aim to config limits. NaN becomes the default. */
export type ClampAim = (aim: AimInput) => AimInput;

// ---------- Wind (wind.ts) ----------

/** Integer in [WIND.min, WIND.max]. Same seed and turn, same wind. turnNumber starts at 0. */
export type WindForTurn = (seed: number, turnNumber: number) => number;

// ---------- Turn state machine (turn.ts) ----------

/** Exactly the states in docs/BUILD.md. SHOT_1 and SHOT_2 mean "ball in the air". */
export type TurnPhase =
  | 'PASS_SCREEN'
  | 'AIMING'
  | 'SHOT_1'
  | 'SHOT_2'
  | 'RELOAD'
  /** A right answer earns one Power Shot: aim it here. */
  | 'BONUS_AIMING'
  /** The Power Shot is in the air. */
  | 'BONUS_SHOT'
  | 'NEXT_PLAYER';

export type TurnState = {
  readonly phase: TurnPhase;
  readonly team: Team;
  /** 0-based count of turns in the match. Each player's turn counts once. */
  readonly turnNumber: number;
  /**
   * Shots fired this turn. Tells the two AIMING states apart:
   * AIMING + 0 means aiming shot 1, AIMING + 1 means aiming shot 2.
   * Goes up on FIRE. Never above 2.
   */
  readonly shotsFired: 0 | 1 | 2;
  /** True once a right answer earned the Power Shot this turn. It is not shot 3 and never counts in shotsFired. */
  readonly bonus: boolean;
};

export type TurnEvent =
  | { type: 'READY' } // PASS_SCREEN -> AIMING (the "I'm ready!" button)
  | { type: 'FIRE' } // AIMING(0) -> SHOT_1, AIMING(1) -> SHOT_2, BONUS_AIMING -> BONUS_SHOT
  | { type: 'SHOT_LANDED' } // SHOT_1 -> AIMING(1), SHOT_2 -> RELOAD, BONUS_SHOT -> NEXT_PLAYER
  /** RELOAD -> BONUS_AIMING when correct is true, else RELOAD -> NEXT_PLAYER. */
  | { type: 'RELOAD_DONE'; correct?: boolean }
  | { type: 'PASS' }; // NEXT_PLAYER -> PASS_SCREEN for the other team, turnNumber + 1

export type TurnEventType = TurnEvent['type'];

export class IllegalTransitionError extends Error {
  readonly phase: TurnPhase | 'OVER';
  readonly event: TurnEventType | string;
  constructor(phase: TurnPhase | 'OVER', event: TurnEventType | string) {
    super(`Illegal turn move: ${event} during ${phase}`);
    this.name = 'IllegalTransitionError';
    this.phase = phase;
    this.event = event;
  }
}

/** New turn in PASS_SCREEN with shotsFired 0. */
export type CreateTurn = (team: Team, turnNumber: number) => TurnState;
/** Pure. Returns a new state or throws IllegalTransitionError. Never mutates. */
export type Transition = (state: TurnState, event: TurnEvent) => TurnState;

// ---------- Damage (damage.ts) ----------

export type BlastResult = 'direct' | 'near' | 'miss';

export type BlastOutcome = {
  result: BlastResult;
  /** The base the blast was scored against (always the opponent; no self damage). */
  target: Team;
  /** Damage dealt to the target's base. The default weapon gives 25, 10, or 0 (config DAMAGE). */
  damage: number;
  /** True when the target's force field stopped a hit that would have done damage. */
  blocked?: boolean;
  /** True when the target's Hoverboard Dodge made a damaging hit miss. */
  dodged?: boolean;
  /** True on 'near'. The scene plays the Awkward Tumble and a bubble. */
  tumble: boolean;
  /** Index into copy TUMBLE_LINES when tumble is true, else null. Chosen by a seeded shuffle bag. */
  bubbleIndex: number | null;
  /**
   * Only when CHARACTER_HEALTH is on: what happened to each fighter the blast touched.
   * Then `result` is the best of them, `damage` is the total health lost, `tumble` is true when
   * any fighter tumbled, and `bubbleIndex` is the first tumble line. Base health is untouched.
   */
  units?: UnitOutcome[];
  /** Only when CHARACTER_HEALTH is on: fighters that reached 0 on THIS shot. Each appears once, ever. */
  knockedOut?: UnitId[];
  /** Only when BASE_IN_BATTLE is on. See BuiltEvents. */
  built?: BuiltEvents;
};

/** A team's base as saved: `chosenBase` and `chosenSpots` from baseBuilder.ts. */
export type ChosenBase = {
  pieces: readonly Placed[];
  spots: readonly ResolvedSpot[];
};

// ---------- Built bases in battle (builtBase.ts, flag BASE_IN_BATTLE) ----------

/** `"PAST:3"`: the team and the brick's index in its saved base. Stable for the whole match. */
export type BrickId = `${Team}:${number}`;
/** A mounted weapon, by its weapon spot (0 to 3) on the picking team. Same id space as UnitId in the selector. */
export type MountId = 'mount:0' | 'mount:1' | 'mount:2' | 'mount:3';
/** Anything a team can pick to shoot with. */
export type ShooterId = UnitId | MountId;

export type BrickView = {
  team: Team;
  /** Piece id from the base builder (stone, tower, panel ...). */
  piece: string;
  hp: number;
  maxHp: number;
  /** In battlefield world px. */
  box: Rect;
  alive: boolean;
};

export type MountView = {
  id: MountId;
  team: Team;
  /** The numbered weapon spot, 0 to 3. */
  spot: number;
  weapon: string;
  role: SpotRole;
  hp: number;
  maxHp: number;
  /** Center of the pad: where its shot starts. */
  origin: Vec2;
  box: Rect;
  alive: boolean;
  /** The brick it sits on, or null when it sits on the foundation (it never falls with a brick). */
  brick: BrickId | null;
  /** True for every role except `guard`. */
  canFire: boolean;
};

export type SpotView = { index: number; x: number; y: number; weapon: string | null };

export type BrickHit = { id: BrickId; damage: number; hp: number; fell: boolean };
export type MountHit = { team: Team; mount: MountId; damage: number; hp: number };
export type MountDown = { team: Team; mount: MountId; reason: 'hit' | 'brickFell' };
export type GuardBlock = { team: Team; mount: MountId };

/** What happened to the built base on one shot (all lists are empty arrays when nothing happened). */
export type BuiltEvents = {
  brickHits: BrickHit[];
  /** Bricks that ran out of hit points on THIS shot, each once, ever. The scene puffs these. */
  brickFell: BrickId[];
  /** Every brick that fell on this shot: the ones above, then unsupported bricks, bottom to top. */
  bricksFell: BrickId[];
  mountHits: MountHit[];
  mountDown: MountDown[];
  guardBlocked: GuardBlock[];
};

/** One fighter's result from one blast (CHARACTER_HEALTH on). */
export type UnitOutcome = {
  unit: UnitId;
  result: 'direct' | 'near';
  /** Health lost: 1 for a direct hit, 2 for a Power Shot, 0 for a near miss. */
  damage: number;
  /** Health left after the blast. */
  hp: number;
  /** True when the fighter tumbles: a near miss, or the hit that took it to 0. */
  tumble: boolean;
  /** True on the one shot that took the fighter to 0. The scene plays the awkward fall. */
  knockedOut: boolean;
  /** Index into copy TUMBLE_LINES when tumble is true, else null. */
  bubbleIndex: number | null;
};

/**
 * Distance from impact to the nearest point of the base rect (0 if inside).
 * <= DAMAGE.directRadius is 'direct', <= DAMAGE.nearRadius is 'near', else 'miss'.
 */
export type ClassifyBlast = (impact: Vec2, base: Rect) => BlastResult;
export type BlastDamage = (result: BlastResult) => number;
/** New hp record. Clamps at 0. Never mutates. */
export type ApplyBlast = (
  hp: Record<Team, number>,
  target: Team,
  result: BlastResult,
) => Record<Team, number>;
/** True when that team's base is at 0. */
export type IsWipeout = (hp: Record<Team, number>, team: Team) => boolean;
/** The team whose opponent is at 0, or null while both stand. */
export type WinnerOf = (hp: Record<Team, number>) => Team | null;

// ---------- Reload (reload.ts) ----------

export type ReloadInput = {
  correct: boolean;
  elapsedMs: number;
  /** Question kind and grade set the fast time limit (see fastWindowMs). Optional. */
  kind?: string;
  grade?: number;
};
export type ReloadScore = {
  /** correct and fast: 2, correct and slow: 1, wrong: 0. */
  scrap: number;
  /** correct and elapsedMs < RELOAD.fastMs. Bad elapsedMs (NaN, negative) counts as slow. Never throws. */
  fast: boolean;
};
/** What the match hands back after a reload: the score, and whether a Power Shot is next. */
export type ReloadResult = ReloadScore & { bonus: boolean };
export type ScoreReload = (input: ReloadInput) => ReloadScore;

// ---------- Name check (names.ts) ----------

export type NameCheck =
  { ok: true; name: string } | { ok: false; reason: 'empty' | 'too_long' | 'blocked' };
/** Trims, checks 1 to 12 chars, and checks a small local blocklist. */
export type ValidateName = (raw: string) => NameCheck;

// ---------- Match (match.ts) ----------

export type MatchStatus = 'PLAYING' | 'OVER';

export type TeamStats = {
  shotsFired: number;
  directHits: number;
  nearHits: number;
  questionsAnswered: number;
  correctAnswers: number;
  /** Fastest correct answer in ms, or null if none yet. */
  fastestAnswerMs: number | null;
  scrapEarned: number;
};

/** ARCHITECTURE.md Match, plus what the scenes need. Snapshots are copies. */
export type Match = {
  /** Squads S1 only: the helpers, who is picked, and which go is next (1 or 2). Absent when the flag is off. */
  readonly squads?: {
    readonly crew: Crew;
    readonly picked: Record<Team, HelperId>;
    readonly go: 1 | 2;
  };
  readonly seed: number;
  readonly players: Players;
  readonly status: MatchStatus;
  readonly winner: Team | null;
  readonly turn: TurnState;
  /** Wind for the current turn, from windForTurn(seed, turn.turnNumber). */
  readonly wind: number;
  /** Base health. Unused for the win when `characterHealth` is on (it stays at full). */
  readonly baseHp: Record<Team, number>;
  /** True when each fighter has its own health and the win is "all fighters out" (CHARACTER_HEALTH). */
  readonly characterHealth: boolean;
  /** Health of every fighter by id. Starts at `maxUnitHp`; changes only when `characterHealth` is on. */
  readonly unitHp: Record<UnitId, number>;
  /** A fighter's full health (CHARACTER_HEALTH.hp). */
  readonly maxUnitHp: number;
  /** Fighters still standing per team (health above 0). The HUD health pips read this. */
  readonly aliveCount: Record<Team, number>;
  /** Each base's full health. 100 unless an upgrade raised it. */
  readonly maxBaseHp: Record<Team, number>;
  readonly scrap: Record<Team, number>;
  /** Each team's aim is remembered between its turns. */
  readonly aim: Record<Team, AimInput>;
  /** The fighter each team will shoot with next. Remembered between turns. */
  readonly selected: Record<Team, UnitId>;
  readonly stats: Record<Team, TeamStats>;
  readonly lastShot: Shot | null;
  /** True when built bases take part (BASE_IN_BATTLE and characterHealth). Absent in old fakes. */
  readonly baseInBattle?: boolean;
  /** The mounted weapon each team has picked, or null for a fighter. Only with `baseInBattle`. */
  readonly selectedMount?: Record<Team, MountId | null>;
  /** Every built brick by id, both teams. Only with `baseInBattle`. */
  readonly bricks?: Record<BrickId, BrickView>;
  /** Each team's mounted weapons (weapons on spots). Only with `baseInBattle`. */
  readonly mounts?: Record<Team, MountView[]>;
  /** Each team's four weapon spots in battlefield px (empty pads have `weapon: null`). */
  readonly spots?: Record<Team, SpotView[]>;
  /** True for a team that brought a built base. Its default base box no longer stops shells. */
  readonly builtBase?: Record<Team, boolean>;
  /** The ammo each team will fire next. Standard unless the player picked a special kind. */
  readonly ammo: Record<Team, AmmoId>;
  /** Shots left this match of each special ammo a team owns. Standard is never listed. */
  readonly ammoLeft: Record<Team, Partial<Record<AmmoId, number>>>;
  /** Each team's evasion ability and where it is in its cycle. */
  readonly evasion: Record<Team, EvasionView>;
  /** True when birds, gusts and recoil are on (DISTURBANCE). Absent in old fakes. */
  readonly disturbances?: boolean;
  /** This turn's birds (empty when disturbances are off). The scene draws them. Absent in old fakes. */
  readonly birds?: readonly BirdPath[];
};

/** What the screens need to know about one team's evasion ability. */
export type EvasionView = {
  id: EvasionId;
  phase: EvasionPhase;
  /** Own turns until it is ready again (recharging only), else 0. */
  turnsLeft: number;
  /** Uses left this match. Infinity when there is no limit. */
  usesLeft: number;
};

export type MatchOptions = {
  players: Players;
  seed: number;
  /** Who goes first. Default 'PAST'. A rematch flips it. */
  firstTeam?: Team;
  /** Default: the Phase 1 layout from config. */
  layout?: BattleLayout;
  /** Weapons and upgrades for each team. Default: the starter weapons, no upgrades (Phase 1). */
  effects?: MatchEffects;
  /** Special ammo each team has unlocked at the Camp. Default: none (Standard only). */
  ammo?: Partial<Record<Team, readonly AmmoId[]>>;
  /** Character health on or off. Default CHARACTER_HEALTH.enabled (off). Tests pass it here. */
  characterHealth?: boolean;
  /** Built bases in battle on or off. Default BASE_IN_BATTLE.enabled (off). Needs characterHealth. */
  baseInBattle?: boolean;
  /** Each team's chosen base (from `chosenBaseFor`). A missing one is the default fixed base. */
  bases?: Partial<Record<Team, ChosenBase>>;
  /** Squads S1 on or off. Default SQUADS.enabled (off). Ignored with characterHealth or built bases. */
  squads?: boolean;
  /** Short, Normal or Long. Scales full health only. Default and unknown values: Normal. */
  matchLength?: MatchLength;
  /**
   * Birds, gusts and recoil on or off. Default DISTURBANCE.enabled (on). Tests that check exact
   * flight paths or aims after a shot pass false.
   */
  disturbances?: boolean;
};

export class MatchOverError extends Error {
  constructor(action: string) {
    super(`The match is over. Cannot ${action}.`);
    this.name = 'MatchOverError';
  }
}

/**
 * The pure orchestrator the Phaser Battle scene drives. It owns turn, hp, scrap,
 * wind, aim, and stats. It does not pick questions (see src/questions/types.ts).
 * Every action out of order throws IllegalTransitionError; any action after the
 * match is over throws MatchOverError.
 */
export interface MatchController {
  readonly layout: BattleLayout;
  /** A fresh copy of the full state. Safe to keep. */
  snapshot(): Match;
  /** PASS_SCREEN -> AIMING. */
  ready(): void;
  /** Only in AIMING or BONUS_AIMING. Clamps and stores the active team's aim. Returns the clamped aim. */
  setAim(aim: AimInput): AimInput;
  /**
   * Only in AIMING or BONUS_AIMING. Picks which of the active team's fighters takes the next shot. Free (not a shot).
   * Another team's fighter or an unknown id throws RangeError.
   * With built bases in battle, a mount id (`mount:2`) picks that mounted weapon instead. A
   * weapon that is down, empty, or a shield generator throws RangeError.
   */
  selectUnit(id: ShooterId): void;
  /**
   * Only in AIMING or BONUS_AIMING. Loads the ammo for the next shot. Free (not a shot).
   * Standard always works. A special kind the team does not own, or has no shots of, throws RangeError.
   */
  selectAmmo(id: AmmoId): void;
  /**
   * Only in AIMING or BONUS_AIMING. Arms the active team's evasion ability. Free (not a shot).
   * It guards their base during the other team's next turn. Throws EvasionError when it is not ready.
   */
  armEvasion(): void;
  /** Only in AIMING or BONUS_AIMING. Takes back an ability armed this turn. Throws EvasionError otherwise. */
  disarmEvasion(): void;
  /** The field as it is right now: the layout plus any wall standing this turn. */
  currentLayout(): BattleLayout;
  /**
   * The path the active fighter's shot would fly with the current aim, wind, ammo and walls.
   * A drawing aid only. It changes nothing and takes no shot.
   */
  previewShot(): ShotResult;
  /**
   * AIMING -> SHOT_n, or BONUS_AIMING -> BONUS_SHOT. Runs the full flight now. The scene animates result.path.
   * With disturbances on, the shell meets this turn's birds at `birdMs` on the bird clock (default 0)
   * and the turn's gust, and the team's aim then slides by the fighter's recoil.
   */
  fire(options?: FireOptions): ShotResult;
  /**
   * SHOT_n -> AIMING (after shot 1) or RELOAD (after shot 2); BONUS_SHOT -> NEXT_PLAYER.
   * Applies damage (a Power Shot's damage is multiplied).
   * If a base reaches 0, status becomes OVER, winner is set, and the turn stops here.
   */
  shotLanded(): BlastOutcome;
  /** RELOAD -> BONUS_AIMING (right answer) or NEXT_PLAYER. Adds scrap and updates stats. */
  reloadDone(input: ReloadInput): ReloadResult;
  /** NEXT_PLAYER -> PASS_SCREEN for the other team with new wind. */
  pass(): void;
  /**
   * Squads S1. Only in AIMING. Picks the active team's launcher or dasher. Free (not a go).
   * Throws IllegalCommandError (`flag_off`, `not_your_helper`) or IllegalTransitionError.
   */
  selectHelper(id: HelperId): void;
  /** The ground spots the picked dasher may roll to now. Empty for a launcher or with the flag off. */
  helperTargets(): GroundSpotId[];
  /**
   * Squads S1. AIMING -> AIMING (after go 1) or RELOAD (after go 2). The picked dasher rolls to `to`
   * and bonks what is next to it. Applies base damage and the win rule. Does the work of
   * fire() and shotLanded() in one call. Throws IllegalCommandError or IllegalTransitionError.
   */
  dash(to: GroundSpotId): DashResult;
  /** Options for a rematch: same players, seed + 1, the other team starts. */
  rematchOptions(): MatchOptions;
}

/** A dash go, after damage. `damage` is what the base really lost (0 if blocked or dodged). */
export type DashResult = DashOutcome & { damage: number; blocked?: boolean; dodged?: boolean };

export type CreateMatch = (options: MatchOptions) => MatchController;
