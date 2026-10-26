// Words for "My shape", the drawing pad in the base builder. Plain English, kept apart from
// copy.ts so the builder and the Camp wording can change without touching each other.
import type { ShapeSaveRefusal } from '../game/baseBuilder';
import { BASE_BUILDER as B } from '../game/config';
import type { Material } from '../game/customShapes';
import type { NameProblem } from '../game/customWeapons';

export const SHAPE_COPY = {
  /** The last tile in the bar, which opens the pad. */
  ownTile: 'My shape',
  ownTileLabel: 'My shape. Draw a new shape.',
  pad: 'Make your own',
  padLabel: 'Make your own shape',
  grid: 'Drawing pad',
  help: 'Pick a material. Tap or drag squares to draw.',
  keys: 'Pad keys: arrows move between squares. Space fills a square with the material, or empties it. Enter saves the shape. Escape closes the pad.',
  material: 'Material',
  materials: {
    stone: 'Stone',
    wood: 'Wood',
    panel: 'Space Tile',
    metal: 'Metal',
    glass: 'Glass',
    jelly: 'Jelly',
  } as Record<Material, string>,
  materialLabel: (name: string, hp: number): string => `${name}, strength ${hp} a square`,
  square: (row: number, col: number, mat: string | null): string =>
    `Square row ${row} column ${col}, ${mat ?? 'empty'}`,
  count: (n: number): string => `${n} of ${B.maxShapeCells} squares`,
  strength: (hp: number): string => `Strength ${hp}`,
  preview: 'Your shape',
  name: 'Name',
  nameLabel: 'Shape name',
  /** Why a typed name is not used. The shape keeps the name the pad filled in. */
  nameProblem: {
    empty: '',
    long: 'That name is too long.',
    letters: 'Use only letters, numbers and spaces.',
    blocked: "Let's pick a friendlier name.",
    private: 'Use a made-up name, not a real one.',
    digits: 'Use fewer numbers in a row.',
  } as Record<NameProblem, string>,
  willUse: (name: string): string => `We will use ${name}.`,
  clear: 'Clear',
  clearLabel: 'Clear the pad',
  save: 'Save shape',
  close: 'Close',
  closeLabel: 'Close the pad',
  ok: 'Looks good. Tap Save shape.',
  saved: (name: string): string => `${name} saved! Drag it from the bar onto your base.`,
  problem: {
    empty: 'Tap squares to draw a shape.',
    apart: 'Squares must touch side to side.',
    big: `Too many squares. ${B.maxShapeCells} is the most.`,
    outside: 'Draw inside the pad.',
    material: 'Pick a material from the list.',
    duplicate: 'You already have this shape.',
    full: `You have ${B.maxShapes} shapes. Delete one first.`,
    noname: 'Pick a player name first.',
  } as Record<ShapeSaveRefusal, string>,
  /** A placed shape whose saved name is gone (it was deleted). */
  placedName: 'Your shape',
  deleteLabel: (name: string): string => `Delete ${name}`,
  deleteAsk: 'Delete?',
  deleteAskLabel: (name: string): string => `Delete ${name}? Bases that use it keep it.`,
  deleteYes: 'Yes',
  deleteYesLabel: (name: string): string => `Yes, delete ${name}`,
  deleteNo: 'No',
  deleteNoLabel: (name: string): string => `No, keep ${name}`,
  deleted: (name: string): string => `${name} deleted. Bases that use it keep it.`,
} as const;
