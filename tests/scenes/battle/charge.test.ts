// The wind-up before a shot: a glow ring pulls in to the launcher, then the shot goes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARGE, chargeFrame, chargeMs } from '../../../src/scenes/battle/charge';
import { CHARGE_MS } from '../../../src/scenes/battle/visual';

describe('chargeMs', () => {
  it('is a short beat, so Fire still feels quick', () => {
    expect(chargeMs(false)).toBe(CHARGE_MS);
    expect(CHARGE_MS).toBeGreaterThanOrEqual(200);
    expect(CHARGE_MS).toBeLessThanOrEqual(500);
  });
  it('skips the wind-up when motion is reduced', () => {
    expect(chargeMs(true)).toBe(0);
  });
  it('matches the Fire button fill time in the stylesheet', () => {
    const tokens = readFileSync(new URL('../../../src/styles/tokens.css', import.meta.url), 'utf8');
    expect(tokens).toContain(`--tc-fire-charge: ${CHARGE_MS}ms;`);
  });
});

describe('chargeFrame', () => {
  const frames = Array.from({ length: 41 }, (_, i) => chargeFrame(i / 40));
  it('pulls the ring in toward the launcher', () => {
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!.ringRadius).toBeLessThanOrEqual(frames[i - 1]!.ringRadius + 1e-9);
    }
    expect(frames[0]!.ringRadius).toBe(CHARGE.ringStart);
    expect(frames[frames.length - 1]!.ringRadius).toBeCloseTo(CHARGE.ringEnd);
  });
  it('grows the glow at the launcher as it charges', () => {
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!.coreRadius).toBeGreaterThanOrEqual(frames[i - 1]!.coreRadius - 1e-9);
    }
    expect(frames[0]!.coreAlpha).toBeLessThan(frames[frames.length - 1]!.coreAlpha);
  });
  it('keeps alphas in range', () => {
    for (const f of frames) {
      for (const a of [f.ringAlpha, f.coreAlpha]) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });
  it('clamps time and survives bad input', () => {
    expect(chargeFrame(-1)).toEqual(chargeFrame(0));
    expect(chargeFrame(9)).toEqual(chargeFrame(1));
    expect(chargeFrame(NaN)).toEqual(chargeFrame(0));
  });
});
