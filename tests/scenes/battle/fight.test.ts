import { describe, expect, it } from 'vitest';
import { baseBlastPlan, explosionPlan } from '../../../src/scenes/battle/impact';
import {
  fallFrame,
  fallPose,
  fallVariantFor,
  standUpFrame,
  starOffsets,
  headPosition,
  LYING_DEG,
  vanishFrame,
} from '../../../src/scenes/battle/tumble';
import { HIT_FX } from '../../../src/game/config';
import { FALL_DX, FALL_MS } from '../../../src/scenes/battle/visual';

describe('explosionPlan', () => {
  it('is deterministic', () => {
    expect(explosionPlan('confetti', 1, 7)).toEqual(explosionPlan('confetti', 1, 7));
  });
  it('is bigger for a bigger scale', () => {
    const small = explosionPlan('confetti', 0.6, 7);
    const big = explosionPlan('confetti', 1.4, 7);
    expect(big.fireballs[0]!.radius).toBeGreaterThan(small.fireballs[0]!.radius);
    expect(big.flashRadius).toBeGreaterThan(small.flashRadius);
  });
  it('has a fireball, smoke and a few chunks that fly up and out', () => {
    const p = explosionPlan('confetti', 1, 3);
    expect(p.fireballs.length).toBeGreaterThan(0);
    expect(p.smoke.length).toBeGreaterThan(0);
    expect(p.chunks.length).toBeGreaterThanOrEqual(3);
    expect(p.chunks.length).toBeLessThanOrEqual(8);
    for (const c of p.chunks) expect(Math.sin(c.angle)).toBeLessThan(0);
  });
  it('a miss is mostly dust: one small fireball', () => {
    expect(explosionPlan('puff', 0.6, 1).fireballs).toHaveLength(1);
  });
  it('plasma throws metal and stone shots throw stone', () => {
    const plasma = explosionPlan('plasma', 1, 5).chunks.map((c) => c.color);
    const stone = explosionPlan('confetti', 1, 5).chunks.map((c) => c.color);
    expect(plasma.some((c) => stone.includes(c))).toBe(false);
  });
  it('survives odd scales and honors a chunk count', () => {
    expect(explosionPlan('blocks', NaN, 1).chunks.length).toBeGreaterThan(0);
    expect(explosionPlan('blocks', 1e9, 1).chunks.length).toBeLessThanOrEqual(8);
    expect(explosionPlan('blocks', 1, 1, 'stone', 5).chunks).toHaveLength(5);
  });
});

describe('baseBlastPlan', () => {
  const base = { x: 100, y: 300, w: 200, h: 220 };
  it('bursts in several places inside the base, in order', () => {
    const spots = baseBlastPlan(base, 9);
    expect(spots.length).toBeGreaterThan(2);
    spots.forEach((s, i) => {
      expect(s.x).toBeGreaterThanOrEqual(base.x);
      expect(s.x).toBeLessThanOrEqual(base.x + base.w);
      expect(s.y).toBeGreaterThanOrEqual(base.y);
      expect(s.y).toBeLessThanOrEqual(base.y + base.h);
      if (i > 0) expect(s.delayMs).toBeGreaterThan(spots[i - 1]!.delayMs);
    });
    expect(baseBlastPlan(base, 9)).toEqual(spots);
  });
});

describe('fallFrame', () => {
  for (const variant of ['face', 'flop'] as const) {
    describe(variant, () => {
      const frames = Array.from({ length: 151 }, (_, i) => fallFrame((i * FALL_MS) / 150, variant));
      it('never goes below the ground or backward', () => {
        let lastDx = 0;
        for (const f of frames) {
          expect(f.lift).toBeGreaterThanOrEqual(0);
          expect(f.dx).toBeGreaterThanOrEqual(lastDx - 1e-9);
          expect(f.dx).toBeLessThanOrEqual(FALL_DX + 1e-9);
          expect(f.squashY).toBeGreaterThan(0);
          lastDx = f.dx;
        }
      });
      it('starts at rest and ends lying down on the ground', () => {
        const first = frames[0]!;
        expect(first.lift).toBe(0);
        expect(first.dx).toBe(0);
        const last = frames[frames.length - 1]!;
        expect(last.phase).toBe('topple');
        expect(last.lift).toBe(0);
        expect(last.dx).toBe(FALL_DX);
        expect(Math.abs(last.rotationDeg)).toBeCloseTo(LYING_DEG);
        expect(last.squashY).toBe(1);
        expect(last.scale).toBe(HIT_FX.fallScale);
      });
      it('goes through fly, land, wobble, topple in order', () => {
        const order = ['fly', 'land', 'wobble', 'topple'];
        const seen = frames.map((f) => order.indexOf(f.phase));
        expect([...seen].sort((a, b) => a - b)).toEqual(seen);
        expect(new Set(seen).size).toBe(4);
      });
      it('is deterministic', () => {
        expect(fallFrame(500, variant)).toEqual(fallFrame(500, variant));
      });
    });
  }
  it('a flop falls backward and a face-plant falls forward', () => {
    expect(fallFrame(FALL_MS, 'flop').rotationDeg).toBeLessThan(0);
    expect(fallFrame(FALL_MS, 'face').rotationDeg).toBeGreaterThan(0);
  });
  it('bounces on landing: a little lift right after the land', () => {
    const f = fallFrame(FALL_MS * 0.645, 'face');
    expect(f.phase).toBe('wobble');
    expect(f.lift).toBeGreaterThan(5);
  });
  it('clamps time and bad input', () => {
    expect(fallFrame(-5, 'face').dx).toBe(0);
    expect(fallFrame(1e9, 'face').phase).toBe('topple');
    expect(fallFrame(NaN, 'flop').dx).toBe(0);
  });
  it('picks the fall style from the seed, the same way every time', () => {
    const picks = Array.from({ length: 30 }, (_, n) => fallVariantFor(7, n));
    expect(picks).toEqual(Array.from({ length: 30 }, (_, n) => fallVariantFor(7, n)));
    expect(new Set(picks)).toEqual(new Set(['face', 'flop']));
  });
  it('survives odd seeds and counts', () => {
    expect(['face', 'flop']).toContain(fallVariantFor(NaN, -3));
    expect(['face', 'flop']).toContain(fallVariantFor(1e12, 1e9));
  });
  it('converts to a pose the sprite can draw', () => {
    const pose = fallPose(fallFrame(300, 'face'));
    expect(pose.lift).toBeGreaterThanOrEqual(0);
    expect(pose.squashX).toBeGreaterThan(0);
  });
});

describe('vanishFrame', () => {
  it('fades the fighter while the puff grows then fades', () => {
    const a = vanishFrame(0);
    const z = vanishFrame(1);
    expect(a.characterAlpha).toBe(1);
    expect(z.characterAlpha).toBe(0);
    expect(z.puffAlpha).toBeCloseTo(0);
    let lastScale = 0;
    let lastAlpha = 1;
    for (let i = 0; i <= 20; i++) {
      const f = vanishFrame(i / 20);
      expect(f.puffScale).toBeGreaterThanOrEqual(lastScale);
      expect(f.characterAlpha).toBeLessThanOrEqual(lastAlpha);
      lastScale = f.puffScale;
      lastAlpha = f.characterAlpha;
    }
  });
  it('clamps input', () => {
    expect(vanishFrame(-1)).toEqual(vanishFrame(0));
    expect(vanishFrame(9)).toEqual(vanishFrame(1));
    expect(vanishFrame(NaN)).toEqual(vanishFrame(0));
  });
});

describe('standUpFrame', () => {
  for (const variant of ['face', 'flop'] as const) {
    it(`${variant}: starts lying where it fell and ends upright at home`, () => {
      const a = standUpFrame(0, variant);
      const z = standUpFrame(1, variant);
      expect(Math.abs(a.rotationDeg)).toBeCloseTo(LYING_DEG);
      expect(a.dx).toBeCloseTo(FALL_DX);
      expect(z.rotationDeg).toBeCloseTo(0);
      expect(z.dx).toBeCloseTo(0);
      expect(z.lift).toBeCloseTo(0);
      expect(a.scale).toBeCloseTo(HIT_FX.fallScale);
      expect(z.scale).toBeCloseTo(1);
      for (let i = 0; i <= 20; i++) {
        const f = standUpFrame(i / 20, variant);
        expect(f.lift).toBeGreaterThanOrEqual(0);
        expect(f.squashY).toBeGreaterThan(0);
      }
    });
  }
  it('clamps bad input', () => {
    expect(standUpFrame(NaN, 'face').dx).toBeCloseTo(FALL_DX);
    expect(standUpFrame(9, 'face').rotationDeg).toBeCloseTo(0);
  });
});

describe('starOffsets', () => {
  it('gives three stars, evenly spread, that circle over time', () => {
    const a = starOffsets(0);
    const b = starOffsets(350);
    expect(a).toHaveLength(3);
    expect(b).not.toEqual(a);
    const back = starOffsets(1400);
    a.forEach((s, i) => {
      expect(back[i]!.dx).toBeCloseTo(s.dx);
      expect(back[i]!.dy).toBeCloseTo(s.dy);
    });
  });
  it('keeps every star inside the circle radius and in front or behind by depth', () => {
    for (let t = 0; t < 1400; t += 100) {
      for (const s of starOffsets(t)) {
        expect(Math.hypot(s.dx, s.dy)).toBeLessThanOrEqual(34 + 1e-9);
        expect(s.front).toBe(s.dy >= 0);
      }
    }
  });
  it('survives NaN time', () => {
    expect(starOffsets(NaN)).toHaveLength(3);
  });
});

describe('headPosition', () => {
  it('stands tall when upright and lies toward the tilt when lying', () => {
    const up = headPosition(100, 500, 0);
    expect(up.x).toBeCloseTo(100);
    expect(up.y).toBeLessThan(500);
    const right = headPosition(100, 500, 90);
    expect(right.x).toBeGreaterThan(100);
    expect(right.y).toBeCloseTo(500);
    expect(headPosition(100, 500, -90).x).toBeLessThan(100);
  });
});
