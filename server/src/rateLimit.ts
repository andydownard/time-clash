// Token buckets. The clock is injected so tests need no real time.

export type BucketOptions = { capacity: number; refillPerSec: number; now: () => number };

export type Bucket = {
  /** Spends one token. False when empty. */
  take(): boolean;
  /** True if a token is available. Spends nothing. */
  has(): boolean;
  /** When the bucket was last touched (ms). */
  readonly touched: number;
};

export function createBucket({ capacity, refillPerSec, now }: BucketOptions): Bucket {
  let tokens = capacity;
  let last = now();
  const refill = (): void => {
    const t = now();
    tokens = Math.min(capacity, tokens + ((t - last) / 1000) * refillPerSec);
    last = t;
  };
  return {
    take(): boolean {
      refill();
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
    has(): boolean {
      refill();
      return tokens >= 1;
    },
    get touched(): number {
      return last;
    },
  };
}

export type KeyedLimiter = {
  take(key: string): boolean;
  has(key: string): boolean;
  /** Drops keys not used for ttlMs. */
  sweep(): void;
  size(): number;
};

export function createKeyedLimiter(
  opts: BucketOptions & { ttlMs: number },
): KeyedLimiter {
  const buckets = new Map<string, Bucket>();
  const get = (key: string): Bucket => {
    let b = buckets.get(key);
    if (!b) {
      b = createBucket(opts);
      buckets.set(key, b);
    }
    return b;
  };
  return {
    take: (key) => get(key).take(),
    has: (key) => get(key).has(),
    sweep(): void {
      const t = opts.now();
      for (const [k, b] of buckets) if (t - b.touched > opts.ttlMs) buckets.delete(k);
    },
    size: () => buckets.size,
  };
}
