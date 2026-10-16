// Where each screen leads. Pure functions, no Phaser and no DOM, so every route is unit tested.
import { TURN } from '../game/config';
import type { MatchController, MatchOptions, Players } from '../game/types';
import type { QuestionBank } from '../questions/types';
import type { TypedStorage } from '../storage/types';
import type { VictoryChoice, VictoryOptions } from '../ui/types';
import {
  SCENE_KEYS,
  type LoadingData,
  type MatchSetup,
  type SceneRoute,
  type VictoryData,
} from './registry';

const toSetup: SceneRoute = {
  key: SCENE_KEYS.loading,
  data: { next: SCENE_KEYS.setup } satisfies LoadingData,
};

/** After the first tap: the intro on a first visit, otherwise straight to Loading. */
export function routeAfterTap(storage: TypedStorage): SceneRoute {
  return storage.get('timeclash.introSeen') === true ? toSetup : { key: SCENE_KEYS.intro };
}

export function routeAfterIntro(): SceneRoute {
  return toSetup;
}

export function buildMatchSetup(players: Players, seed: number): MatchSetup {
  return { players, seed, firstTeam: TURN.firstTeam };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Loading hands off to Battle or Setup. Bad data goes to Setup, never a dead end. */
export function routeAfterLoading(data: unknown): SceneRoute {
  if (isRecord(data) && data.next === SCENE_KEYS.battle && isRecord(data.setup)) {
    return { key: SCENE_KEYS.battle, data: data.setup };
  }
  return { key: SCENE_KEYS.setup };
}

const looksLikeController = (v: unknown): v is MatchController =>
  isRecord(v) && typeof v.snapshot === 'function' && typeof v.rematchOptions === 'function';

export function controllerFrom(data: VictoryData | unknown): MatchController | null {
  if (looksLikeController(data)) return data;
  if (isRecord(data) && looksLikeController(data.controller)) return data.controller;
  return null;
}

/** What the Victory screen shows, and what a rematch needs. */
export type VictoryPlan = { options: VictoryOptions; rematch: MatchOptions };

const isTeam = (v: unknown): v is 'PAST' | 'FUTURE' => v === 'PAST' || v === 'FUTURE';

function planFromController(controller: MatchController): VictoryPlan | null {
  const m = controller.snapshot();
  if (m.status !== 'OVER' || m.winner === null) return null;
  return {
    options: {
      winner: m.winner,
      names: { PAST: m.players[0].name, FUTURE: m.players[1].name },
      stats: m.stats,
    },
    rematch: controller.rematchOptions(),
  };
}

/** The shape BattleScene sends: { winner, names, stats, rematch }. */
function planFromResult(data: Record<string, unknown>): VictoryPlan | null {
  const { winner, names, stats, rematch } = data;
  if (!isTeam(winner) || !isRecord(names) || !isRecord(stats) || !isRecord(rematch)) return null;
  if (!isRecord(stats.PAST) || !isRecord(stats.FUTURE)) return null;
  if (typeof names.PAST !== 'string' || typeof names.FUTURE !== 'string') return null;
  if (!Array.isArray(rematch.players) || typeof rematch.seed !== 'number') return null;
  return {
    options: {
      winner,
      names: { PAST: names.PAST, FUTURE: names.FUTURE },
      stats: stats as unknown as VictoryOptions['stats'],
    },
    rematch: rematch as unknown as MatchOptions,
  };
}

/** Null unless the match is over with a winner, so Victory never shows a wrong screen. */
export function victoryFrom(data: VictoryData | unknown): VictoryPlan | null {
  const controller = controllerFrom(data);
  if (controller) return planFromController(controller);
  return isRecord(data) ? planFromResult(data) : null;
}

export function routeAfterVictory(choice: VictoryChoice, rematch: MatchOptions): SceneRoute {
  if (choice === 'rematch') {
    const data: LoadingData = { next: SCENE_KEYS.battle, setup: rematch };
    return { key: SCENE_KEYS.loading, data };
  }
  return { key: SCENE_KEYS.tap };
}

/**
 * The real load. The question bank is a lazy chunk, so a lost chunk really fails and the
 * Loading screen offers Retry. Progress only moves forward and ends at 1.
 */
export async function loadAssets(
  loadBank: () => Promise<QuestionBank>,
  report: (progress: number) => void,
): Promise<QuestionBank> {
  report(0.1);
  const bank = await loadBank();
  report(0.7);
  if (!bank || !Array.isArray(bank.questions) || bank.questions.length === 0) {
    throw new Error('The question bank is empty.');
  }
  report(1);
  return bank;
}

export type SeedSource = {
  /** A fresh seed, or the pinned one. */
  next(): number;
  /** Pins the seed (e2e only). A bad value is ignored. null releases the pin. */
  pin(seed: number | null): void;
};

const SEED_RANGE = 2 ** 31;

/** Seeds are minted here, at the edge of the app. All game logic after this is seeded. */
export function createSeedSource(entropy: () => number): SeedSource {
  let pinned: number | null = null;
  return {
    next: () => pinned ?? Math.floor(Math.min(0.999999999, Math.max(0, entropy())) * SEED_RANGE),
    pin(seed) {
      if (seed === null) pinned = null;
      else if (Number.isInteger(seed) && seed >= 0 && seed < SEED_RANGE) pinned = seed;
    },
  };
}
