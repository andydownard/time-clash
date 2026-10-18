import { describe, expect, it } from 'vitest';
import { createBucket, createKeyedLimiter } from '../src/rateLimit';

describe('token bucket', () => {
  it('allows a burst then rejects a flood', () => {
    const now = 0;
    const b = createBucket({ capacity: 5, refillPerSec: 1, now: () => now });
    const results = Array.from({ length: 8 }, () => b.take());
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(results.slice(5)).toEqual([false, false, false]);
  });
  it('refills with time but never past capacity', () => {
    let now = 0;
    const b = createBucket({ capacity: 3, refillPerSec: 2, now: () => now });
    for (let i = 0; i < 3; i++) b.take();
    expect(b.take()).toBe(false);
    now = 500; // one token
    expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
    now = 1_000_000;
    expect([b.take(), b.take(), b.take(), b.take()]).toEqual([true, true, true, false]);
  });
});

describe('keyed limiter', () => {
  it('limits each key on its own', () => {
    const now = 0;
    const l = createKeyedLimiter({ capacity: 2, refillPerSec: 0, now: () => now, ttlMs: 1000 });
    expect([l.take('a'), l.take('a'), l.take('a')]).toEqual([true, true, false]);
    expect(l.take('b')).toBe(true);
  });
  it('has() peeks without spending', () => {
    const l = createKeyedLimiter({ capacity: 1, refillPerSec: 0, now: () => 0, ttlMs: 1000 });
    expect(l.has('a')).toBe(true);
    expect(l.has('a')).toBe(true);
    l.take('a');
    expect(l.has('a')).toBe(false);
  });
  it('forgets idle keys on sweep', () => {
    let now = 0;
    const l = createKeyedLimiter({ capacity: 1, refillPerSec: 1, now: () => now, ttlMs: 1000 });
    l.take('a');
    l.take('b');
    expect(l.size()).toBe(2);
    now = 2000;
    l.sweep();
    expect(l.size()).toBe(0);
    expect(l.take('a')).toBe(true);
  });
});
