// The pure plan behind a built base on the battlefield (src/scenes/battle/basePlan.ts).
import { describe, expect, it } from 'vitest';
import { PHASE1_LAYOUT, WORLD } from '../../../src/game/config';
import { createMatch } from '../../../src/game/match';
import type { Match, Players, Team } from '../../../src/game/types';
import {
  CRUMBLE_MAX_DELAY_MS,
  brickSprites,
  brickWear,
  crackLines,
  crumblePlan,
  dustPuffs,
  padFlash,
  padRing,
  padSprites,
  stepPxOf,
} from '../../../src/scenes/battle/basePlan';
import { ART, NO_TINT, TEAM_COLOR } from '../../../src/scenes/battle/visual';
import { brickSvg, weaponPadSvg } from '../../../src/ui/baseBuilderArt';
import { HUGE, TINY, TYPICAL, brick } from '../../helpers/builtBases';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'math' },
];

const snapWith = (team: Team, base = TYPICAL(team)): Match =>
  createMatch({
    players: PLAYERS,
    seed: 1,
    disturbances: false,
    characterHealth: false,
    baseInBattle: true,
    bases: { [team]: base },
  }).snapshot();

describe('brick pictures come from the builder', () => {
  it('brickSvg draws the builder piece at the asked size, and nothing for an unknown piece', () => {
    const svg = brickSvg('stone', 0, 64, 32);
    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="32"');
    expect(svg).toContain('viewBox="0 0 80 40"');
    expect(brickSvg('nope', 0, 10, 10)).toBe('');
  });

  it('a turned brick swaps its picture box', () => {
    expect(brickSvg('tower', 90, 32, 16)).toContain('viewBox="0 0 80 40"');
  });

  it('a weapon pad is a whole picture', () => {
    expect(weaponPadSvg('cannon', 40)).toMatch(/^<svg[^>]*width="40"/);
  });

  for (const team of ['PAST', 'FUTURE'] as const) {
    for (const [name, base] of [
      ['tiny', TINY(team)],
      ['typical', TYPICAL(team)],
      ['huge', HUGE(team)],
    ] as const) {
      it(`${team} ${name}: one sprite a brick, centered on its box, inside the base footprint`, () => {
        const s = snapWith(team, base);
        const sprites = brickSprites(team, s.bricks!);
        expect(sprites).toHaveLength(base.pieces.length);
        const box = PHASE1_LAYOUT.bases[team];
        for (const sp of sprites) {
          expect(sp.flip).toBe(team === 'FUTURE');
          expect(sp.x - sp.w / 2).toBeGreaterThanOrEqual(box.x - 1e-6);
          expect(sp.x + sp.w / 2).toBeLessThanOrEqual(box.x + box.w + 1e-6);
          expect(sp.y + sp.h / 2).toBeLessThanOrEqual(box.y + box.h + 1e-6);
          expect(sp.svg.startsWith('<svg')).toBe(true);
        }
        // The other team's bricks are never drawn on this side.
        expect(brickSprites(team === 'PAST' ? 'FUTURE' : 'PAST', s.bricks!)).toEqual([]);
      });
    }
  }

  it('reads the build scale from the bricks', () => {
    const s = snapWith('PAST', TINY('PAST'));
    expect(stepPxOf('PAST', s.bricks!)).toBeCloseTo(2, 6);
  });

  it('draws only pads with a weapon, sized with the bricks', () => {
    const pads = padSprites(
      [
        { index: 0, x: 100, y: 500, weapon: 'cannon', brick: 'PAST:0' },
        { index: 1, x: 140, y: 500, weapon: null, brick: null },
      ],
      2,
    );
    expect(pads).toHaveLength(1);
    expect(pads[0]).toMatchObject({ index: 0, size: 20, brick: 'PAST:0' });
  });

  it('a weapon of your own is drawn with the picture of its style', () => {
    const [pad] = padSprites(
      [{ index: 2, x: 100, y: 500, weapon: 'custom:P:1', brick: null, art: 'catapult' }],
      2,
    );
    expect(pad!.svg).toBe(weaponPadSvg('catapult', pad!.size * 2));
    expect(pad!.key).toContain('catapult');
  });
});

describe('weapon pads in battle', () => {
  it('the pick ring sits round the pad, a little bigger, in the team color', () => {
    const ring = padRing({ x: 100, y: 500, size: 20 }, 'FUTURE');
    expect(ring).toMatchObject({ x: 100, y: 500, color: TEAM_COLOR.FUTURE });
    expect(ring.r).toBeGreaterThan(10);
    expect(ring.width).toBeGreaterThanOrEqual(3);
  });

  it('the fire flash grows and fades; with reduced motion it only blinks in place', () => {
    const full = padFlash(20, false);
    expect(full.toScale).toBeGreaterThan(1);
    expect(full.ms).toBeGreaterThan(0);
    const calm = padFlash(20, true);
    expect(calm.toScale).toBe(1);
    expect(calm.ms).toBeLessThanOrEqual(full.ms);
  });
});

describe('wear', () => {
  it('full health is untouched; hurt bricks get darker and show cracks (not color alone)', () => {
    expect(brickWear(30, 30)).toEqual({ tint: NO_TINT, cracks: 0 });
    expect(brickWear(15, 30)).toEqual({ tint: ART.brickWorn, cracks: 1 });
    expect(brickWear(5, 30)).toEqual({ tint: ART.brickWornMore, cracks: 2 });
  });

  it('cracks stay inside the brick', () => {
    const box = { x: 10, y: 20, w: 40, h: 16 };
    for (const [x1, y1, x2, y2] of crackLines(box, 2)) {
      for (const [x, y] of [
        [x1, y1],
        [x2, y2],
      ] as const) {
        expect(x).toBeGreaterThanOrEqual(box.x);
        expect(x).toBeLessThanOrEqual(box.x + box.w);
        expect(y).toBeGreaterThanOrEqual(box.y);
        expect(y).toBeLessThanOrEqual(box.y + box.h);
      }
    }
  });
});

describe('the crumble', () => {
  const box = { x: 100, y: 480, w: 32, h: 16 };
  const ground = 620;

  it('lands on the ground, drifts back from the enemy and stays on screen', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      for (let order = 0; order < 30; order++) {
        const p = crumblePlan(team, box, ground, order, false);
        expect(box.y + box.h + p.dy).toBeCloseTo(ground, 6);
        expect(Math.sign(p.dx)).toBe(team === 'PAST' ? -1 : 1);
        expect(box.x + p.dx).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w + p.dx).toBeLessThanOrEqual(WORLD.width);
        expect(Math.abs(p.angle)).toBeLessThanOrEqual(90);
        expect(p.delayMs).toBeLessThanOrEqual(CRUMBLE_MAX_DELAY_MS);
        expect(p.fadeMs).toBeGreaterThan(0);
      }
    }
  });

  it('is the same every time (no randomness)', () => {
    expect(crumblePlan('PAST', box, ground, 3, false)).toEqual(
      crumblePlan('PAST', box, ground, 3, false),
    );
    expect(dustPuffs(box, 2)).toEqual(dustPuffs(box, 2));
  });

  it('with reduced motion: no move, no spin, only a short fade', () => {
    expect(crumblePlan('FUTURE', box, ground, 5, true)).toMatchObject({
      dx: 0,
      dy: 0,
      angle: 0,
      durationMs: 0,
    });
  });

  it('dust puffs sit around the brick', () => {
    for (const p of dustPuffs(box, 0)) {
      expect(Math.abs(p.x - (box.x + box.w / 2))).toBeLessThanOrEqual(box.w);
      expect(p.r).toBeGreaterThan(0);
    }
  });
});

it('a brick of your own draws its own squares', () => {
  const s = snapWith('PAST', {
    pieces: [brick('own:P:w1', 4, 10, 13)],
    spots: [],
  });
  const sprites = brickSprites('PAST', s.bricks!);
  expect(sprites).toHaveLength(1);
  expect(sprites[0]!.svg).toContain('stroke-dasharray');
});
