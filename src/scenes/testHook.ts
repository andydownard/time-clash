// A small hook so Playwright can pin the seed, make a load fail, and read state.
// Only installed when the URL has ?e2e=1 AND the build is not a production build.
// It never exposes questions or answers (risk 3).
import type { BattleLayout, Match, MatchController, Players } from '../game/types';
import type { TypedStorage } from '../storage/types';
import type { SeedSource } from './flow';
import type { Session } from './registry';
import { controllerFrom } from './flow';

export type TimeClashHook = {
  version: 1;
  setSeed(seed: number | null): void;
  /** Squads S1 on (true), off (false) or back to the config default (null) for matches started after this. */
  setSquads(on: boolean | null): void;
  failNextLoads(count: number): void;
  /** Key of the active scene, or null. */
  scene(): string | null;
  /** A copy of the current match, or null. */
  match(): Match | null;
  /** The field as it stands now (biome, base spot, any wall), or null. Never secret. */
  layout(): BattleLayout | null;
  /** Saved players, or null. */
  players(): Players | null;
  /** Smallest size, in screen pixels, of any label drawn on the canvas, or null. */
  labelPx(): number | null;
  /** What the angle guide on the board shows: the team, its firing point, and its texts. */
  aim(): {
    team: string | null;
    origin: { x: number; y: number } | null;
    texts: string[];
    label?: { x: number; y: number; w: number; h: number } | null;
  } | null;
};

export function e2eEnabled(search: string, mode: string): boolean {
  if (mode === 'production') return false;
  return new URLSearchParams(search).get('e2e') === '1';
}

/** Switches a test can flip. Missing means the config default. Only the e2e hook writes it. */
export type TestFlags = { squads?: boolean; quickLoad?: boolean };
export const createFlags = (): TestFlags => ({});

export type LoadFaults = {
  failNext(count: number): void;
  /** True if this load should fail. Uses one up. */
  take(): boolean;
};

export function createLoadFaults(): LoadFaults {
  let remaining = 0;
  return {
    failNext(count) {
      remaining = Number.isInteger(count) && count > 0 ? count : 0;
    },
    take() {
      if (remaining <= 0) return false;
      remaining--;
      return true;
    },
  };
}

/** The part of a Phaser scene the hook looks at. */
export type ActiveScene = {
  scene?: { key?: string };
  controller?: unknown;
  labels?: { minRenderedPx(): number | null } | null;
  aimState?: () => {
    team: string | null;
    origin: { x: number; y: number } | null;
    texts: string[];
    label?: { x: number; y: number; w: number; h: number } | null;
  };
};

export type HookDeps = {
  search: string;
  mode: string;
  seeds: SeedSource;
  faults: LoadFaults;
  flags: TestFlags;
  storage: TypedStorage;
  session: Session;
  activeScenes: () => readonly ActiveScene[];
};

export function installTestHook(win: { __timeclash?: TimeClashHook }, deps: HookDeps): boolean {
  if (!e2eEnabled(deps.search, deps.mode)) return false;
  // A test run never waits out the funny Loading screen (TIMING.loadingQuickMs).
  deps.flags.quickLoad = true;
  const findController = (): MatchController | null => {
    if (deps.session.match) return deps.session.match;
    for (const s of deps.activeScenes()) {
      const c = controllerFrom(s.controller);
      if (c) return c;
    }
    return null;
  };
  win.__timeclash = {
    version: 1,
    setSeed: (seed) => deps.seeds.pin(seed),
    setSquads: (on) => {
      if (on === null) delete deps.flags.squads;
      else deps.flags.squads = on;
    },
    failNextLoads: (count) => deps.faults.failNext(count),
    scene: () => deps.activeScenes()[0]?.scene?.key ?? null,
    match: () => findController()?.snapshot() ?? null,
    layout: () => findController()?.currentLayout() ?? null,
    players: () => deps.storage.get('timeclash.players'),
    labelPx: () => deps.activeScenes()[0]?.labels?.minRenderedPx() ?? null,
    aim: () => deps.activeScenes()[0]?.aimState?.() ?? null,
  };
  return true;
}
