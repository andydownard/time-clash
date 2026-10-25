// @vitest-environment jsdom
// "Make your own": the drawing pad, saving a shape, dragging it onto the plot like a brick,
// turning it, deleting it (after asking), and the keyboard. jsdom has no layout, so the plot and
// tray get fixed boxes: one picture unit is one pixel, so a cell is 40px and the plot is 960 by 480.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  freshBases,
  saveShape,
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
    if (this.classList.contains('tc-bb-tray')) return box(0, 600, 960, 120);
    if (this.classList.contains('tc-bb-shapes')) return box(0, 730, 960, 90);
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
const withL = (team: 'PAST' | 'FUTURE' = 'PAST'): BasesState => {
  const r = saveShape(freshBases(), NAMES[team], team, L);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const pad = () => q('bb-pad')!;
const sq = (r: number, c: number) => q(`bb-sq-${r}-${c}`)!;
const msg = () => q('bb-pad-msg')!.textContent;
const filled = () => qa('.tc-bb-sq[aria-pressed="true"]').length;
const pieces = () => qa('.tc-bb-piece');
const status = () => q('bb-status')!.textContent;

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

describe('the tray tile and the pad', () => {
  it('shows a "My own shape" tile in the My shapes row, not counted as a brick', () => {
    open();
    expect(q('bb-own')!.textContent).toBe(SHAPE_COPY.ownTile);
    expect(qa('.tc-bb-brick')).toHaveLength(8);
    expect(q('bb-brick-stone')!.closest('.tc-bb-tray')!.contains(q('bb-own'))).toBe(false);
    expect(q('bb-pad')!.hasAttribute('hidden')).toBe(true);
    expect(q('bb-shapes')!.contains(q('bb-own'))).toBe(true);
    expect(qa('.tc-bb-mine')).toHaveLength(0);
  });
  it('opens with an L drawn, a count, a preview and a good message', () => {
    open();
    click(q('bb-own'));
    expect(pad().hasAttribute('hidden')).toBe(false);
    expect(qa('.tc-bb-sq')).toHaveLength(B.shapePad * B.shapePad);
    expect(filled()).toBe(4);
    expect(q('bb-pad-count')!.textContent).toBe(SHAPE_COPY.count(4));
    expect(msg()).toBe(SHAPE_COPY.ok);
    expect(q('bb-pad-preview')!.querySelector('svg')).not.toBeNull();
    expect(q('bb-pad-save')!.getAttribute('aria-disabled')).toBe('false');
  });
  it('covers the plot: the plot, tools and tray wait while it is open', () => {
    open();
    click(q('bb-own'));
    expect(q('bb-plot')!.closest('.tc-bb-plot')!.hasAttribute('inert')).toBe(true);
    expect(q('bb-turn')!.closest('.tc-bb-tools')!.hasAttribute('inert')).toBe(true);
    expect(q('bb-brick-stone')!.closest('.tc-bb-tray')!.hasAttribute('inert')).toBe(true);
    click(q('bb-pad-close'));
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(q('bb-brick-stone')!.closest('.tc-bb-tray')!.hasAttribute('inert')).toBe(false);
  });
  it('names every square for a screen reader', () => {
    open();
    click(q('bb-own'));
    expect(sq(1, 1).getAttribute('aria-label')).toBe('Square row 1 column 1, filled');
    expect(sq(2, 3).getAttribute('aria-label')).toBe('Square row 2 column 3, empty');
    click(sq(2, 3));
    expect(sq(2, 3).getAttribute('aria-label')).toBe('Square row 2 column 3, filled');
    expect(sq(2, 3).getAttribute('aria-pressed')).toBe('true');
  });
  it('Clear empties the pad and says what to do', () => {
    open();
    click(q('bb-own'));
    click(q('bb-pad-clear'));
    expect(filled()).toBe(0);
    expect(q('bb-pad-preview')!.querySelector('svg')).toBeNull();
    expect(q('bb-pad-save')!.getAttribute('aria-disabled')).toBe('true');
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
    expect(msg()).toBe('Squares must touch.');
    click(q('bb-pad-save'));
    expect(o.saved).toHaveLength(0);
    expect(msg()).toBe('Squares must touch.');
    // Fill all sixteen: too many.
    for (let r = 1; r <= 4; r++)
      for (let c = 1; c <= 4; c++) if (!sq(r, c).matches('[aria-pressed="true"]')) click(sq(r, c));
    expect(filled()).toBe(16);
    expect(msg()).toBe('Too many squares (8 max)');
    click(q('bb-pad-save'));
    expect(o.saved).toHaveLength(0);
    expect(shapesOf(freshBases(), 'Alex', 'PAST')).toEqual([]);
  });
  it('allows exactly eight squares', () => {
    open();
    click(q('bb-own'));
    click(q('bb-pad-clear'));
    for (const c of [1, 2, 3, 4]) {
      click(sq(1, c));
      click(sq(2, c));
    }
    expect(filled()).toBe(8);
    expect(msg()).toBe(SHAPE_COPY.ok);
    click(sq(3, 1));
    expect(msg()).toBe('Too many squares (8 max)');
  });
  it('refuses a shape that is already saved', () => {
    const o = open('PAST', withL());
    click(q('bb-own'));
    expect(msg()).toBe(SHAPE_COPY.problem.duplicate);
    click(q('bb-pad-save'));
    expect(o.saved).toHaveLength(0);
  });
});

describe('saving', () => {
  it('saves the L, closes the pad, shows it under My shapes and keeps it on the device', () => {
    const o = open();
    click(q('bb-own'));
    click(q('bb-pad-save'));
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(status()).toBe(SHAPE_COPY.saved);
    expect(q('bb-shape-1')!.getAttribute('aria-label')).toBe('My shape 1, 4 squares');
    expect(shapesOf(o.saved.at(-1)!, 'Alex', 'PAST')).toEqual(['10/10/11']);
    expect(document.activeElement).toBe(q('bb-shape-1'));
  });
  it('keeps the two sides apart', () => {
    open('FUTURE', withL('PAST'));
    expect(qa('.tc-bb-mine')).toHaveLength(0);
  });
  it('stops at six shapes and says so', () => {
    let st = freshBases();
    for (let n = 1; n <= B.maxShapes; n++) {
      const r = saveShape(
        st,
        'Alex',
        'PAST',
        Array.from({ length: n }, (_, c): Cell => [c % 4, Math.floor(c / 4)]),
      );
      if (!r.ok) throw new Error(r.reason);
      st = r.state;
    }
    open('PAST', st);
    expect(qa('.tc-bb-mine')).toHaveLength(B.maxShapes);
    click(q('bb-own'));
    expect(msg()).toBe(SHAPE_COPY.problem.full);
  });
});

describe('a saved shape is a brick', () => {
  it('drags onto the plot, is saved with the base, and turns', () => {
    const o = open('PAST', withL());
    drag(q('bb-shape-1')!, [6 * 40 + 40, 8 * 40 + 60]);
    expect(pieces()).toHaveLength(1);
    expect(status()).toBe('Your shape placed.');
    const base = slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0);
    expect(base).toHaveLength(1);
    expect(base[0]).toMatchObject({
      piece: customId('PAST', '10/10/11'),
      hp: 4 * B.hpPerCell,
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
  it('opens again from a saved base after a reload, even if the shape was deleted', () => {
    const o = open('PAST', withL());
    drag(q('bb-shape-1')!, [6 * 40 + 40, 8 * 40 + 60]);
    click(q('bb-shape-del-1'));
    click(q('bb-clear-yes'));
    expect(qa('.tc-bb-mine')).toHaveLength(0);
    expect(pieces()).toHaveLength(1);
    document.body.innerHTML = '';
    s = setup();
    const again = open('PAST', o.saved.at(-1)!);
    expect(pieces()).toHaveLength(1);
    expect(again.saved).toHaveLength(0);
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
});

describe('deleting', () => {
  it('asks first, and Keep it changes nothing', () => {
    const o = open('PAST', withL());
    click(q('bb-shape-del-1'));
    expect(q('bb-clear-yes')!.closest('.tc-bb-confirm')!.hasAttribute('hidden')).toBe(false);
    expect(q('bb-clear-yes')!.closest('.tc-bb-confirm')!.textContent).toContain(
      SHAPE_COPY.deleteAsk,
    );
    click(q('bb-clear-no'));
    expect(qa('.tc-bb-mine')).toHaveLength(1);
    expect(o.saved).toHaveLength(0);
    expect(document.activeElement).toBe(q('bb-shape-del-1'));
  });
  it('Yes, delete it removes the shape and saves', () => {
    const o = open('PAST', withL());
    click(q('bb-shape-del-1'));
    click(q('bb-clear-yes'));
    expect(qa('.tc-bb-mine')).toHaveLength(0);
    expect(shapesOf(o.saved.at(-1)!, 'Alex', 'PAST')).toEqual([]);
    expect(status()).toBe(SHAPE_COPY.deleted);
  });
  it('the Clear question still says its own words afterwards', () => {
    open('PAST', withL());
    click(q('bb-shape-del-1'));
    click(q('bb-clear-no'));
    drag(q('bb-shape-1')!, [6 * 40 + 40, 8 * 40 + 60]);
    click(q('bb-clear'));
    expect(q('bb-clear-yes')!.closest('.tc-bb-confirm')!.textContent).toContain(
      'Take every brick off',
    );
  });
});

describe('painting and the keyboard', () => {
  it('a press fills a square and dragging across fills the rest', () => {
    open();
    click(q('bb-own'));
    click(q('bb-pad-clear'));
    pointer(sq(1, 1), 'pointerdown', 0, 0);
    const real = document.elementFromPoint;
    document.elementFromPoint = ((x: number) => (x === 1 ? sq(1, 2) : sq(1, 3))) as typeof real;
    pointer(document, 'pointermove', 1, 0);
    pointer(document, 'pointermove', 2, 0);
    pointer(document, 'pointerup', 2, 0);
    document.elementFromPoint = real;
    expect(filled()).toBe(3);
    expect(sq(1, 3).getAttribute('aria-pressed')).toBe('true');
    // The click that follows the press does not undo it.
    click(sq(1, 1));
    expect(sq(1, 1).getAttribute('aria-pressed')).toBe('true');
  });
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
    const e = keydown(sq(2, 1), 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(qa('.tc-bb-mine')).toHaveLength(1);
    click(q('bb-own'));
    keydown(sq(1, 1), 'Escape');
    expect(pad().hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(q('bb-own'));
  });
  it('Space (a click with no pointer) toggles a square', () => {
    open();
    click(q('bb-own'));
    click(sq(4, 4));
    expect(sq(4, 4).getAttribute('aria-pressed')).toBe('true');
    click(sq(4, 4));
    expect(sq(4, 4).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('look rules for the new parts', () => {
  it('squares and pad buttons are at least 56px, and there are no raw colors', () => {
    expect(css).toMatch(/\.tc-bb-sq \{[^}]*min-width: 56px;[^}]*min-height: 56px/);
    expect(css).toMatch(/\.tc-bb-pad-btn \{[^}]*min-height: 64px/);
    expect(css).toMatch(/\.tc-bb-mine \{[^}]*touch-action: none/);
    expect(css).toMatch(/\.tc-bb-pad-grid \{[^}]*touch-action: none/);
    expect(css).toMatch(/\.tc-bb-mine-del \{[^}]*min-width: 56px/);
  });
  it('the pad respects reduced motion by having nothing that moves', () => {
    const block = css.slice(css.indexOf('Your own shapes'));
    expect(block).not.toMatch(/animation|transition|@keyframes/);
  });
});
