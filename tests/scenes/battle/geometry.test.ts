import { describe, expect, it } from 'vitest';
import {
  AIM,
  BASES,
  DAMAGE,
  PHASE1_LAYOUT,
  TIMING,
  TURN,
  WIND,
  WORLD,
} from '../../../src/game/config';
import {
  angleArc,
  angleFromDrag,
  angleLabelSpot,
  guideTip,
  bubbleTailTarget,
  aimVector,
  bubbleAnchor,
  characterSpot,
  hpFraction,
  shotIcons,
  sideAlpha,
  windArrow,
} from '../../../src/scenes/battle/geometry';
import { BUBBLE_MAX_WORLD_W, DIAL, FALL_DX } from '../../../src/scenes/battle/visual';

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

describe('the small angle guide', () => {
  const o = { x: 200, y: 500 };
  it('puts the tip guideLength from the muzzle along the aim, both facings', () => {
    for (const facing of [1, -1] as const) {
      for (const angle of [0, 30, 45, 90]) {
        const t = guideTip(o, angle, facing);
        expect(Math.hypot(t.x - o.x, t.y - o.y)).toBeCloseTo(DIAL.guideLength, 6);
        expect(Math.sign(t.x - o.x) || facing).toBe(facing);
        expect(t.y).toBeLessThanOrEqual(o.y + 1e-9);
      }
    }
  });
  it('sweeps the arc from flat up to the aim, mirrored for Team Future', () => {
    expect(angleArc(45, 1)).toEqual({ start: -Math.PI / 4, end: 0 });
    const f = angleArc(45, -1);
    expect(f.start).toBeCloseTo(Math.PI, 9);
    expect(f.end).toBeCloseTo(Math.PI + Math.PI / 4, 9);
  });
  it('puts the number just past the tip, away from the launcher', () => {
    const past = angleLabelSpot(o, 45, 1);
    expect(past.x).toBeGreaterThan(guideTip(o, 45, 1).x);
    expect(past.anchorX).toBe(0);
    const future = angleLabelSpot(o, 45, -1);
    expect(future.x).toBeLessThan(guideTip(o, 45, -1).x);
    expect(future.anchorX).toBe(1);
  });
  it('turns a pointer into a whole-degree angle and round-trips the tip', () => {
    for (const facing of [1, -1] as const) {
      for (let angle = AIM.angleMinDeg; angle <= AIM.angleMaxDeg; angle += 5) {
        expect(angleFromDrag(o, guideTip(o, angle, facing), facing, 1)).toBe(angle);
      }
    }
  });
  it('clamps behind and above the launcher and ignores bad numbers', () => {
    expect(angleFromDrag(o, { x: o.x - 100, y: o.y + 5 }, 1, 40)).toBe(AIM.angleMinDeg);
    expect(angleFromDrag(o, { x: o.x - 5, y: o.y - 100 }, 1, 40)).toBe(AIM.angleMaxDeg);
    expect(angleFromDrag(o, o, 1, 33)).toBe(33);
    expect(angleFromDrag(o, { x: NaN, y: NaN }, 1, 33)).toBe(33);
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
  it('is out of the starting base health when no maximum is given', () => {
    expect(hpFraction(DAMAGE.startingBaseHp)).toBe(1);
    expect(hpFraction(DAMAGE.startingBaseHp / 2)).toBe(0.5);
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
