// Shared contract for the pure game rules. No Phaser imports (AGENTS.md pattern 6).
// Coordinates: world pixels, origin top-left, y grows DOWN (same as Phaser, so no conversion).
// See docs/CONTRACTS.md for the reasons behind each choice.

import type { MatchEffects } from './loadout';

// ---------- Basics ----------

export type Team = 'PAST' | 'FUTURE';
export const TEAMS: readonly Team[] = ['PAST', 'FUTURE'];
export const otherTeam = (t: Team): Team => (t === 'PAST' ? 'FUTURE' : 'PAST');

/** 0 = Kindergarten, 1..12 = that grade. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** What a family picks on Setup. 'both' alternates reading and math, reading first. */
export type Subject = 'reading' | 'math' | 'both';

export type Player = {
  /** Trimmed, 1 to 12 characters. Never leaves the device. */
  name: string;
  team: Team;
  grade: Grade;
  subject: Subject;
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

/** Everything static about one battlefield. Phase 2 adds more layouts. */
export type BattleLayout = {
  width: number;
  height: number;
  terrain: Terrain;
  bases: Bases;
  launchOrigins: Record<Team, Vec2>;
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
export type Shot = AimInput & { team: Team; wind: number; turnNumber: number };

export type ShotInput = AimInput & {
  origin: Vec2;
  /** +1 fires toward +x (Team Past), -1 toward -x (Team Future). */
  facing: 1 | -1;
  /** Horizontal acceleration in px/s². Positive pushes toward +x. */
  wind: number;
  layout: BattleLayout;
  /** Multiplies the launch speed (a longer-range weapon). Default 1. */
  speedScale?: number;
};

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
export type TurnPhase = 'PASS_SCREEN' | 'AIMING' | 'SHOT_1' | 'SHOT_2' | 'RELOAD' | 'NEXT_PLAYER';

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
};

export type TurnEvent =
  | { type: 'READY' } // PASS_SCREEN -> AIMING (the "I'm ready!" button)
  | { type: 'FIRE' } // AIMING(0) -> SHOT_1, AIMING(1) -> SHOT_2
  | { type: 'SHOT_LANDED' } // SHOT_1 -> AIMING(1), SHOT_2 -> RELOAD
  | { type: 'RELOAD_DONE' } // RELOAD -> NEXT_PLAYER
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
  /** True on 'near'. The scene plays the Awkward Tumble and a bubble. */
  tumble: boolean;
  /** Index into copy TUMBLE_LINES when tumble is true, else null. Chosen by a seeded shuffle bag. */
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
  readonly seed: number;
  readonly players: Players;
  readonly status: MatchStatus;
  readonly winner: Team | null;
  readonly turn: TurnState;
  /** Wind for the current turn, from windForTurn(seed, turn.turnNumber). */
  readonly wind: number;
  readonly baseHp: Record<Team, number>;
  /** Each base's full health. 100 unless an upgrade raised it. */
  readonly maxBaseHp: Record<Team, number>;
  readonly scrap: Record<Team, number>;
  /** Each team's aim is remembered between its turns. */
  readonly aim: Record<Team, AimInput>;
  readonly stats: Record<Team, TeamStats>;
  readonly lastShot: Shot | null;
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
  /** Only in AIMING. Clamps and stores the active team's aim. Returns the clamped aim. */
  setAim(aim: AimInput): AimInput;
  /** AIMING -> SHOT_n. Runs the full flight now. The scene animates result.path. */
  fire(): ShotResult;
  /**
   * SHOT_n -> AIMING (after shot 1) or RELOAD (after shot 2). Applies damage.
   * If a base reaches 0, status becomes OVER, winner is set, and the turn stops here.
   */
  shotLanded(): BlastOutcome;
  /** RELOAD -> NEXT_PLAYER. Adds scrap and updates stats. */
  reloadDone(input: ReloadInput): ReloadScore;
  /** NEXT_PLAYER -> PASS_SCREEN for the other team with new wind. */
  pass(): void;
  /** Options for a rematch: same players, seed + 1, the other team starts. */
  rematchOptions(): MatchOptions;
}

export type CreateMatch = (options: MatchOptions) => MatchController;
