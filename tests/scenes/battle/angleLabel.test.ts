// The angle number ("45°") by the aim guide never sits on a fighter: not its body, not its
// letter tag, not the arrow over the tag. Checked for every fighter that can aim, on every
// castle place, every base spot and every biome, at every angle, at the largest label size
// (a 1024px wide screen grows canvas text to keep it at 20px or more).
import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../../src/game/battlefield';
import {
  AIM,
  BIOME_IDS,
  FORT_IDS,
  PHASE1_LAYOUT,
  SPOT_IDS,
  TEAM_FACING,
} from '../../../src/game/config';
import { UNITS, firingOrigin } from '../../../src/game/units';
import type { FortIdValue, Rect, SpotIdValue, Vec2 } from '../../../src/game/types';
import {
  ANGLE_LABEL_MAX,
  angleLabelBox,
  fighterKeepOut,
  type LabelSize,
} from '../../../src/scenes/battle/angleLabel';
import { guideTip } from '../../../src/scenes/battle/geometry';
import { TEXT_ROLES } from '../../../src/scenes/battle/textStyle';
import { unitSpot } from '../../../src/scenes/battle/unitSpots';
import { worldFontPx } from '../../../src/scenes/battle/textScale';

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const SPOTS: Array<SpotIdValue | null> = [null, ...SPOT_IDS];
const FORTS: Array<FortIdValue | null> = [null, ...FORT_IDS];
/** The label at a 1280 wide screen (28px) and the largest it grows to (the 1024 wide screen). */
const SIZES: LabelSize[] = [{ w: 90, h: 48 }, ANGLE_LABEL_MAX];

describe('the largest label size covers the real text', () => {
  it('ANGLE_LABEL_MAX holds the 35px readout of a 1024 wide screen with its padding', () => {
    const px = worldFontPx(TEXT_ROLES.readoutPast.basePx, 1024, 1280);
    expect(px).toBeGreaterThanOrEqual(20);
    // Chromium measured "45°" at 94x51 world px on a 1024 wide screen (e2e/phase2.spec.ts checks it).
    expect(ANGLE_LABEL_MAX.w).toBeGreaterThanOrEqual(94);
    expect(ANGLE_LABEL_MAX.h).toBeGreaterThanOrEqual(51);
  });
});

describe('fighterKeepOut', () => {
  it('holds each fighter body and its tag with the arrow above, moved with its base', () => {
    const l = buildLayout({ biome: 'aspen', spot: 'bridge', fort: 'hillFort' });
    const boxes = fighterKeepOut(l);
    expect(boxes).toHaveLength(UNITS.length * 2);
    const a = unitSpot(UNITS.find((u) => u.id === 'A')!);
    // Balloon A does not ride the castle, so it stays put.
    expect(boxes).toContainEqual(a.box);
    // Cannon Knight C rides the castle up the hill.
    const c = unitSpot(UNITS.find((u) => u.id === 'C')!);
    const shift = l.baseShift!.PAST!;
    expect(boxes).toContainEqual({ ...c.box, x: c.box.x + shift.x, y: c.box.y + shift.y });
  });
});

describe('angleLabelBox', () => {
  it('sits just past the tip when nothing is in the way', () => {
    const o: Vec2 = { x: 640, y: 300 };
    for (const facing of [1, -1] as const) {
      const box = angleLabelBox(o, 45, facing, SIZES[0]!, [], PHASE1_LAYOUT);
      const tip = guideTip(o, 45, facing);
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      expect(Math.sign(cx - tip.x)).toBe(facing);
      expect(Math.hypot(cx - tip.x, cy - tip.y)).toBeLessThan(70);
    }
  });

  it('Hill Fort, Cannon Knight at 45°: the number is off Balloon A (the panel case)', () => {
    const l = buildLayout({ biome: 'aspen', spot: 'skyscraper', fort: 'hillFort' });
    const keep = fighterKeepOut(l);
    const o = firingOrigin('PAST', 'C', l);
    const box = angleLabelBox(o, 45, 1, ANGLE_LABEL_MAX, keep, l);
    const a = unitSpot(UNITS.find((u) => u.id === 'A')!);
    expect(overlaps(box, a.box)).toBe(false);
    for (const k of keep) expect(overlaps(box, k)).toBe(false);
  });

  it('keeps its size and stays inside the world', () => {
    const box = angleLabelBox({ x: 1270, y: 10 }, 90, 1, ANGLE_LABEL_MAX, [], PHASE1_LAYOUT);
    expect(box.w).toBe(ANGLE_LABEL_MAX.w);
    expect(box.h).toBe(ANGLE_LABEL_MAX.h);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.w).toBeLessThanOrEqual(PHASE1_LAYOUT.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
  });

  it('never covers the guide line or its handle', () => {
    const o: Vec2 = { x: 400, y: 400 };
    for (let angle = AIM.angleMinDeg; angle <= AIM.angleMaxDeg; angle += 5) {
      const box = angleLabelBox(o, angle, 1, ANGLE_LABEL_MAX, [], PHASE1_LAYOUT);
      const tip = guideTip(o, angle, 1);
      for (let t = 0; t <= 1; t += 0.05) {
        const p = { x: o.x + (tip.x - o.x) * t, y: o.y + (tip.y - o.y) * t };
        const inside = p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;
        expect(inside, `${angle}° t=${t}`).toBe(false);
      }
    }
  });

  it('Drawbridge, Cannon Knight at 45°: a clear spot close by keeps the number off the deck', () => {
    const l = buildLayout({ biome: 'aspen', spot: 'bridge', fort: 'drawbridge' });
    const o = firingOrigin('PAST', 'C', l);
    const box = angleLabelBox(o, 45, 1, ANGLE_LABEL_MAX, fighterKeepOut(l), l);
    const deck = l.terrain.obstacles[2]!;
    const deckBox: Rect = { x: deck[0]!.x, y: deck[0]!.y, w: 160, h: 50 };
    expect(overlaps(box, deckBox)).toBe(false);
  });

  it('ignores bad numbers without throwing', () => {
    const box = angleLabelBox({ x: NaN, y: NaN }, NaN, 1, ANGLE_LABEL_MAX, [], PHASE1_LAYOUT);
    expect(Number.isFinite(box.x) && Number.isFinite(box.y)).toBe(true);
  });

  for (const biome of BIOME_IDS)
    for (const fort of FORTS)
      it(`${biome}, castle ${fort}: every fighter, every spot, every angle, the number is off every fighter`, () => {
        // Gather every miss and check once: one expect per case would be about 150,000 calls.
        const misses: string[] = [];
        let cases = 0;
        for (const spot of SPOTS) {
          const l = buildLayout({ biome, spot, fort });
          const keep = fighterKeepOut(l);
          const ground = l.terrain.ground[0]!.y;
          for (const u of UNITS) {
            const o = firingOrigin(u.team, u.id, l);
            const facing = TEAM_FACING[u.team];
            for (const size of SIZES)
              for (let angle = AIM.angleMinDeg; angle <= AIM.angleMaxDeg; angle += 1) {
                cases++;
                const box = angleLabelBox(o, angle, facing, size, keep, l);
                const where = `${spot} ${u.id} ${angle}° ${size.w}x${size.h}`;
                const hit = keep.findIndex((k) => overlaps(box, k));
                if (hit >= 0) misses.push(`${where}: covers fighter box ${hit}`);
                if (box.x < 0 || box.x + box.w > l.width || box.y < 0 || box.y + box.h > ground)
                  misses.push(`${where}: outside the world or below the ground`);
              }
          }
        }
        expect(cases).toBe(SPOTS.length * UNITS.length * SIZES.length * 91);
        expect(misses).toEqual([]);
      });
});
