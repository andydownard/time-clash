// Fakes for the scene tests. A fake MatchController is enough for routing; one test
// also uses the real createMatch so the hand-off shape cannot drift.
import type {
  Match,
  MatchController,
  MatchOptions,
  Players,
  Team,
  TeamStats,
} from '../../src/game/types';
import { DEFAULT_SETTINGS, PHASE1_LAYOUT } from '../../src/game/config';
import { freshUnitHp } from '../../src/game/damage';
import type { QuestionBank } from '../../src/questions/types';
import type { AppServices } from '../../src/scenes/registry';
import { setup } from '../ui/helpers';

export const players: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 5, subject: 'reading' },
];

export const stats = (over: Partial<TeamStats> = {}): TeamStats => ({
  shotsFired: 4,
  directHits: 1,
  nearHits: 2,
  questionsAnswered: 2,
  correctAnswers: 1,
  fastestAnswerMs: 3200,
  scrapEarned: 3,
  ...over,
});

export function fakeController(
  patch: Partial<Match> = {},
  rematch: MatchOptions = { players, seed: 8, firstTeam: 'FUTURE' },
): MatchController {
  const match: Match = {
    seed: 7,
    players,
    status: 'OVER',
    winner: 'PAST',
    turn: { phase: 'RELOAD', team: 'PAST', turnNumber: 3, shotsFired: 2, bonus: false },
    wind: 0,
    baseHp: { PAST: 50, FUTURE: 0 },
    characterHealth: false,
    unitHp: freshUnitHp(),
    maxUnitHp: 3,
    aliveCount: { PAST: 5, FUTURE: 5 },
    maxBaseHp: { PAST: 100, FUTURE: 100 },
    scrap: { PAST: 3, FUTURE: 1 },
    aim: { PAST: { angleDeg: 45, power: 60 }, FUTURE: { angleDeg: 45, power: 60 } },
    selected: { PAST: 'C', FUTURE: '1' },
    stats: { PAST: stats(), FUTURE: stats({ directHits: 0, fastestAnswerMs: null }) },
    lastShot: null,
    ammo: { PAST: 'standard', FUTURE: 'standard' },
    ammoLeft: { PAST: {}, FUTURE: {} },
    evasion: {
      PAST: { id: 'barricade', phase: 'ready', turnsLeft: 0, usesLeft: 1 },
      FUTURE: { id: 'dodge', phase: 'ready', turnsLeft: 0, usesLeft: Infinity },
    },
    ...patch,
  };
  const unused = (): never => {
    throw new Error('not used in this test');
  };
  return {
    layout: PHASE1_LAYOUT,
    snapshot: () => structuredClone(match),
    ready: unused,
    setAim: unused,
    selectUnit: unused,
    selectAmmo: unused,
    armEvasion: unused,
    disarmEvasion: unused,
    currentLayout: () => PHASE1_LAYOUT,
    previewShot: unused,
    selectHelper: unused,
    helperTargets: () => [],
    dash: unused,
    fire: unused,
    shotLanded: unused,
    reloadDone: unused,
    pass: unused,
    rematchOptions: () => rematch,
  };
}

export const tinyBank: QuestionBank = {
  questions: [
    {
      id: 'math-2-0001',
      subject: 'math',
      grade: 2,
      kind: 'numeric',
      prompt: '1 + 1',
      choices: ['1', '2', '3', '4'],
      answer: '2',
      tags: [],
    },
  ],
};

/** Real overlay and audio in jsdom, wired the way main.ts wires them. */
export function makeServices(opts: { loadBank?: () => Promise<QuestionBank>; seed?: number } = {}) {
  const base = setup();
  let opened = 0;
  const services: AppServices = {
    overlay: base.overlay,
    audio: base.audio,
    storage: base.storage,
    env: base.clock,
    session: { match: null, bank: null },
    howTo: {
      get isOpen() {
        return false;
      },
      open: async () => {
        opened++;
      },
    },
    loadBank: opts.loadBank ?? (async () => tinyBank),
    newSeed: () => opts.seed ?? 1234,
  };
  return { ...base, services, howToOpened: () => opened, DEFAULT_SETTINGS };
}

export const teamOf = (i: 0 | 1): Team => (i === 0 ? 'PAST' : 'FUTURE');
