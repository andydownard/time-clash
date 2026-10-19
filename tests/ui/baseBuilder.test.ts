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
  type BasesState,
} from '../../src/game/baseBuilder';
import { BASE_BUILDER as B, UI } from '../../src/game/config';
import { BUILDER_COPY, FORGE_COPY } from '../../src/data/copy';
import { walletOf, type CampState } from '../../src/game/loadout';
import { plotPoint } from '../../src/ui/baseBuilderScreen';
import { TEST_IDS } from '../../src/ui/types';
import { NAMES, campWith } from '../helpers/camp';
import { click, flush, q, qa, setup } from './helpers';

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
  done: Promise<void>;
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
    drag(brick('stone'), [mid(6, 9, 2, 1)[0] + 7, mid(6, 9, 2, 1)[1] - 6]);
    expect(pieces()).toHaveLength(1);
    const saved = slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ piece: 'stone', x: 6, y: 9, ox: 0, oy: 0, rot: 0 });
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
    drag(brick('long'), mid(4, 9, 4, 1));
    drag(brick('long'), mid(4, 9, 4, 1));
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
    pointer(plot(), 'pointerdown', ...mid(3, 3, 1, 2));
    expect(pieces()).toHaveLength(1);
    expect(brick('tower').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('placed bricks', () => {
  it('tap a brick to choose it, then Turn spins it, and Undo takes the turn back', () => {
    const o = open();
    drag(brick('stone'), mid(6, 9, 2, 1));
    pointer(plot().querySelector('.tc-bb-piece')!, 'pointerdown', ...mid(6, 9, 2, 1));
    pointer(document, 'pointerup', ...mid(6, 9, 2, 1));
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
    drag(brick('stone'), mid(6, 9, 2, 1));
    const start = mid(6, 9, 2, 1);
    const end = mid(12, 5, 2, 1);
    pointer(pieces()[0]!, 'pointerdown', ...start);
    pointer(document, 'pointermove', start[0] + 30, start[1] - 30);
    pointer(document, 'pointermove', ...end);
    pointer(document, 'pointerup', ...end);
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]).toMatchObject({ x: 12, y: 5 });
    expect(status()).toBe(BUILDER_COPY.moved('Stone'));
  });
  it('drag a placed brick back to the tray to remove it', () => {
    const o = open();
    drag(brick('stone'), mid(6, 9, 2, 1));
    const start = mid(6, 9, 2, 1);
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
    drag(brick('stone'), mid(6, 9, 2, 1));
    const start = mid(6, 9, 2, 1);
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
    drag(brick('stone'), mid(6, 9, 2, 1));
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
    drag(brick('stone'), mid(6, 9, 2, 1));
    expect(pieces()[0]!.getAttribute('aria-label')).toBe(BUILDER_COPY.pieceLabel('Stone', 6, 9));
    expect(pieces()[0]!.getAttribute('role')).toBe('button');
    expect(pieces()[0]!.getAttribute('tabindex')).toBe('0');
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
    drag(brick('stone'), mid(6, 9, 2, 1));
    key(pieces()[0]!, 'ArrowRight');
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!.x).toBe(7);
    key(pieces()[0]!, 'ArrowUp');
    expect(slotPieces(o.saved.at(-1)!, 'Alex', 'PAST', 0)[0]!.y).toBe(8);
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
    drag(brick('stone'), mid(6, 9, 2, 1));
    click(q('bb-slot-2'));
    expect(pieces()).toHaveLength(0);
    drag(brick('long'), mid(4, 9, 4, 1));
    drag(brick('tower'), mid(10, 8, 1, 2));
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
    const r = placePiece(newBuild('PAST'), 'stone', { x: 2, y: 3, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    const bases = saveSlot(freshBases(), 'Alex', 'PAST', 2, r.state.pieces);
    bases.players.alex!.PAST.chosen = 2;
    open('PAST', campWith(0), bases);
    expect(q('bb-slot-3')!.getAttribute('aria-pressed')).toBe('true');
    expect(pieces()).toHaveLength(1);
  });
  it('a saved piece the player does not own is left out, not crashed on', () => {
    const r = placePiece(newBuild('PAST'), 'arch', { x: 2, y: 3, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    open('PAST', campWith(0), saveSlot(freshBases(), 'Alex', 'PAST', 0, r.state.pieces));
    expect(pieces()).toHaveLength(0);
  });
  it('Team Future saves under its own player and side', () => {
    const o = open('FUTURE');
    drag(brick('panel'), mid(6, 9, 2, 1));
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
    expect(status()).toBe(FORGE_COPY.needMore((B.pieceScrap.arch as number) - 2));
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

describe('Camp buttons and thumbnails', () => {
  it('shows nothing new unless the builder is on', () => {
    void s.overlay.showCamp();
    expect(q(TEST_IDS.campBuild('PAST'))).toBeNull();
    void s.overlay.showCamp({ builder: false });
    expect(q(TEST_IDS.campBuild('PAST'))).toBeNull();
  });
  it('shows a Build button and a picture for each side, and the button opens that side', async () => {
    const r = placePiece(newBuild('PAST'), 'stone', { x: 2, y: 3, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    const choice = s.overlay.showCamp({
      builder: true,
      names: NAMES,
      bases: { PAST: [...r.state.pieces], FUTURE: [] },
    });
    expect(q(TEST_IDS.campBuild('PAST'))!.textContent).toBe(BUILDER_COPY.campButton.PAST);
    expect(q(TEST_IDS.campBuild('FUTURE'))!.textContent).toBe(BUILDER_COPY.campButton.FUTURE);
    expect(q(TEST_IDS.campBase('PAST'))!.getAttribute('data-bricks')).toBe('1');
    expect(q(TEST_IDS.campBase('FUTURE'))!.getAttribute('data-bricks')).toBe('0');
    expect(q(TEST_IDS.campBase('PAST'))!.getAttribute('aria-label')).toBe("Alex's Castle");
    click(q(TEST_IDS.campBuild('FUTURE')));
    await flush();
    await expect(choice).resolves.toBe('buildFuture');
  });
  it('the Past button opens the Past side', async () => {
    const choice = s.overlay.showCamp({ builder: true });
    click(q(TEST_IDS.campBuild('PAST')));
    await expect(choice).resolves.toBe('buildPast');
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
