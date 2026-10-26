// Where Build Base's weapon list goes in Weapons mode: beside the plot on the side away from the
// picked pad when that side has room for the two-column list, the other side if only it has room,
// and a bottom sheet under the plot when neither side has room. No pad is ever covered.
import { describe, expect, it } from 'vitest';
import {
  LIST_GAP_PX,
  SIDE_LIST_PX,
  roomBeside,
  weaponListPlace,
  type Rect,
} from '../../src/ui/weaponListPlace';

const rect = (left: number, top: number, w: number, h: number): Rect => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});
/** A plot area 1000 wide. */
const AREA = rect(0, 0, 1000, 500);
/** Four 60px pads in a row from `from`, 100px apart. */
const row = (from: number): Rect[] => [0, 1, 2, 3].map((i) => rect(from + i * 100, 400, 60, 60));
const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('roomBeside', () => {
  it('measures from the area edge to the nearest pad on that side, less a gap each end', () => {
    const pads = row(300); // 300 to 660
    expect(roomBeside('left', AREA, pads)).toBe(300 - 2 * LIST_GAP_PX);
    expect(roomBeside('right', AREA, pads)).toBe(1000 - 660 - 2 * LIST_GAP_PX);
  });
  it('is the whole area with no pads, and none for an area with no size (no layout yet)', () => {
    expect(roomBeside('left', AREA, [])).toBe(1000 - 2 * LIST_GAP_PX);
    expect(roomBeside('right', rect(0, 0, 0, 0), row(0))).toBe(0);
  });
});

describe('weaponListPlace', () => {
  it('pads bunched on the left: the list goes right, for every picked pad', () => {
    const pads = row(20);
    for (const picked of [0, 1, 2, 3]) expect(weaponListPlace(AREA, pads, picked)).toBe('right');
  });
  it('pads bunched on the right: the list goes left, for every picked pad', () => {
    const pads = row(540);
    for (const picked of [0, 1, 2, 3]) expect(weaponListPlace(AREA, pads, picked)).toBe('left');
  });
  it('both sides have room: the side away from the picked pad wins', () => {
    const wide = rect(0, 0, 2000, 500);
    const pads = row(850); // 850 to 1210, room on both sides
    expect(weaponListPlace(wide, pads, 0)).toBe('right');
    expect(weaponListPlace(wide, pads, 1)).toBe('right');
    expect(weaponListPlace(wide, pads, 2)).toBe('left');
    expect(weaponListPlace(wide, pads, 3)).toBe('left');
  });
  it('only the near side has room: it is used, since it still covers no pad', () => {
    const pads = [rect(450, 400, 60, 60), ...row(600).slice(0, 3)];
    // Pad 1 sits left, so away is right, but pads 2 to 4 leave no room there.
    expect(weaponListPlace(AREA, pads, 0)).toBe('left');
  });
  it('pads across the middle (the default row): neither side has room, so a bottom sheet', () => {
    // The real 1024x768 numbers: plot 216 to 836, pads 382 to 670.
    const area = { left: 216, top: 88, right: 836, bottom: 548 };
    const pads = [382, 458, 534, 610].map((x) => rect(x, 327, 60, 60));
    for (const picked of [0, 1, 2, 3]) expect(weaponListPlace(area, pads, picked)).toBe('sheet');
  });
  it('no layout yet (jsdom, a hidden screen): a bottom sheet, never a guess that covers', () => {
    expect(weaponListPlace(rect(0, 0, 0, 0), row(0), 0)).toBe('sheet');
  });
  it('a side list never covers any pad', () => {
    for (let from = 0; from <= 640; from += 20) {
      const pads = row(from);
      for (const picked of [0, 1, 2, 3]) {
        const place = weaponListPlace(AREA, pads, picked);
        if (place === 'sheet') continue;
        const list =
          place === 'left'
            ? rect(AREA.left + LIST_GAP_PX, 0, SIDE_LIST_PX, 500)
            : rect(AREA.right - LIST_GAP_PX - SIDE_LIST_PX, 0, SIDE_LIST_PX, 500);
        for (const pad of pads) expect(overlaps(list, pad)).toBe(false);
      }
    }
  });
  it('a narrower list fits where the usual one does not', () => {
    const pads = row(300);
    expect(weaponListPlace(AREA, pads, 3)).toBe('sheet');
    expect(weaponListPlace(AREA, pads, 3, 250)).toBe('left');
  });
});
