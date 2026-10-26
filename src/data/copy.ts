// Every user-facing string lives here. Kids read these, so: short words, short sentences.
// Vocabulary table in AGENTS.md applies. Banned words are checked by tests/contracts/copy.test.ts.
// Intro narration text lives in src/data/introScript.ts (from docs/NARRATION.md).
import { DAMAGE, TURN } from '../game/config';
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
  /** The Weapon Workshop button, and the "My weapons" section (your own weapons). */
  makeOwn: 'Make my own weapon',
  myWeapons: (n: number): string => `My weapons · ${n}`,
  allWeapons: 'All weapons',
  /** The star badge on a weapon you made, in words for a screen reader. */
  mine: 'Made by you',
  /** The Level up button for one of your own weapons sits under the list. */
  levelUpMine: (name: string, text: string): string => `${name}: ${text}`,
  full: (max: number): string => `You have ${max} of your own. That is the most.`,
} as const;

// ---------- Weapon Workshop (make your own weapon) ----------
export const WORKSHOP_COPY = {
  title: 'Weapon Workshop',
  back: 'Back',
  pickStyle: 'Pick a style',
  /** A style is named after the catalog weapon it is like. */
  styles: {
    royalSword: 'Sword',
    elderLongbow: 'Longbow',
    ironCannon: 'Cannon',
    plasmaBlade: 'Blade',
    laserRifle: 'Rifle',
    railCannon: 'Rail Cannon',
  } as Readonly<Record<string, string>>,
  pointsLeft: (n: number): string => (n === 1 ? '1 point left' : `${n} points left`),
  stats: {
    power: { name: 'Power', help: 'Hits hard' },
    reach: { name: 'Reach', help: 'Throws far' },
    splash: { name: 'Splash', help: 'Near misses hurt' },
  },
  more: (stat: string): string => `More ${stat}`,
  less: (stat: string): string => `Less ${stat}`,
  /** What a stat's points do, in words. */
  power: (n: number): string => `Damage ${n}`,
  reach: (range: string): string => `Range ${range}`,
  splash: (n: number): string => `Near miss ${n}`,
  statLabel: (stat: string, n: number, max: number): string => `${stat} ${n} of ${max}`,
  atMost: (stat: string): string => `${stat} is full.`,
  atLeast: (stat: string): string => `${stat} is as low as it goes.`,
  noPoints: 'No points left. Take one from another.',
  nameIt: 'Name it',
  firstWord: 'First word',
  secondWord: 'Second word',
  typeName: 'Or type a name',
  /** Silly, friendly words. A weapon's name is one of each, or a typed name. */
  adjectives: [
    'Wobbly',
    'Giggly',
    'Bouncy',
    'Sparkly',
    'Mighty',
    'Fuzzy',
    'Zippy',
    'Jolly',
    'Sneaky',
    'Rumbly',
    'Sleepy',
    'Shiny',
    'Speedy',
    'Silly',
  ] as readonly string[],
  nouns: [
    'Noodle',
    'Pickle',
    'Muffin',
    'Thunder',
    'Banana',
    'Teapot',
    'Waffle',
    'Bubble',
    'Taco',
    'Puddle',
    'Gizmo',
    'Sock',
    'Pancake',
    'Rocket',
  ] as readonly string[],
  /** Why a typed name is not used. The picked words are kept, so nothing is lost. */
  nameProblem: {
    empty: '',
    long: 'That name is too long.',
    letters: 'Use only letters, numbers and spaces.',
    blocked: "Let's pick a friendlier name.",
    private: 'Keep your own name a secret.',
    digits: 'Use fewer numbers in a row.',
  },
  keepPicked: (name: string): string => `We will use ${name}.`,
  forge: (cost: number): string => `Forge it! · ${cost} Scrap`,
  forged: (name: string): string => `You made ${name}! It is equipped.`,
  needMore: (n: number): string => `Not yet. You need ${n} more Scrap.`,
} as const;

// ---------- Build Base (the old shop screen, shown when the base builder is off) ----------
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
  title: 'Build Base',
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
  upgrade: 'Build Base',
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

/** The grade dropdown's words, also used by screen readers and summaries. */
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
  bonusRingShown: 'Bonus ring: shown',
  bonusRingHidden: 'Bonus ring: hidden',
  volume: 'Volume',
  pause: 'Pause',
  resume: 'Keep playing',
  back: 'Back',
  leaveGame: 'Leave game',
  stay: 'Stay',
} as const;

// ---------- Pause and leaving a game ----------
export const PAUSE = {
  leaveTitle: 'Leave this game?',
  leaveBody: 'Your match will end. You can start a new one at the Camp.',
} as const;

// ---------- Turn your iPad ----------
export const TURN_SCREEN = {
  title: 'Turn your iPad sideways',
  body: 'Time Clash plays best on its side. Turn your iPad and your game waits for you.',
  picture: 'A tablet turning on its side.',
} as const;

// ---------- Tap to Start ----------
export const TAP_TO_START = {
  button: 'TAP TO PLAY',
  /** The sound promise. The big button already says what to do. */
  helper: 'Sound starts after you tap.',
} as const;

// ---------- Intro (How to Play) ----------
export const INTRO = {
  heading: 'How to Play',
  skip: 'Skip',
  replay: 'Replay',
  mute: 'Mute',
  unmute: 'Unmute',
  next: 'Next card',
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
  nameLabel: 'Name',
  namePlaceholder: 'Type a name',
  gradeLabel: 'Grade',
  subjectLabel: 'Subject',
  gradeHelper: 'Each team gets questions for its own grade. That keeps it fair.',
  /** One quiet line under the grade, only while that team's grade is K or 1. No read-aloud. */
  youngReaderNote: 'A grown-up can read the questions with you.',
  /** Match length: a parent picks it. Short and Long change how many hits a base can take. */
  matchLengthLabel: 'Match length',
  matchLengthChips: { short: 'Short', normal: 'Normal', long: 'Long' } as Record<string, string>,
  matchLengthHelper: 'Short ends sooner. Long takes more hits. Questions stay the same.',
  start: "Let's clash!",
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
  /** The selector token that switches to the weapons on the base pads. */
  baseWeapons: 'Base weapons',
  /** A weapon token: its spot number (1 to 4) and its name. */
  mountLabel: (spot: number, name: string): string => `Spot ${spot}: ${name}`,
  /** The token that switches back to the fighters, with the picked fighter on it. */
  fightersLabel: (name: string, id: string): string => `Fighters: ${name} ${id}`,
  /** The gold star pip and screen-reader text while the Power Shot is up. */
  powerShot: 'Power Shot!',
  /** The coach line: it teaches the two sliders and shows until the first shot is fired. */
  coach: 'Slide Angle and Power. Then press Fire!',
  yourTurn: 'Your turn',
  angleValue: (deg: number): string => `${Math.round(deg)}°`,
  powerValue: (p: number): string => `${Math.round(p)}`,
  hpValue: (hp: number, max: number = DAMAGE.startingBaseHp): string =>
    `${Math.round(hp)} / ${Math.round(max)}`,
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

// ---------- Squads S1 (SQUADS.enabled) ----------
/** Words for the helpers. Short, third-grade, with a caption for every line Chrono says. */
export const SQUAD_COPY = {
  pick: 'Pick a helper',
  where: 'Walk out',
  noSpots: 'No spot is free. Press Fire!',
  helperName: {
    'PAST-launcher': 'Cannon Crew',
    'PAST-dasher': 'Sir Bonk',
    'FUTURE-launcher': 'Rocket Button',
    'FUTURE-dasher': 'Robo Bonk',
  } as Record<string, string>,
  /** What each helper does, said once under the name. */
  helperKind: { launcher: 'Fire!', dasher: 'Walk!' } as Record<string, string>,
  /** The one spot button: the dasher walks out to it. */
  spotLabel: 'Walk out!',
  spotAria: (n: number): string => `Walk out to spot ${n}`,
  /** Replaces Walk out while the dasher is on the field. A whole go. */
  recall: 'Come back',
  recallIcon: '\uD83C\uDFE0',
  /** Shown in place of Walk out while the dasher rests. */
  resting: 'Resting. Back soon.',
  walked: (name: string): string => `${name} walks out. He bonks every turn!`,
  cameBack: (name: string): string => `${name} walks home.`,
  /** The word that pops up on the field with every bonk. */
  bonkWord: 'Bonk!',
  bonkBase: (name: string): string => `${name}: Bonk! The base wobbles.`,
  bonkHelper: (name: string): string => `${name}: Bonk! Bonk!`,
  bonkBlocked: 'Bonk! The force field says no.',
  bonkDodged: 'Whoosh! The base slid out of the way.',
  /** A shell lands near a dasher. Nobody is hurt: he wobbles, or loses a heart. */
  wobble: (name: string): string => `${name} wobbles.`,
  loseHeart: (name: string): string => `Bop! ${name} loses a heart.`,
  tumbleHome: (name: string): string => `${name} tumbles and walks home dizzy.`,
  /** Read by a screen reader on the health pips. */
  hearts: (n: number, max: number): string => `${n} of ${max} hearts`,
  back: 'Back',
  hear: 'Hear it',
  backIcon: '\u21A9',
  hearIcon: '\uD83D\uDD0A',
  /** The first-go hint. The finger is drawn beside it, so a pre-reader can follow the picture. */
  firstGo: 'Press Fire! Or pick a helper and tap Walk out!',
  fingerIcon: '\uD83D\uDC46',
  /** What Chrono says on Hear it. Plain words, one short line per kind of helper. */
  hearLine: (kind: string, name: string): string =>
    kind === 'dasher'
      ? `${name} walks across. He bonks every turn. Tap Walk out!`
      : `${name} fires a ball. Press Fire!`,
} as const;

// ---------- Turn banner and pass screen ----------
export const turnBanner = (name: string, shot: number | 'POWER'): string =>
  shot === 'POWER'
    ? `${String(name).toUpperCase()}, POWER SHOT!`
    : `${String(name).toUpperCase()}, YOUR TURN! (SHOT ${shot} OF ${TURN.shotsPerTurn})`;

/** The turn strip words when Squads is on. "GO 1 OF 2" and its dots sit right beside them. */
export const goTurnBanner = (name: string): string => `${String(name).toUpperCase()}, YOUR TURN!`;

export const PASS_SCREEN = {
  heading: 'Pass the screen!',
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
  hintIcon: '💡',
  yourTurn: 'Your turn!',
  waiting: 'Waiting',
  readStory: 'Read the story',
  gotIt: 'Got it',
  why: (hint: string): string => `Clue: ${hint}`,
  timerLabel: 'Bonus scrap if you answer fast. No rush!',
  reloaded: 'RELOADED!',
  fastBonus: '+2 scrap! Super fast!',
  slowCorrect: '+1 scrap! Nice work!',
  bonusPop: '+2 scrap',
  /** Caption for the bonus sound. */
  bonusSound: 'Ka-ching!',
  wrong: (answer: string): string => `Good try! The answer is ${answer}.`,
  lostQuestion: 'Oops! Chrono lost the question. Free reload!',
  wrongReloaded: 'Reloaded anyway. You always get to reload!',
} as const;

// ---------- Hits and tumbles ----------
export const HITS = {
  direct: 'Direct hit!',
  near: 'So close!',
  miss: 'Whoosh! Missed.',
} as const;

/** More ways to say it. The scene picks with a seeded shuffle bag, so no line repeats back to back. */
export const HIT_LINES = {
  direct: ['Direct hit!', 'Bullseye! Boom!', 'Right on target!', 'Whack! Great shot!'],
  near: [
    'So close!',
    'Almost! The wall felt that breeze.',
    'Whoa! That one tickled the wall.',
    'Just a hair away!',
    'Eek! The wall is sweating now.',
    'One tiny nudge more. Then boom!',
  ],
  miss: [
    'Whoosh! Missed.',
    'Splat! A worm says hi.',
    'Nothing but sky! The birds say thanks.',
    'Oops! The wind took it for a ride.',
    'Plop! The grass got a surprise.',
    'Bonk! That rock did not see it coming.',
  ],
} as const;

/**
 * The sound words for birds and gusts. Each one floats over the board when it happens, so the
 * squawk and the whoosh are never sound-only cues.
 */
export const DISTURBANCE_COPY = {
  squawk: 'Squawk!',
  whoosh: 'Whoosh!',
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
    'I mix up my tick and tock too!',
    'Good try! Now that clue is yours.',
    'Brains grow from tries like that. Onward!',
    'My gears slip too. Next one!',
  ],
} as const;

/**
 * Said by whoever tumbled. Picked with a seeded shuffle bag, so each one shows up. The last six
 * (2026-10-25) have no recorded clip yet: they use the browser voice, always with a caption.
 */
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
  'Boing! I bounce like a ball!',
  'That was my best cartwheel ever!',
  'I am a starfish now!',
  'Wobble, wobble, flop!',
  'My hat landed before I did!',
  'Wheee! Can we do that again?',
] as const;

/** Extra lines only Team Past says when they wipe out. Silly, kind, and nobody is hurt. */
export const TUMBLE_LINES_PAST = [
  'Ouch! My dignity!',
  'The floor started it.',
  'Five more minutes, Mom.',
  'My armor is too shiny. Oops.',
  "I'm just resting my eyes.",
  'That was my good helmet!',
  'Tell my horse I was brave.',
  'My armor goes clink, clank, clonk!',
  'Squire! Bring me a pillow, please!',
  'My horse is laughing at me.',
  'Who left a banana peel here?',
  'Even my mustache fell over!',
] as const;

/** Extra lines only Team Future says when they wipe out. */
export const TUMBLE_LINES_FUTURE = [
  'Oops. My legs went offline.',
  'My hoverboard would never!',
  'Rebooting... please wait.',
  'Beep boop. Ouch boop.',
  'Plan B was also falling.',
  'Somebody update my legs.',
  'I landed exactly as planned.',
  'Does this count as a nap?',
  'Oops. My jetpack forgot to jet.',
  'My robot socks need new batteries.',
  'I slipped on a space taco!',
  'Robot dance! Nailed it. Mostly.',
] as const;

/**
 * The lines one team can say: the shared lines, then that team's own. The match picks an index
 * from this list with a seeded shuffle bag (TUMBLE_LINE_COUNT is its length for both teams).
 */
export function tumblePool(team: Team): readonly string[] {
  return [...TUMBLE_LINES, ...(team === 'PAST' ? TUMBLE_LINES_PAST : TUMBLE_LINES_FUTURE)];
}

/**
 * Said by a fighter whose brick fell out from under it on a built base (owner, 2026-10-25: "they
 * fall awkwardly and say something funny"). Picked with a seeded shuffle bag per team, so no line
 * shows twice in a row. No recorded clip yet: they use the browser voice, always with a caption.
 */
export const BASE_FALL_LINES = [
  'Whoa! The floor left without me!',
  'I live on the ground floor now.',
  'Going down! Next stop, the grass!',
  'I meant to take the stairs.',
] as const;

/** Extra base fall lines only Team Past says. */
export const BASE_FALL_LINES_PAST = [
  'Nobody tell the castle.',
  'My tower took a little nap.',
  'Who built this wall? Oh. Me.',
  'Brick, brick, brick, and then plop!',
  'My armor clanged all the way down.',
  'Squire! My wall ran away!',
  'That wall owes me a ladder.',
  'Even my helmet is giggling.',
  'A knight always lands. Sort of.',
  'My bricks went for a walk.',
] as const;

/** Extra base fall lines only Team Future says. */
export const BASE_FALL_LINES_FUTURE = [
  'Beep! Floor not found!',
  'Gravity update installed. Oops.',
  'My hover boots forgot to hover.',
  'Starting over from the ground floor.',
  'My base did a robot dance.',
  'Landing mode: extra wobbly.',
  'Nobody tell my robot friends.',
  'New plan: stand down here.',
  'My circuits say that was fun!',
  'Who unplugged the floor?',
] as const;

/** The base fall lines one team can say: the shared ones, then its own (BASE_FALL_LINE_COUNT). */
export function baseFallPool(team: Team): readonly string[] {
  return [...BASE_FALL_LINES, ...(team === 'PAST' ? BASE_FALL_LINES_PAST : BASE_FALL_LINES_FUTURE)];
}

// ---------- Victory ----------
export const VICTORY = {
  heading: (name: string): string => `${name} wins!`,
  /**
   * Said by the losing side's fighter in the canvas speech bubble, never by Chrono. Chrono did not
   * fall over, so the line only fits in the mouth of the side that took the wipeout.
   */
  goodSport: 'Rematch? My dignity needs a rematch!',
  wipeout: 'Wipeout!',
  /** A silly line about the walls, never about a person. */
  wipeoutLine: (home: string): string =>
    `Wipeout! The ${home.toLowerCase()} turned into bouncy toy blocks.`,
  brainStats: 'Brain stats',
  brainStatsValue: (right: number, total: number): string => `${right} right out of ${total}`,
  /** The Scrap a side earned this match. Zero is a plain "0 Scrap", never a blank. */
  scrapLabel: 'Scrap earned',
  scrapValue: (n: number): string => `${n} Scrap`,
  awardsHeading: 'Awards',
  awards: {
    quickestBrain: 'Quickest Brain',
    mostWobbles: 'Most Wobbles',
    sharpestShot: 'Sharpest Shot',
    brainPower: 'Brain Power',
    scrapCollector: 'Scrap Collector',
    goodSport: 'Good Sport',
  } as Record<AwardId, string>,
  rematch: 'Rematch',
  backToCamp: 'Back to Camp',
} as const;

/**
 * Chrono's line on the Victory screen, picked by how the match went (src/ui/victoryMood.ts).
 * It cheers both sides and never names a loser.
 */
export const VICTORY_CHRONO = {
  /** Both sides landed hits, and the score was tight. */
  close: 'What a close clash! My gears are still spinning.',
  /** One side landed nothing. Gentle, and the wind takes the blame. */
  shutout: 'Tough one! The wind was extra sneaky. Rematch?',
  /** Anything else. */
  solid: 'Great clash, both teams! Who wants a rematch?',
} as const;
export type VictoryMood = keyof typeof VICTORY_CHRONO;

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
} as const;

// ---------- Phase 2: Battle Plan, ammo and evasion (additive) ----------
/** The Battle Plan screen between the Camp and the battle. */
export const PLAN_COPY = {
  title: 'Battle Plan',
  back: 'Back',
  go: 'Lock it in!',
  placeHeading: 'Pick a place',
  fortHeading: (pastName: string): string => `${pastName}, place your castle`,
  spotHeading: (futureName: string): string => `${futureName}, hide your base`,
  ammoHeading: 'Special ammo',
  ammoNote: 'A few shots each match. Unlock it once with Scrap.',
  scrap: 'Scrap',
  biomes: {
    aspen: { name: 'Aspen Forest', note: 'A big hill.' },
    cherry: { name: 'Cherry Blossoms', note: 'A low, wide hill.' },
    temple: { name: 'Ruined Temple', note: 'A tall old pillar.' },
  },
  spots: {
    skyscraper: { name: 'Skyscraper', height: 'High', note: 'No cover.' },
    foodTruck: { name: 'Food Trucks', height: 'Middle', note: 'A low wall.' },
    bridge: { name: 'Bridge', height: 'Low', note: 'Blocks flat shots.' },
  },
  forts: {
    hillFort: { name: 'Hill Fort', height: 'High', note: 'Solid rock below.' },
    /** Code id `villageWall`. The label is just "Village", so it never sounds like the Stone Wall ability. */
    villageWall: { name: 'Village', height: 'Middle', note: 'A low wall.' },
    drawbridge: { name: 'Drawbridge', height: 'Low', note: 'Blocks flat shots.' },
  },
  ammo: {
    confetti: { name: 'Confetti', note: 'Bigger blast.' },
    plasma: { name: 'Plasma', note: 'Bounces once.' },
    bowling: { name: 'Bowling', note: 'Hits hard. Wind barely moves it.' },
  },
  unlock: (cost: number): string => `${cost} Scrap`,
  owned: (uses: number): string => `${uses} shots`,
  /** What a screen reader hears for one ammo button. */
  ammoLabel: (name: string, note: string, owned: boolean, cost: number, uses: number): string =>
    owned
      ? `${name}. ${note} Unlocked: ${uses} shots each match.`
      : `${name}. ${note} Unlock it for ${cost} Scrap.`,
  unlocked: (name: string): string => `${name} unlocked!`,
  needScrap: (cost: number): string => `You need ${cost} Scrap for that. Answer fast to earn more.`,
} as const;

/** The two gear buttons in the battle bar: ammo and the evasion ability. */
export const GEAR_COPY = {
  standard: 'Standard',
  ammoButton: (name: string, left: string): string => `Ammo: ${name}, ${left}. Tap to change.`,
  unlimited: 'no limit',
  shotsLeft: (n: number): string => `${n} left`,
  abilities: {
    dodge: { name: 'Hoverboard Dodge', short: 'Dodge' },
    barricade: { name: 'Stone Wall', short: 'Wall' },
  },
  ready: (name: string): string => `${name}: ready. Tap to use it on the next turn.`,
  armed: (name: string): string => `${name}: set for the next turn. Tap to take it back.`,
  active: (name: string): string => `${name}: guarding now.`,
  recharging: (name: string, turns: number): string =>
    `${name}: charging. Ready in ${turns} ${turns === 1 ? 'turn' : 'turns'}.`,
  used: (name: string): string => `${name}: used up this match.`,
  /** Chrono says these out loud (with a caption) when a player sets an ability. */
  armedLine: {
    dodge: 'Hoverboard charged! The next hit will whoosh right past.',
    barricade: 'Stone wall ready! It pops up on the next turn.',
  },
  /** Floating words when a dodge makes a hit miss. */
  dodgedLine: 'Whoosh! Dodged!',
} as const;

// ---------- Base builder ----------
export const BUILDER_COPY = {
  /** The screen is called Build Base for both sides. */
  title: { PAST: 'Build Base', FUTURE: 'Build Base' } as Record<Team, string>,
  /** A tap on a locked piece or weapon when the purse is short. */
  needMore: (n: number): string => `Not enough Scrap yet. You need ${n} more.`,
  pickTeam: 'Choose a team',
  back: 'Back',
  scrap: 'Scrap',
  slots: 'Saved bases',
  slot: (n: number): string => `Base ${n}`,
  slotEmpty: (n: number): string => `Base ${n}, empty. Start a new base`,
  slotFull: (n: number, bricks: number): string => `Base ${n}, ${bricks} bricks`,
  tools: 'Tools',
  tray: 'Bricks',
  plot: 'Build plot',
  hint: 'Drag a brick. Tap Turn to spin it.',
  hintPicked: (name: string): string => `${name} is ready. Tap the plot to put it down.`,
  keys: 'Keys: Enter picks a brick. Arrows move it. R turns it. Enter puts it down. Delete takes it off. Control Z undoes.',
  turn: 'Turn',
  undo: 'Undo',
  clear: 'Clear',
  snapOn: 'Snap ON',
  snapOff: 'Snap OFF',
  snapLabel: (on: boolean): string => `Snap to grid is ${on ? 'on' : 'off'}. Tap to switch.`,
  done: 'Done',
  clearAsk: 'Take every brick off this base?',
  clearYes: 'Yes, clear it',
  clearNo: 'Keep it',
  placed: (name: string): string => `${name} placed.`,
  moved: (name: string): string => `${name} moved.`,
  turned: (name: string): string => `${name} turned.`,
  removed: (name: string): string => `${name} taken off.`,
  cleared: 'The plot is clear. Undo brings it back.',
  undone: 'Undone.',
  nothingToUndo: 'Nothing to undo.',
  pickFirst: 'Tap a brick first, then tap Turn.',
  noRoom: 'No room there. Try another spot.',
  /** A brick let go in mid-air, or beside a wall with nothing under it. */
  floating: 'Build on something that touches the ground.',
  /** Taking away, moving or turning a brick that another brick rests on. */
  holding: 'Something is sitting on that brick. Take the top one off first.',
  /** Once, when an old base had floating bricks and the builder set them down. */
  settled: 'Chrono here! Some bricks were floating. I set them down.',
  full: 'This base is full of bricks.',
  cancelled: 'Put back. Nothing changed.',
  selected: (name: string): string => `${name} chosen. Tap Turn to spin it.`,
  pieceLabel: (name: string, x: number, y: number): string =>
    `${name}, column ${x + 1}, row ${y + 1}. Enter to choose, Delete to take off.`,
  lockedLabel: (name: string, n: number): string => `${name}, locked. ${n} Scrap to unlock.`,
  unlockCost: (n: number): string => `${n} Scrap`,
  unlocked: (name: string): string => `You unlocked ${name}!`,
  ghostAt: (name: string, x: number, y: number): string =>
    `${name} at column ${x + 1}, row ${y + 1}. Enter puts it down.`,
  /** The column left of the plot with the team and mode buttons. */
  rail: 'Team and mode',
  // Weapon spots
  mode: 'Mode',
  modeBuild: 'Build',
  modeWeapons: 'Weapons',
  modeBuildLabel: 'Build mode, bricks',
  modeWeaponsLabel: 'Weapons mode, pick weapon spots',
  spotsChip: (used: number, total: number): string => `Spots ${used} of ${total} used`,
  spotHint: 'Tap a spot. Pick a weapon for it.',
  spotKeys:
    'Weapon keys: Tab or arrows go to a spot. Enter chooses it. Then arrows pick a weapon and Enter puts it on. Delete clears the spot. Escape closes the list.',
  spotTitle: (n: number): string => `Spot ${n}: pick a weapon`,
  spotPanel: (n: number): string => `Pick a weapon for spot ${n}`,
  onThisSpot: 'On this spot',
  clearSpot: 'Clear spot',
  clearSpotLabel: (n: number): string => `Clear spot ${n}`,
  spotLabel: (weapon: string | null, n: number, selected: boolean): string =>
    `Spot ${n}, ${weapon ? weapon.toLowerCase() : 'empty'}${selected ? ', selected' : ''}`,
  weaponLabel: (name: string, onSpot: boolean): string => (onSpot ? `${name}, on this spot` : name),
  weaponLockedLabel: (name: string, n: number): string => `${name}, locked. Costs ${n} Scrap.`,
  weaponPlaced: (name: string, n: number): string => `${name} is on spot ${n}.`,
  weaponCleared: (n: number): string => `Spot ${n} is empty now.`,
  spotAlreadyEmpty: (n: number): string => `Spot ${n} is already empty.`,
  spotChosen: (n: number): string => `Spot ${n} chosen. Pick a weapon for it.`,
  weaponUnlocked: (name: string, n: number): string =>
    `You unlocked ${name}! Tap it to put it on spot ${n}.`,
  /** "My weapons": the weapons the player made in the Forge Workshop, at the top of the list. */
  myWeapons: 'My weapons',
  campWeapons: 'Base weapons',
  myDamage: (n: number): string => `Damage ${n}`,
  myWeaponLabel: (name: string, damage: number, onSpot: boolean): string =>
    `${name}, my weapon, damage ${damage}${onSpot ? ', on this spot' : ''}`,
  /** The quiet row when the player has made none yet. It opens the Forge Workshop. */
  makeInForge: 'Make a weapon in the Forge',
  madeInForge: (name: string): string => `You made ${name}! It is in My weapons now.`,
} as const;
