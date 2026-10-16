import { describe, expect, it } from 'vitest';
import {
  AIM,
  BALLISTICS,
  BASES,
  DAMAGE,
  GRADE,
  LAUNCH_ORIGINS,
  NAME,
  RELOAD,
  SCRAP,
  TEAM_FACING,
  TERRAIN,
  UI,
  WIND,
  WORLD,
} from '../../src/game/config';
import { TEAMS } from '../../src/game/types';

describe('config: Phase 1 balance numbers (docs/BUILD.md)', () => {
  it('matches the ballistics numbers', () => {
    expect(BALLISTICS.gravity).toBe(600);
    expect(BALLISTICS.maxLaunchSpeed).toBe(900);
    expect(BALLISTICS.stepSeconds).toBeCloseTo(1 / 60, 12);
    expect(AIM.angleMinDeg).toBe(0);
    expect(AIM.angleMaxDeg).toBe(90);
    expect(AIM.powerMin).toBe(0);
    expect(AIM.powerMax).toBe(100);
  });

  it('matches wind, damage, reload, and scrap numbers', () => {
    expect(WIND.min).toBe(-80);
    expect(WIND.max).toBe(80);
    expect(DAMAGE.directRadius).toBe(48);
    expect(DAMAGE.nearRadius).toBe(120);
    expect(DAMAGE.direct).toBe(25);
    expect(DAMAGE.near).toBe(10);
    expect(DAMAGE.startingBaseHp).toBe(100);
    expect(RELOAD.fastMs).toBe(8000);
    expect(SCRAP.fastCorrect).toBe(2);
    expect(SCRAP.slowCorrect).toBe(1);
    expect(SCRAP.wrong).toBe(0);
    expect(SCRAP.starting).toBe(0);
  });

  it('keeps defaults inside the aim limits', () => {
    expect(AIM.defaultAngleDeg).toBeGreaterThanOrEqual(AIM.angleMinDeg);
    expect(AIM.defaultAngleDeg).toBeLessThanOrEqual(AIM.angleMaxDeg);
    expect(AIM.defaultPower).toBeGreaterThanOrEqual(AIM.powerMin);
    expect(AIM.defaultPower).toBeLessThanOrEqual(AIM.powerMax);
  });

  it('uses grades K (0) to 12 and names of 1 to 12 characters', () => {
    expect(GRADE.min).toBe(0);
    expect(GRADE.max).toBe(12);
    expect(NAME.minLength).toBe(1);
    expect(NAME.maxLength).toBe(12);
  });

  it('meets the accessibility floor', () => {
    expect(UI.tapTargetMinPx).toBeGreaterThanOrEqual(56);
    expect(UI.textMinPx).toBeGreaterThanOrEqual(20);
    expect(UI.youngReadingTextPx).toBeGreaterThanOrEqual(32);
  });
});

describe('config: battle layout', () => {
  it('is a 1280x720 logical world', () => {
    expect(WORLD.width).toBe(1280);
    expect(WORLD.height).toBe(720);
    expect(TERRAIN.groundY).toBeLessThan(WORLD.height);
  });

  it('puts each base inside the world, sitting on the ground', () => {
    for (const team of TEAMS) {
      const b = BASES[team];
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(WORLD.width);
      expect(b.y).toBeGreaterThan(0);
      expect(b.y + b.h).toBe(TERRAIN.groundY);
    }
  });

  it('puts Team Past on the left facing right, Team Future on the right facing left', () => {
    expect(BASES.PAST.x + BASES.PAST.w).toBeLessThan(BASES.FUTURE.x);
    expect(TEAM_FACING.PAST).toBe(1);
    expect(TEAM_FACING.FUTURE).toBe(-1);
  });

  it('launches from above the ground and outside the obstacles', () => {
    for (const team of TEAMS) {
      expect(LAUNCH_ORIGINS[team].y).toBeLessThan(TERRAIN.groundY);
    }
    const hillXs = TERRAIN.hill.map((p) => p.x);
    for (const team of TEAMS) {
      const x = LAUNCH_ORIGINS[team].x;
      expect(x < Math.min(...hillXs) || x > Math.max(...hillXs)).toBe(true);
    }
  });

  it('can reach the other base at full power on flat ground (v^2 / g)', () => {
    const range = BALLISTICS.maxLaunchSpeed ** 2 / BALLISTICS.gravity;
    const gap = Math.abs(LAUNCH_ORIGINS.FUTURE.x - LAUNCH_ORIGINS.PAST.x);
    expect(range).toBeGreaterThan(gap * 1.2);
  });

  it('caps flight time so a shot always ends', () => {
    expect(BALLISTICS.maxSteps).toBeGreaterThan(0);
    expect(Number.isInteger(BALLISTICS.maxSteps)).toBe(true);
  });
});
