// @vitest-environment jsdom
// The message lane (coach line, first-go hint, caption bar) never covers a fighter, a base (and so
// no built-base brick), the wind sign, the team cards or the control bar. Checked on every field
// (biome, base spot, castle place) and at every supported landscape size.
import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../src/game/battlefield';
import { BATTLE_BAND, BIOME_IDS, FORT_IDS, SPOT_IDS, TERRAIN, WORLD } from '../../src/game/config';
import { dasherBox, dasherHomePoint } from '../../src/game/crew';
import type { FortIdValue, Rect, SpotIdValue } from '../../src/game/types';
import { fitLayout } from '../../src/game/builtBase';
import { RIDER_IDS, riderDrop, riderFeet } from '../../src/game/riders';
import { unitById } from '../../src/game/units';
import { fighterKeepOut } from '../../src/scenes/battle/angleLabel';
import { characterSpot } from '../../src/scenes/battle/geometry';
import { TEXT_ROLES } from '../../src/scenes/battle/textStyle';
import { worldFontPx } from '../../src/scenes/battle/textScale';
import { chronoBox } from '../../src/scenes/battle/unitSpots';
import { WIND_SIGN } from '../../src/scenes/battle/visual';
import {
  MESSAGE_LANE,
  fitCanvas,
  laneOnScreen,
  placeLane,
  clearLane,
} from '../../src/ui/messageLane';

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const SPOTS: Array<SpotIdValue | null> = [null, ...SPOT_IDS];
const FORTS: Array<FortIdValue | null> = [null, ...FORT_IDS];
const FIELDS = BIOME_IDS.flatMap((biome) =>
  SPOTS.flatMap((spot) => FORTS.map((fort) => ({ biome, spot, fort }))),
);

/** iPad landscape (1024x768), iPad mini (1133x744), laptop (1280x800), iPad Pro 13in. */
const SCREENS = [
  { width: 1024, height: 768 },
  { width: 1133, height: 744 },
  { width: 1280, height: 800 },
  { width: 1376, height: 1032 },
];
/** The team cards end this far down the screen (12px gap plus a 98px card, measured). */
const CARDS_BOTTOM_PX = 110;

describe('the message lane on the field', () => {
  it('clears every fighter, its letter tag and the arrow over it, on every field', () => {
    for (const plan of FIELDS) {
      const l = buildLayout(plan);
      for (const k of fighterKeepOut(l)) {
        expect(overlaps(MESSAGE_LANE, k), `${JSON.stringify(plan)} ${JSON.stringify(k)}`).toBe(
          false,
        );
      }
    }
  });

  it('clears every fighter standing anywhere on a built base, down to the ground under it', () => {
    // A fighter on a built base stands on its top brick (riders.ts): anywhere from the old castle
    // spot down to the ground. Sweep the whole way on every field.
    for (const plan of FIELDS) {
      const l = buildLayout(plan);
      for (const share of [0.25, 0.5, 0.75, 1]) {
        const drops = Object.fromEntries(
          RIDER_IDS.map((id) => [id, share * riderDrop(unitById(id)!.team, id, l, [])]),
        );
        for (const k of fighterKeepOut(l, drops)) {
          expect(overlaps(MESSAGE_LANE, k), `${JSON.stringify(plan)} ${share}`).toBe(false);
        }
      }
    }
  });

  it('clears both bases, so no built-base brick (fitted inside the base box) is covered', () => {
    for (const plan of FIELDS) {
      const l = buildLayout(plan);
      for (const team of ['PAST', 'FUTURE'] as const) {
        expect(overlaps(MESSAGE_LANE, l.bases[team]), `${JSON.stringify(plan)} ${team}`).toBe(
          false,
        );
      }
    }
  });

  it('clears the room of a built base, Chrono and the helpers, and a fighter standing as high as the room, on every field', () => {
    // Built bases are drawn big (owner report, 2026-10-28). The base fills the room of its place
    // (BUILT_PLACES), and a fighter stands on the top brick, at most as high as the room's top.
    for (const plan of FIELDS) {
      const l = fitLayout(buildLayout(plan), { PAST: true, FUTURE: true });
      const id = JSON.stringify(plan);
      const drops: Record<string, number> = {};
      for (const team of ['PAST', 'FUTURE'] as const) {
        const room = l.bases[team];
        expect(overlaps(MESSAGE_LANE, room), `${id} ${team} room`).toBe(false);
        expect(overlaps(MESSAGE_LANE, chronoBox(characterSpot(team, l))), `${id} Chrono`).toBe(
          false,
        );
        expect(dasherHomePoint(team, l).y).toBeGreaterThan(MESSAGE_LANE.y + MESSAGE_LANE.h);
        for (const rider of RIDER_IDS) {
          if (unitById(rider)!.team !== team) continue;
          const feet = riderFeet(team, rider, l)!;
          const top = {
            team,
            box: { x: feet.left - 5, y: room.y, w: feet.right - feet.left + 10, h: 50 },
            alive: true,
          };
          drops[rider] = riderDrop(team, rider, l, [top]);
        }
      }
      for (const spot of ['g0', 'g1', 'g2', 'g3', 'g4']) {
        expect(overlaps(MESSAGE_LANE, dasherBox(spot, l)), `${id} ${spot}`).toBe(false);
      }
      for (const k of fighterKeepOut(l, drops)) {
        expect(overlaps(MESSAGE_LANE, k), `${id} ${JSON.stringify(k)}`).toBe(false);
      }
    }
  });

  it('clears Chrono and the walking helpers at home and on every ground spot', () => {
    for (const plan of FIELDS) {
      const l = buildLayout(plan);
      for (const team of ['PAST', 'FUTURE'] as const) {
        expect(overlaps(MESSAGE_LANE, chronoBox(characterSpot(team, l)))).toBe(false);
        const home = dasherHomePoint(team, l);
        expect(home.y).toBeGreaterThan(MESSAGE_LANE.y + MESSAGE_LANE.h);
      }
      for (const spot of ['g0', 'g1', 'g2', 'g3', 'g4']) {
        expect(overlaps(MESSAGE_LANE, dasherBox(spot, l)), `${spot}`).toBe(false);
      }
    }
  });

  it('sits wholly above the ground line, so it never reaches the control band', () => {
    expect(MESSAGE_LANE.y + MESSAGE_LANE.h).toBeLessThan(TERRAIN.groundY);
    expect(MESSAGE_LANE.x).toBeGreaterThanOrEqual(0);
    expect(MESSAGE_LANE.x + MESSAGE_LANE.w).toBeLessThanOrEqual(WORLD.width);
  });

  it('starts under the wind sign, even with the sign words grown for a 768px wide window', () => {
    const font = worldFontPx(TEXT_ROLES.hud.basePx, 768, WORLD.width);
    // Words start 22px under the arrow; a line is about 1.3 font sizes tall; 8px frame padding
    // and a 4px frame line close it.
    const signBottom = WIND_SIGN.y + 22 + font * 1.3 + 8 + 4;
    expect(MESSAGE_LANE.y).toBeGreaterThan(signBottom);
  });

  it('is centered across the field', () => {
    expect(MESSAGE_LANE.x + MESSAGE_LANE.w / 2).toBe(WORLD.width / 2);
  });
});

describe('the message lane on screen', () => {
  it('sits under the team cards and above the control bar at every supported size', () => {
    for (const s of SCREENS) {
      const canvas = fitCanvas(s);
      const lane = laneOnScreen(canvas);
      const k = canvas.width / WORLD.width;
      expect(lane.top, `${s.width}x${s.height}`).toBeGreaterThan(CARDS_BOTTOM_PX);
      // The control bar fills the band under the field (BATTLE_BAND), below the ground line.
      const groundPx = canvas.top + TERRAIN.groundY * k;
      expect(lane.top + lane.height).toBeLessThan(groundPx);
      expect(canvas.height).toBeCloseTo((WORLD.height + BATTLE_BAND) * k, 5);
    }
  });

  it('is wide and tall enough for a long caption at the 20px floor on the smallest screen', () => {
    const lane = laneOnScreen(fitCanvas({ width: 1024, height: 768 }));
    // Two lines of about 40 characters each, with padding, at 20px and more.
    expect(lane.width).toBeGreaterThanOrEqual(440);
    expect(lane.height).toBeGreaterThanOrEqual(120);
  });

  it('fits a canvas that is limited by height (centered across) or by width', () => {
    expect(fitCanvas({ width: 1280, height: 800 })).toEqual({
      left: (1280 - 800 * (1280 / 920)) / 2,
      top: 0,
      width: 800 * (1280 / 920),
      height: 800,
    });
    const w = fitCanvas({ width: 1024, height: 768 });
    expect(w.left).toBe(0);
    expect(w.width).toBe(1024);
  });

  it('maps world px to screen px with the canvas scale and offset', () => {
    const lane = laneOnScreen({ left: 100, top: 40, width: 640, height: 460 });
    expect(lane).toEqual({
      left: 100 + MESSAGE_LANE.x / 2,
      top: 40 + MESSAGE_LANE.y / 2,
      width: MESSAGE_LANE.w / 2,
      height: MESSAGE_LANE.h / 2,
    });
  });
});

describe('placeLane and clearLane', () => {
  it('writes the lane box from the measured canvas, and takes it away again', () => {
    document.body.innerHTML = '<div id="game"><canvas></canvas></div>';
    const canvas = document.querySelector('canvas')!;
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 1024,
        height: 736,
        x: 0,
        y: 0,
        right: 1024,
        bottom: 736,
      }) as DOMRect;
    placeLane(document);
    const st = document.documentElement.style;
    const px = (name: string): number => parseFloat(st.getPropertyValue(name));
    expect(px('--tc-lane-left')).toBeCloseTo(MESSAGE_LANE.x * 0.8, 1);
    expect(px('--tc-lane-top')).toBeCloseTo(MESSAGE_LANE.y * 0.8, 1);
    expect(px('--tc-lane-width')).toBeCloseTo(MESSAGE_LANE.w * 0.8, 1);
    expect(px('--tc-lane-height')).toBeCloseTo(MESSAGE_LANE.h * 0.8, 1);
    clearLane(document);
    expect(st.getPropertyValue('--tc-lane-top')).toBe('');
    document.body.innerHTML = '';
  });

  it('falls back to the fitted window size when the canvas is not drawn yet', () => {
    document.body.innerHTML = '';
    placeLane(document);
    const want = laneOnScreen(fitCanvas({ width: window.innerWidth, height: window.innerHeight }));
    expect(
      parseFloat(document.documentElement.style.getPropertyValue('--tc-lane-top')),
    ).toBeCloseTo(want.top, 0);
    clearLane(document);
  });
});
