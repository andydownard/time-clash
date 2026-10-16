import { describe, expect, it } from 'vitest';
import { TIMING } from '../../src/game/config';
import type { LoadingHandle } from '../../src/ui/types';
import { runLoading } from '../../src/ui/loadingLogic';
import { createClock } from '../audio/fakes';

function fakeHandle() {
  const log: string[] = [];
  const progress: number[] = [];
  let retry: (() => void) | null = null;
  const handle: LoadingHandle = {
    setProgress: (p) => progress.push(p),
    showError: () => {
      log.push('error');
      return new Promise<void>((r) => (retry = r));
    },
    close: () => log.push('close'),
  };
  return { handle, log, progress, tapRetry: () => retry?.() };
}

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runLoading', () => {
  it('waits at least the minimum time even when loading is instant', async () => {
    const clock = createClock();
    const f = fakeHandle();
    let done = false;
    void runLoading({ load: () => Promise.resolve(), handle: f.handle, env: clock }).then(
      () => (done = true),
    );
    await flush();
    clock.advance(TIMING.loadingMinMs - 1);
    await flush();
    expect(done).toBe(false);
    expect(f.log).not.toContain('close');
    clock.advance(1);
    await flush();
    expect(done).toBe(true);
    expect(f.log).toEqual(['close']);
  });

  it('waits for a slow load even after the minimum time', async () => {
    const clock = createClock();
    const f = fakeHandle();
    const d = deferred();
    let done = false;
    void runLoading({ load: () => d.promise, handle: f.handle, env: clock }).then(
      () => (done = true),
    );
    clock.advance(TIMING.loadingMinMs * 5);
    await flush();
    expect(done).toBe(false);
    expect(Math.max(...f.progress)).toBeLessThan(1);
    d.resolve();
    await flush();
    clock.advance(200);
    await flush();
    expect(done).toBe(true);
  });

  it('progress never goes down and ends at 1', async () => {
    const clock = createClock();
    const f = fakeHandle();
    void runLoading({ load: () => Promise.resolve(), handle: f.handle, env: clock });
    for (let i = 0; i < 30; i++) {
      clock.advance(100);
      await flush();
    }
    for (let i = 1; i < f.progress.length; i++)
      expect(f.progress[i]!).toBeGreaterThanOrEqual(f.progress[i - 1]!);
    expect(f.progress.at(-1)).toBe(1);
    expect(f.progress.every((p) => p >= 0 && p <= 1)).toBe(true);
  });

  it('never reports 1 before the load resolves', async () => {
    const clock = createClock();
    const f = fakeHandle();
    const d = deferred();
    void runLoading({ load: () => d.promise, handle: f.handle, env: clock });
    for (let i = 0; i < 40; i++) {
      clock.advance(100);
      await flush();
    }
    expect(f.progress.includes(1)).toBe(false);
  });

  it('real progress reports are respected and clamped', async () => {
    const clock = createClock();
    const f = fakeHandle();
    const d = deferred();
    void runLoading({
      load: (report) => {
        report(0.2);
        report(5);
        report(Number.NaN);
        return d.promise;
      },
      handle: f.handle,
      env: clock,
    });
    clock.advance(TIMING.loadingMinMs * 2);
    await flush();
    expect(f.progress.every((p) => Number.isFinite(p) && p >= 0 && p <= 1)).toBe(true);
  });

  it('a failure shows the error, Retry loads again, and success closes', async () => {
    const clock = createClock();
    const f = fakeHandle();
    let calls = 0;
    let done = false;
    void runLoading({
      load: () => (++calls === 1 ? Promise.reject(new Error('net')) : Promise.resolve()),
      handle: f.handle,
      env: clock,
    }).then(() => (done = true));
    await flush();
    expect(f.log).toEqual(['error']);
    expect(done).toBe(false);
    f.tapRetry();
    await flush();
    clock.advance(TIMING.loadingMinMs);
    await flush();
    expect(calls).toBe(2);
    expect(done).toBe(true);
    expect(f.log).toEqual(['error', 'close']);
  });

  it('keeps offering Retry as many times as it fails (never traps the child)', async () => {
    const clock = createClock();
    const f = fakeHandle();
    let calls = 0;
    void runLoading({
      load: () => (++calls < 4 ? Promise.reject(new Error('x')) : Promise.resolve()),
      handle: f.handle,
      env: clock,
    });
    for (let i = 0; i < 3; i++) {
      await flush();
      f.tapRetry();
    }
    await flush();
    clock.advance(TIMING.loadingMinMs * 2);
    await flush();
    expect(f.log.filter((l) => l === 'error')).toHaveLength(3);
    expect(f.log.at(-1)).toBe('close');
  });

  it('a load function that throws synchronously is treated as a failure', async () => {
    const clock = createClock();
    const f = fakeHandle();
    let calls = 0;
    void runLoading({
      load: () => {
        if (++calls === 1) throw new Error('sync');
        return Promise.resolve();
      },
      handle: f.handle,
      env: clock,
    });
    await flush();
    expect(f.log).toEqual(['error']);
  });

  it('stops ticking after it finishes', async () => {
    const clock = createClock();
    const f = fakeHandle();
    void runLoading({ load: () => Promise.resolve(), handle: f.handle, env: clock });
    clock.advance(TIMING.loadingMinMs + 500);
    await flush();
    clock.advance(1000);
    await flush();
    expect(clock.pending()).toBe(0);
  });
});
