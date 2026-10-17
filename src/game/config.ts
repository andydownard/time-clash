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
} as const;

// ---------- Layout (logical world, scaled to fit by Phaser) ----------
export const WORLD = { width: 1280, height: 720 } as const;

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
export const TUMBLE_LINE_COUNT = 12;
