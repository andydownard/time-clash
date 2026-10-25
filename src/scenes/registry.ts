// Scene keys, the data scenes pass to each other, and the shared services.
// Scenes stay thin: every rule goes through MatchController, every decision about where to
// go next lives in flow.ts and steps.ts, which are tested without a canvas.
import type { AudioManager } from '../audio/types';
import type { MatchController, MatchOptions } from '../game/types';
import type { BattleResult } from './battle/types';
import type { QuestionBank } from '../questions/types';
import type { TypedStorage } from '../storage/types';
import type { LoadingEnv } from '../ui/loadingLogic';
import type { Overlay } from '../ui/types';

export const SCENE_KEYS = {
  boot: 'BootScene',
  tap: 'TapToStartScene',
  intro: 'IntroScene',
  loading: 'LoadingScene',
  setup: 'SetupScene',
  camp: 'CampScene',
  battle: 'BattleScene',
  victory: 'VictoryScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

/** The start payload for BattleScene. Same shape as the rules layer's MatchOptions. */
export type MatchSetup = MatchOptions;

/** Where to go next, and what to hand over. */
export type SceneRoute = { key: SceneKey; data?: unknown };

/** What LoadingScene receives. It loads, then goes to `next`. */
export type LoadingData =
  | { next: typeof SCENE_KEYS.setup }
  | { next: typeof SCENE_KEYS.camp }
  | { next: typeof SCENE_KEYS.battle; setup: MatchSetup };

/**
 * What VictoryScene receives. BattleScene hands over a BattleResult. A finished
 * MatchController (bare or wrapped) works too. Anything else routes back to Setup,
 * so a bad hand-off never strands a family.
 */
export type VictoryData = BattleResult | MatchController | { controller: MatchController };

/** State that outlives a scene. The e2e hook reads the match from here. */
export type Session = {
  match: MatchController | null;
  /** The question bank, once loaded. Lets Setup go straight to Battle. */
  bank: QuestionBank | null;
};

/** Opens the spoken How to Play screen. One at a time, from any scene. */
export interface HowToPlay {
  open(): Promise<void>;
  readonly isOpen: boolean;
}

export type AppServices = {
  overlay: Overlay;
  audio: AudioManager;
  storage: TypedStorage;
  howTo: HowToPlay;
  session: Session;
  env: LoadingEnv;
  /** Loads the question bank. Throws if it cannot. */
  loadBank: () => Promise<QuestionBank>;
  /** A fresh match seed. The e2e hook can pin it. */
  newSeed: () => number;
  /** True when Setup offers the Computer player (config flag, or `?computer=1` / `?computer=0`). */
  computerPlayer?: boolean;
  /** Switches only the e2e hook sets (Squads on). Empty in a real game, so config decides. */
  flags?: { squads?: boolean; quickLoad?: boolean };
};

export const SERVICES_KEY = 'timeclash.services';

export function servicesOf(registry: { get(key: string): unknown }): AppServices {
  const s = registry.get(SERVICES_KEY) as AppServices | undefined;
  if (!s) throw new Error('Time Clash services are missing. BootScene must run first.');
  return s;
}
