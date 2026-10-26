// Where Build Base's weapon list goes in Weapons mode, so it never covers a pad. Pure: it takes
// boxes in screen pixels and returns a place. The list goes beside the plot on the side away
// from the picked pad when that side has room for the two-column list. If only the other side has
// room, it goes there (it still covers no pad). With no room on either side (the usual row of pads
// across the middle), it is a bottom sheet under the plot. tests/ui/weaponListPlace.test.ts.

export type Rect = { left: number; top: number; right: number; bottom: number };
export type Side = 'left' | 'right';
export type ListPlace = Side | 'sheet';

/** Width of the list beside the plot: two columns of 56px tiles with 20px words. */
export const SIDE_LIST_PX = 420;
/** Air between the list and the plot's edge, and between the list and the nearest pad. */
export const LIST_GAP_PX = 12;

/** Free width on one side of the plot area, from its edge to the nearest pad, less the gaps. */
export function roomBeside(side: Side, area: Rect, pads: readonly Rect[]): number {
  const width = area.right - area.left;
  if (width <= 0) return 0;
  if (pads.length === 0) return width - 2 * LIST_GAP_PX;
  return side === 'right'
    ? area.right - Math.max(...pads.map((p) => p.right)) - 2 * LIST_GAP_PX
    : Math.min(...pads.map((p) => p.left)) - area.left - 2 * LIST_GAP_PX;
}

/**
 * The list's place for this picked pad (0-based). `pads` are all the pads' tap areas and `area` is
 * the box the side list sits in. The side away from the picked pad is tried first.
 */
export function weaponListPlace(
  area: Rect,
  pads: readonly Rect[],
  picked: number,
  width = SIDE_LIST_PX,
): ListPlace {
  const pad = pads[picked];
  const middle = (area.left + area.right) / 2;
  const away: Side = pad && (pad.left + pad.right) / 2 > middle ? 'left' : 'right';
  const near: Side = away === 'left' ? 'right' : 'left';
  for (const side of [away, near]) if (roomBeside(side, area, pads) >= width) return side;
  return 'sheet';
}
