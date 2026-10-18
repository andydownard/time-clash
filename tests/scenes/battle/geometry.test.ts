import { describe, expect, it } from 'vitest';
import {
  AIM,
  BASES,
  DAMAGE,
  LAUNCH_ORIGINS,
  PHASE1_LAYOUT,
  TEAM_FACING,
  TIMING,
  TURN,
  WIND,
  WORLD,
} from '../../../src/game/config';
import {
  aimFromDrag,
  bubbleTailTarget,
  aimVector,
  bubbleAnchor,
  characterSpot,
  dialHandle,
  hpFraction,
  shotIcons,
  sideAlpha,
  windArrow,
} from '../../../src/scenes/battle/geometry';
import { BUBBLE_MAX_WORLD_W, FALL_DX } from '../../../src/scenes/battle/visual';

describe('aimVector', () => {
  it('points toward the enemy for Past and flips for Future', () => {
    const p = aimVector(0, 1);
    const f = aimVector(0, -1);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(0);
    expect(f.x).toBeCloseTo(-1);
  });
  it('points up (negative y) at 90 degrees', () => {
    const v = aimVector(90, 1);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(-1);
  });
});

describe('dialHandle and aimFromDrag', () => {
  const origin = LAUNCH_ORIGINS.PAST;
  it('round-trips every whole aim for both teams', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const o = LAUNCH_ORIGINS[team];
      const facing = TEAM_FACING[team];
      for (let angle = AIM.angleMinDeg; angle <= AIM.angleMaxDeg; angle += 9) {
        for (let power = 10; power <= AIM.powerMax; power += 18) {
          const handle = dialHandle(o, angle, power, facing);
          const back = aimFromDrag(o, handle, facing, { angleDeg: 1, power: 1 });
          expect(back.angleDeg).toBe(angle);
          expect(back.power).toBe(power);
        }
      }
    }
  });
  it('clamps a drag behind the launcher to flat or straight up', () => {
    const behind = aimFromDrag(origin, { x: origin.x - 100, y: origin.y + 5 }, 1, {
      angleDeg: 40,
      power: 50,
    });
    expect(behind.angleDeg).toBeGreaterThanOrEqual(AIM.angleMinDeg);
    expect(behind.angleDeg).toBeLessThanOrEqual(AIM.angleMaxDeg);
    const above = aimFromDrag(origin, { x: origin.x - 5, y: origin.y - 100 }, 1, {
      angleDeg: 40,
      power: 50,
    });
    expect(above.angleDeg).toBe(AIM.angleMaxDeg);
  });
  it('caps power at the maximum for a very long drag', () => {
    const far = aimFromDrag(origin, { x: origin.x + 5000, y: origin.y - 5000 }, 1, {
      angleDeg: 40,
      power: 50,
    });
    expect(far.power).toBe(AIM.powerMax);
  });
  it('keeps the current angle when the pointer sits on the launcher', () => {
    const same = aimFromDrag(origin, origin, 1, { angleDeg: 33, power: 70 });
    expect(same.angleDeg).toBe(33);
    expect(same.power).toBe(AIM.powerMin);
  });
  it('never returns NaN for NaN input', () => {
    const bad = aimFromDrag(origin, { x: NaN, y: NaN }, 1, { angleDeg: 33, power: 70 });
    expect(bad).toEqual({ angleDeg: 33, power: 70 });
  });
});

describe('windArrow', () => {
  it('is calm at zero', () => {
    expect(windArrow(0)).toEqual({ dir: 0, length: 0 });
  });
  it('points right for positive and left for negative', () => {
    expect(windArrow(40).dir).toBe(1);
    expect(windArrow(-40).dir).toBe(-1);
  });
  it('is longest at the config limit and never longer', () => {
    expect(windArrow(WIND.max).length).toBeGreaterThan(windArrow(WIND.max / 2).length);
    expect(windArrow(WIND.max * 5).length).toBe(windArrow(WIND.max).length);
    expect(windArrow(NaN)).toEqual({ dir: 0, length: 0 });
  });
});

describe('hpFraction', () => {
  it('maps hp onto 0..1 and clamps', () => {
    expect(hpFraction(DAMAGE.startingBaseHp)).toBe(1);
    expect(hpFraction(0)).toBe(0);
    expect(hpFraction(DAMAGE.startingBaseHp / 2)).toBe(0.5);
    expect(hpFraction(-30)).toBe(0);
    expect(hpFraction(999)).toBe(1);
    expect(hpFraction(NaN)).toBe(0);
  });
});

describe('shotIcons', () => {
  it('shows one filled icon per shot left', () => {
    expect(shotIcons(2)).toEqual([true, true]);
    expect(shotIcons(1)).toEqual([true, false]);
    expect(shotIcons(0)).toEqual([false, false]);
    expect(shotIcons(2)).toHaveLength(TURN.shotsPerTurn);
  });
});

describe('sideAlpha', () => {
  it('dims only the waiting side', () => {
    expect(sideAlpha('PAST', 'PAST')).toBe(1);
    expect(sideAlpha('FUTURE', 'PAST')).toBeCloseTo(1 - TIMING.waitingDim);
  });
  it('shows both sides fully when nobody is active', () => {
    expect(sideAlpha('PAST', null)).toBe(1);
    expect(sideAlpha('FUTURE', null)).toBe(1);
  });
});

describe('placement', () => {
  it('stands each character on the ground beside its own base', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const spot = characterSpot(team, PHASE1_LAYOUT);
      expect(spot.y).toBe(PHASE1_LAYOUT.terrain.ground[0]!.y);
      expect(spot.x).toBeGreaterThan(0);
      expect(spot.x).toBeLessThan(WORLD.width);
    }
    expect(characterSpot('PAST', PHASE1_LAYOUT).x).toBeGreaterThan(BASES.PAST.x + BASES.PAST.w);
    expect(characterSpot('FUTURE', PHASE1_LAYOUT).x).toBeLessThan(BASES.FUTURE.x);
  });
  it('keeps the whole speech bubble off both bases, so it never covers a health tag', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const a = bubbleAnchor(team, PHASE1_LAYOUT);
      const left = a.x - BUBBLE_MAX_WORLD_W / 2;
      const right = a.x + BUBBLE_MAX_WORLD_W / 2;
      for (const t of ['PAST', 'FUTURE'] as const) {
        const b = BASES[t];
        expect(right <= b.x || left >= b.x + b.w, `${team} bubble vs ${t} base`).toBe(true);
      }
    }
  });
  it('aims the bubble tail at the speaker, with the bubble still clear of both bases', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const spot = characterSpot(team, PHASE1_LAYOUT);
      const t = bubbleTailTarget(team, PHASE1_LAYOUT);
      expect(t.x).toBe(spot.x);
      expect(t.y).toBeLessThan(spot.y);
      // Close enough that the tail visibly points at the character, not at empty sky.
      const a = bubbleAnchor(team, PHASE1_LAYOUT);
      expect(Math.abs(t.x - a.x)).toBeLessThanOrEqual(BUBBLE_MAX_WORLD_W / 2);
    }
  });
  it('aims the tail at the stars over a fallen fighter, out toward the field', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const spot = characterSpot(team, PHASE1_LAYOUT);
      const t = bubbleTailTarget(team, PHASE1_LAYOUT, true);
      expect(Math.abs(t.x - spot.x)).toBe(FALL_DX);
      expect(Math.sign(t.x - spot.x)).toBe(team === 'PAST' ? 1 : -1);
      expect(t.y).toBeLessThan(spot.y);
      const a = bubbleAnchor(team, PHASE1_LAYOUT);
      expect(Math.abs(t.x - a.x)).toBeLessThanOrEqual(BUBBLE_MAX_WORLD_W / 2);
    }
  });
  it('puts the speech bubble above the character, inside the world', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      const a = bubbleAnchor(team, PHASE1_LAYOUT);
      expect(a.y).toBeLessThan(characterSpot(team, PHASE1_LAYOUT).y);
      expect(a.y).toBeGreaterThan(0);
      expect(a.x).toBeGreaterThan(0);
      expect(a.x).toBeLessThan(WORLD.width);
    }
  });
});

describe('hpFraction with a raised maximum', () => {
  it('keeps the old behavior with no maximum (out of 100)', () => {
    expect(hpFraction(100)).toBe(1);
    expect(hpFraction(50)).toBe(0.5);
    expect(hpFraction(0)).toBe(0);
  });
  it('is out of the given maximum', () => {
    expect(hpFraction(62, 124)).toBe(0.5);
    expect(hpFraction(124, 124)).toBe(1);
  });
  it('is 0 for a bad health or a bad maximum, and never above 1', () => {
    expect(hpFraction(Number.NaN, 100)).toBe(0);
    expect(hpFraction(50, 0)).toBe(0);
    expect(hpFraction(50, -10)).toBe(0);
    expect(hpFraction(50, Number.NaN)).toBe(0);
    expect(hpFraction(300, 100)).toBe(1);
  });
});
