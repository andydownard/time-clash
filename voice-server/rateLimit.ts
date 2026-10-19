// Fixed-window per-IP limiter, in memory only. The key is never logged or stored on disk.
export type RateLimiter = { allow(key: string): boolean };

export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  now: () => number;
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; n: number }>();
  const maxKeys = opts.maxKeys ?? 10_000;
  return {
    allow(key) {
      const t = opts.now();
      if (windows.size >= maxKeys && !windows.has(key)) {
        for (const [k, w] of windows) if (t - w.start >= opts.windowMs) windows.delete(k);
        // Still full of live keys: refuse new ones rather than grow without bound.
        if (windows.size >= maxKeys) return false;
      }
      const w = windows.get(key);
      if (!w || t - w.start >= opts.windowMs) {
        windows.set(key, { start: t, n: 1 });
        return true;
      }
      w.n++;
      return w.n <= opts.limit;
    },
  };
}
