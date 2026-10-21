// Words for "Make your own", the shape pad in the base builder. Plain English, kept apart from
// copy.ts so the builder and the Camp wording can change without touching each other.
import type { ShapeSaveRefusal } from '../game/baseBuilder';
import { BASE_BUILDER as B } from '../game/config';

export const SHAPE_COPY = {
  /** The tray tile that opens the pad. */
  ownTile: 'My own shape',
  ownTileLabel: 'My own shape. Opens the drawing pad.',
  group: 'My shapes',
  newSlot: 'Draw a new shape',
  pad: 'Make your own',
  padLabel: 'Make your own shape',
  grid: 'Drawing pad',
  help: 'Tap squares to draw. Squares must touch.',
  keys: 'Pad keys: arrows move between squares. Space fills or empties a square. Enter saves the shape. Escape closes the pad.',
  square: (row: number, col: number, filled: boolean): string =>
    `Square row ${row} column ${col}, ${filled ? 'filled' : 'empty'}`,
  count: (n: number): string => `${n} of ${B.maxShapeCells} squares`,
  preview: 'Your shape',
  clear: 'Clear',
  clearLabel: 'Clear the pad',
  save: 'Save shape',
  close: 'Close',
  closeLabel: 'Close the pad',
  ok: 'Looks good. Tap Save shape.',
  saved: 'Shape saved! Drag it from My shapes onto your base.',
  problem: {
    empty: 'Tap squares to draw a shape.',
    apart: 'Squares must touch.',
    big: `Too many squares (${B.maxShapeCells} max)`,
    outside: 'Draw inside the pad.',
    duplicate: 'You already have this shape.',
    full: `You have ${B.maxShapes} shapes. Delete one first.`,
    noname: 'Pick a player name first.',
  } as Record<ShapeSaveRefusal, string>,
  shapeLabel: (n: number, cells: number): string => `My shape ${n}, ${cells} squares`,
  deleteLabel: (n: number): string => `Delete my shape ${n}`,
  deleteAsk: 'Delete this shape? Bases that use it keep it.',
  deleteYes: 'Yes, delete it',
  deleteNo: 'Keep it',
  deleted: 'Shape deleted.',
} as const;
