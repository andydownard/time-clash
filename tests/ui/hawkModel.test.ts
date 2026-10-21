// The hawk is a small solid: a body, a head, two thick wings and a tail, turned about its upright
// axis and drawn flat. These tests check it keeps its volume at every angle.
import { describe, expect, it, vi } from 'vitest';
import {
  HAWK_COLORS,
  HAWK_STILL,
  hawkMarkup,
  hawkPaints,
  type HawkPaint,
} from '../../src/ui/hawkModel';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

function bounds(paints: readonly HawkPaint[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of paints) {
    const n = [...p.d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    for (let i = 0; i + 1 < n.length; i += 2) {
      xs.push(n[i]!);
      ys.push(n[i + 1]!);
    }
  }
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

const yaws = Array.from({ length: 72 }, (_, i) => i * 5);

describe('hawkPaints', () => {
  it('always paints real shapes: finite numbers, a fill and an outline', () => {
    for (const yaw of yaws) {
      const paints = hawkPaints({ yaw, flap: 10 });
      expect(paints.length).toBeGreaterThan(20);
      for (const p of paints) {
        expect(p.d).not.toMatch(/NaN|Infinity|undefined/);
        expect(p.fill).toMatch(/^#[0-9a-f]{6}$/);
        expect(p.stroke).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('never collapses to a sliver: it keeps its width and height at every turn angle', () => {
    for (const yaw of yaws) {
      const b = bounds(hawkPaints({ yaw, flap: 0 }));
      expect(b.w, `width at ${yaw}`).toBeGreaterThan(90);
      expect(b.h, `height at ${yaw}`).toBeGreaterThan(38);
    }
  });

  it('shows its chest and the underside of both wings when it faces us', () => {
    const fills = new Set(hawkPaints({ yaw: 90, flap: 8 }).map((p) => p.fill));
    const has = (tones: readonly string[]) => tones.some((c) => fills.has(c));
    expect(has(HAWK_COLORS.belly)).toBe(true);
    expect(has(HAWK_COLORS.wingUnder)).toBe(true);
    expect(has(HAWK_COLORS.beak)).toBe(true);
  });

  it('shows its tail and wing undersides when it flies away', () => {
    const fills = new Set(hawkPaints({ yaw: 270, flap: 8 }).map((p) => p.fill));
    expect(HAWK_COLORS.tailUnder.some((c) => fills.has(c))).toBe(true);
    expect(HAWK_COLORS.wingUnder.some((c) => fills.has(c))).toBe(true);
  });

  it('gives the wing an edge you can see (thickness), not a paper line', () => {
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const fills = hawkPaints({ yaw, flap: 0 }).map((p) => p.fill);
      expect(
        fills.filter((c) => (HAWK_COLORS.wingEdge as readonly string[]).includes(c)).length,
        `edge at ${yaw}`,
      ).toBeGreaterThan(2);
    }
  });

  it('uses only the hawk palette', () => {
    const all = new Set<string>(Object.values(HAWK_COLORS).flat());
    for (const yaw of [0, 60, 120, 200, 300]) {
      for (const p of hawkPaints({ yaw, flap: 12 })) {
        expect(all.has(p.fill), p.fill).toBe(true);
        expect(all.has(p.stroke), p.stroke).toBe(true);
      }
    }
  });

  it('is the same every time, and changes with the flap', () => {
    expect(hawkPaints({ yaw: 33, flap: 5 })).toEqual(hawkPaints({ yaw: 33, flap: 5 }));
    expect(hawkPaints({ yaw: 33, flap: 5 })).not.toEqual(hawkPaints({ yaw: 33, flap: 25 }));
  });

  it('wraps any angle the same way', () => {
    expect(hawkPaints({ yaw: 400, flap: 0 })).toEqual(hawkPaints({ yaw: 40, flap: 0 }));
    expect(hawkPaints({ yaw: -90, flap: 0 })).toEqual(hawkPaints({ yaw: 270, flap: 0 }));
  });

  it('holds its still pose in three-quarter view: head, beak and belly all show', () => {
    const fills = new Set(hawkPaints(HAWK_STILL).map((p) => p.fill));
    expect(HAWK_COLORS.beak.some((c) => fills.has(c))).toBe(true);
    expect(HAWK_COLORS.head.some((c) => fills.has(c))).toBe(true);
    expect(HAWK_COLORS.wingUnder.some((c) => fills.has(c))).toBe(true);
    expect(HAWK_COLORS.wingEdge.some((c) => fills.has(c))).toBe(true);
    expect(HAWK_STILL.yaw % 90).not.toBe(0);
  });
});

describe('hawkMarkup', () => {
  it('writes one path per paint, with the outline behind it', () => {
    const paints = hawkPaints(HAWK_STILL);
    const markup = hawkMarkup(paints);
    expect(markup.match(/<path /g)?.length).toBe(paints.length);
    expect(markup).not.toMatch(/<script|on\w+=/i);
  });
});
