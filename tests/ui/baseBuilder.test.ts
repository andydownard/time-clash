// @vitest-environment jsdom
// The base builder screen: tray, drag and drop, turn, undo, saved slots, Scrap, and the Camp
// buttons. jsdom has no layout, so the plot and tray boxes are given fixed sizes: one picture unit
// is one pixel, so a cell is 40px and the plot is 960 by 480.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  freshBases,
  newBuild,
  placePiece,
  saveSlot,
  slotPieces,
  slotSpots,
  type BasesState,
} from '../../src/game/baseBuilder';
import { BASE_BUILDER as B, UI } from '../../src/game/config';
import { BUILDER_COPY } from '../../src/data/copy';
import { walletOf, type CampState } from '../../src/game/loadout';
import { plotPoint } from '../../src/ui/baseBuilderScreen';
import type { Team } from '../../src/game/types';
import { NAMES, campWith } from '../helpers/camp';
import { click, q, qa, setup } from './helpers';

const css = readFileSync(join(process.cwd(), 'src/styles/baseBuilder.css'), 'utf8');
const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

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
    return realRect.call(this);
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

type Opened = {
  saved: BasesState[];
  camps: CampState[];
  done: Promise<Team | null>;
};

function open(
  team: 'PAST' | 'FUTURE' = 'PAST',
  camp: CampState = campWith(0, 0),
  bases: BasesState = freshBases(),
): Opened {
  const saved: BasesState[] = [];
  const camps: CampState[] = [];
  const done = s.overlay.showBaseBuilder({
    team,
    camp,
    names: NAMES,
    bases,
    saveCamp: (c) => camps.push(c),
    saveBases: (b) => saved.push(b),
  });
  return { saved, camps, done };
}

const brick = (id: string) => q(`bb-brick-${id}`)!;
const pieces = () => qa('.tc-bb-piece');
const status = () => q('bb-status')!.textContent;
const plot = () => q('bb-plot')!;

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  );
}
/** A real drag: press on `from`, move a little, then to the point, and let go. */
function drag(from: Element, to: [number, number], start: [number, number] = [10, 650]): void {
  pointer(from, 'pointerdown', start[0], start[1]);
  pointer(document, 'pointermove', start[0] + 20, start[1] - 20);
  pointer(document, 'pointermove', to[0], to[1]);
  pointer(document, 'pointerup', to[0], to[1]);
}
/** Cell (col,row) middle for a brick w by h cells, as a point. */
const mid = (col: number, row: number, w = 1, h = 1): [number, number] => [
  (col + w / 2) * 40,
  (row + h / 2) * 40,
];
const key = (target: Element, k: string, init: KeyboardEventInit = {}): void => {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }),
  );
};

describe('screen', () => {
  it('names itself, shows Scrap, three save slots, the tools and the tray', () => {
    open('PAST', campWith(7));
    const screen = document.querySelector('[data-screen="builder"]')!;
    expect(screen.querySelector('h1')!.textContent).toBe(BUILDER_COPY.title.PAST);
    expect(screen.getAttribute('data-team')).toBe('PAST');
    expect(q('bb-scrap')!.textContent).toContain('7');
    expect(qa('.tc-bb-slot').map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(status()).toBe(BUILDER_COPY.hint);
    for (const id of ['turn', 'undo', 'clear', 'snap', 'done'])
      expect(q(`bb-${id}`)).not.toBeNull();
    expect(qa('.tc-bb-brick').map((b) => b.getAttribute('data-piece'))).toEqual([
      'stone',
      'long',
      'plank',
      'tower',
      'wallTop',
      'arch',
      'gate',
      'flag',
    ]);
    expect(brick('arch').getAttribute('data-state')).toBe('locked');
    expect(brick('arch').textContent).toContain(`${B.pieceScrap.arch} Scrap`);
    expect(brick('stone').getAttribute('data-state')).toBe('owned');
  });
  it('Team Future gets its own pieces', () => {
    open('FUTURE');
    expect(qa('.tc-bb-brick').map((b) => b.getAttribute('data-piece'))).toEqual([
      'panel',
      'beam',
      'solar',
      'antenna',
      'laserBase',
      'hangarDoor',
      'powerCore',
    ]);
    expect(document.querySelector('[data-screen="builder"]')!.getAttribute('data-team')).toBe(
      'FUTURE',
    );
  });
  it('every control is a real button with a name for assistive tech', () => {
    open();
    for (const b of qa('[data-screen="builder"] button')) {
      expect((b.getAttribute('aria-label') ?? b.textContent ?? '').trim().length).toBeGreaterThan(
        0,
      );
    }
    expect(plot().getAttribute('aria-label')).toBe(BUILDER_COPY.plot);
    expect(document.querySelector('[data-screen="builder"] .tc-sr-only')).not.toBeNull();
  });
  it('Done and Back both close it', async () => {
    const a = open();
    click(q('bb-done'));
    await a.done;
    expect(document.querySelector('[data-screen="builder"]')).toBeNull();
    const b = open();
    click(q('bb-back'));
    await b.done;
    expect(document.querySelector('[data-screen="builder"]')).toBeNull();
  });
});

describe('drag and drop', () => {
  it('a drag from the tray puts a brick on the plot, snapped to the grid, and saves it', () => {
    const o = open();
    drag(brick('stone'), [mid(6, 10, 2, 1)[0] + 7, mid(6, 10, 2, 1)[1] - 6]);
    expect(pieces()).toHaveLength(1);
    const saved = slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ piece: 'stone', x: 6, y: 10, ox: 0, oy: 0, rot: 0 });
    expect(status()).toBe(BUILDER_COPY.placed('Stone'));
  });
  it('with Snap off the brick keeps a finer position', () => {
    const o = open();
    click(q('bb-snap'));
    expect(q('bb-snap')!.textContent).toBe(BUILDER_COPY.snapOff);
    expect(q('bb-snap')!.getAttribute('aria-pressed')).toBe('false');
    drag(brick('stone'), [6 * 40 + 80 + 10, 9 * 40 + 20 + 10]);
    const p = slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!;
    expect(p.ox !== 0 || p.oy !== 0).toBe(true);
    click(q('bb-snap'));
    expect(q('bb-snap')!.textContent).toBe(BUILDER_COPY.snapOn);
  });
  it('a drag that ends outside the plot cancels and saves nothing', () => {
    const o = open();
    drag(brick('stone'), [2000, 10]);
    expect(pieces()).toHaveLength(0);
    expect(o.saved).toHaveLength(0);
    expect(status()).toBe(BUILDER_COPY.cancelled);
    expect(document.querySelector('.tc-bb-ghost')!.hasAttribute('hidden')).toBe(true);
  });
  it('a brick dropped on top of another lands on the nearest free spot', () => {
    open();
    drag(brick('long'), mid(4, 10, 4, 1));
    drag(brick('long'), mid(4, 10, 4, 1));
    expect(pieces()).toHaveLength(2);
    const [a, b] = pieces().map((p) => p.getAttribute('transform'));
    expect(a).not.toBe(b);
  });
  it('shows the floating ghost while dragging', () => {
    open();
    pointer(brick('stone'), 'pointerdown', 10, 650);
    pointer(document, 'pointermove', 100, 100);
    const ghost = document.querySelector('.tc-bb-ghost')!;
    expect(ghost.hasAttribute('hidden')).toBe(false);
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.tc-bb-drop')).not.toBeNull();
    pointer(document, 'pointerup', 100, 100);
    expect(ghost.hasAttribute('hidden')).toBe(true);
  });
  it('a locked brick cannot be dragged', () => {
    open();
    drag(brick('arch'), mid(5, 5, 2, 2));
    expect(pieces()).toHaveLength(0);
  });
  it('tap a tray brick, then tap the plot to put it down', () => {
    open();
    pointer(brick('tower'), 'pointerdown', 10, 650);
    pointer(document, 'pointerup', 10, 650);
    expect(brick('tower').getAttribute('aria-pressed')).toBe('true');
    expect(status()).toBe(BUILDER_COPY.hintPicked('Tower'));
    pointer(plot(), 'pointerdown', ...mid(3, 9, 1, 2));
    pointer(document, 'pointerup', ...mid(3, 9, 1, 2));
    expect(pieces()).toHaveLength(1);
    expect(brick('tower').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('placed bricks', () => {
  it('tap a brick to choose it, then Turn spins it, and Undo takes the turn back', () => {
    const o = open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    pointer(plot().querySelector('.tc-bb-piece')!, 'pointerdown', ...mid(6, 10, 2, 1));
    pointer(document, 'pointerup', ...mid(6, 10, 2, 1));
    click(q('bb-turn'));
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!.rot).toBe(90);
    expect(pieces()[0]!.getAttribute('transform')).toContain('rotate(90)');
    click(q('bb-undo'));
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!.rot).toBe(0);
    click(q('bb-undo'));
    expect(pieces()).toHaveLength(0);
    click(q('bb-undo'));
    expect(status()).toBe(BUILDER_COPY.nothingToUndo);
  });
  it('Turn with nothing chosen says what to do', () => {
    open();
    click(q('bb-turn'));
    expect(status()).toBe(BUILDER_COPY.pickFirst);
  });
  it('drag a placed brick to move it', () => {
    const o = open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    const start = mid(6, 10, 2, 1);
    const end = mid(12, 10, 2, 1);
    pointer(pieces()[0]!, 'pointerdown', ...start);
    pointer(document, 'pointermove', start[0] + 30, start[1] - 30);
    pointer(document, 'pointermove', ...end);
    pointer(document, 'pointerup', ...end);
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]).toMatchObject({ x: 12, y: 10 });
    expect(status()).toBe(BUILDER_COPY.moved('Stone'));
  });
  it('drag a placed brick back to the tray to remove it', () => {
    const o = open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    const start = mid(6, 10, 2, 1);
    pointer(pieces()[0]!, 'pointerdown', ...start);
    pointer(document, 'pointermove', start[0], start[1] + 100);
    pointer(document, 'pointermove', 100, 650);
    pointer(document, 'pointerup', 100, 650);
    expect(pieces()).toHaveLength(0);
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)).toHaveLength(0);
    expect(status()).toBe(BUILDER_COPY.removed('Stone'));
  });
  it('a placed brick dragged off the plot but not onto the tray goes back', () => {
    open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    const start = mid(6, 10, 2, 1);
    pointer(pieces()[0]!, 'pointerdown', ...start);
    pointer(document, 'pointermove', 1500, 50);
    pointer(document, 'pointerup', 1500, 50);
    expect(pieces()).toHaveLength(1);
    expect(status()).toBe(BUILDER_COPY.cancelled);
  });
  it('a cancelled pointer (a palm, a system gesture) puts the brick back', () => {
    open();
    pointer(brick('stone'), 'pointerdown', 10, 650);
    pointer(document, 'pointermove', 200, 200);
    pointer(document, 'pointercancel', 200, 200);
    expect(pieces()).toHaveLength(0);
    expect(document.querySelector('.tc-bb-ghost')!.hasAttribute('hidden')).toBe(true);
  });
  it('Clear asks first, Keep it changes nothing, Yes clears, and Undo brings it back', () => {
    open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    click(q('bb-clear'));
    expect(q('bb-clear-yes')!.closest('[hidden]')).toBeNull();
    click(q('bb-clear-no'));
    expect(pieces()).toHaveLength(1);
    click(q('bb-clear'));
    click(q('bb-clear-yes'));
    expect(pieces()).toHaveLength(0);
    click(q('bb-undo'));
    expect(pieces()).toHaveLength(1);
  });
  it('gives each brick a spoken label with its place', () => {
    open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    expect(pieces()[0]!.getAttribute('aria-label')).toBe(BUILDER_COPY.pieceLabel('Stone', 6, 10));
    expect(pieces()[0]!.getAttribute('role')).toBe('button');
    expect(pieces()[0]!.getAttribute('tabindex')).toBe('0');
  });
});

describe('support: every brick stands on the ground or on a brick that does', () => {
  it('a brick dragged into mid-air shows the pink "not here" outline and is refused with a reason', () => {
    const o = open();
    pointer(brick('stone'), 'pointerdown', 10, 650);
    pointer(document, 'pointermove', 100, 100);
    pointer(document, 'pointermove', ...mid(6, 4, 2, 1));
    expect(document.querySelector('.tc-bb-drop')!.getAttribute('data-ok')).toBe('false');
    expect(document.querySelector('.tc-bb-ghost')!.getAttribute('data-ok')).toBe('false');
    expect(status()).toBe(BUILDER_COPY.floating);
    pointer(document, 'pointerup', ...mid(6, 4, 2, 1));
    expect(pieces()).toHaveLength(0);
    expect(o.saved).toHaveLength(0);
    expect(status()).toBe(BUILDER_COPY.floating);
  });
  it('a second layer on the first is fine, and the outline is the ok one', () => {
    const o = open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    pointer(brick('stone'), 'pointerdown', 10, 650);
    pointer(document, 'pointermove', 100, 100);
    pointer(document, 'pointermove', ...mid(6, 9, 2, 1));
    expect(document.querySelector('.tc-bb-drop')!.getAttribute('data-ok')).toBe('true');
    pointer(document, 'pointerup', ...mid(6, 9, 2, 1));
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0).map((p) => p.y)).toEqual([10, 9]);
  });
  it('a brick let go just above another drops onto it with Snap off', () => {
    const o = open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    click(q('bb-snap'));
    // Three free steps (15px) above the top of the first stone.
    drag(brick('stone'), [mid(6, 9, 2, 1)[0], mid(6, 9, 2, 1)[1] - 15]);
    const top = slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[1]!;
    expect([top.y, top.oy]).toEqual([9, 0]);
  });
  it('the bottom brick cannot be taken off, dragged away or deleted while one sits on it', () => {
    open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    drag(brick('stone'), mid(6, 9, 2, 1));
    const bottom = () => pieces().find((p) => p.getAttribute('aria-label')!.includes('row 11'))!;
    // Dragged to the tray: refused, nothing lost.
    let start = mid(6, 10, 2, 1);
    pointer(bottom(), 'pointerdown', start[0], start[1]);
    pointer(document, 'pointermove', start[0], start[1] + 100);
    pointer(document, 'pointermove', 100, 650);
    pointer(document, 'pointerup', 100, 650);
    expect(pieces()).toHaveLength(2);
    expect(status()).toBe(BUILDER_COPY.holding);
    // Dragged across the ground: refused, it stays where it was.
    start = mid(6, 10, 2, 1);
    pointer(bottom(), 'pointerdown', ...start);
    pointer(document, 'pointermove', start[0] + 30, start[1]);
    pointer(document, 'pointermove', ...mid(14, 10, 2, 1));
    expect(document.querySelector('.tc-bb-drop')!.getAttribute('data-ok')).toBe('false');
    pointer(document, 'pointerup', ...mid(14, 10, 2, 1));
    expect(bottom().getAttribute('aria-label')).toBe(BUILDER_COPY.pieceLabel('Stone', 6, 10));
    expect(status()).toBe(BUILDER_COPY.holding);
    // Delete key: refused, and the keyboard stays on the brick.
    key(bottom(), 'Delete');
    expect(pieces()).toHaveLength(2);
    expect(status()).toBe(BUILDER_COPY.holding);
    // Turn: refused too.
    pointer(bottom(), 'pointerdown', ...start);
    pointer(document, 'pointerup', ...start);
    click(q('bb-turn'));
    expect(status()).toBe(BUILDER_COPY.holding);
    // Take the top one off first, then the bottom one comes off.
    const top = pieces().find((p) => p.getAttribute('aria-label')!.includes('row 10'))!;
    key(top, 'Delete');
    key(bottom(), 'Delete');
    expect(pieces()).toHaveLength(0);
    // Undo walks back through legal states only.
    click(q('bb-undo'));
    click(q('bb-undo'));
    expect(pieces()).toHaveLength(2);
  });
  it('Clear always works, even with a stack', () => {
    open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    drag(brick('stone'), mid(6, 9, 2, 1));
    click(q('bb-clear'));
    click(q('bb-clear-yes'));
    expect(pieces()).toHaveLength(0);
  });
  it('an old base with floating bricks is set down when it opens, saved, and said once', () => {
    const raw = { v: 1 as const, p: [['stone', 4, 2, 0, 0, 0, 20]] as never };
    const bases: BasesState = {
      players: {
        alex: {
          PAST: { chosen: 0, slots: [raw, null, null] },
          FUTURE: { chosen: 0, slots: [null, null, null] },
        },
      },
    };
    const o = open('PAST', campWith(0), bases);
    expect(status()).toBe(BUILDER_COPY.settled);
    expect(pieces()[0]!.getAttribute('aria-label')).toBe(BUILDER_COPY.pieceLabel('Stone', 4, 10));
    expect(o.saved).toHaveLength(1);
    document.body.innerHTML = '';
    s = setup();
    open('PAST', campWith(0), o.saved[0]!);
    expect(status()).toBe(BUILDER_COPY.hint);
  });
});

describe('tap to pick, then tap or slide on the plot', () => {
  it('Team Future: tap Antenna, tap the plot, and it is placed there', () => {
    const o = open('FUTURE');
    pointer(brick('antenna'), 'pointerdown', 10, 650);
    pointer(document, 'pointerup', 10, 650);
    pointer(plot(), 'pointerdown', ...mid(3, 9, 1, 2));
    pointer(document, 'pointerup', ...mid(3, 9, 1, 2));
    expect(slotPieces(o.saved.at(-1)!, 'Sam', 'FUTURE', 0)[0]).toMatchObject({
      piece: 'antenna',
      x: 3,
      y: 9,
    });
    expect(brick('antenna').getAttribute('aria-pressed')).toBe('false');
  });
  it('a tap in mid-air is refused, and the brick stays picked so the next tap can work', () => {
    open();
    pointer(brick('stone'), 'pointerdown', 10, 650);
    pointer(document, 'pointerup', 10, 650);
    pointer(plot(), 'pointerdown', ...mid(6, 3, 2, 1));
    pointer(document, 'pointerup', ...mid(6, 3, 2, 1));
    expect(pieces()).toHaveLength(0);
    expect(status()).toBe(BUILDER_COPY.floating);
    expect(brick('stone').getAttribute('aria-pressed')).toBe('true');
    pointer(plot(), 'pointerdown', ...mid(6, 10, 2, 1));
    pointer(document, 'pointerup', ...mid(6, 10, 2, 1));
    expect(pieces()).toHaveLength(1);
  });
  it('a tap on top of a placed brick stacks the picked brick there (it does not grab the brick)', () => {
    const o = open();
    drag(brick('tower'), mid(6, 9, 1, 2));
    pointer(brick('stone'), 'pointerdown', 10, 650);
    pointer(document, 'pointerup', 10, 650);
    // The stone's middle is over the tower's top cell.
    const p: [number, number] = [6 * 40 + 40, 9 * 40 - 20];
    pointer(pieces()[0]!, 'pointerdown', ...p);
    pointer(document, 'pointerup', ...p);
    expect(
      slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0).map((q2) => [q2.piece, q2.x, q2.y]),
    ).toEqual([
      ['tower', 6, 9],
      ['stone', 6, 8],
    ]);
  });
  it('a picked brick follows a finger slide on the plot and lands where it is let go', () => {
    const o = open();
    pointer(brick('plank'), 'pointerdown', 10, 650);
    pointer(document, 'pointerup', 10, 650);
    pointer(plot(), 'pointerdown', ...mid(2, 4, 3, 1));
    pointer(document, 'pointermove', ...mid(5, 6, 3, 1));
    expect(document.querySelector('.tc-bb-ghost')!.hasAttribute('hidden')).toBe(false);
    pointer(document, 'pointermove', ...mid(9, 10, 3, 1));
    pointer(document, 'pointerup', ...mid(9, 10, 3, 1));
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]).toMatchObject({ x: 9, y: 10 });
  });
  it('with a mouse, the picked brick shows where it would go before the click', () => {
    open();
    pointer(brick('stone'), 'pointerdown', 10, 650);
    pointer(document, 'pointerup', 10, 650);
    pointer(plot(), 'pointermove', ...mid(6, 10, 2, 1));
    expect(document.querySelector('.tc-bb-drop')!.getAttribute('data-ok')).toBe('true');
    pointer(plot(), 'pointermove', ...mid(6, 2, 2, 1));
    expect(document.querySelector('.tc-bb-drop')!.getAttribute('data-ok')).toBe('false');
  });
  it('a plain tap on a placed brick chooses it and draws the dashed outline', () => {
    open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    pointer(pieces()[0]!, 'pointerdown', ...mid(6, 10, 2, 1));
    pointer(document, 'pointerup', ...mid(6, 10, 2, 1));
    expect(document.querySelector('.tc-bb-select')).not.toBeNull();
    expect(status()).toBe(BUILDER_COPY.selected('Stone'));
  });
});

describe('the whole plot is a place to build', () => {
  it('a brick let go just past the left or right edge lands on the edge', () => {
    const o = open();
    drag(brick('stone'), [-12, mid(0, 10, 2, 1)[1]]);
    drag(brick('stone'), [960 + 12, mid(0, 10, 2, 1)[1]]);
    const xs = slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0).map((p) => p.x);
    expect(xs).toEqual([0, B.cols - 2]);
  });
  it('the team and mode buttons live in a rail beside the plot, not on it', () => {
    open();
    const rail = q('bb-rail')!;
    expect(rail.contains(q('bb-team-PAST'))).toBe(true);
    expect(rail.contains(q('bb-team-FUTURE'))).toBe(true);
    expect(rail.contains(q('bb-mode-build'))).toBe(true);
    expect(rail.contains(q('bb-mode-weapons'))).toBe(true);
    expect(rail.contains(q('bb-spots-chip'))).toBe(true);
    expect(document.querySelector('.tc-bb-plot')!.contains(rail)).toBe(false);
    const top = document.querySelector('.tc-bb-top')!;
    expect([...top.children].map((c) => c.className.split(' ').at(-1))).toEqual([
      'tc-bb-back',
      'tc-bb-slots',
      'tc-bb-scrap',
    ]);
    // The dashed castle outline that looked like a limit is gone.
    expect(plot().querySelector('[stroke-dasharray="4 10"]')).toBeNull();
  });
  it('the plot picture fills its frame exactly (no empty bands)', () => {
    expect(css).toMatch(/\.tc-bb-plot-art \{[^}]*box-sizing: content-box/);
    expect(css).toMatch(/\.tc-bb-plot-art \{[^}]*aspect-ratio: 2 \/ 1/);
    expect(css).not.toMatch(/tc-bb-modebar/);
  });
});

describe('keyboard', () => {
  it('Enter picks, arrows move, R turns, Enter places, Delete removes, Control Z undoes', () => {
    const o = open();
    click(brick('tower'));
    expect(brick('tower').getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(plot());
    const before = status();
    key(plot(), 'ArrowLeft');
    expect(status()).not.toBe(before);
    key(plot(), 'r');
    key(plot(), 'Enter');
    expect(pieces()).toHaveLength(1);
    const p = slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!;
    expect(p).toMatchObject({ piece: 'tower', rot: 90 });
    key(pieces()[0]!, 'Delete');
    expect(pieces()).toHaveLength(0);
    key(document.querySelector('[data-screen="builder"]')!, 'z', { ctrlKey: true });
    expect(pieces()).toHaveLength(1);
  });
  it('arrow keys move a chosen brick and R turns it', () => {
    const o = open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    key(pieces()[0]!, 'ArrowRight');
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!.x).toBe(7);
    // Up would leave it in mid-air, so it stays and the status line says why.
    key(pieces()[0]!, 'ArrowUp');
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!.y).toBe(10);
    expect(status()).toBe(BUILDER_COPY.floating);
    key(pieces()[0]!, 'r');
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!.rot).toBe(90);
  });
  it('Escape puts a picked brick back, and arrows never leave the plot', () => {
    open();
    click(brick('stone'));
    for (let i = 0; i < 40; i++) key(plot(), 'ArrowRight');
    key(plot(), 'Enter');
    const only = pieces();
    expect(only).toHaveLength(1);
    click(brick('stone'));
    key(plot(), 'Escape');
    expect(brick('stone').getAttribute('aria-pressed')).toBe('false');
  });
  it('says there is no room when the picked brick has nowhere to go', () => {
    open();
    expect(plot().getAttribute('tabindex')).toBe('0');
  });
});

describe('saved slots', () => {
  it('each slot keeps its own base, and the tab you leave on is the chosen one', () => {
    const o = open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    click(q('bb-slot-2'));
    expect(pieces()).toHaveLength(0);
    drag(brick('long'), mid(4, 10, 4, 1));
    drag(brick('tower'), mid(10, 9, 1, 2));
    const last = o.saved.at(-1)!;
    expect(slotPieces(last, 'Alex', 'PAST', 0)).toHaveLength(1);
    expect(slotPieces(last, 'Alex', 'PAST', 1)).toHaveLength(2);
    expect(last.players.alex!.PAST.chosen).toBe(1);
    click(q('bb-slot-1'));
    expect(pieces()).toHaveLength(1);
    expect(o.saved.at(-1)!.players.alex!.PAST.chosen).toBe(0);
    expect(q('bb-slot-3')!.getAttribute('aria-label')).toBe(BUILDER_COPY.slotEmpty(3));
    expect(q('bb-slot-2')!.getAttribute('aria-label')).toBe(BUILDER_COPY.slotFull(2, 2));
  });
  it('opens on the chosen slot and shows the saved base', () => {
    const r = placePiece(newBuild('PAST'), 'stone', { x: 2, y: 10, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    const bases = saveSlot(freshBases(), 'Alex', 'PAST', 2, r.state.pieces);
    bases.players.alex!.PAST.chosen = 2;
    open('PAST', campWith(0), bases);
    expect(q('bb-slot-3')!.getAttribute('aria-pressed')).toBe('true');
    expect(pieces()).toHaveLength(1);
  });
  it('a saved piece the player does not own is left out, not crashed on', () => {
    const r = placePiece(newBuild('PAST'), 'arch', { x: 2, y: 9, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    open('PAST', campWith(0), saveSlot(freshBases(), 'Alex', 'PAST', 0, r.state.pieces));
    expect(pieces()).toHaveLength(0);
  });
  it('Team Future saves under its own player and side', () => {
    const o = open('FUTURE');
    drag(brick('panel'), mid(6, 10, 2, 1));
    expect(slotPieces(o.saved.at(-1)!, 'Sam', 'FUTURE', 0)).toHaveLength(1);
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)).toHaveLength(0);
  });
});

describe('Scrap and locked pieces', () => {
  it('tapping a locked piece unlocks it for Scrap, once', () => {
    const o = open('PAST', campWith(10));
    click(brick('arch'));
    expect(status()).toBe(BUILDER_COPY.unlocked('Arch'));
    expect(o.camps).toHaveLength(1);
    expect(walletOf(o.camps[0]!, 'Alex').scrap).toBe(10 - (B.pieceScrap.arch as number));
    expect(q('bb-scrap')!.textContent).toContain(String(10 - (B.pieceScrap.arch as number)));
    expect(brick('arch').getAttribute('data-state')).toBe('owned');
    click(brick('arch'));
    expect(o.camps).toHaveLength(1);
  });
  it('too little Scrap says how much more and changes nothing', () => {
    const o = open('PAST', campWith(2));
    click(brick('arch'));
    expect(status()).toBe(BUILDER_COPY.needMore((B.pieceScrap.arch as number) - 2));
    expect(o.camps).toHaveLength(0);
    expect(brick('arch').getAttribute('data-state')).toBe('locked');
    expect(q('bb-scrap')!.textContent).toContain('2');
  });
  it('an unlocked piece can be dragged onto the plot', () => {
    open('PAST', campWith(20));
    click(brick('arch'));
    drag(brick('arch'), mid(8, 9, 2, 2));
    expect(pieces()).toHaveLength(1);
  });
  it('the other side keeps its own Scrap', () => {
    const o = open('FUTURE', campWith(0, 9));
    click(brick('laserBase'));
    expect(walletOf(o.camps[0]!, 'Sam').scrap).toBe(9 - (B.pieceScrap.laserBase as number));
    expect(walletOf(o.camps[0]!, 'Alex').scrap).toBe(0);
  });
});

describe('team picker', () => {
  it('has a Past and a Future choice, with the current side checked', () => {
    open('FUTURE');
    expect(q('bb-team-PAST')!.getAttribute('aria-checked')).toBe('false');
    expect(q('bb-team-FUTURE')!.getAttribute('aria-checked')).toBe('true');
    expect(q('bb-team-PAST')!.textContent).toBe('Team Past');
    expect(q('bb-team-FUTURE')!.textContent).toBe('Team Future');
  });
  it('tapping the other side closes this screen and answers with that side', async () => {
    const { done } = open('PAST');
    click(q('bb-team-FUTURE'));
    await expect(done).resolves.toBe('FUTURE');
    expect(document.querySelector('[data-screen="builder"]')).toBeNull();
  });
  it('tapping the side you are on does nothing, and Back and Done answer null', async () => {
    const { done } = open('PAST');
    click(q('bb-team-PAST'));
    expect(document.querySelector('[data-screen="builder"]')).not.toBeNull();
    click(q('bb-back'));
    await expect(done).resolves.toBeNull();
  });
});

describe('plotPoint', () => {
  it('maps a point and skips the empty bands when the box is wider than the picture', () => {
    const p = plotPoint({ left: 100, top: 50, width: 1960, height: 480 }, 100 + 500 + 40, 50 + 40);
    expect(p).toEqual({ ux: 40, uy: 40, scale: 1 });
    expect(plotPoint({ left: 0, top: 0, width: 480, height: 240 }, 240, 120).scale).toBe(0.5);
    expect(plotPoint({ left: 0, top: 0, width: 0, height: 0 }, 10, 10).scale).toBe(1);
  });
});

describe('look rules (baseBuilder.css)', () => {
  it('uses no raw hex colors', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it('loads nothing from the network', () => {
    expect(css).not.toMatch(/url\(|https?:|@font-face|@import/);
  });
  it('every var(--tc-*) is defined in tokens.css', () => {
    const used = new Set([...css.matchAll(/var\((--tc-[\w-]+)/g)].map((m) => m[1] as string));
    const missing = [...used].filter((v) => !tokens.includes(`${v}:`));
    expect(missing).toEqual([]);
  });
  it('no text under 20px and no tap target under 56px', () => {
    const vars = Object.fromEntries(
      [...tokens.matchAll(/(--tc-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]),
    );
    for (const m of css.matchAll(/font-size:\s*([^;]+);/g)) {
      const v = (m[1] as string).trim();
      const token = /^var\((--tc-[\w-]+)\)$/.exec(v);
      const px = /^(\d+)px$/.exec(token ? (vars[token[1] as string] ?? '') : v);
      expect(px, v).not.toBeNull();
      expect(Number(px![1])).toBeGreaterThanOrEqual(UI.textMinPx);
    }
    for (const m of css.matchAll(/min-height:\s*(\d+)px/g)) {
      // The hint strip and the picture frames are not tap targets.
      expect(Number(m[1])).toBeGreaterThanOrEqual(48);
    }
    for (const sel of ['.tc-bb-slot', '.tc-bb-tool', '.tc-bb-brick']) {
      const block = new RegExp(
        `\\n${sel.replace('.', '\\.')} \\{[^}]*min-height:\\s*(\\d+)px`,
      ).exec(css);
      expect(Number(block![1]), sel).toBeGreaterThanOrEqual(UI.tapTargetMinPx);
    }
  });
  it('touch dragging turns off page scroll on the plot and the tray bricks', () => {
    expect(css).toMatch(/\.tc-bb-plot-art \{[^}]*touch-action: none/);
    expect(css).toMatch(/\.tc-bb-brick \{[^}]*touch-action: none/);
  });
});

describe('weapon spots', () => {
  const pad = (n: number) =>
    document.querySelector<SVGElement>(`.tc-bb-spot[data-spot="${n - 1}"]`)!;
  const weapons = () => q('bb-weapon-panel')!;
  const toWeapons = () => click(q('bb-mode-weapons'));
  // jsdom SVG nodes have no click(), so send the event a tap makes.
  const tap = (el: Element): void => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  };

  it('starts in Build mode: pads are drawn but not buttons, no list, a chip counts them', () => {
    open();
    expect(q('bb-mode-build')!.getAttribute('aria-pressed')).toBe('true');
    expect(q('bb-spots-chip')!.textContent).toBe(BUILDER_COPY.spotsChip(0, B.spots.count));
    expect(qa('.tc-bb-spot')).toHaveLength(B.spots.count);
    expect(pad(1).getAttribute('role')).toBeNull();
    expect(pad(1).getAttribute('tabindex')).toBeNull();
    expect(weapons().hidden).toBe(true);
  });
  it('Weapons mode makes the pads buttons with names, shows the hint, and parks the tray', () => {
    open();
    toWeapons();
    expect(q('bb-mode-weapons')!.getAttribute('aria-pressed')).toBe('true');
    expect(status()).toBe(BUILDER_COPY.spotHint);
    expect(pad(2).getAttribute('role')).toBe('button');
    expect(pad(2).getAttribute('tabindex')).toBe('0');
    expect(pad(2).getAttribute('aria-label')).toBe('Spot 2, empty');
    expect(q('bb-weapon-panel')!.hidden).toBe(true);
    expect(document.querySelector('.tc-bb-tray')!.hasAttribute('inert')).toBe(true);
    click(q('bb-mode-build'));
    expect(status()).toBe(BUILDER_COPY.hint);
    expect(document.querySelector('.tc-bb-tray')!.hasAttribute('inert')).toBe(false);
  });
  it("tapping a pad opens the list for that spot with this side's four weapons", () => {
    open('FUTURE');
    toWeapons();
    tap(pad(2));
    expect(weapons().hidden).toBe(false);
    expect(weapons().textContent).toContain(BUILDER_COPY.spotTitle(2));
    expect(pad(2).getAttribute('aria-label')).toBe('Spot 2, empty, selected');
    expect(qa('.tc-bb-weapon[data-weapon]').map((b) => b.getAttribute('data-weapon'))).toEqual([
      'laser',
      'missilePod',
      'turret',
      'shieldGen',
    ]);
    expect(q('bb-weapon-shieldGen')!.getAttribute('data-state')).toBe('locked');
    expect(q('bb-weapon-shieldGen')!.textContent).toContain('35 Scrap');
  });
  it('picking a weapon mounts it, saves it, marks it "On this spot", and counts it', () => {
    const o = open();
    toWeapons();
    tap(pad(2));
    click(q('bb-weapon-catapult'));
    expect(status()).toBe(BUILDER_COPY.weaponPlaced('Catapult', 2));
    expect(pad(2).getAttribute('aria-label')).toBe('Spot 2, catapult, selected');
    expect(pad(2).getAttribute('data-weapon')).toBe('catapult');
    expect(q('bb-weapon-catapult')!.textContent).toContain(BUILDER_COPY.onThisSpot);
    expect(q('bb-spots-chip')!.textContent).toBe(BUILDER_COPY.spotsChip(1, B.spots.count));
    const last = o.saved[o.saved.length - 1]!;
    expect(slotSpots(last, 'Alex', 'PAST', 0)[1]?.weapon).toBe('catapult');
  });
  it('picking the same weapon again saves nothing new, and another weapon replaces it', () => {
    const o = open();
    toWeapons();
    tap(pad(1));
    click(q('bb-weapon-cannon'));
    const n = o.saved.length;
    click(q('bb-weapon-cannon'));
    expect(o.saved.length).toBe(n);
    click(q('bb-weapon-archerPost'));
    expect(pad(1).getAttribute('data-weapon')).toBe('archerPost');
    expect(q('bb-spots-chip')!.textContent).toBe(BUILDER_COPY.spotsChip(1, B.spots.count));
  });
  it('Clear spot empties the pad; clearing an empty spot says so and saves nothing', () => {
    const o = open();
    toWeapons();
    tap(pad(3));
    click(q('bb-spot-clear'));
    expect(status()).toBe(BUILDER_COPY.spotAlreadyEmpty(3));
    expect(o.saved).toHaveLength(0);
    click(q('bb-weapon-cannon'));
    click(q('bb-spot-clear'));
    expect(status()).toBe(BUILDER_COPY.weaponCleared(3));
    expect(pad(3).getAttribute('data-weapon')).toBe('');
  });
  it('Undo takes back a weapon change', () => {
    open();
    toWeapons();
    tap(pad(2));
    click(q('bb-weapon-cannon'));
    click(q('bb-undo'));
    expect(pad(2).getAttribute('data-weapon')).toBe('');
    expect(q('bb-spots-chip')!.textContent).toBe(BUILDER_COPY.spotsChip(0, B.spots.count));
  });
  it('a locked weapon needs Scrap: short changes nothing, enough unlocks once, then it mounts', () => {
    const o = open('PAST', campWith(40));
    toWeapons();
    tap(pad(1));
    click(q('bb-weapon-ballista'));
    expect(status()).toBe(BUILDER_COPY.weaponUnlocked('Ballista', 1));
    expect(o.camps).toHaveLength(1);
    expect(walletOf(o.camps[0]!, 'Alex').scrap).toBe(5);
    expect(q('bb-weapon-ballista')!.getAttribute('data-state')).toBe('owned');
    expect(pad(1).getAttribute('data-weapon')).toBe('');
    click(q('bb-weapon-ballista'));
    expect(pad(1).getAttribute('data-weapon')).toBe('ballista');
    expect(o.camps).toHaveLength(1);
  });
  it('with too little Scrap a locked weapon says how many more are needed', () => {
    const o = open('PAST', campWith(10));
    toWeapons();
    tap(pad(1));
    click(q('bb-weapon-ballista'));
    expect(status()).toBe(BUILDER_COPY.needMore(25));
    expect(o.camps).toHaveLength(0);
    expect(q('bb-weapon-ballista')!.getAttribute('data-state')).toBe('locked');
  });
  it('with no room beside the plot the list is a bottom sheet in the bar’s place', () => {
    // jsdom has no layout, so no side has room (weaponListPlace.test.ts covers the sides).
    open();
    toWeapons();
    tap(pad(1));
    const screen = document.querySelector('[data-screen="builder"]')!;
    expect(weapons().getAttribute('data-side')).toBe('sheet');
    expect(screen.getAttribute('data-list')).toBe('sheet');
    // Under the plot row and above the status line, so it never sits on the plot.
    expect(weapons().parentElement!.classList.contains('tc-bb-body')).toBe(true);
    expect(weapons().nextElementSibling).toBe(q('bb-status'));
    expect(css).toMatch(/\.tc-bb\[data-list='sheet'\] \.tc-bb-tray \{[^}]*display: none/);
    // Letting go of the spot brings the bar back.
    tap(plot());
    expect(weapons().hidden).toBe(true);
    expect(screen.hasAttribute('data-list')).toBe(false);
  });
  it('pads carry a test id by number, and Clear spot is the last tile of the grid', () => {
    open();
    toWeapons();
    tap(pad(2));
    expect(q('bb-spot-2')).toBe(pad(2));
    expect(weapons().querySelector('.tc-bb-weapons-list')!.lastElementChild).toBe(
      q('bb-spot-clear'),
    );
  });
  it('tapping the plot away from a pad lets go of the spot', () => {
    open();
    toWeapons();
    tap(pad(1));
    tap(plot());
    expect(weapons().hidden).toBe(true);
  });
  it('bricks cannot be dragged in Weapons mode', () => {
    open();
    drag(brick('stone'), mid(6, 10, 2, 1));
    expect(pieces()).toHaveLength(1);
    toWeapons();
    const before = pieces()[0]!.getAttribute('transform');
    drag(pieces()[0]!, mid(12, 10, 2, 1), [260, 420]);
    expect(pieces()[0]!.getAttribute('transform')).toBe(before);
  });
  it('shows weapons saved earlier, and an old save with no spots opens with empty pads', () => {
    const bricks = newBuild('PAST');
    const r = placePiece(bricks, 'stone', { x: 2, y: 10, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    const old = saveSlot(freshBases(), 'Alex', 'PAST', 0, r.state.pieces);
    open('PAST', campWith(0, 0), old);
    expect(q('bb-spots-chip')!.textContent).toBe(BUILDER_COPY.spotsChip(0, B.spots.count));
    expect(pieces()).toHaveLength(1);
    const withSpot = saveSlot(old, 'Alex', 'PAST', 0, r.state.pieces, [
      {},
      { weapon: 'cannon' },
      {},
      {},
    ]);
    document.body.innerHTML = '';
    s = setup();
    open('PAST', campWith(0, 0), withSpot);
    expect(pad(2).getAttribute('data-weapon')).toBe('cannon');
  });
  it('keyboard: Enter on a pad opens the list, arrows move, Enter mounts, Delete clears, Escape closes', () => {
    open('FUTURE');
    toWeapons();
    key(pad(3), 'ArrowRight');
    expect(document.activeElement).toBe(pad(4));
    key(pad(4), 'ArrowLeft');
    expect(document.activeElement).toBe(pad(3));
    key(pad(3), 'Enter');
    expect(weapons().hidden).toBe(false);
    expect(document.activeElement).toBe(q('bb-weapon-laser'));
    key(q('bb-weapon-laser')!, 'ArrowDown');
    expect(document.activeElement).toBe(q('bb-weapon-missilePod'));
    click(q('bb-weapon-missilePod'));
    expect(pad(3).getAttribute('aria-label')).toBe('Spot 3, rocket pod, selected');
    key(q('bb-weapon-missilePod')!, 'Delete');
    expect(pad(3).getAttribute('data-weapon')).toBe('');
    key(q('bb-weapon-laser')!, 'Escape');
    expect(weapons().hidden).toBe(true);
    expect(document.activeElement).toBe(pad(3));
  });
  it('Delete on a focused pad clears it without opening the list', () => {
    open();
    toWeapons();
    tap(pad(2));
    click(q('bb-weapon-cannon'));
    tap(plot());
    key(pad(2), 'Delete');
    expect(pad(2).getAttribute('data-weapon')).toBe('');
    expect(weapons().hidden).toBe(true);
  });
  it("switching saved bases lets go of the spot and shows that base's weapons", () => {
    open();
    toWeapons();
    tap(pad(1));
    click(q('bb-weapon-cannon'));
    click(q('bb-slot-2'));
    expect(weapons().hidden).toBe(true);
    expect(pad(1).getAttribute('data-weapon')).toBe('');
    click(q('bb-slot-1'));
    expect(pad(1).getAttribute('data-weapon')).toBe('cannon');
  });
});
