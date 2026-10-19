// Every balance number and layout constant lives here (AGENTS.md "Config in one place").
// Phase 1 numbers come from docs/BUILD.md. Tune here only.
import type { Settings } from '../storage/types';
import type { BattleLayout, Polygon, Rect, Team, Vec2 } from './types';

// ---------- Physics ----------
export const BALLISTICS = {
  /** px/s², pulls toward +y (down). */
  gravity: 600,
  /** px/s at power 100. */
  maxLaunchSpeed: 900,
  /** Fixed step in seconds. */
  stepSeconds: 1 / 60,
  /** 12 seconds of flight, then the shot ends as 'timeout'. */
  maxSteps: 720,
  /** Drawing size only. Collision uses the center point. */
  projectileRadius: 10,
} as const;

export const WIND = {
  /** px/s², horizontal. Positive pushes toward +x. Integer, new every turn. */
  min: -80,
  max: 80,
  /** Strength names for kids. Below `breezy` is calm. Same for left and right. */
  levels: { breezy: 10, windy: 30, superWindy: 55 },
} as const;

export const AIM = {
  angleMinDeg: 0,
  angleMaxDeg: 90,
  powerMin: 0,
  powerMax: 100,
  defaultAngleDeg: 45,
  defaultPower: 60,
  /** Arrow key step. */
  stepFine: 1,
  /** Shift + arrow key step. */
  stepCoarse: 5,
  /** How many path points the dotted preview shows (short, then fades). */
  previewPoints: 18,
} as const;

// ---------- Damage and health ----------
export const DAMAGE = {
  startingBaseHp: 100,
  /** Impact within this distance of the base rect is a direct hit. */
  directRadius: 48,
  /** Impact within this distance is a near miss (tumble). */
  nearRadius: 120,
  direct: 25,
  near: 10,
} as const;

// ---------- Reload and scrap ----------
export const RELOAD = {
  /** Answers strictly under this many ms are "fast". */
  fastMs: 8000,
  /** Fast time limit by question kind. Longer reading takes longer to read, so the bonus stays fair. */
  fastMsByKind: {
    numeric: 8000,
    sightword: 8000,
    choice: 10000,
    vocab: 12000,
    grammar: 12000,
    mainidea: 20000,
  } as Readonly<Record<string, number>>,
  /** Kindergarten and first grade get this much extra time under the fast limit. */
  earlyGradeExtraMs: 4000,
  earlyGradeMax: 1,
  /**
   * After a wrong answer the right answer and the clue stay up until the player taps Got it.
   * This safety timer closes the card anyway, so play is never blocked.
   */
  wrongAnswerMaxMs: 20000,
  /** Got it ignores taps this soon after an answer, so a stray key press cannot skip the clue. */
  gotItDelayMs: 400,
  /** After a right answer, show "RELOADED!" this long. */
  rightAnswerBeatMs: 1200,
} as const;

export const SCRAP = {
  starting: 0,
  fastCorrect: 2,
  slowCorrect: 1,
  wrong: 0,
} as const;

/** The Power Shot: one extra shot after a right reload answer. It has no question of its own. */
export const BONUS = {
  /** Multiplies the hit's damage (rounded). Walls and force fields still apply. */
  damageMultiplier: 1.5,
} as const;

export const TURN = {
  shotsPerTurn: 2,
  /** Team Past starts the first match. Each rematch flips who starts. */
  firstTeam: 'PAST' as Team,
} as const;

// ---------- Setup ----------
export const GRADE = { min: 0, max: 12 } as const;
export const NAME = { minLength: 1, maxLength: 12 } as const;
export const DEFAULT_NAMES: Record<Team, string> = { PAST: 'Knight', FUTURE: 'Rocket' };

// ---------- Seeds ----------
/** Salts mixed into the match seed so each stream is separate but repeatable. */
export const RNG_SALT = {
  wind: 0x57494e44,
  bubbles: 0x42554242,
  questions: 0x51554553,
  lines: 0x4c494e45,
  /** The Computer player's aim and answers. */
  computer: 0x434f4d50,
} as const;

// ---------- Layout (logical world, scaled to fit by Phaser) ----------
export const WORLD = { width: 1280, height: 720 } as const;

/**
 * Extra canvas height below the battlefield, in world px. The HUD control bar lives in this band,
 * so the fighters on the ground are never covered. Physics and layout still use WORLD alone.
 */
export const BATTLE_BAND = 200;

const GROUND_Y = 620;

const GROUND: Polygon = [
  { x: 0, y: GROUND_Y },
  { x: WORLD.width, y: GROUND_Y },
  { x: WORLD.width, y: WORLD.height },
  { x: 0, y: WORLD.height },
];

/** One hill in the middle so flat shots do not always work. */
const HILL: Polygon = [
  { x: 540, y: GROUND_Y },
  { x: 600, y: 520 },
  { x: 680, y: 500 },
  { x: 740, y: GROUND_Y },
];

export const TERRAIN = { groundY: GROUND_Y, ground: GROUND, hill: HILL } as const;

export const BASES: Record<Team, Rect> = {
  PAST: { x: 80, y: 470, w: 160, h: 150 },
  FUTURE: { x: 1040, y: 490, w: 160, h: 130 },
};

export const LAUNCH_ORIGINS: Record<Team, Vec2> = {
  PAST: { x: 220, y: 450 },
  FUTURE: { x: 1060, y: 470 },
};

/** +1 fires toward +x, -1 toward -x. */
export const TEAM_FACING: Record<Team, 1 | -1> = { PAST: 1, FUTURE: -1 };

export const PHASE1_LAYOUT: BattleLayout = {
  width: WORLD.width,
  height: WORLD.height,
  terrain: { ground: GROUND, obstacles: [HILL] },
  bases: BASES,
  launchOrigins: LAUNCH_ORIGINS,
};

// ---------- Base deployment spots (Phase 2, Team Future only) ----------
/** Austin spots for Team Future's base. `null` (no spot picked) is the Phase 1 layout, unchanged. */
export const SPOT_IDS = ['skyscraper', 'bridge', 'foodTruck'] as const;

export type SpotConfig = {
  /** How far the base (and so every Future fighter) moves from its Phase 1 place. */
  shift: Vec2;
  /** The base rectangle after the move. */
  base: Rect;
  /** Where Future shots start. Outside the base, above the ground. */
  launchOrigin: Vec2;
  /** Extra solid shapes: the tower, the bridge deck, the low wall. */
  obstacles: readonly Polygon[];
};

const rectToPolygon = (r: Rect): Polygon => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];

export const SPOTS: Record<(typeof SPOT_IDS)[number], SpotConfig> = {
  /** High on a tower. The best view, and no cover. The tower is solid, so low shots thud into it. */
  skyscraper: {
    shift: { x: 0, y: -160 },
    base: { x: 1040, y: 330, w: 160, h: 130 },
    launchOrigin: { x: 1060, y: 310 },
    obstacles: [rectToPolygon({ x: 1040, y: 460, w: 160, h: GROUND_Y - 460 })],
  },
  /** Low, under a bridge deck. The deck stops flat shots, so players must lob. */
  bridge: {
    shift: { x: 0, y: 60 },
    base: { x: 1040, y: 550, w: 160, h: 70 },
    launchOrigin: { x: 1060, y: 530 },
    obstacles: [rectToPolygon({ x: 880, y: 410, w: 210, h: 60 })],
  },
  /** On the ground at the pavilion, behind a low wall. */
  foodTruck: {
    shift: { x: 0, y: 0 },
    base: { x: 1040, y: 490, w: 160, h: 130 },
    launchOrigin: { x: 1060, y: 470 },
    obstacles: [rectToPolygon({ x: 960, y: 540, w: 30, h: GROUND_Y - 540 })],
  },
};

// ---------- Timing (ms) ----------
export const TIMING = {
  /** Loading screen waits at least this long so jokes can be read. */
  loadingMinMs: 1500,
  /** A new family sees the longer, funnier load once. Returning families use loadingMinMs. */
  loadingFirstMinMs: 4000,
  loadingMessageMs: 2500,
  bannerDropMs: 400,
  bannerHoldMs: 1800,
  modalPopMs: 250,
  tumbleMs: 1400,
  /** A speech bubble stays at least this long. */
  bubbleHoldMs: 3000,
  /** Longer lines stay about this long per word, so a slow reader can finish. */
  bubbleMsPerWord: 400,
  /** Waiting side dims by this much (0..1). */
  waitingDim: 0.25,
} as const;

// ---------- UI floors (AGENTS.md accessibility) ----------
export const UI = {
  tapTargetMinPx: 56,
  textMinPx: 20,
  /** Reading questions for K to 3. */
  youngReadingTextPx: 32,
  /** Grades at or below this get the large sight-word layout. */
  youngReadingMaxGrade: 3,
  choicesPerQuestion: 4,
} as const;

// ---------- Audio and settings ----------
export const AUDIO = {
  defaultVolume: 0.7,
  /** Voice and SFX are normalized to this peak gain before master volume. */
  sfxGain: 0.5,
  voiceGain: 1,
  /** Speech synthesis fallback rate (calm, not rushed). */
  speechRate: 0.95,
} as const;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  muted: false,
  volume: AUDIO.defaultVolume,
  captions: true,
  musicOn: true,
  reducedMotion: 'system',
};

/** How many tumble speech bubbles exist. Must equal TUMBLE_LINES.length in src/data/copy.ts (a test pins it). */
export const TUMBLE_LINE_COUNT = 21;

// ---------- Hit effects (drawing numbers; the burst, the pip, the funny fall) ----------
export const HIT_FX = {
  /** Flying bits in the impact burst. */
  particleCount: 14,
  /** The whole burst is gone by this time. */
  burstMaxMs: 850,
  flashMs: 120,
  ringMs: 420,
  ringStartRadius: 14,
  ringEndScale: 9,
  smokeMs: 800,
  particleMinDist: 80,
  particleMaxDist: 190,
  particleMinMs: 450,
  particleMaxMs: 800,
  /** Photosensitivity: no more than this many flashes in any one second. */
  maxFlashesPerSecond: 3,
  /** The floating "-N" over the hit base. */
  pipRisePx: 70,
  pipHoldMs: 350,
  pipFadeMs: 750,
  /** Health text pops to this scale when it drops, then settles. */
  hpPopScale: 1.3,
  hpPopMs: 260,
  /** Little stars circling a fallen fighter. */
  starCount: 3,
  starRadiusPx: 34,
  starSquash: 0.35,
  starPeriodMs: 1400,
  starSizePx: 11,
  /** How far above the lying head the stars circle. */
  starLiftPx: 44,
  /** Standing back up after the fall. */
  standUpMs: 600,
  standUpHop: 18,
  /** A fighter in a fall is drawn this many times bigger, so the slapstick can be seen. */
  fallScale: 2,
  /** The speech bubble tail aims this far above a fallen fighter's feet (clears the stars). */
  fallenTailRise: 72,
  /** Small bounce when a fighter lands. */
  landBounce: 22,
} as const;

// ---------- Practice opponent (the "Computer player") ----------
export type BotLevel = 'easy' | 'medium' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

/** How one shooter aims and answers. The three levels and the scripted test player share this shape. */
export type BotProfile = {
  /** Spread (one standard deviation) of the angle error, in degrees. */
  angleSpreadDeg: number;
  /** Spread of the power error, in power points (0 to 100 scale). */
  powerSpreadPct: number;
  /** 0 ignores the wind, 1 reads it fully. */
  windSkill: number;
  /** Chance of a right reload answer on a grade 0 question (before the grade drop). */
  reloadAccuracy: number;
  /** Think time scale: 1 is a typical child. Bigger is slower. */
  thinkScale: number;
};

export const PRACTICE_BOT = {
  /** Off by default. The UI turns it on later, after the panel review. */
  enabled: false,
  /** Shown wherever the opponent appears. Never "bot", "AI" or "assistant". */
  displayName: 'Computer player',
  levels: {
    easy: {
      angleSpreadDeg: 7.5,
      powerSpreadPct: 12,
      windSkill: 0.3,
      reloadAccuracy: 0.65,
      thinkScale: 1.4,
    },
    medium: {
      angleSpreadDeg: 5,
      powerSpreadPct: 9,
      windSkill: 0.6,
      reloadAccuracy: 0.8,
      thinkScale: 1,
    },
    hard: {
      angleSpreadDeg: 2,
      powerSpreadPct: 4,
      windSkill: 0.9,
      reloadAccuracy: 0.92,
      thinkScale: 0.8,
    },
  } as Readonly<Record<BotLevel, BotProfile>>,
  /** The "decent human" the simulation plays against. Not a level a child can pick. */
  scriptedHuman: {
    angleSpreadDeg: 4.5,
    powerSpreadPct: 9,
    windSkill: 0.5,
    reloadAccuracy: 0.75,
    thinkScale: 1,
  } as BotProfile,
  /** Aim search: coarse grid step, then a fine step around the best coarse cell. */
  search: { angleStepDeg: 5, powerStep: 5, fineRadius: 4, fineStep: 1 },
  reload: {
    /** Chance drops by this much per grade level, so harder questions are missed more. */
    gradeDrop: 0.015,
    /** Never below a blind guess among four choices. */
    floor: 0.25,
    ceiling: 0.97,
    /** Think time in ms: base, plus per grade, plus per reading kind, with random jitter on top. */
    thinkBaseMs: 2500,
    thinkPerGradeMs: 250,
    thinkReadingExtraMs: 1500,
    thinkJitterMs: 2000,
    /** Never answer faster than this, so it does not feel instant. */
    minDelayMs: 1800,
    /** Never wait longer than this, so play is never slow. */
    maxDelayMs: 14000,
  },
  /** Safety cap for simulated matches. A real match ends far sooner. */
  maxSimTurns: 400,
  /** How the screen paces the Computer player's turn, so a child can follow it and never waits long. */
  pace: {
    /** The dial and power meter move by themselves for this long before Fire, by level speed. */
    aimBaseMs: 1500,
    aimMinMs: 1200,
    aimMaxMs: 2000,
    /** How many small moves the dial makes on the way to the chosen shot. */
    aimSteps: 14,
    /** The reload "thinking" wait never passes this, even when the answer model wants longer. */
    reloadCapMs: 2500,
    reloadMinMs: 900,
    /** All the thinking in one computer turn (aiming plus reload) stays under this. */
    turnBudgetMs: 8000,
    /** With reduced motion the dial jumps, and the banner still shows for this long. */
    reducedBeatMs: 700,
  },
} as const;

// ---------- Base builder ----------
/**
 * Before a battle a player builds a castle (Team Past) or a base (Team Future) from bricks on a
 * grid. Off by default until the panel has reviewed it. `?builder=1` in the address turns it on
 * for a try-out (see `baseBuilderOn` in baseBuilder.ts).
 */
export const BASE_BUILDER = {
  enabled: false,
  /** The query-string switch that turns it on without changing this file. */
  queryParam: 'builder',
  /** The build plot in grid cells. The bottom `groundRows` rows are the foundation (not buildable). */
  cols: 24,
  rows: 12,
  groundRows: 1,
  /** One cell is this many steps wide when Snap is off. A free brick sits on this finer grid. */
  freeSteps: 8,
  /** Saved bases each player keeps for each side. */
  slots: 3,
  /** Most player names whose saved bases we keep. */
  maxPlayers: 50,
  /** Most bricks in one base, so a saved base stays small. */
  maxPieces: 60,
  /** Steps Undo can go back. */
  undoDepth: 50,
  /** How far (in cells) Turn looks for a free spot when a turned brick would overlap. */
  turnSearchRadius: 3,
  /** Scrap to unlock a locked piece, by piece id. */
  pieceScrap: {
    arch: 6,
    gate: 10,
    flag: 4,
    laserBase: 8,
    hangarDoor: 10,
    powerCore: 6,
  } as Readonly<Record<string, number>>,
  /** Brick strength in hit points, kept in the save for the battle task. */
  hp: { light: 10, small: 20, medium: 35, large: 50 },
  /** Weapon spots: round pads on the base where a weapon can be mounted. */
  spots: {
    count: 4,
    /** Pad radius in free steps (a pad is about one and a quarter cells wide). */
    padSteps: 5,
    /** The lowest a pad may sit, in cells from the top, so the mode switch never covers one. */
    topRows: 2,
    /** With no bricks, pads sit in a row on the foundation across these columns. */
    rowFromCol: 6,
    rowToCol: 18,
    /** The smallest pad tap area on screen, in pixels (AGENTS.md: 56px targets). */
    tapPx: 56,
  },
  /** Weapons that can be mounted on a spot. `scrap` null means owned from the start. */
  spotWeapons: [
    { id: 'cannon', team: 'PAST', name: 'Cannon', scrap: null, role: 'direct', damage: 20, hp: 30 },
    { id: 'catapult', team: 'PAST', name: 'Catapult', scrap: null, role: 'lob', damage: 25, hp: 25 },
    { id: 'archerPost', team: 'PAST', name: 'Archer post', scrap: null, role: 'volley', damage: 10, hp: 20 },
    { id: 'ballista', team: 'PAST', name: 'Ballista', scrap: 35, role: 'direct', damage: 35, hp: 30 },
    { id: 'laser', team: 'FUTURE', name: 'Laser', scrap: null, role: 'direct', damage: 20, hp: 30 },
    { id: 'missilePod', team: 'FUTURE', name: 'Missile pod', scrap: null, role: 'lob', damage: 25, hp: 25 },
    { id: 'turret', team: 'FUTURE', name: 'Turret', scrap: null, role: 'volley', damage: 10, hp: 20 },
    { id: 'shieldGen', team: 'FUTURE', name: 'Shield generator', scrap: 35, role: 'guard', damage: 0, hp: 40 },
  ],
} as const;
