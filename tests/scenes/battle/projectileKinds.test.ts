import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAUNCH_ORIGINS, PHASE1_LAYOUT, TEAM_FACING } from '../../../src/game/config';
import { simulateShot } from '../../../src/game/ballistics';
import {
  DEFAULT_KIND,
  PROJECTILE_KINDS,
  headingDegrees,
  kindFlies,
  kindForRole,
  type ProjectileKind,
} from '../../../src/scenes/battle/projectileKinds';
import { DRAWINGS } from '../../../src/scenes/battle/projectiles';

describe('kindForRole', () => {
  const table: Array<[string, ProjectileKind]> = [
    ['balloon', 'bomb'],
    ['archer', 'arrow'],
    ['cannon', 'cannonball'],
    ['catapult', 'stone'],
    ['spear', 'spear'],
    ['tank', 'shell'],
    ['helicopter', 'tracer'],
    ['bunker', 'rocket'],
    ['saber', 'wave'],
    ['laserGun', 'laser'],
  ];
  it.each(table)('%s -> %s', (role, kind) => expect(kindForRole(role)).toBe(kind));
  it('falls back to cannonball', () => {
    expect(kindForRole('')).toBe('cannonball');
    expect(kindForRole('dragon')).toBe('cannonball');
    expect(kindForRole('toString')).toBe('cannonball');
  });
  it('has team defaults', () => {
    expect(DEFAULT_KIND).toEqual({ PAST: 'cannonball', FUTURE: 'shell' });
  });
});

describe('headingDegrees', () => {
  it('is 0 for tiny paths and never NaN', () => {
    expect(headingDegrees([], 0)).toBe(0);
    expect(headingDegrees([{ x: 1, y: 1 }], 0)).toBe(0);
    expect(
      headingDegrees(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        0,
      ),
    ).toBe(0);
    const two = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(headingDegrees(two, 0)).toBe(0);
    expect(headingDegrees(two, 1)).toBe(0);
    expect(headingDegrees(two, 99)).toBe(0);
    expect(headingDegrees(two, -3)).toBe(0);
    expect(Number.isNaN(headingDegrees(two, Number.NaN))).toBe(false);
  });
  it('follows a straight path', () => {
    const down = [
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 0, y: 10 },
    ];
    expect(headingDegrees(down, 1)).toBeCloseTo(90);
    const diag = [
      { x: 0, y: 0 },
      { x: 5, y: -5 },
      { x: 10, y: -10 },
    ];
    expect(headingDegrees(diag, 0)).toBeCloseTo(-45);
    expect(headingDegrees(diag, 2)).toBeCloseTo(-45);
  });
  it('left-moving path points left', () => {
    const left = [
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(Math.abs(headingDegrees(left, 0))).toBeCloseTo(180);
  });
  it.each(['PAST', 'FUTURE'] as const)('follows a real arc for %s', (team) => {
    const r = simulateShot({
      angleDeg: 55,
      power: 70,
      origin: LAUNCH_ORIGINS[team],
      facing: TEAM_FACING[team],
      wind: 0,
      layout: PHASE1_LAYOUT,
    });
    const n = r.path.length;
    expect(n).toBeGreaterThan(10);
    // Mirror a left-flying path so "right" is always zero degrees.
    const norm = (i: number): number => {
      const h = (headingDegrees(r.path, i) * Math.PI) / 180;
      return (Math.atan2(Math.sin(h), team === 'PAST' ? Math.cos(h) : -Math.cos(h)) * 180) / Math.PI;
    };
    expect(norm(0)).toBeLessThan(-20);
    expect(norm(n - 1)).toBeGreaterThan(20);
    let top = 0;
    r.path.forEach((p, i) => {
      if (p.y < (r.path[top] as { y: number }).y) top = i;
    });
    expect(Math.abs(norm(top))).toBeLessThan(5);
    for (let i = 0; i < n; i++) expect(Number.isNaN(headingDegrees(r.path, i))).toBe(false);
    // Points right for Past, left for Future.
    const mid = headingDegrees(r.path, top);
    expect(team === 'PAST' ? Math.abs(mid) < 90 : Math.abs(mid) > 90).toBe(true);
  });
});

describe('drawing table and colors', () => {
  it('has a drawing for every kind', () => {
    for (const k of PROJECTILE_KINDS) expect(typeof DRAWINGS[k]).toBe('function');
    expect(Object.keys(DRAWINGS).sort()).toEqual([...PROJECTILE_KINDS].sort());
  });
  it('kindFlies is defined for every kind', () => {
    for (const k of PROJECTILE_KINDS) expect(typeof kindFlies(k)).toBe('boolean');
    expect(kindFlies('arrow')).toBe(true);
    expect(kindFlies('rocket')).toBe(true);
    expect(kindFlies('cannonball')).toBe(false);
  });
  it('uses only colors from visual.ts', () => {
    const src = readFileSync(join(process.cwd(), 'src/scenes/battle/projectiles.ts'), 'utf8');
    expect(src.match(/0x[0-9a-fA-F]{6}\b/g) ?? []).toEqual([]);
    expect(src).toContain("from './visual'");
  });
});
