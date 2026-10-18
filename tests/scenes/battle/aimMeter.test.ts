import { describe, expect, it } from 'vitest';
import { meterLeft } from '../../../src/scenes/battle/geometry';

describe('power meter position', () => {
  it('slides back from the enemy so it clears the balloon over the launcher', () => {
    expect(meterLeft(500, 1, 1280, 210)).toBeLessThan(500 - 105);
    expect(meterLeft(780, -1, 1280, 210)).toBeGreaterThan(780 - 105);
  });
  it('stays inside the picture', () => {
    expect(meterLeft(20, 1, 1280, 210)).toBeGreaterThanOrEqual(8);
    expect(meterLeft(1270, -1, 1280, 210)).toBeLessThanOrEqual(1280 - 210 - 8);
  });
});
