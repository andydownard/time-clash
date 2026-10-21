// The Past Forge bowyer: pure pose numbers, and the CSS keyframes made from them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOW_LOOP_SECONDS,
  KNIFE_KEYS,
  SHOULDER,
  armAt,
  armPose,
  bowKeyframesCss,
  handAt,
  handFrom,
  knifeAt,
  sampleMarks,
} from '../../src/ui/forgePose';

const ui = readFileSync(join(process.cwd(), 'src/styles/ui.css'), 'utf8');

describe('bowyer pose numbers', () => {
  it('the loop is calm: 2 to 3 seconds, and chips pop under 3 times a second', () => {
    expect(BOW_LOOP_SECONDS).toBeGreaterThanOrEqual(2);
    expect(BOW_LOOP_SECONDS).toBeLessThanOrEqual(3);
    const art = readFileSync(join(process.cwd(), 'src/ui/forgeArt.ts'), 'utf8');
    const popped = [...art.matchAll(/class="tc-forge-chip"/g)].length;
    expect(popped).toBeGreaterThan(0);
    expect(popped / BOW_LOOP_SECONDS).toBeLessThan(3);
  });

  it('the knife loop starts and ends in the same place and stays on the stave', () => {
    expect(knifeAt(0)).toEqual(knifeAt(100));
    expect(KNIFE_KEYS[0]!.pct).toBe(0);
    expect(KNIFE_KEYS[KNIFE_KEYS.length - 1]!.pct).toBe(100);
    for (const p of sampleMarks()) {
      const k = knifeAt(p);
      expect(k.lift).toBeGreaterThanOrEqual(0);
      expect(Math.abs(k.slide)).toBeLessThanOrEqual(30);
    }
  });

  it('both hands land on the knife handles all through the loop', () => {
    for (const handle of ['near', 'far'] as const) {
      for (const p of sampleMarks()) {
        const want = handAt(handle, p);
        const got = handFrom(SHOULDER, armAt(handle, p));
        expect(Math.hypot(got.x - want.x, got.y - want.y)).toBeLessThan(0.01);
      }
    }
  });

  it('keeps the elbow below the line to the hand and the bones a sane length', () => {
    for (const handle of ['near', 'far'] as const) {
      for (const p of sampleMarks()) {
        const pose = armAt(handle, p);
        expect(pose.bone).toBeGreaterThan(60);
        expect(pose.bone).toBeLessThan(160);
        const elbowY = SHOULDER.y + pose.bone * Math.sin((pose.upper * Math.PI) / 180);
        expect(elbowY).toBeLessThan(806);
      }
    }
  });

  it('armPose is the inverse of handFrom for any reachable point', () => {
    const hand = { x: 600, y: 700 };
    const got = handFrom(SHOULDER, armPose(SHOULDER, hand));
    expect(got.x).toBeCloseTo(hand.x, 6);
    expect(got.y).toBeCloseTo(hand.y, 6);
  });

  it('ui.css holds exactly the keyframes the pose numbers make', () => {
    const css = ui.replace(/\s+/g, ' ');
    for (const block of bowKeyframesCss().split(/(?=@keyframes)/)) {
      expect(css).toContain(block.replace(/\s+/g, ' ').trim());
    }
  });

  it('every moving part is hushed by reduced motion and has a still pose in the art', () => {
    const art = readFileSync(join(process.cwd(), 'src/ui/forgeArt.ts'), 'utf8');
    expect(ui).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/,
    );
    expect(ui).toMatch(/\[data-motion='reduced'\] \*[\s\S]*animation: none !important/);
    for (const part of ['near-upper', 'near-bone', 'far-upper', 'far-bone']) {
      expect(art).toMatch(new RegExp(`class="tc-forge-${part}" transform="(rotate|scale)\\(`));
    }
    expect(art).toMatch(/class="tc-forge-thumb" transform="translate\(/);
    // chips and button glows are invisible until animated, so a still picture shows none
    expect(ui).toMatch(/\.tc-forge-chip \{\s*opacity: 0;/);
    expect(ui).toMatch(/\.tc-forge-lit \{\s*opacity: 0;/);
  });
});
