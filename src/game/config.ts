// Every balance number and layout constant lives here (AGENTS.md "Config in one place").
// Phase 1 numbers come from docs/BUILD.md. Tune here only.
import type { Settings } from '../storage/types';
import type { BattleLayout, Polygon, Rect, Team, Topic, Vec2 } from './types';

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

// ---------- Character health ----------
/**
 * Every fighter has its own health. It REPLACES base health for the win (owner decision,
 * 2026-10-20). Off until the scene and HUD land. The flag is read only as the default of
 * `MatchOptions.characterHealth`; tests pass the option and never change this constant.
 */
export const CHARACTER_HEALTH = {
  enabled: false,
  /** Health each fighter starts with. */
  hp: 3,
  /** Health lost to a direct hit. */
  directHit: 1,
  /**
   * Health lost to a Power Shot direct hit. The Power Shot is 1.5 times as hard
   * (BONUS.damageMultiplier). Health is whole numbers, so 1 x 1.5 rounds up to 2.
   */
  powerHit: 2,
  /** A near miss does no damage. The fighter tumbles. */
  nearHit: 0,
  /** A fighter's hit box, centered on its firing spot, in world px. */
  box: { w: 64, h: 64 },
  /** Scales DAMAGE.directRadius around a fighter box. 0.5 means 24 px of slack. */
  directScale: 0.5,
  /** Scales DAMAGE.nearRadius around a fighter box. 0.75 means 90 px. */
  nearScale: 0.75,
} as const;

// ---------- Match length ----------
/**
 * A parent picks how long a match runs at Setup. It only scales how much damage a base
 * (or a fighter, with CHARACTER_HEALTH on) can take. Turns, questions, reload timing and
 * scoring never change. Normal is exactly the balance above.
 */
export const MATCH_LENGTH = {
  default: 'normal',
  ids: ['short', 'normal', 'long'],
  /** Multiplies full health. Normal is 1, so nothing moves for anyone who leaves it alone. */
  healthScale: { short: 0.5, normal: 1, long: 1.5 },
} as const;

// ---------- Reload and scrap ----------
export const RELOAD = {
  /** Answers strictly under this many ms are "fast". */
  fastMs: 8000,
  /** Fast time limit by question kind. Longer reading takes longer to read, so the bonus stays fair. */
  fastMsByKind: {
    numeric: 8000,
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

/**
 * Squads, milestone S1 (docs/SQUADS_PLAN.md). Off by default, so a shipped build plays exactly
 * as before. A match takes `MatchOptions.squads`, which falls back to `enabled`. Tests pass the
 * option and never change this constant.
 */
export const SQUADS = {
  enabled: false,
  /** A turn is this many goes, then the reload question. Same number as TURN.shotsPerTurn. */
  goesPerTurn: 2,
  /** Ground spots g0 to g4, left to right. g0 is Team Past's doorstep and the last one is Team Future's. */
  groundSpots: 5,
  /** How many spots a dasher may roll in one go. */
  dashRange: 2,
  /** Base health a dash bonk takes off an enemy base (plan section 6). One aimed direct hit stays bigger. */
  dashBonkDamage: 12,
  /** Where each side's dasher stands at the start, and where it walks home to after a bonk. */
  dasherHome: { PAST: 1, FUTURE: 3 } as Record<Team, number>,
  /** Rendered tap size at 768 px wide. The hard floor is 56. */
  minTapPx: 64,
} as const;

// ---------- Setup ----------
export const GRADE = { min: 0, max: 12 } as const;
export const NAME = { minLength: 1, maxLength: 12 } as const;
export const DEFAULT_NAMES: Record<Team, string> = { PAST: 'Knight', FUTURE: 'Rocket' };

// ---------- Topic focus ----------
/**
 * A parent can focus one side's math questions on a topic. Off by default for every player.
 * `offer` lists the topics Setup shows on each side: multiplication for Team Past, division for Team Future.
 */
export const TOPIC_FOCUS = {
  enabled: true,
  offer: { PAST: ['multiplication'], FUTURE: ['division'] } as Record<Team, readonly Topic[]>,
  /** The tag a bank question carries when it belongs to a topic. */
  tags: { multiplication: 'topic:multiplication', division: 'topic:division' } as Record<
    Topic,
    string
  >,
  /** Every math grade, K to 12, must hold at least this many questions for each topic. */
  minPerGrade: 20,
} as const;
export const TOPIC_IDS: readonly Topic[] = ['multiplication', 'division'];

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

// ---------- Castle places (Team Past) ----------
/**
 * Places for Team Past's castle, the mirror of Team Future's SPOTS. `null` (no place picked, and
 * every plan saved before these existed) is the Phase 1 castle, unchanged. Each place moves the
 * castle (and the fighters standing on it) by `shift`, and adds its own solid shapes.
 */
export const FORT_IDS = ['hillFort', 'villageWall', 'drawbridge'] as const;

export const FORTS: Record<(typeof FORT_IDS)[number], SpotConfig> = {
  /** High on a rock. The best view. The rock is solid, so low shots thud into it. */
  hillFort: {
    shift: { x: 0, y: -140 },
    base: { x: 80, y: 330, w: 160, h: 150 },
    launchOrigin: { x: 220, y: 310 },
    obstacles: [
      [
        { x: 84, y: 480 },
        { x: 236, y: 480 },
        { x: 242, y: 536 },
        { x: 238, y: GROUND_Y },
        { x: 74, y: GROUND_Y },
        { x: 70, y: 548 },
      ],
    ],
  },
  /** On the ground, behind a low stone wall out in front. */
  villageWall: {
    shift: { x: 0, y: 0 },
    base: { x: 80, y: 470, w: 160, h: 150 },
    launchOrigin: { x: 220, y: 450 },
    obstacles: [rectToPolygon({ x: 426, y: 536, w: 32, h: GROUND_Y - 536 })],
  },
  /** Low, behind a raised wooden drawbridge. The bridge stops flat shots, so players must lob. */
  drawbridge: {
    shift: { x: 0, y: 50 },
    base: { x: 80, y: 520, w: 160, h: 100 },
    launchOrigin: { x: 220, y: 500 },
    obstacles: [rectToPolygon({ x: 260, y: 380, w: 160, h: 50 })],
  },
};

// ---------- Biomes (Phase 2) ----------
/** Where the battle happens. Each place has its own middle obstacle and its own backdrop. */
export const BIOME_IDS = ['aspen', 'cherry', 'temple'] as const;

export type BiomeConfig = {
  /** The solid shape in the middle of the field. Aspen keeps the Phase 1 hill. */
  obstacle: Polygon;
};

export const BIOMES: Record<(typeof BIOME_IDS)[number], BiomeConfig> = {
  /** The Phase 1 hill, unchanged. */
  aspen: { obstacle: HILL },
  /** A low, wide mound. Flatter shots get through more often. */
  cherry: {
    obstacle: [
      { x: 500, y: GROUND_Y },
      { x: 580, y: 560 },
      { x: 700, y: 550 },
      { x: 780, y: GROUND_Y },
    ],
  },
  /** A tall broken pillar. Players must lob over it. */
  temple: {
    obstacle: [
      { x: 610, y: GROUND_Y },
      { x: 610, y: 470 },
      { x: 640, y: 455 },
      { x: 670, y: 480 },
      { x: 670, y: GROUND_Y },
    ],
  },
};

/** What a new family's first Battle Plan shows picked. Food Trucks keeps the Phase 1 base spot. */
export const DEFAULT_PLAN = { biome: 'aspen', spot: 'foodTruck' } as const;

// ---------- Evasion (Phase 2) ----------
/**
 * One ability per team. A player arms it on their own turn (free, not a shot). It guards their
 * base during the other team's next turn.
 */
export const EVASION = {
  /** Team Future. The base zips aside, so the first hit that would do damage misses. */
  dodge: {
    team: 'FUTURE' as Team,
    /** Ready again this many of your own turns after you arm it. */
    rechargeTurns: 2,
  },
  /** Team Past. A stone wall stands in front of the castle for the other team's whole turn. */
  barricade: {
    team: 'PAST' as Team,
    usesPerMatch: 1,
    /** Clear of the castle, its fighters and the middle obstacle. Lobs still get over it. */
    wall: { x: 460, y: 400, w: 40, h: GROUND_Y - 400 } as Rect,
  },
} as const;

// ---------- Timing (ms) ----------
export const TIMING = {
  /** Loading screen waits at least this long so the jokes and the balloon riders can be enjoyed. */
  loadingMinMs: 5000,
  /** A new family sees the longer, funnier load once. Returning families use loadingMinMs. */
  loadingFirstMinMs: 8000,
  /** Browser tests (the e2e hook is on) wait this long, so a full run is not slowed by the jokes. */
  loadingQuickMs: 1500,
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

/** Victory confetti and the fast-answer burst. Decoration only. */
export const CELEBRATE = {
  confettiCount: 24,
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
  hideBonusRing: false,
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
 * grid. On for everyone (owner decision, 2026-10-23). With `enabled` false, `?builder=1` in the
 * address still turns it on for a try-out (see `baseBuilderOn` in baseBuilder.ts).
 */
export const BASE_BUILDER = {
  enabled: true,
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
  /** Your own shapes: the drawing pad is this many squares on a side. */
  shapePad: 4,
  /** Most squares in one shape of your own. */
  maxShapeCells: 8,
  /** Most shapes of your own a player keeps for each side. */
  maxShapes: 6,
  /** Hit points for each square of a shape of your own (the shape has squares times this). */
  hpPerCell: 8,
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

// ---------- Built bases in battle ----------
/**
 * The bricks and weapon spots a player built take part in the match (owner decision, 2026-10-20:
 * "the bricks take hits", weapons on spots are real firing positions, a hit brick falls away, a
 * weapon falls with its brick). Nobody is hurt: bricks puff and tumble. Off until the scene draws
 * it. Read only as the default of `MatchOptions.baseInBattle`; tests pass the option. It only
 * works together with `CHARACTER_HEALTH` (the win is still "all fighters out").
 */
export const BASE_IN_BATTLE = {
  enabled: false,
  /** Battlefield pixels per build step. The plot is 192 by 88 steps, so 384 by 176 px. */
  scale: 2,
  /** Where the plot's outer edge sits, in world px from its own side of the screen. */
  margin: 40,
  /** The plot's bottom edge (the top of the foundation) is the ground line. */
  plotBottomY: TERRAIN.groundY,
  /** A weapon's hit box, centered on its pad, in world px (the pad is 2 x 5 steps wide). */
  mountBox: { w: 20, h: 20 },
  /** Mounted weapons fire with this range scale (squad upgrades do not change them). */
  mountSpeedScale: 1,
  /**
   * Damage to a brick or weapon (in brick hit points, see BASE_BUILDER.hp) from a shell that
   * reaches it. A near miss chips 0. A Power Shot multiplies by BONUS.damageMultiplier (rounded).
   * A fighter's shot does `fighterShot` times its damageScale. A mounted weapon does its catalog
   * `damage` times its role's multiplier (`lob` is the splash weapon: it hits the hardest).
   */
  brickDamage: {
    fighterShot: 20,
    roleMultiplier: { direct: 1, lob: 1.5, volley: 1, guard: 0 },
  },
  /** How a shot is aimed from a mount, by role. Angles are degrees (0 flat, 90 up). */
  aimByRole: {
    direct: { minAngleDeg: 0, maxAngleDeg: 45 },
    lob: { minAngleDeg: 45, maxAngleDeg: 90 },
    volley: { minAngleDeg: 0, maxAngleDeg: 90 },
    guard: { minAngleDeg: 0, maxAngleDeg: 90 },
  },
  /** A volley: this many small shells fanned this far apart (degrees), each with the weapon's damage. */
  volley: { shots: 3, spreadDeg: 4, maxFighterHealth: 1 },
  /** A shield generator blocks the first hit per enemy turn that lands this close to its pad (px). */
  guardRadius: 90,
  /** Fighters with these roles shoot over walls like a lob (they fly above them). */
  flierRoles: ['balloon', 'helicopter'] as readonly string[],
  /** The Computer player picks a mounted weapon this often when it has one that can fire. */
  botMountChance: 0.5,
} as const;

// ---------- Weapon Workshop (make your own Forge weapon) ----------
/**
 * The Forge's "Make my own weapon" pad (owner request, 2026-10-24). A player picks a style (the
 * team's three catalog weapons are the three styles), then spends `budget` points on three stats.
 * Each stat holds `minPoints` to `maxPoints`. The numbers are set so that no custom weapon ever
 * beats the best catalog weapon of its team: see `powerScore` in src/game/customWeapons.ts and
 * the sweep in tests/game/customWeapons.test.ts. A weapon's score is
 * `direct + near + reachWeight * (speedScale - 1)`. reachWeight 20 counts the catalog's +0.2 launch
 * speed (Royal Sword to Iron Cannon) as 4 damage, about two Forge levels of direct damage.
 * Best catalog score: Iron Cannon 32 + 12 + 4 = 48. Best custom score: 43 (Power 5, Splash 4).
 */
export const WORKSHOP = {
  /** Custom weapons one player can keep for one side. */
  maxPerTeam: 6,
  /** Points to spend on Power, Reach and Splash together. */
  budget: 10,
  minPoints: 1,
  maxPoints: 5,
  /** Power: direct-hit damage = base + perPoint x points (19 to 31). */
  power: { base: 16, perPoint: 3 },
  /** Splash: near-miss damage = base + perPoint x points (6 to 14). */
  splash: { base: 4, perPoint: 2 },
  /** Reach: launch speed scale = base + perPoint x points (1.0 to 1.2, like the catalog). */
  reach: { base: 0.95, perPoint: 0.05 },
  /** Score weight of launch speed above 1 (see above). */
  reachWeight: 20,
  /** The points each style starts with. The player moves them freely after that. */
  presets: {
    short: { power: 3, reach: 1, splash: 1 },
    long: { power: 1, reach: 3, splash: 1 },
    heavy: { power: 1, reach: 1, splash: 3 },
  },
  /**
   * Scrap to forge, by score: the first row whose `upTo` the score is not above. The cheapest
   * matches the Forge's first level-up (6 Scrap). Scores run 25 to 43.
   */
  cost: [
    { upTo: 30, scrap: 6 },
    { upTo: 36, scrap: 12 },
    { upTo: 40, scrap: 18 },
    { upTo: 999, scrap: 24 },
  ] as ReadonlyArray<{ upTo: number; scrap: number }>,
  /** A typed name: this many characters at most, letters, digits and spaces only. */
  typedNameMax: 14,
  /** A saved name (a picked pair of words or a typed name) is never longer than this. */
  savedNameMax: 24,
  /** Longest run of digits allowed in a typed name, so no phone or house number fits. */
  maxDigitRun: 2,
  /** Highest serial number in a custom weapon id ("custom:P:7"). */
  maxSerial: 999,
  /**
   * As a base-builder spot weapon (for a later "My weapons" section in Build Base). Damage =
   * (damageBase + damagePerPower x Power points) x roleScale, rounded. Health = hpBase +
   * hpPerSparePower x (maxPoints - Power points), so a gentle hitter is sturdier.
   */
  mount: {
    roles: { short: 'direct', long: 'volley', heavy: 'lob' },
    damageBase: 8,
    damagePerPower: 3,
    /** A volley fires several shells, so each one is smaller (like the Archer post). */
    roleScale: { direct: 1, volley: 0.5, lob: 1 },
    hpBase: 20,
    hpPerSparePower: 2,
  },
} as const;
