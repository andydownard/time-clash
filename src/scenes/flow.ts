// Where each screen leads. Pure functions, no Phaser and no DOM, so every route is unit tested.
import { TURN } from '../game/config';
import type { MatchEffects } from '../game/loadout';
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

/**
 * Loading, then home. Home is the Camp once Setup has saved the players, so a returning family
 * lands there. A new family has no players yet, so it goes to Setup first.
 */
function toHome(storage?: TypedStorage): SceneRoute {
  const known = storage?.get('timeclash.players') != null;
  const data: LoadingData = { next: known ? SCENE_KEYS.camp : SCENE_KEYS.setup };
  return { key: SCENE_KEYS.loading, data };
}

/**
 * Where the app goes first. A returning family (intro seen, players saved) skips the Tap to Play
 * screen and goes through Loading to the Camp. A new family sees the front door first, which
 * unlocks sound and starts the spoken How to Play.
 */
export function routeAtBoot(storage: TypedStorage): SceneRoute {
  const returning =
    storage.get('timeclash.introSeen') === true && storage.get('timeclash.players') != null;
  return returning ? toHome(storage) : { key: SCENE_KEYS.tap };
}

/** After the first tap: the intro on a first visit, otherwise straight to Loading. */
export function routeAfterTap(storage: TypedStorage): SceneRoute {
  return storage.get('timeclash.introSeen') === true ? toHome(storage) : { key: SCENE_KEYS.intro };
}

export function routeAfterIntro(storage?: TypedStorage): SceneRoute {
  return toHome(storage);
}

/** Setup leads to the Camp. The players are already saved, so the Camp needs no data. */
export function routeAfterSetup(): SceneRoute {
  return { key: SCENE_KEYS.camp };
}

export function buildMatchSetup(
  players: Players,
  seed: number,
  effects?: MatchEffects,
): MatchSetup {
  return { players, seed, firstTeam: TURN.firstTeam, ...(effects ? { effects } : {}) };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Loading hands off to Battle, the Camp or Setup. Bad data goes to Setup, never a dead end. */
export function routeAfterLoading(data: unknown): SceneRoute {
  if (isRecord(data) && data.next === SCENE_KEYS.camp) return { key: SCENE_KEYS.camp };
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
  return { key: SCENE_KEYS.camp };
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
