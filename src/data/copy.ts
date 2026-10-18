// Every user-facing string lives here. Kids read these, so: short words, short sentences.
// Vocabulary table in AGENTS.md applies. Banned words are checked by tests/contracts/copy.test.ts.
// Intro narration text lives in src/data/introScript.ts (from docs/NARRATION.md).
import { TURN } from '../game/config';
import type { AwardId } from '../game/awards';
import { windLevel } from '../game/wind';
import type { Subject, Team } from '../game/types';
import type { UpgradeEffect } from '../game/upgrades';

export const GAME_TITLE = 'Time Clash';
export const GAME_SUBTITLE = 'Past vs. Future';
/** The slogan. It is never the name: the game is called Time Clash. */
export const GAME_TAGLINE = 'Time to Clash!';

// ---------- Forge Weapon ----------
export const FORGE_COPY = {
  title: 'Forge Weapon',
  back: 'Back',
  scrap: 'Scrap',
  pickTeam: 'Choose a team',
  damage: 'Damage',
  range: 'Range',
  level: 'Level',
  rangeNames: { short: 'Short', long: 'Long', far: 'Far' } as const,
  equipped: 'Equipped',
  /** Who owns it: the name of the player on that side. */
  ownedBy: (name: string): string => `Owned by ${name}`,
  unlockCost: (cost: number): string => `${cost} Scrap`,
  /** The button inside the row of the weapon in use. */
  levelUp: (cost: number): string => `Level up · ${cost} Scrap`,
  levelUpMax: 'Top level',
  levelUpLabel: (weapon: string, text: string): string => `${weapon}: ${text}`,
  /** Status lines, read out politely. Never shaming: a short purse is just "not yet". */
  equippedNow: (name: string): string => `${name} is equipped.`,
  unlocked: (name: string): string => `You unlocked ${name}!`,
  forged: (name: string, level: number): string => `${name} is now level ${level}!`,
  needMore: (n: number): string => `Not yet. You need ${n} more Scrap.`,
  atTop: 'This weapon is at the top level.',
} as const;

// ---------- Upgrade Base ----------
/** What an upgrade does, in words a child can read. `n` is the total at the level shown. */
export const upgradeEffect = (effect: UpgradeEffect, n: number): string => {
  switch (effect) {
    case 'maxHp':
      return `Base health +${n}`;
    case 'directCut':
      return `Direct hits hurt ${n} less`;
    case 'nearCut':
      return `Near misses hurt ${n} less`;
    case 'shieldHits':
      return n === 1 ? 'Blocks 1 hit each match' : `Blocks ${n} hits each match`;
    case 'directBonus':
      return `Your direct hits +${n}`;
    case 'repair':
      return `Heals ${n} health each turn`;
  }
};

export const UPGRADE_COPY = {
  title: 'Upgrade Base',
  back: 'Back',
  scrap: 'Scrap',
  pickTeam: 'Choose a team',
  level: (n: number, max: number): string => `Level ${n} of ${max}`,
  cost: (cost: number): string => `${cost} Scrap`,
  topLevel: 'Top level',
  /** Who owns it: the name of the player on that side. */
  ownedBy: (name: string): string => `Owned by ${name}`,
  /** Status lines, read out politely. A short purse is just "not yet". */
  upgraded: (name: string, level: number): string => `${name} is now level ${level}!`,
  needMore: (n: number): string => `Not yet. You need ${n} more Scrap.`,
  atTop: 'This one is at the top level.',
} as const;

// ---------- Camp ----------
export const CAMP = {
  heading: 'Camp',
  logoTime: 'Time',
  logoClash: 'Clash',
  forge: 'Forge Weapon',
  upgrade: 'Upgrade Base',
  /** The big button. It starts the match. */
  start: GAME_TAGLINE,
  /** A small way back to Setup, to change names, grades and subjects. */
  players: 'Change players',
} as const;

export const TEAM_NAMES: Record<Team, string> = { PAST: 'Team Past', FUTURE: 'Team Future' };
export const TEAM_HOMES: Record<Team, string> = { PAST: 'Castle', FUTURE: 'Secret Base' };

export const SUBJECT_LABELS: Record<Subject, string> = {
  reading: 'Reading',
  math: 'Math',
  both: 'Both',
};

/** Short label for chips: K, 1, 2 ... 12. */
export const gradeLabel = (grade: number): string => (grade === 0 ? 'K' : String(grade));
/** Long label for screen readers and summaries. */
export const gradeChipLabel = (grade: number): string =>
  grade === 0 ? 'Kindergarten' : `Grade ${grade}`;

// ---------- Shared buttons ----------
export const BUTTONS = {
  howToPlay: 'How to Play',
  howToPlayIcon: '?',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  captionsOn: 'Captions on',
  captionsOff: 'Captions off',
  musicOn: 'Music on',
  musicOff: 'Music off',
  motionOn: 'Motion on',
  motionOff: 'Motion off',
  volume: 'Volume',
  pause: 'Pause',
  resume: 'Keep playing',
  back: 'Back',
  leaveGame: 'Leave game',
  stay: 'Stay',
  next: 'Next',
  ok: 'OK',
} as const;

// ---------- Pause and leaving a game ----------
export const PAUSE = {
  leaveTitle: 'Leave this game?',
  leaveBody: 'Your match will end. You can start a new one at the Camp.',
} as const;

// ---------- Tap to Start ----------
export const TAP_TO_START = {
  button: 'TAP TO PLAY',
  helper: 'Tap the big button to start. Sound starts after you tap.',
} as const;

// ---------- Intro (How to Play) ----------
export const INTRO = {
  heading: 'How to Play',
  skip: 'Skip',
  replay: 'Replay',
  mute: 'Mute',
  unmute: 'Unmute',
  next: 'Next card',
  done: "Let's go!",
  cardOf: (n: number, total: number): string => `Card ${n} of ${total}`,
} as const;

// ---------- Loading ----------
export const LOADING = {
  /** From docs/DESIGN_BRIEF.md. Rotates every TIMING.loadingMessageMs. */
  messages: [
    'Convincing the hoverboard that math is good for it...',
    'Teaching the catapult how to do long division...',
    'Telling the knights what Wi-Fi is...',
    'Warming up the dad jokes...',
    'Buffing out dignity scratches from the last fall...',
    "Looking for Austin's secret base behind a taco truck...",
  ],
  /** What each balloon rider says after the landing, one set of lines per rider. Short and silly. */
  riderLines: [
    ['I meant to do that', 'on purpose! I was', 'testing gravity.'],
    ['Rude! I was only', 'admiring your sword.', "It's very pointy."],
    ['Note to self: take', 'the bus next time.', "Buses don't pop."],
  ],
  percent: (p: number): string => `${Math.round(p)}%`,
  errorTitle: 'Oops! Some pieces got lost in time.',
  errorBody: "Let's grab them again.",
  errorButton: 'Try again',
} as const;

// ---------- Setup ----------
export const SETUP = {
  heading: 'Who is fighting?',
  subtitle: 'Type your name. Pick your grade and subject.',
  nameLabel: 'Name',
  namePlaceholder: 'Type a name',
  gradeLabel: 'Grade',
  subjectLabel: 'Subject',
  gradeHelper: 'Each team gets questions for its own grade. That keeps it fair.',
  subjectHelper: 'Both mixes reading and math.',
  start: "Let's clash!",
  matchHelper: 'Questions will match your grade.',
  namesStay: 'Names stay on this device. Nothing is sent anywhere.',
  readBack: (team: string, grade: string, subject: string): string =>
    `${team}: ${grade}, ${subject}`,
  versus: 'VS',
  nameEmpty: 'Type a name first.',
  nameTooLong: 'Names can be up to 12 letters.',
  nameBlocked: "Let's pick a different name.",
} as const;

// ---------- Battle HUD ----------
export const HUD = {
  angle: 'Angle',
  power: 'Power',
  fire: 'Fire!',
  baseHealth: 'Base health',
  scrap: 'Scrap',
  shotsLeft: 'Shots left',
  reloadPip: 'Reload',
  keyboardHint: "Arrow keys aim. Space fires. Press a fighter's letter or number to pick it.",
  pickOne: 'Pick one',
  unitLabel: (name: string, id: string): string => `${name} ${id}`,
  /** The gold star pip and screen-reader text while the Power Shot is up. */
  powerShot: 'Power Shot!',
  /** The coach line: it teaches the two sliders and shows until the first shot is fired. */
  coach: 'Slide Angle and Power. Then press Fire!',
  yourTurn: 'Your turn',
  angleValue: (deg: number): string => `${Math.round(deg)}°`,
  powerValue: (p: number): string => `${Math.round(p)}`,
  hpValue: (hp: number, max = 100): string => `${Math.round(hp)} / ${Math.round(max)}`,
  shotsValue: (n: number): string => `${n} of ${TURN.shotsPerTurn}`,
} as const;

/** Wind uses words and arrows, never a bare number and never color alone. */
export const windWord = (wind: number): string =>
  ['Calm', 'Breezy', 'Windy', 'Super windy'][windLevel(wind)] as string;

export const windLabel = (wind: number): string => {
  const level = windLevel(wind);
  if (level === 0) return 'Wind: calm';
  const word = windWord(wind).toLowerCase();
  const arrows = '→'.repeat(level);
  // The owner wants the number kept on screen (INBOX learning aim), now with words to explain it.
  const n = Math.abs(Math.round(Number(wind)));
  return Number(wind) > 0
    ? `Wind: ${word} ${arrows} (${n})`
    : `Wind: ${'←'.repeat(level)} ${word} (${n})`;
};

// ---------- Turn banner and pass screen ----------
export const turnBanner = (name: string, shot: number | 'POWER'): string =>
  shot === 'POWER'
    ? `${String(name).toUpperCase()}, POWER SHOT!`
    : `${String(name).toUpperCase()}, YOUR TURN! (SHOT ${shot} OF ${TURN.shotsPerTurn})`;

export const PASS_SCREEN = {
  heading: 'Pass the screen!',
  noPeeking: 'No peeking at their question!',
  upNext: (name: string): string => `${name}, you're up!`,
  ready: "I'm ready!",
  /** Shown beside the heading, so the next side is clear without color. */
  icon: { PAST: '🏰', FUTURE: '🛸' } as Record<Team, string>,
} as const;

// ---------- Reload ----------
export const RELOAD = {
  heading: 'Reload time!',
  instructions: 'Answer to reload your launcher.',
  hint: 'Hint',
  speak: 'Hear it',
  hintIcon: '💡',
  speakIcon: '🔊',
  yourTurn: 'Your turn!',
  waiting: 'Waiting',
  readStory: 'Read the story',
  gotIt: 'Got it',
  matchWord: (word: string): string => `Tap the word that matches: ${word}`,
  why: (hint: string): string => `Clue: ${hint}`,
  timerLabel: 'Bonus scrap if you answer fast. No rush!',
  reloaded: 'RELOADED!',
  fastBonus: '+2 scrap! Super fast!',
  slowCorrect: '+1 scrap! Nice work!',
  wrong: (answer: string): string => `Nice try! The answer is ${answer}.`,
  lostQuestion: 'Oops! Chrono lost the question. Free reload!',
  wrongReloaded: 'Reloaded anyway. You always get to reload!',
} as const;

// ---------- Hits and tumbles ----------
export const HITS = {
  direct: 'Direct hit!',
  near: 'So close!',
  miss: 'Whoosh! Missed.',
  blocks: 'Boing! Toy blocks everywhere!',
} as const;

/** More ways to say it. The scene picks with a seeded shuffle bag, so no line repeats back to back. */
export const HIT_LINES = {
  direct: ['Direct hit!', 'Bullseye! Boom!', 'Right on target!', 'Whack! Great shot!'],
  near: [
    'So close!',
    'Almost! Did you feel that breeze?',
    'Whoa, that was near!',
    'Just a hair away!',
  ],
  miss: [
    'Whoosh! Missed.',
    'Splat! Right in the dirt.',
    'Nothing but sky!',
    'Oops! The wind took it.',
  ],
} as const;

/** Chrono's quick joke after a reload. Warm, and always at Chrono's expense. */
export const RELOAD_QUIPS = {
  fast: [
    'Zoom! Even my clock is dizzy!',
    'Wow! I blinked and you were done!',
    'Fast brain! I need to catch up!',
  ],
  slow: [
    'Nice and steady. I like it!',
    'Good thinking! I would have guessed.',
    'Careful brain wins the day!',
  ],
  wrong: [
    'My pointer is wiggly too. Try the next one!',
    'Oops! Even Chrono does that. Onward!',
    'No worries! The clue will stick now.',
  ],
} as const;

/** Said by whoever tumbled. Picked with a seeded shuffle bag, so each one shows up. */
export const TUMBLE_LINES = [
  'Just inspecting the floor for loose pennies!',
  'Oops! My legs forgot how to stand!',
  'I meant to do that. It was a spin move!',
  'Who put the gravity on maximum?!',
  'Just checking the lawn for four-leaf clovers!',
  'The ground jumped up and hugged me!',
  'I was only looking for my shoe!',
  'Is the floor supposed to be this close?',
  'Nap time! Just for one second!',
  'My knees tied a bow. Ta-da!',
  'Whoa! The world is sideways now!',
  'I am a pancake. A proud pancake!',
] as const;

/** Extra lines only Team Past says when they wipe out. Silly, kind, and nobody is hurt. */
export const TUMBLE_LINES_PAST = [
  'I meant to do that!',
  'Ouch! My dignity!',
  'The floor started it.',
  'Five more minutes, Mom.',
  'My armor is too shiny. Oops.',
  "I'm just resting my eyes.",
  'That was my good helmet!',
  'Whoa. The sky is sideways.',
  'Tell my horse I was brave.',
] as const;

/** Extra lines only Team Future says when they wipe out. */
export const TUMBLE_LINES_FUTURE = [
  'Oops. My legs went offline.',
  'My hoverboard would never!',
  'Rebooting... please wait.',
  'I was just checking the floor.',
  'Beep boop. Ouch boop.',
  'Plan B was also falling.',
  'Somebody update my legs.',
  'I landed exactly as planned.',
  'Does this count as a nap?',
] as const;

/**
 * The lines one team can say: the shared lines, then that team's own. The match picks an index
 * from this list with a seeded shuffle bag (TUMBLE_LINE_COUNT is its length for both teams).
 */
export function tumblePool(team: Team): readonly string[] {
  return [...TUMBLE_LINES, ...(team === 'PAST' ? TUMBLE_LINES_PAST : TUMBLE_LINES_FUTURE)];
}

// ---------- Victory ----------
export const VICTORY = {
  heading: (name: string): string => `${name} wins!`,
  teamWins: (team: Team): string => `${TEAM_NAMES[team]} wins!`,
  goodSport: 'Rematch? My dignity needs a rematch!',
  wipeout: 'Wipeout!',
  /** A silly line about the walls, never about a person. */
  wipeoutLine: (home: string): string =>
    `Wipeout! The ${home.toLowerCase()} turned into bouncy toy blocks.`,
  brainStats: 'Brain stats',
  brainStatsValue: (right: number, total: number): string => `${right} right out of ${total}`,
  awardsHeading: 'Awards',
  awards: {
    quickestBrain: 'Quickest Brain',
    mostWobbles: 'Most Wobbles',
    sharpestShot: 'Sharpest Shot',
    brainPower: 'Brain Power',
    scrapCollector: 'Scrap Collector',
    goodSport: 'Good Sport',
  } as Record<AwardId, string>,
  statsHeading: 'Scoreboard',
  shotsFired: 'Shots fired',
  directHits: 'Direct hits',
  questionsAnswered: 'Questions answered',
  correctAnswers: 'Right answers',
  fastestAnswer: 'Fastest answer',
  fastestValue: (ms: number | null): string =>
    ms === null ? 'None yet' : `${(Number(ms) / 1000).toFixed(1)} seconds`,
  scrapEarned: 'Scrap earned',
  rematch: 'Rematch',
  backToCamp: 'Back to Camp',
} as const;

// ---------- Errors ----------
export const ERRORS = {
  generic: 'Something went wonky. Tap to try again.',
  tryAgain: 'Try again',
  noSound: 'Sound is not working here. Captions are on.',
  saveFailed: 'This browser will not save. The game still works today.',
} as const;

// ---------- Added by the UI track (additive) ----------
export const UI_EXTRA = {
  gradeError: 'Pick a grade.',
  subjectError: 'Pick a subject.',
  chronoName: 'Chrono',
  clearData: 'Clear my data',
  clearDataAsk: 'Clear names and settings from this device?',
  clearDataYes: 'Yes, clear it',
  clearDataNo: 'Keep them',
  clearDataDone: 'All clear. Nothing is saved now.',
  choicesLabel: 'Answer choices',
  stepsLabel: 'Steps',
  loadingLabel: 'Loading',
  playerCard: (team: Team): string => `${TEAM_NAMES[team]} player`,
} as const;
