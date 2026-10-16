// A small hook so Playwright can pin the seed, make a load fail, and read state.
// Only installed when the URL has ?e2e=1 AND the build is not a production build.
// It never exposes questions or answers (risk 3).
import type { Match, MatchController, Players } from '../game/types';
import type { TypedStorage } from '../storage/types';
import type { SeedSource } from './flow';
import type { Session } from './registry';
import { controllerFrom } from './flow';

export type TimeClashHook = {
  version: 1;
  setSeed(seed: number | null): void;
  failNextLoads(count: number): void;
  /** Key of the active scene, or null. */
  scene(): string | null;
  /** A copy of the current match, or null. */
  match(): Match | null;
  /** Saved players, or null. */
  players(): Players | null;
  /** Smallest size, in screen pixels, of any label drawn on the canvas, or null. */
  labelPx(): number | null;
};

export function e2eEnabled(search: string, mode: string): boolean {
  if (mode === 'production') return false;
  return new URLSearchParams(search).get('e2e') === '1';
}

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
};

export type HookDeps = {
  search: string;
  mode: string;
  seeds: SeedSource;
  faults: LoadFaults;
  storage: TypedStorage;
  session: Session;
  activeScenes: () => readonly ActiveScene[];
};

export function installTestHook(win: { __timeclash?: TimeClashHook }, deps: HookDeps): boolean {
  if (!e2eEnabled(deps.search, deps.mode)) return false;
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
    failNextLoads: (count) => deps.faults.failNext(count),
    scene: () => deps.activeScenes()[0]?.scene?.key ?? null,
    match: () => findController()?.snapshot() ?? null,
    players: () => deps.storage.get('timeclash.players'),
    labelPx: () => deps.activeScenes()[0]?.labels?.minRenderedPx() ?? null,
  };
  return true;
}
