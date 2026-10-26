// @vitest-environment jsdom
// "My shape": the drawing pad with materials and a name, saved shapes as tiles in the main bar
// (before the last "My shape" tile), dragging one onto the plot like a brick, turning it, deleting
// it from the trash can in its tile (after a Yes / No), and the keyboard. jsdom has no layout, so
// the plot and bar get fixed boxes: one picture unit is one pixel, so a cell is 40px and the plot
// is 960 by 480.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  freshBases,
  newBuild,
  placePiece,
  savedShapes,
  saveShape,
  saveSlot,
  shapesOf,
  slotPieces,
  type BasesState,
} from '../../src/game/baseBuilder';
import { BASE_BUILDER as B } from '../../src/game/config';
import { customId, type Cell } from '../../src/game/customShapes';
import { SHAPE_COPY } from '../../src/data/shapeCopy';
import { NAMES, campWith } from '../helpers/camp';
import { click, q, qa, setup } from './helpers';

const css = readFileSync(join(process.cwd(), 'src/styles/baseBuilder.css'), 'utf8');

let s: ReturnType<typeof setup>;
const realRect = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  s = setup();
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const box = (left: number, top: number, width: number, height: number): DOMRect =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
      }) as DOMRect;
    if (this.classList.contains('tc-bb-plot-art')) return box(0, 0, 960, 480);
    if (this.classList.contains('tc-bb-tray')) return box(0, 600, 960, 200);
    return realRect.call(this);
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

function open(team: 'PAST' | 'FUTURE' = 'PAST', bases: BasesState = freshBases()) {
  const saved: BasesState[] = [];
  const done = s.overlay.showBaseBuilder({
    team,
    camp: campWith(0, 0),
    names: NAMES,
    bases,
    saveCamp: () => undefined,
    saveBases: (b) => saved.push(b),
  });
  return { saved, done };
}

const L: Cell[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
];
const withL = (team: 'PAST' | 'FUTURE' = 'PAST', label?: string): BasesState => {
  const r = saveShape(freshBases(), NAMES[team], team, L, label);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** Saved shapes of 1, 2, 3 ... squares in a row, named One, Two, Three ... */
const withMany = (n: number): BasesState => {
  let st = freshBases();
  const words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
  for (let i = 0; i < n; i++) {
    const r = saveShape(
      st,
      'Alex',
      'PAST',
      Array.from({ length: i + 1 }, (_, c): Cell => [c % 6, Math.floor(c / 6)]),
      words[i],
    );
    if (!r.ok) throw new Error(r.reason);
    st = r.state;
  }
  return st;
};
const pad = () => q('bb-pad')!;
const sq = (r: number, c: number) => q(`bb-sq-${r}-${c}`)!;
const msg = () => q('bb-pad-msg')!.textContent;
const filled = () => qa('.tc-bb-sq[aria-pressed="true"]').length;
const pieces = () => qa('.tc-bb-piece');
const status = () => q('bb-status')!.textContent;
const tiles = () => [...q('bb-tray')!.children] as HTMLElement[];

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  );
}
function drag(from: Element, to: [number, number], start: [number, number] = [10, 760]): void {
  pointer(from, 'pointerdown', start[0], start[1]);
  pointer(document, 'pointermove', start[0] + 20, start[1] - 20);
  pointer(document, 'pointermove', to[0], to[1]);
  pointer(document, 'pointerup', to[0], to[1]);
}
const keydown = (target: Element, k: string): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
};

describe('the main bar and the last tile', () => {
  it('ends with the "My shape" tile, after the bricks, and has no separate shapes row', () => {
    open();
    expect(q('bb-own')!.textContent).toBe(SHAPE_COPY.ownTile);
    expect(qa('.tc-bb-brick')).toHaveLength(8);
    expect(tiles().at(-1)).toBe(q('bb-own'));
    expect(q('bb-shapes')).toBeNull();
    expect(qa('.tc-bb-mine')).toHaveLength(0);
    expect(q('bb-pad')!.hasAttribute('hidden')).toBe(true);
  });
  it('shows saved shapes as tiles in saved order, between the bricks and "My shape"', () => {
    open('PAST', withMany(3));
    const t = tiles();
    expect(t).toHaveLength(8 + 3 + 1);
    expect(
      t.slice(8, 11).map((w) => w.querySelector('.tc-bb-mine')!.getAttribute('aria-label')),
    ).toEqual(['One', 'Two', 'Three']);
    expect(t.at(-1)).toBe(q('bb-own'));
  });
  it('shows each name under its tile, and the name is the tile label', () => {
    open('PAST', withL('PAST', 'Hook'));
    const tile = q('bb-shape-1')!;
    expect(tile.getAttribute('aria-label')).toBe('Hook');
    expect(tile.querySelector('.tc-bb-mine-name')!.textContent).toBe('Hook');
  });
  it('a shape saved before names shows as Shape N', () => {
    const st = withL();
    // Take the stored name away, as in a save from before names.
    delete st.players.alex!.PAST.shapeNames;
    open('PAST', st);
    expect(q('bb-shape-1')!.getAttribute('aria-label')).toBe('Shape 1');
  });
  it('keeps the two sides apart', () => {
    open('FUTURE', withL('PAST'));
    expect(qa('.tc-bb-mine')).toHaveLength(0);
  });
  it('holds eight shapes and still ends with "My shape"', () => {
    open('PAST', withMany(B.maxShapes));
    expect(qa('.tc-bb-mine')).toHaveLength(B.maxShapes);
    expect(tiles().at(-1)).toBe(q('bb-own'));
    click(q('bb-own'));
    expect(msg()).toBe(SHAPE_COPY.problem.full);
  });
});

describe('the pad', () => {
  it('opens with an L of the side default, a count, a strength, a preview and a name', () => {
    open();
    click(q('bb-own'));
    expect(pad().hasAttribute('hidden')).toBe(false);
    expect(qa('.tc-bb-sq')).toHaveLength(B.shapePad * B.shapePad);
    expect(B.shapePad).toBe(6);
    expect(filled()).toBe(4);
    expect(q('bb-pad-count')!.textContent).toBe(SHAPE_COPY.count(4));
    expect(q('bb-pad-strength')!.textContent).toBe('Strength 32');
    expect(msg()).toBe(SHAPE_COPY.ok);
    expect(q('bb-pad-preview')!.querySelector('svg')).not.toBeNull();
    expect(q<HTMLInputElement>('bb-pad-name')!.value).toBe('Shape 1');
    expect(q('bb-pad-save')!.getAttribute('aria-disabled')).toBe('false');
  });
  it('covers the plot: the plot, tools, rail and bar wait while it is open', () => {
    open();
    click(q('bb-own'));
    expect(q('bb-plot')!.closest('.tc-bb-plot')!.hasAttribute('inert')).toBe(true);
    expect(q('bb-turn')!.closest('.tc-bb-tools')!.hasAttribute('inert')).toBe(true);
    expect(q('bb-tray')!.hasAttribute('inert')).toBe(true);
    expect(q('bb-rail')!.hasAttribute('inert')).toBe(true);
    click(q('bb-pad-close'));
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(q('bb-tray')!.hasAttribute('inert')).toBe(false);
  });
  it('names every square and its material for a screen reader', () => {
    open();
    click(q('bb-own'));
    expect(sq(1, 1).getAttribute('aria-label')).toBe('Square row 1 column 1, Stone');
    expect(sq(2, 3).getAttribute('aria-label')).toBe('Square row 2 column 3, empty');
    click(sq(2, 3));
    expect(sq(2, 3).getAttribute('aria-label')).toBe('Square row 2 column 3, Stone');
    expect(sq(2, 3).getAttribute('aria-pressed')).toBe('true');
  });
  it('Clear empties the pad', () => {
    open();
    click(q('bb-own'));
    click(q('bb-pad-clear'));
    expect(filled()).toBe(0);
    expect(q('bb-pad-preview')!.querySelector('svg')).toBeNull();
    expect(q('bb-pad-save')!.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('materials', () => {
  it('is a radio group of the side materials, the default picked, each with a picture', () => {
    open();
    click(q('bb-own'));
    const group = q('bb-mat-stone')!.closest('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe(SHAPE_COPY.material);
    const chips = qa('.tc-bb-mat');
    expect(chips.map((c) => c.getAttribute('data-mat'))).toEqual([
      'stone',
      'wood',
      'glass',
      'jelly',
    ]);
    expect(chips.every((c) => c.getAttribute('role') === 'radio')).toBe(true);
    expect(chips.every((c) => c.querySelector('svg.tc-bb-mat-icon'))).toBe(true);
    expect(q('bb-mat-stone')!.getAttribute('aria-checked')).toBe('true');
    expect(q('bb-mat-wood')!.getAttribute('aria-label')).toBe('Wood, strength 5 a square');
  });
  it('Team Future draws with panel, metal, glass and jelly', () => {
    open('FUTURE');
    click(q('bb-own'));
    expect(qa('.tc-bb-mat').map((c) => c.getAttribute('data-mat'))).toEqual([
      'panel',
      'metal',
      'glass',
      'jelly',
    ]);
  });
  it('a tap fills a square with the picked material, shows its picture, adds its strength', () => {
    open();
    click(q('bb-own'));
    click(q('bb-mat-wood'));
    expect(q('bb-mat-wood')!.getAttribute('aria-checked')).toBe('true');
    click(sq(1, 2));
    expect(sq(1, 2).getAttribute('data-mat')).toBe('wood');
    expect(sq(1, 2).getAttribute('aria-label')).toBe('Square row 1 column 2, Wood');
    expect(sq(1, 2).querySelector('svg')).not.toBeNull();
    expect(q('bb-pad-strength')!.textContent).toBe(`Strength ${32 + 5}`);
  });
  it('a tap on a square of another material paints it; the same material empties it', () => {
    open();
    click(q('bb-own'));
    click(q('bb-mat-glass'));
    click(sq(1, 1));
    expect(sq(1, 1).getAttribute('data-mat')).toBe('glass');
    expect(filled()).toBe(4);
    click(sq(1, 1));
    expect(sq(1, 1).getAttribute('aria-pressed')).toBe('false');
    expect(sq(1, 1).querySelector('svg')).toBeNull();
  });
  it('dragging paints every square crossed with the picked material', () => {
    open();
    click(q('bb-own'));
    click(q('bb-pad-clear'));
    click(q('bb-mat-jelly'));
    pointer(sq(1, 1), 'pointerdown', 0, 0);
    const real = document.elementFromPoint;
    document.elementFromPoint = ((x: number) => (x === 1 ? sq(1, 2) : sq(1, 3))) as typeof real;
    pointer(document, 'pointermove', 1, 0);
    pointer(document, 'pointermove', 2, 0);
    pointer(document, 'pointerup', 2, 0);
    document.elementFromPoint = real;
    expect(filled()).toBe(3);
    expect(qa('.tc-bb-sq[data-mat="jelly"]')).toHaveLength(3);
    // The click that follows the press does not undo it.
    click(sq(1, 1));
    expect(sq(1, 1).getAttribute('aria-pressed')).toBe('true');
  });
  it('arrow keys move between materials (one Tab stop)', () => {
    open();
    click(q('bb-own'));
    keydown(q('bb-mat-stone')!, 'ArrowRight');
    expect(q('bb-mat-wood')!.getAttribute('aria-checked')).toBe('true');
    expect(qa('.tc-bb-mat').filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });
  it('saves a shape of many materials; the same squares in stone are another shape', () => {
    const o = open();
    click(q('bb-own'));
    click(q('bb-mat-wood'));
    click(sq(1, 1));
    click(q('bb-pad-save'));
    expect(shapesOf(o.saved.at(-1)!, 'Alex', 'PAST')).toEqual(['w0/10/11']);
    click(q('bb-own'));
    // The plain stone L is not a duplicate of the one with a wood square.
    expect(msg()).toBe(SHAPE_COPY.ok);
    click(q('bb-pad-save'));
    expect(shapesOf(o.saved.at(-1)!, 'Alex', 'PAST')).toEqual(['w0/10/11', '10/10/11']);
  });
});

describe('what cannot be saved', () => {
  it('says why in plain words: empty, apart, too many', () => {
    const o = open();
    click(q('bb-own'));
    click(q('bb-pad-clear'));
    expect(msg()).toBe(SHAPE_COPY.problem.empty);
    click(sq(1, 1));
    click(sq(3, 3));
    expect(msg()).toBe(SHAPE_COPY.problem.apart);
    click(q('bb-pad-save'));
    expect(o.saved).toHaveLength(0);
    // Squares that touch only at a corner are apart too.
    click(sq(2, 2));
    expect(msg()).toBe(SHAPE_COPY.problem.apart);
    for (let r = 1; r <= 6; r++)
      for (let c = 1; c <= 6; c++) if (!sq(r, c).matches('[aria-pressed="true"]')) click(sq(r, c));
    expect(filled()).toBe(36);
    expect(msg()).toBe('Too many squares. 12 is the most.');
    click(q('bb-pad-save'));
    expect(o.saved).toHaveLength(0);
  });
  it('allows exactly twelve squares', () => {
    open();
    click(q('bb-own'));
    click(q('bb-pad-clear'));
    for (const c of [1, 2, 3, 4, 5, 6]) {
      click(sq(1, c));
      click(sq(2, c));
    }
    expect(filled()).toBe(12);
    expect(msg()).toBe(SHAPE_COPY.ok);
    click(sq(3, 1));
    expect(msg()).toBe('Too many squares. 12 is the most.');
  });
  it('refuses a shape that is already saved', () => {
    const o = open('PAST', withL());
    click(q('bb-own'));
    expect(msg()).toBe(SHAPE_COPY.problem.duplicate);
    click(q('bb-pad-save'));
    expect(o.saved).toHaveLength(0);
  });
});

describe('naming', () => {
  const typeName = (text: string): void => {
    const input = q<HTMLInputElement>('bb-pad-name')!;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  it('the field holds at most 14 letters and is labelled', () => {
    open();
    click(q('bb-own'));
    const input = q<HTMLInputElement>('bb-pad-name')!;
    expect(input.maxLength).toBe(14);
    expect(document.querySelector(`label[for="${input.id}"]`)!.textContent).toBe('Name');
  });
  it('saves with the typed name, shown under the tile', () => {
    const o = open();
    click(q('bb-own'));
    typeName('  Tall   tower ');
    click(q('bb-pad-save'));
    expect(savedShapes(o.saved.at(-1)!, 'Alex', 'PAST')[0]!.name).toBe('Tall tower');
    expect(q('bb-shape-1')!.getAttribute('aria-label')).toBe('Tall tower');
    expect(status()).toBe(SHAPE_COPY.saved('Tall tower'));
  });
  it('an empty name falls back to the filled-in name', () => {
    const o = open();
    click(q('bb-own'));
    typeName('   ');
    expect(q('bb-pad-name-msg')!.textContent).toBe('');
    click(q('bb-pad-save'));
    expect(savedShapes(o.saved.at(-1)!, 'Alex', 'PAST')[0]!.name).toBe('Shape 1');
  });
  it('an unkind or odd name says so kindly, and Save still works with the filled-in name', () => {
    const o = open();
    click(q('bb-own'));
    typeName('poop wall');
    expect(q('bb-pad-name-msg')!.textContent).toBe(
      `${SHAPE_COPY.nameProblem.blocked} ${SHAPE_COPY.willUse('Shape 1')}`,
    );
    typeName('Sam fort');
    expect(q('bb-pad-name-msg')!.textContent).toContain(SHAPE_COPY.nameProblem.private);
    typeName('Wall!');
    expect(q('bb-pad-name-msg')!.textContent).toContain(SHAPE_COPY.nameProblem.letters);
    click(q('bb-pad-save'));
    expect(savedShapes(o.saved.at(-1)!, 'Alex', 'PAST')[0]!.name).toBe('Shape 1');
  });
  it('fills in the next free Shape N', () => {
    open('PAST', withMany(2));
    click(q('bb-own'));
    expect(q<HTMLInputElement>('bb-pad-name')!.value).toBe('Shape 3');
  });
  it('Enter in the name field saves', () => {
    const o = open();
    click(q('bb-own'));
    typeName('Hook');
    const e = keydown(q('bb-pad-name')!, 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(savedShapes(o.saved.at(-1)!, 'Alex', 'PAST')[0]!.name).toBe('Hook');
  });
});

describe('saving', () => {
  it('saves the L, closes the pad, shows it in the bar and keeps it on the device', () => {
    const o = open();
    click(q('bb-own'));
    click(q('bb-pad-save'));
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(status()).toBe(SHAPE_COPY.saved('Shape 1'));
    expect(q('bb-shape-1')!.getAttribute('aria-label')).toBe('Shape 1');
    expect(shapesOf(o.saved.at(-1)!, 'Alex', 'PAST')).toEqual(['10/10/11']);
    expect(document.activeElement).toBe(q('bb-shape-1'));
    expect(tiles().at(-1)).toBe(q('bb-own'));
  });
});

describe('a saved shape is a brick', () => {
  it('drags onto the plot, is saved with the base, and turns', () => {
    const o = open('PAST', withL('PAST', 'Hook'));
    drag(q('bb-shape-1')!, [6 * 40 + 40, 8 * 40 + 60]);
    expect(pieces()).toHaveLength(1);
    expect(status()).toBe('Hook placed.');
    expect(pieces()[0]!.getAttribute('aria-label')).toContain('Hook');
    const base = slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0);
    expect(base).toHaveLength(1);
    expect(base[0]).toMatchObject({
      piece: customId('PAST', '10/10/11'),
      hp: 4 * B.materialHp.stone,
      rot: 0,
    });
    click(q('bb-turn'));
    expect(pieces()[0]!.getAttribute('transform')).toMatch(/rotate\(90\)/);
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!.rot).toBe(90);
  });
  it('draws one square per filled cell', () => {
    open('PAST', withL());
    drag(q('bb-shape-1')!, [6 * 40 + 40, 8 * 40 + 60]);
    expect(pieces()[0]!.querySelectorAll('rect')).toHaveLength(4);
  });
  it('a tap picks it, then a tap on the plot puts it down', () => {
    open('PAST', withL());
    pointer(q('bb-shape-1')!, 'pointerdown', 10, 760);
    pointer(document, 'pointerup', 10, 760);
    expect(q('bb-shape-1')!.getAttribute('aria-pressed')).toBe('true');
    // The L is 2 by 3: its middle here puts its foot on the ground.
    pointer(q('bb-plot')!, 'pointerdown', 6 * 40 + 40, 8 * 40 + 60);
    pointer(document, 'pointerup', 6 * 40 + 40, 8 * 40 + 60);
    expect(pieces()).toHaveLength(1);
  });
  it('a placed shape dropped on the bar comes off', () => {
    open('PAST', withL());
    drag(q('bb-shape-1')!, [6 * 40 + 40, 8 * 40 + 60]);
    expect(pieces()).toHaveLength(1);
    drag(pieces()[0]!, [400, 700], [6 * 40 + 20, 8 * 40 + 20]);
    expect(pieces()).toHaveLength(0);
  });
});

describe('deleting from the trash can in the tile', () => {
  it('the trash can is inside the tile, at its upper right, named for the shape', () => {
    open('PAST', withL('PAST', 'Hook'));
    const del = q('bb-shape-del-1')!;
    expect(del.closest('.tc-bb-mine-wrap')).toBe(q('bb-shape-1')!.closest('.tc-bb-mine-wrap'));
    expect(del.getAttribute('aria-label')).toBe('Delete Hook');
    expect(css).toMatch(/\.tc-bb-mine-del \{[^}]*position: absolute;[^}]*top: 0;[^}]*right: 0;/);
    expect(css).toMatch(
      /\.tc-bb-mine-del \{[^}]*width: var\(--tc-tap\);[^}]*height: var\(--tc-tap\);/,
    );
  });
  it('asks Delete? with real Yes and No buttons, and No keeps it', () => {
    const o = open('PAST', withL('PAST', 'Hook'));
    click(q('bb-shape-del-1'));
    const ask = q('bb-shape-ask-1')!;
    expect(ask.hasAttribute('hidden')).toBe(false);
    expect(ask.textContent).toContain(SHAPE_COPY.deleteAsk);
    expect(ask.getAttribute('aria-label')).toBe(SHAPE_COPY.deleteAskLabel('Hook'));
    expect(q('bb-shape-yes-1')!.tagName).toBe('BUTTON');
    expect(q('bb-shape-no-1')!.tagName).toBe('BUTTON');
    // The safe choice gets the keyboard, and the tile waits.
    expect(document.activeElement).toBe(q('bb-shape-no-1'));
    expect(q('bb-shape-1')!.hasAttribute('inert')).toBe(true);
    click(q('bb-shape-no-1'));
    expect(ask.hasAttribute('hidden')).toBe(true);
    expect(qa('.tc-bb-mine')).toHaveLength(1);
    expect(o.saved).toHaveLength(0);
    expect(document.activeElement).toBe(q('bb-shape-del-1'));
  });
  it('Escape is the same as No', () => {
    open('PAST', withL());
    click(q('bb-shape-del-1'));
    keydown(q('bb-shape-no-1')!, 'Escape');
    expect(q('bb-shape-ask-1')!.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(q('bb-shape-del-1'));
  });
  it('only one tile asks at a time', () => {
    open('PAST', withMany(2));
    click(q('bb-shape-del-1'));
    click(q('bb-shape-del-2'));
    expect(q('bb-shape-ask-1')!.hasAttribute('hidden')).toBe(true);
    expect(q('bb-shape-ask-2')!.hasAttribute('hidden')).toBe(false);
  });
  it('Yes removes the shape and its name, saves, and says so', () => {
    const o = open('PAST', withMany(2));
    click(q('bb-shape-del-1'));
    click(q('bb-shape-yes-1'));
    expect(qa('.tc-bb-mine')).toHaveLength(1);
    expect(savedShapes(o.saved.at(-1)!, 'Alex', 'PAST').map((x) => x.name)).toEqual(['Two']);
    expect(status()).toBe(SHAPE_COPY.deleted('One'));
    expect(document.activeElement).toBe(q('bb-shape-1'));
    expect(tiles().at(-1)).toBe(q('bb-own'));
  });
  it('a base that uses a deleted shape keeps its copy, and still opens after a reload', () => {
    const o = open('PAST', withL('PAST', 'Hook'));
    drag(q('bb-shape-1')!, [6 * 40 + 40, 8 * 40 + 60]);
    click(q('bb-shape-del-1'));
    click(q('bb-shape-yes-1'));
    expect(qa('.tc-bb-mine')).toHaveLength(0);
    expect(pieces()).toHaveLength(1);
    expect(pieces()[0]!.getAttribute('aria-label')).toContain(SHAPE_COPY.placedName);
    document.body.innerHTML = '';
    s = setup();
    const again = open('PAST', o.saved.at(-1)!);
    expect(pieces()).toHaveLength(1);
    expect(again.saved).toHaveLength(0);
  });
  it('a base with a deleted shape of many materials keeps every material', () => {
    const cells: Cell[] = [
      [0, 0, 'wood'],
      [0, 1, 'glass'],
      [0, 2],
      [1, 2, 'jelly'],
    ];
    const r = saveShape(freshBases(), 'Alex', 'PAST', cells, 'Rainbow');
    if (!r.ok) throw new Error(r.reason);
    const built = placePiece(newBuild('PAST'), r.id, { x: 4, y: 8, ox: 0, oy: 0 });
    if (!built.ok) throw new Error(built.reason);
    open('PAST', saveSlot(r.state, 'Alex', 'PAST', 0, built.state.pieces));
    click(q('bb-shape-del-1'));
    click(q('bb-shape-yes-1'));
    expect(pieces()).toHaveLength(1);
    expect(pieces()[0]!.getAttribute('data-piece')).toBe('own:P:w0/g0/1j');
    // Wood, glass, stone and jelly: four squares, each with its own look.
    expect(pieces()[0]!.querySelectorAll(':scope > rect')).toHaveLength(4);
    expect(pieces()[0]!.querySelectorAll('circle').length).toBeGreaterThan(0);
  });
  it('the Clear question still says its own words', () => {
    open('PAST', withL());
    drag(q('bb-shape-1')!, [6 * 40 + 40, 8 * 40 + 60]);
    click(q('bb-clear'));
    expect(q('bb-clear-yes')!.closest('.tc-bb-confirm')!.textContent).toContain(
      'Take every brick off',
    );
  });
});

describe('the keyboard', () => {
  it('arrows move between squares, one Tab stop, Enter saves, Escape closes', () => {
    open();
    click(q('bb-own'));
    expect(qa('.tc-bb-sq').filter((b) => b.tabIndex === 0)).toHaveLength(1);
    sq(1, 1).focus();
    keydown(sq(1, 1), 'ArrowRight');
    expect(document.activeElement).toBe(sq(1, 2));
    keydown(sq(1, 2), 'ArrowDown');
    expect(document.activeElement).toBe(sq(2, 2));
    keydown(sq(2, 2), 'ArrowLeft');
    keydown(sq(2, 1), 'ArrowLeft');
    expect(document.activeElement).toBe(sq(2, 1));
    for (let i = 0; i < 8; i++) keydown(document.activeElement!, 'ArrowRight');
    expect(document.activeElement).toBe(sq(2, 6));
    const e = keydown(sq(2, 6), 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(qa('.tc-bb-mine')).toHaveLength(1);
    click(q('bb-own'));
    keydown(sq(1, 1), 'Escape');
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(q('bb-own'));
  });
  it('Space (a click with no pointer) fills and empties a square', () => {
    open();
    click(q('bb-own'));
    click(sq(6, 6));
    expect(sq(6, 6).getAttribute('aria-pressed')).toBe('true');
    click(sq(6, 6));
    expect(sq(6, 6).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('look rules for the new parts', () => {
  it('squares, pad buttons, the trash and the bar tiles are at least 56px', () => {
    expect(css).toMatch(/\.tc-bb-sq \{[^}]*min-width: 56px;[^}]*min-height: 56px/);
    expect(css).toMatch(/--bb-sq: 64px/);
    expect(css).toMatch(/\.tc-bb-pad-btn \{[^}]*min-height: 64px/);
    expect(css).toMatch(/\.tc-bb-mine \{[^}]*min-height: 92px[^}]*touch-action: none/);
    expect(css).toMatch(/\.tc-bb-own \{[^}]*min-height: 92px/);
    expect(css).toMatch(/\.tc-bb-pad-grid \{[^}]*touch-action: none/);
    expect(css).toMatch(
      /\.tc-bb-mine-ask \.tc-btn \{[^}]*min-width: var\(--tc-tap\);[^}]*min-height: var\(--tc-tap\)/,
    );
  });
  it('the bar wraps into even rows and never scrolls sideways', () => {
    expect(css).toMatch(/\.tc-bb-tray \{[^}]*display: grid;[^}]*repeat\(auto-fit/);
    expect(css).not.toMatch(/\.tc-bb-tray \{[^}]*overflow-x: auto/);
  });
  it('the pad respects reduced motion by having nothing that moves', () => {
    const block = css.slice(css.indexOf('Your own shapes'));
    expect(block).not.toMatch(/animation|transition|@keyframes/);
  });
});
