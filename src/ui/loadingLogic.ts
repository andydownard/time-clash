// Loading screen timing, with no DOM. The screen stays at least TIMING.loadingMinMs so the
// jokes can be read, waits for the real load, and offers Retry forever if loading fails.
import { TIMING } from '../game/config';
import type { LoadingHandle } from './types';

export type LoadingEnv = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
};

export type RunLoadingOptions = {
  /** The real work. Call `report` with 0 to 1 if you know how far along it is. */
  load: (report: (p: number) => void) => Promise<unknown>;
  handle: LoadingHandle;
  env: LoadingEnv;
  minMs?: number;
  tickMs?: number;
};

/** Progress shown while waiting. It never claims 100% until the load is done. */
const WAITING_CEILING = 0.95;

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Resolves after the screen has closed. */
export async function runLoading(options: RunLoadingOptions): Promise<void> {
  const { load, handle, env } = options;
  const minMs = options.minMs ?? TIMING.loadingMinMs;
  const tickMs = options.tickMs ?? 100;
  let shown = 0;
  const show = (p: number): void => {
    // Never move backward.
    shown = Math.max(shown, clamp01(p));
    handle.setProgress(shown);
  };

  for (;;) {
    const start = env.now();
    let real = 0;
    let hasReal = false;
    let loaded = false;
    let failed = false;
    let timer: unknown = null;

    const tick = (): void => {
      const elapsed = env.now() - start;
      const byTime = clamp01(elapsed / minMs);
      // Until the load is done, stay under the ceiling and never pass what the load reported.
      const ceiling = loaded ? 1 : Math.min(WAITING_CEILING, hasReal ? real : 1);
      show(Math.min(byTime, ceiling));
      if (loaded && elapsed >= minMs) return;
      timer = env.setTimeout(tick, tickMs);
    };

    let work: Promise<unknown>;
    try {
      work = Promise.resolve(
        load((p) => {
          hasReal = true;
          real = Math.max(real, clamp01(p));
        }),
      );
    } catch (e) {
      work = Promise.reject(e);
    }
    const settled = new Promise<void>((resolve) => {
      work.then(
        () => {
          loaded = true;
          // The tick loop notices `loaded` and finishes once the minimum has passed.
          resolve();
        },
        () => {
          failed = true;
          resolve();
        },
      );
    });
    tick();
    await settled;
    if (failed) {
      if (timer !== null) env.clearTimeout(timer);
      await handle.showError();
      continue;
    }
    // Wait out the rest of the minimum time.
    const remaining = minMs - (env.now() - start);
    await new Promise<void>((resolve) => env.setTimeout(resolve, Math.max(0, remaining)));
    if (timer !== null) env.clearTimeout(timer);
    show(1);
    handle.close();
    return;
  }
}
