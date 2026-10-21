import { describe, expect, it } from 'vitest';
import { baseBlastPlan, explosionPlan } from '../../../src/scenes/battle/impact';
import {
  dizzyStarsFrame,
  fallFrame,
  fallPose,
  fallVariant,
  FALL_PHASES,
  LYING_DEG,
  vanishFrame,
  type FallFrame,
} from '../../../src/scenes/battle/tumble';
import { BOUNCE_HEIGHT, FALL_DX, FALL_HEIGHT, FALL_MS } from '../../../src/scenes/battle/visual';

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
  for (const variant of ['face', 'feet'] as const) {
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
        expect(last.rotationDeg).toBeCloseTo(LYING_DEG);
        expect(last.squashY).toBe(1);
      });
      it('goes through teeter, fly, land, bounce, wobble, topple in order', () => {
        expect(FALL_PHASES).toEqual(['teeter', 'fly', 'land', 'bounce', 'wobble', 'topple']);
        const seen = frames.map((f) => FALL_PHASES.indexOf(f.phase));
        expect([...seen].sort((a, b) => a - b)).toEqual(seen);
        expect(new Set(seen).size).toBe(FALL_PHASES.length);
      });
      it('sets up with a teeter: it stays put, rocks, flails, looks both ways, ends upright', () => {
        const teeter = frames.filter((f) => f.phase === 'teeter');
        expect(teeter.length).toBeGreaterThan(5);
        for (const f of teeter) {
          expect(f.dx).toBe(0);
          expect(f.lift).toBe(0);
        }
        expect(Math.max(...teeter.map((f) => Math.abs(f.rotationDeg)))).toBeGreaterThan(5);
        expect(new Set(teeter.map((f) => Math.round(f.armSwingDeg))).size).toBeGreaterThan(3);
        const looks = new Set(teeter.map((f) => f.lookDir));
        expect(looks.has(-1) && looks.has(1)).toBe(true);
        expect(fallFrame(0, variant).rotationDeg).toBeCloseTo(0);
        const lastTeeter = teeter[teeter.length - 1]!;
        expect(Math.abs(lastTeeter.rotationDeg)).toBeLessThan(3);
      });
      it('pays off with a bounce: up off the ground after landing, and back down', () => {
        const bounce = frames.filter((f) => f.phase === 'bounce');
        expect(bounce.length).toBeGreaterThan(5);
        const peak = Math.max(...bounce.map((f) => f.lift));
        expect(peak).toBeGreaterThan(BOUNCE_HEIGHT * 0.8);
        expect(peak).toBeLessThan(FALL_HEIGHT);
        for (const f of bounce) expect(f.dx).toBe(FALL_DX);
        expect(bounce[0]!.lift).toBeLessThan(peak / 2);
        expect(bounce[bounce.length - 1]!.lift).toBeLessThan(peak / 2);
        const land = frames.filter((f) => f.phase === 'land');
        expect(Math.min(...land.map((f) => f.squashY))).toBeLessThan(0.7);
      });
      it('is deterministic', () => {
        expect(fallFrame(500, variant)).toEqual(fallFrame(500, variant));
      });
    });
  }
  const sample = (variant: 'face' | 'feet'): FallFrame[] =>
    Array.from({ length: 301 }, (_, i) => fallFrame((i * FALL_MS) / 300, variant));
  it('on its feet it spins a full turn in the bounce; flat on its face it bounces like a plank', () => {
    const spin = sample('feet').filter((f) => f.phase === 'bounce');
    expect(Math.max(...spin.map((f) => f.rotationDeg))).toBeGreaterThan(150);
    const end = spin[spin.length - 1]!.rotationDeg % 360;
    expect(Math.min(end, 360 - end)).toBeLessThan(20);
    const plank = sample('face').filter((f) => f.phase === 'bounce');
    for (const f of plank) expect(f.rotationDeg).toBeCloseTo(LYING_DEG);
  });
  it('keeps the whole tumble short so play keeps moving', () => {
    expect(FALL_MS).toBeLessThanOrEqual(2500);
  });
  it('on its feet it stands after landing, then falls over', () => {
    const wobble = sample('feet').find((f) => f.phase === 'wobble')!;
    expect(Math.abs(wobble.rotationDeg)).toBeLessThan(15);
    const late = fallFrame(FALL_MS * 0.95, 'feet');
    expect(late.rotationDeg).toBeGreaterThan(40);
  });
  it('clamps time and bad input', () => {
    expect(fallFrame(-5, 'face').dx).toBe(0);
    expect(fallFrame(1e9, 'face').phase).toBe('topple');
    expect(fallFrame(NaN, 'feet').dx).toBe(0);
  });
  it('alternates variants by count', () => {
    expect(fallVariant(0)).not.toBe(fallVariant(1));
    expect(fallVariant(2)).toBe(fallVariant(0));
  });
  it('converts to a pose the sprite can draw', () => {
    const pose = fallPose(fallFrame(300, 'face'));
    expect(pose.lift).toBeGreaterThanOrEqual(0);
    expect(pose.squashX).toBeGreaterThan(0);
  });
});

describe('dizzyStarsFrame', () => {
  it('circles three stars above the head', () => {
    const f = dizzyStarsFrame(0.5);
    expect(f).toHaveLength(3);
    for (const s of f) expect(s.dy).toBeLessThan(0);
  });
  it('moves the stars around over time', () => {
    expect(dizzyStarsFrame(0.3)[0]!.dx).not.toBeCloseTo(dizzyStarsFrame(0.5)[0]!.dx);
  });
  it('fades in, holds, and fades out', () => {
    expect(dizzyStarsFrame(0)[0]!.alpha).toBe(0);
    expect(dizzyStarsFrame(1)[0]!.alpha).toBeCloseTo(0);
    expect(dizzyStarsFrame(0.5)[0]!.alpha).toBeGreaterThan(0.8);
  });
  it('is deterministic and survives bad input', () => {
    expect(dizzyStarsFrame(0.4)).toEqual(dizzyStarsFrame(0.4));
    expect(dizzyStarsFrame(NaN)).toEqual(dizzyStarsFrame(0));
    expect(dizzyStarsFrame(-3)).toEqual(dizzyStarsFrame(0));
    expect(dizzyStarsFrame(7)).toEqual(dizzyStarsFrame(1));
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
