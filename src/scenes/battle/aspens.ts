// The battle backdrop's aspen forest: pale trunks with dark marks and clumps of golden leaves, in
// two depth layers. It is muted on purpose (a night forest behind the fight, never competing with
// the fighters or the controls). Pure geometry from a fixed seed, so it is the same every time and
// easy to test. BattleScene's backdrop draws it.
import { createRng } from '../../game/rng';

export type AspenTree = {
  x: number;
  /** Trunk width. */
  w: number;
  /** Where the leaves start. */
  top: number;
  /** Where the trunk meets the ground. */
  bottom: number;
  /** Leaf clumps, in world pixels. */
  leaves: ReadonlyArray<{ x: number; y: number; r: number }>;
  /** Dark bark marks as y positions along the trunk. */
  marks: readonly number[];
};

export type AspenLayer = {
  trees: readonly AspenTree[];
  /** How see-through the trunks and leaves are. Far trees are fainter. */
  alpha: number;
};

const SEED = 0x41535045; // "ASPE"

/** Both layers for a world `width` wide whose ground starts at `horizon`. Far first, near second. */
export function aspenLayers(width: number, horizon: number): [AspenLayer, AspenLayer] {
  const rng = createRng(SEED);
  const make = (count: number, trunk: number, topMin: number, topMax: number): AspenTree[] =>
    Array.from({ length: count }, (_, i) => {
      // Spread evenly with a little wobble, so it never looks like a picket fence.
      const x = ((i + 0.5) / count) * width + (rng.next() - 0.5) * (width / count) * 0.6;
      const top = horizon - topMin - rng.next() * (topMax - topMin);
      const bottom = horizon - 14;
      const clumps = 4 + Math.floor(rng.next() * 3);
      const leaves = Array.from({ length: clumps }, () => ({
        x: x + (rng.next() - 0.5) * trunk * 9,
        y: top + (rng.next() - 0.35) * trunk * 6,
        r: trunk * (2.2 + rng.next() * 2.2),
      }));
      const marks: number[] = [];
      for (let y = top + 24; y < bottom - 6; y += 18 + rng.next() * 22) marks.push(y);
      return { x, w: trunk, top, bottom, leaves, marks };
    });
  return [
    { trees: make(22, 5, 150, 250), alpha: 0.32 },
    { trees: make(13, 8, 190, 300), alpha: 0.5 },
  ];
}
