// The bird and gust drawings: pure shapes the Battle scene paints. Shape and motion carry the
// meaning, not color alone (AGENTS.md accessibility).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISTURBANCE, WORLD } from '../../../src/game/config';
import {
  BIRD_HIT_RADIUS,
  bonkTilt,
  BONK,
  birdPoints,
  birdShapes,
  featherBurst,
  flapAt,
  FLAP_MS,
} from '../../../src/scenes/battle/birdArt';
import { GUST_EDGE, gustCue } from '../../../src/scenes/battle/gustArt';
import { contrastRatio } from '../../../src/ui/contrast';
import { css } from '../../../src/scenes/palette';
import { ART } from '../../../src/scenes/battle/visual';
import { BIRD_COLORS } from '../../../src/scenes/battle/birdArt';
import { DISTURBANCE_COPY } from '../../../src/data/copy';
import { findBanned } from '../../data/copyLintScan';

const AT = { x: 600, y: 300 };

describe('birdShapes', () => {
  it('fits inside the bump circle (what you see is what bumps)', () => {
    for (const flap of [-1, 0, 1]) {
      for (const p of birdPoints(birdShapes(AT, 1, flap))) {
        expect(Math.hypot(p.x - AT.x, p.y - AT.y)).toBeLessThanOrEqual(BIRD_HIT_RADIUS + 6);
      }
    }
  });

  it('faces the way it flies: the beak is on the leading side', () => {
    const beakX = (dir: 1 | -1) => {
      const beak = birdShapes(AT, dir, 0).find(
        (s) => s.op === 'poly' && s.color === BIRD_COLORS.beak,
      );
      if (!beak || beak.op !== 'poly') throw new Error('no beak');
      return Math.max(...beak.pts.map((p) => (p.x - AT.x) * dir));
    };
    expect(beakX(1)).toBeGreaterThan(15);
    expect(beakX(-1)).toBeGreaterThan(15);
  });

  it('flaps: the wing tip goes up and down', () => {
    const tipY = (flap: number) => Math.min(...birdPoints(birdShapes(AT, 1, flap)).map((p) => p.y));
    expect(tipY(1)).toBeLessThan(tipY(-1));
  });

  it('has a dark outline that stands out on the night sky', () => {
    const outlines = birdShapes(AT, 1, 0).filter((s) => s.op === 'outline');
    expect(outlines.length).toBeGreaterThanOrEqual(2);
    // The pale body against the darkest and lightest sky shades.
    expect(contrastRatio(css(BIRD_COLORS.body), css(ART.skyTop))).toBeGreaterThan(3);
    expect(contrastRatio(css(BIRD_COLORS.outline), css(ART.skyHorizon))).toBeGreaterThan(3);
  });

  it('a bad flap draws a still wing', () => {
    expect(birdShapes(AT, 1, Number.NaN)).toEqual(birdShapes(AT, 1, 0));
  });
});

describe('flap and bonk', () => {
  it('flaps over time, and holds still with reduced motion', () => {
    expect(flapAt(FLAP_MS / 4, false)).toBeCloseTo(1, 6);
    expect(flapAt(FLAP_MS / 4, true)).toBe(0);
    expect(flapAt(Number.NaN, false)).toBe(0);
  });

  it('a bumped bird spins once, then flies on; reduced motion only tilts', () => {
    expect(bonkTilt(null, false)).toBe(0);
    expect(bonkTilt(BONK.ms / 2, false)).toBeCloseTo(180, 6);
    expect(bonkTilt(BONK.ms, false)).toBe(0);
    expect(bonkTilt(BONK.ms / 2, true)).toBe(20);
    expect(bonkTilt(-1, false)).toBe(0);
  });

  it('a feather puff is the same every time for the same bump, and spreads out', () => {
    const a = featherBurst(0, 40);
    expect(a).toEqual(featherBurst(0, 40));
    expect(a).toHaveLength(6);
    const xs = a.map((f) => Math.sign(Math.round(f.dx)));
    expect(xs).toContain(1);
    expect(xs).toContain(-1);
  });
});

describe('gustCue', () => {
  it('points the arrow the way the gust blows, with streaks behind', () => {
    for (const dir of [1, -1] as const) {
      const cue = gustCue(AT, dir);
      const tip = cue.arrow.reduce((best, p) =>
        (p.x - AT.x) * dir > (best.x - AT.x) * dir ? p : best,
      );
      expect((tip.x - AT.x) * dir).toBeGreaterThan(40);
      for (const s of cue.streaks) {
        expect((Math.max(s.x1, s.x2) - AT.x) * dir).toBeLessThanOrEqual(0);
        expect((Math.min(s.x1, s.x2) - AT.x) * dir).toBeLessThan(0);
      }
      expect(cue.streaks).toHaveLength(3);
    }
  });

  it('stays on screen near the edges', () => {
    for (const x of [0, 30, WORLD.width - 10, WORLD.width + 50]) {
      for (const dir of [1, -1] as const) {
        const cue = gustCue({ x, y: 300 }, dir);
        for (const p of cue.arrow) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(WORLD.width);
        }
        for (const s of cue.streaks) {
          expect(Math.min(s.x1, s.x2)).toBeGreaterThanOrEqual(0);
          expect(Math.max(s.x1, s.x2)).toBeLessThanOrEqual(WORLD.width);
        }
      }
    }
    expect(GUST_EDGE).toBeGreaterThan(60);
  });

  it('floats its word above the shell', () => {
    expect(gustCue(AT, 1).label.y).toBeLessThan(AT.y);
  });

  it('grows with the turn level: more and longer streaks, a bigger arrow, no words added', () => {
    const size = (lv: 'low' | 'medium' | 'high') => {
      const cue = gustCue(AT, 1, WORLD.width, lv);
      const xs = cue.arrow.map((p) => p.x);
      const ys = cue.arrow.map((p) => p.y);
      return {
        streaks: cue.streaks.length,
        longest: Math.max(...cue.streaks.map((s) => Math.abs(s.x2 - s.x1))),
        arrowW: Math.max(...xs) - Math.min(...xs),
        arrowH: Math.max(...ys) - Math.min(...ys),
        width: cue.width,
      };
    };
    const low = size('low');
    const medium = size('medium');
    const high = size('high');
    // Low is the old cue exactly.
    expect(gustCue(AT, 1, WORLD.width, 'low')).toEqual(gustCue(AT, 1));
    expect(low.streaks).toBe(3);
    for (const [a, b] of [
      [low, medium],
      [medium, high],
    ] as const) {
      expect(b.streaks).toBeGreaterThan(a.streaks);
      expect(b.longest).toBeGreaterThan(a.longest);
      expect(b.arrowW).toBeGreaterThan(a.arrowW);
      expect(b.arrowH).toBeGreaterThan(a.arrowH);
      expect(b.width).toBeGreaterThan(a.width);
    }
  });

  it('the layer draws the cue at the gust level it was told', () => {
    const src = readFileSync(join(process.cwd(), 'src/scenes/battle/disturbanceLayer.ts'), 'utf8');
    expect(src).toMatch(/gustCue\([^)]*hit\.level\)/);
    expect(src).toMatch(/lineStyle\(cue\.width/);
  });

  it('a high gust still stays on screen near the edges, both ways', () => {
    for (const x of [0, 30, WORLD.width - 10, WORLD.width + 50])
      for (const dir of [1, -1] as const) {
        const cue = gustCue({ x, y: 300 }, dir, WORLD.width, 'high');
        for (const p of cue.arrow) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(WORLD.width);
        }
        for (const s of cue.streaks) {
          expect(Math.min(s.x1, s.x2)).toBeGreaterThanOrEqual(0);
          expect(Math.max(s.x1, s.x2)).toBeLessThanOrEqual(WORLD.width);
        }
      }
  });
});

describe('words and rules', () => {
  it('the sound words are short, friendly and never banned', () => {
    expect(DISTURBANCE_COPY.squawk).toBe('Squawk!');
    expect(DISTURBANCE_COPY.gust).toBe('Gust!');
    // "Whoosh!" means a miss and a dodge, so a gust has its own word (owner, 2026-10-25).
    expect(Object.values(DISTURBANCE_COPY)).not.toContain('Whoosh!');
    for (const t of Object.values(DISTURBANCE_COPY)) expect(findBanned(t)).toEqual([]);
  });

  it('the bump circle the art uses is the rules number', () => {
    expect(BIRD_HIT_RADIUS).toBe(DISTURBANCE.birds.hitRadius);
  });

  it('the art files import no rules state beyond config and never use Math.random', () => {
    for (const f of ['birdArt.ts', 'gustArt.ts', 'disturbanceLayer.ts']) {
      const src = readFileSync(join(process.cwd(), 'src/scenes/battle', f), 'utf8');
      expect(src, f).not.toMatch(/Math\.random/);
    }
  });
});
