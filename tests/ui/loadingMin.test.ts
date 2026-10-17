import { describe, expect, it } from 'vitest';
import { TIMING } from '../../src/game/config';
import type { LoadingHandle } from '../../src/ui/types';
import { loadingMinFor, runLoading } from '../../src/ui/loadingLogic';
import { createClock } from '../audio/fakes';

function fakeHandle() {
  const log: string[] = [];
  const handle: LoadingHandle = {
    setProgress: () => undefined,
    showError: () => {
      log.push('error');
      return new Promise<void>(() => undefined);
    },
    close: () => log.push('close'),
  };
  return { handle, log };
}

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('loading minimum time', () => {
  it('is longer for a new family and short for a returning one', () => {
    expect(TIMING.loadingFirstMinMs).toBe(4000);
    expect(loadingMinFor(true)).toBe(TIMING.loadingFirstMinMs);
    expect(loadingMinFor(false)).toBe(TIMING.loadingMinMs);
    expect(TIMING.loadingMinMs).toBeLessThanOrEqual(1500);
  });

  it('waits the whole first-visit time with the minMs option, then closes', async () => {
    const clock = createClock();
    const f = fakeHandle();
    void runLoading({
      load: () => Promise.resolve(),
      handle: f.handle,
      env: clock,
      minMs: TIMING.loadingFirstMinMs,
    });
    await flush();
    clock.advance(TIMING.loadingFirstMinMs - 1);
    await flush();
    expect(f.log).not.toContain('close');
    clock.advance(1);
    await flush();
    expect(f.log).toEqual(['close']);
  });

  it('a returning family is released at the short time', async () => {
    const clock = createClock();
    const f = fakeHandle();
    void runLoading({
      load: () => Promise.resolve(),
      handle: f.handle,
      env: clock,
      minMs: loadingMinFor(false),
    });
    await flush();
    clock.advance(TIMING.loadingMinMs);
    await flush();
    expect(f.log).toEqual(['close']);
  });

  it('still shows Retry when the load fails, even with the long minimum', async () => {
    const clock = createClock();
    const f = fakeHandle();
    void runLoading({
      load: () => Promise.reject(new Error('lost')),
      handle: f.handle,
      env: clock,
      minMs: TIMING.loadingFirstMinMs,
    });
    await flush();
    expect(f.log).toEqual(['error']);
  });
});
