// Sample built bases for tests: the smallest, a typical and the biggest a player can build.
import { resolveSpots, type Placed, type Rotation } from '../../src/game/baseBuilder';
import type { CustomWeapon } from '../../src/game/customWeapons';
import type { ChosenBase, Team } from '../../src/game/types';

export const brick = (
  piece: string,
  x: number,
  y: number,
  hp: number,
  rot: Rotation = 0,
): Placed => ({ piece, x, y, ox: 0, oy: 0, rot, hp });

export const baseOf = (pieces: Placed[]): ChosenBase => ({ pieces, spots: [] });

/** The smallest base: one plank (or solar panel) on the foundation. */
export const TINY = (team: Team): ChosenBase =>
  baseOf([brick(team === 'PAST' ? 'plank' : 'solar', 10, 10, team === 'PAST' ? 10 : 20)]);

/** A typical base: four bricks on the ground, two on top, and a tower (or antenna). */
export const TYPICAL = (team: Team): ChosenBase => {
  const b = team === 'PAST' ? 'stone' : 'panel';
  const t = team === 'PAST' ? 'tower' : 'antenna';
  return baseOf([
    brick(b, 6, 10, 20),
    brick(b, 8, 10, 20),
    brick(b, 10, 10, 20),
    brick(b, 12, 10, 20),
    brick(b, 8, 9, 20),
    brick(b, 10, 9, 20),
    brick(t, 9, 7, team === 'PAST' ? 35 : 10),
  ]);
};

/** The biggest base: 60 gates (or hangar doors), five layers across the whole plot. */
export const HUGE = (team: Team): ChosenBase => {
  const id = team === 'PAST' ? 'gate' : 'hangarDoor';
  const pieces: Placed[] = [];
  for (const y of [9, 7, 5, 3, 1]) for (let x = 0; x < 24; x += 2) pieces.push(brick(id, x, y, 50));
  return baseOf(pieces);
};

export const SIZES = { tiny: TINY, typical: TYPICAL, huge: HUGE } as const;

/**
 * A base with weapons on its pads, placed the way the builder places them (`resolveSpots`). Each
 * entry is a catalog weapon id, a Workshop weapon of your own, or null for an empty pad.
 */
export const armed = (
  base: ChosenBase,
  weapons: ReadonlyArray<string | CustomWeapon | null>,
): ChosenBase => ({
  pieces: base.pieces,
  spots: resolveSpots(
    base.pieces,
    weapons.map((w) =>
      w === null ? {} : typeof w === 'string' ? { weapon: w } : { weapon: w.id, mine: w },
    ),
  ),
});

/** The strongest weapons each side can mount, four of them (the pace test uses these). */
export const STRONGEST: Record<Team, readonly string[]> = {
  PAST: ['ballista', 'catapult', 'ballista', 'archerPost'],
  FUTURE: ['missilePod', 'laser', 'turret', 'missilePod'],
};
