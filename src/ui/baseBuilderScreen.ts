// The base builder: build a castle (Team Past) or a base (Team Future) from bricks before a
// battle. Drag a brick from the tray onto the plot, turn it, move it, drag it back to remove it.
// Every change is saved at once through `saveBases`. The rules live in src/game/baseBuilder.ts.
import '../styles/baseBuilder.css';
import { BUILDER_COPY, TEAM_NAMES } from '../data/copy';
import { SHAPE_COPY } from '../data/shapeCopy';
import {
  assignWeapon,
  basesOf,
  baseWasSettled,
  chooseSlot,
  clampToPlot,
  clearBuild,
  clearSpot,
  deleteShape,
  footprint,
  landingFor,
  movePiece,
  newBuild,
  ownedPieceIds,
  ownedSpotWeaponIds,
  pieceById,
  pieceScrap,
  piecesOf,
  placePiece,
  positionFromPoint,
  rectOf,
  removePiece,
  resolveSpots,
  saveShape,
  saveSlot,
  shapesOf,
  slotPieces,
  slotSpots,
  spotWeaponById,
  spotWeaponsOf,
  spotsUsed,
  turnPiece,
  undoBuild,
  type BasesState,
  type BuildState,
  type PieceDef,
  type Placed,
  type PlaceRefusal,
  type SpotWeaponDef,
  type Pos,
  type Rotation,
} from '../game/baseBuilder';
import { BASE_BUILDER as B } from '../game/config';
import { cellsFromKey, customId, shapeKey, shapeProblem, type Cell } from '../game/customShapes';
import { unlockPiece, unlockSpotWeapon } from '../game/economy';
import { walletOf, type CampState } from '../game/loadout';
import { TEAMS, type Team } from '../game/types';
import type { UiCtx } from './ctx';
import { h } from './dom';
import {
  baseThumb,
  CELL,
  ghostIcon,
  nodesFromMarkup,
  placedMarkup,
  plotScene,
  shapeIcon,
  spotsMarkup,
  weaponIcon,
  PLOT_H,
  PLOT_W,
  STEP,
  staticMarkup,
  trayIcon,
} from './baseBuilderArt';
import { svgFromString } from './svg';
import { TEST_IDS, type BuilderOptions } from './types';

/** How far a pointer moves before a press becomes a drag. Smaller is a tap. */
const DRAG_START_PX = 6;
/**
 * A brick let go this close outside the plot (over its frame) still lands: it is pushed back
 * inside, at the nearest legal place. Farther out, the drag is put back.
 */
const EDGE_GRACE_PX = 28;

type Box = { left: number; top: number; width: number; height: number };

/** The words for why a brick cannot go where it was let go. */
export function refusalText(why: PlaceRefusal): string {
  if (why === 'full') return BUILDER_COPY.full;
  if (why === 'floating') return BUILDER_COPY.floating;
  if (why === 'holding') return BUILDER_COPY.holding;
  return BUILDER_COPY.noRoom;
}

/**
 * The inside of a framed element on screen (its border taken off): the plot picture fills exactly
 * this box, so every pixel of it is a place to build.
 */
export function innerBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  const cs = el.ownerDocument.defaultView?.getComputedStyle(el);
  const px = (v: string | undefined): number => parseFloat(v ?? '') || 0;
  const l = px(cs?.borderLeftWidth);
  const t = px(cs?.borderTopWidth);
  return {
    left: r.left + l,
    top: r.top + t,
    width: Math.max(0, r.width - l - px(cs?.borderRightWidth)),
    height: Math.max(0, r.height - t - px(cs?.borderBottomWidth)),
  };
}

/**
 * Where a screen point is on the plot, in picture units, and how big one unit is on screen.
 * The picture fills its box. If the box were ever a different shape, the picture is fitted and
 * centered, and the bands beside it are skipped.
 */
export function plotPoint(
  box: Box,
  clientX: number,
  clientY: number,
): { ux: number; uy: number; scale: number } {
  const width = box.width || PLOT_W;
  const height = box.height || PLOT_H;
  const scale = Math.min(width / PLOT_W, height / PLOT_H);
  const offX = (width - PLOT_W * scale) / 2;
  const offY = (height - PLOT_H * scale) / 2;
  return {
    ux: (clientX - box.left - offX) / scale,
    uy: (clientY - box.top - offY) / scale,
    scale,
  };
}

const rotate = (r: Rotation): Rotation => ((r + 90) % 360) as Rotation;
const within = (box: Box, x: number, y: number): boolean =>
  x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;

type Drag =
  | {
      kind: 'new';
      id: string;
      rot: Rotation;
      sx: number;
      sy: number;
      moved: boolean;
      pid: number;
      /** A picked brick pressed onto the plot: a tap puts it down right there. */
      fromPlot: boolean;
    }
  | {
      kind: 'move';
      index: number;
      /** Grab point inside the brick, in cells. */
      gx: number;
      gy: number;
      sx: number;
      sy: number;
      moved: boolean;
      pid: number;
    };

export function showBaseBuilder(ctx: UiCtx, options: BuilderOptions): Promise<Team | null> {
  const { doc } = ctx;
  return new Promise<Team | null>((resolve) => {
    const { team } = options;
    const name = options.names[team];
    let camp: CampState = options.camp;
    let bases: BasesState = options.bases;
    let slot = basesOf(bases, name, team).chosen;
    let snap = true;
    let selected: number | null = null;
    /** A tray brick picked by tap or key, waiting to be put down. */
    let armed: { id: string; rot: Rotation } | null = null;
    /** Where the picked brick is, for the keyboard (top-left cell). */
    let cursor: { x: number; y: number } | null = null;
    let drag: Drag | null = null;
    let dragRot: Rotation = 0;
    /** Build moves bricks. Weapons picks what is mounted on each spot. */
    let mode: 'build' | 'weapons' = 'build';
    let selSpot: number | null = null;

    const owned = (): Set<string> => ownedPieceIds(team, walletOf(camp, name).loadout[team].pieces);
    const ownedWeapons = (): Set<string> =>
      ownedSpotWeaponIds(team, walletOf(camp, name).loadout[team].mounts);
    const loadSlot = (): BuildState =>
      newBuild(
        team,
        slotPieces(bases, name, team, slot, owned()),
        slotSpots(bases, name, team, slot, ownedWeapons()),
      );
    /** True when the slot held floating bricks from before the support rule (they are set down). */
    const slotSettled = (): boolean =>
      baseWasSettled(basesOf(bases, name, team).slots[slot], team, owned());
    let settledOnOpen = slotSettled();
    let build = loadSlot();

    // ---------- Static parts ----------
    const status = h(doc, 'p', {
      class: 'tc-bb-hint',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': 'bb-status',
    });
    const say = (text: string): void => {
      status.textContent = '';
      status.textContent = text;
    };
    const hintDefault = (): void => {
      status.textContent = mode === 'weapons' ? BUILDER_COPY.spotHint : BUILDER_COPY.hint;
    };

    const back = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-bb-back',
      'data-testid': 'bb-back',
      text: `← ${BUILDER_COPY.back}`,
    });
    const scrapValue = h(doc, 'span', { class: 'tc-bb-scrap-n' });
    const scrapBox = h(
      doc,
      'p',
      { class: 'tc-bb-scrap', 'data-testid': 'bb-scrap' },
      h(doc, 'span', { text: `${BUILDER_COPY.scrap} ` }),
      scrapValue,
    );
    /** Past or Future, like the Forge. The side you are not on opens the builder for that side. */
    const teamPicker = h(
      doc,
      'div',
      { class: 'tc-bb-teams', role: 'radiogroup', 'aria-label': BUILDER_COPY.pickTeam },
      ...TEAMS.map((t) =>
        h(doc, 'button', {
          type: 'button',
          role: 'radio',
          class: 'tc-chip tc-bb-team',
          'data-team': t,
          'data-testid': `bb-team-${t}`,
          'aria-checked': String(t === team),
          tabindex: t === team ? 0 : -1,
          text: TEAM_NAMES[t],
        }),
      ),
    );
    const slotNav = h(doc, 'nav', { class: 'tc-bb-slots', 'aria-label': BUILDER_COPY.slots });

    const plotArt = plotScene(doc, team);
    plotArt.setAttribute('role', 'group');
    plotArt.setAttribute('tabindex', '0');
    plotArt.setAttribute('aria-label', BUILDER_COPY.plot);
    plotArt.removeAttribute('aria-hidden');
    plotArt.setAttribute('data-testid', 'bb-plot');
    const piecesLayer = plotArt.querySelector('.tc-bb-pieces') as SVGGElement;
    const spotsLayer = plotArt.querySelector('.tc-bb-spots') as SVGGElement;
    const previewLayer = plotArt.querySelector('.tc-bb-preview') as SVGGElement;

    const confirmText = h(doc, 'p', { text: BUILDER_COPY.clearAsk });
    const confirmYes = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-primary',
      'data-testid': 'bb-clear-yes',
      'data-act': 'yes',
      text: BUILDER_COPY.clearYes,
    });
    const confirmNo = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': 'bb-clear-no',
      'data-act': 'no',
      text: BUILDER_COPY.clearNo,
    });
    const confirm = h(
      doc,
      'div',
      {
        class: 'tc-bb-confirm',
        role: 'alertdialog',
        'aria-label': BUILDER_COPY.clearAsk,
        hidden: true,
      },
      confirmText,
      h(doc, 'div', { class: 'tc-row' }, confirmYes, confirmNo),
    );
    /** What the question does on Yes, and where focus goes back to when it closes. */
    let onYes: (() => void) | null = null;
    let askFrom: HTMLElement | null = null;
    const ask = (
      text: string,
      yes: string,
      no: string,
      from: HTMLElement,
      then: () => void,
    ): void => {
      confirmText.textContent = text;
      confirm.setAttribute('aria-label', text);
      confirmYes.textContent = yes;
      confirmNo.textContent = no;
      onYes = then;
      askFrom = from;
      confirm.hidden = false;
      confirmNo.focus();
    };
    // Mode switch, spots chip and the weapon list sit over the plot.
    const modeBtn = (id: 'build' | 'weapons', label: string, aria: string): HTMLButtonElement => {
      const b = h(doc, 'button', {
        type: 'button',
        class: 'tc-bb-mode-btn',
        'data-testid': `bb-mode-${id}`,
        'aria-label': aria,
      });
      b.append(
        svgFromString(
          doc,
          id === 'build'
            ? '<svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><rect x="5" y="14" width="38" height="22" rx="3"/><path d="M5,25 H43 M24,14 V25 M15,25 V36 M33,25 V36"/></svg>'
            : '<svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><circle cx="24" cy="24" r="15" stroke-dasharray="7 5"/><path d="M24,16 V32 M16,24 H32"/></svg>',
        ),
        h(doc, 'span', { text: label }),
      );
      return b;
    };
    const buildModeBtn = modeBtn('build', BUILDER_COPY.modeBuild, BUILDER_COPY.modeBuildLabel);
    const weaponsModeBtn = modeBtn(
      'weapons',
      BUILDER_COPY.modeWeapons,
      BUILDER_COPY.modeWeaponsLabel,
    );
    const spotChip = h(doc, 'p', { class: 'tc-bb-count', 'data-testid': 'bb-spots-chip' });
    /** The left rail beside the plot: Team, then Mode and the spots count. Nothing sits on the plot. */
    const rail = h(
      doc,
      'aside',
      { class: 'tc-bb-rail', 'aria-label': BUILDER_COPY.rail, 'data-testid': 'bb-rail' },
      teamPicker,
      h(doc, 'hr', { class: 'tc-bb-rail-line', 'aria-hidden': 'true' }),
      h(
        doc,
        'div',
        { class: 'tc-bb-mode', role: 'group', 'aria-label': BUILDER_COPY.mode },
        buildModeBtn,
        weaponsModeBtn,
      ),
      spotChip,
    );
    const panelTitle = h(doc, 'h2', { class: 'tc-bb-weapons-title' });
    const panelList = h(doc, 'div', { class: 'tc-bb-weapons-list' });
    const clearSpotBtn = h(doc, 'button', {
      type: 'button',
      class: 'tc-bb-weapon tc-bb-weapon-clear',
      'data-testid': 'bb-spot-clear',
    });
    clearSpotBtn.append(
      svgFromString(
        doc,
        '<svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M10,14 H38 M19,14 V8 H29 V14 M14,14 L16,40 H32 L34,14"/></svg>',
      ),
      h(doc, 'span', { text: BUILDER_COPY.clearSpot }),
    );
    clearSpotBtn.setAttribute('aria-label', BUILDER_COPY.clearSpot);
    const weaponPanel = h(
      doc,
      'section',
      { class: 'tc-bb-weapons', 'data-testid': 'bb-weapon-panel', hidden: true },
      panelTitle,
      panelList,
      clearSpotBtn,
    );
    const plotWrap = h(doc, 'div', { class: 'tc-bb-plot' }, plotArt, weaponPanel, confirm);

    const toolIcons: Record<string, string> = {
      turn: '<path d="M38,24 A14,14 0 1 1 30,11"/><path d="M26,3 L32,11 L23,15"/>',
      undo: '<path d="M14,18 H30 A10,10 0 0 1 30,38 H16"/><path d="M20,10 L12,18 L20,26"/>',
      clear:
        '<path d="M10,14 H38 M19,14 V8 H29 V14 M14,14 L16,40 H32 L34,14 M21,22 V34 M27,22 V34"/>',
      snap: '<path d="M8,8 H40 V40 H8 Z M8,24 H40 M24,8 V40"/>',
      done: '<path d="M8,26 L19,37 L40,12"/>',
    };
    const tool = (id: string, label: string, extra = ''): HTMLButtonElement => {
      const b = h(doc, 'button', {
        type: 'button',
        class: `tc-bb-tool tc-bb-tool-${id} ${extra}`.trim(),
        'data-testid': `bb-${id}`,
      });
      b.append(
        svgFromString(
          doc,
          `<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${toolIcons[id]}</svg>`,
        ),
        h(doc, 'span', { class: 'tc-bb-tool-label', text: label }),
      );
      return b;
    };
    const turnBtn = tool('turn', BUILDER_COPY.turn);
    const undoBtn = tool('undo', BUILDER_COPY.undo);
    const clearBtn = tool('clear', BUILDER_COPY.clear);
    const snapBtn = tool('snap', BUILDER_COPY.snapOn);
    const doneBtn = tool('done', BUILDER_COPY.done, 'tc-bb-done');
    const tools = h(
      doc,
      'section',
      { class: 'tc-bb-tools', 'aria-label': BUILDER_COPY.tools },
      turnBtn,
      undoBtn,
      clearBtn,
      snapBtn,
      doneBtn,
    );

    const tray = h(doc, 'section', { class: 'tc-bb-tray', 'aria-label': BUILDER_COPY.tray });
    const shapesTray = h(doc, 'section', {
      class: 'tc-bb-shapes',
      'aria-label': SHAPE_COPY.group,
      'data-testid': 'bb-shapes',
    });

    // The drawing pad: a small grid of big squares. It covers the plot while it is open.
    const padSquares: HTMLButtonElement[] = [];
    for (let r = 0; r < B.shapePad; r++) {
      for (let c = 0; c < B.shapePad; c++) {
        padSquares.push(
          h(doc, 'button', {
            type: 'button',
            class: 'tc-bb-sq',
            'data-r': String(r),
            'data-c': String(c),
            'aria-label': SHAPE_COPY.square(r + 1, c + 1, false),
            'data-testid': `bb-sq-${r + 1}-${c + 1}`,
          }),
        );
      }
    }
    const padGrid = h(
      doc,
      'div',
      { class: 'tc-bb-pad-grid', role: 'group', 'aria-label': SHAPE_COPY.grid },
      ...padSquares,
    );
    const padPreview = h(doc, 'div', {
      class: 'tc-bb-pad-preview',
      role: 'img',
      'aria-label': SHAPE_COPY.preview,
      'data-testid': 'bb-pad-preview',
    });
    const padCount = h(doc, 'p', { class: 'tc-bb-pad-count', 'data-testid': 'bb-pad-count' });
    const padMsg = h(doc, 'p', {
      class: 'tc-bb-pad-msg',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': 'bb-pad-msg',
    });
    const padBtn = (id: string, text: string, label: string, extra = ''): HTMLButtonElement =>
      h(doc, 'button', {
        type: 'button',
        class: `tc-bb-pad-btn ${extra}`.trim(),
        'data-testid': `bb-pad-${id}`,
        'aria-label': label,
        text,
      });
    const padClear = padBtn('clear', SHAPE_COPY.clear, SHAPE_COPY.clearLabel);
    const padSave = padBtn('save', SHAPE_COPY.save, SHAPE_COPY.save, 'tc-bb-pad-save');
    const padClose = padBtn('close', SHAPE_COPY.close, SHAPE_COPY.closeLabel);
    const pad = h(
      doc,
      'section',
      {
        class: 'tc-bb-pad',
        role: 'dialog',
        'aria-label': SHAPE_COPY.padLabel,
        'data-testid': 'bb-pad',
        hidden: true,
      },
      h(doc, 'h2', { class: 'tc-bb-pad-title', text: SHAPE_COPY.pad }),
      padGrid,
      h(
        doc,
        'div',
        { class: 'tc-bb-pad-side' },
        h(doc, 'p', { class: 'tc-bb-pad-help', text: SHAPE_COPY.help }),
        h(doc, 'div', { class: 'tc-bb-pad-row' }, padPreview, padCount),
        padMsg,
        h(doc, 'div', { class: 'tc-bb-pad-actions' }, padClear, padSave, padClose),
      ),
    );
    const ghost = h(doc, 'div', { class: 'tc-bb-ghost', 'aria-hidden': 'true', hidden: true });
    const keys = h(doc, 'p', { class: 'tc-sr-only', text: BUILDER_COPY.keys });
    const spotKeys = h(doc, 'p', { class: 'tc-sr-only', text: BUILDER_COPY.spotKeys });
    const padKeys = h(doc, 'p', { class: 'tc-sr-only', text: SHAPE_COPY.keys });

    const screen = h(
      doc,
      'section',
      {
        class: 'tc-screen tc-bb',
        'data-screen': 'builder',
        'data-team': team,
        'data-motion': ctx.motion(),
      },
      h(doc, 'h1', { class: 'tc-sr-only', text: BUILDER_COPY.title[team] }),
      h(doc, 'header', { class: 'tc-bb-top' }, back, slotNav, scrapBox),
      h(doc, 'div', { class: 'tc-bb-main' }, rail, plotWrap, tools, pad),
      status,
      keys,
      spotKeys,
      padKeys,
      tray,
      shapesTray,
      ghost,
    );

    // ---------- Saving ----------
    const persist = (): void => {
      bases = chooseSlot(
        saveSlot(bases, name, team, slot, build.pieces, build.spots),
        name,
        team,
        slot,
      );
      options.saveBases(bases);
    };

    const nameOf = (id: string): string => pieceById(id)?.name ?? '';

    // ---------- Drawing ----------
    function renderPlot(): void {
      const nodes = build.pieces.flatMap((p, i) => {
        const def = pieceById(p.piece);
        const label = def ? BUILDER_COPY.pieceLabel(def.name, p.x, p.y) : '';
        return nodesFromMarkup(doc, placedMarkup(p, i, label));
      });
      piecesLayer.replaceChildren(...nodes);
      for (const n of nodes) {
        if (Number(n.getAttribute('data-index')) === selected) n.setAttribute('data-selected', '');
      }
      drawPreview(null);
    }

    /** The dashed outline around the chosen brick, plus the drop preview while carrying one. */
    function drawPreview(spot: { id: string; rot: Rotation; pos: Pos; ok: boolean } | null): void {
      const parts: string[] = [];
      if (selected !== null && !drag) {
        const p = build.pieces[selected];
        const r = p && rectOf(p);
        if (r) {
          parts.push(
            `<rect class="tc-bb-select" x="${r.l * STEP - 4}" y="${r.t * STEP - 4}" width="${(r.r - r.l) * STEP + 8}" height="${(r.b - r.t) * STEP + 8}" rx="8" fill="none" stroke="#ffb23e" stroke-width="5" stroke-dasharray="10 7"/>`,
          );
        }
      }
      if (spot) {
        const def = pieceById(spot.id);
        if (def) {
          const f = footprint(def, spot.rot);
          const l = (spot.pos.x * B.freeSteps + spot.pos.ox) * STEP;
          const t = (spot.pos.y * B.freeSteps + spot.pos.oy) * STEP;
          parts.push(
            `<g class="tc-bb-drop" data-ok="${spot.ok}" opacity=".7">${staticMarkup(spot.id, spot.rot, l, t)}</g><rect x="${l - 3}" y="${t - 3}" width="${f.w * CELL + 6}" height="${f.h * CELL + 6}" rx="8" fill="none" stroke="${spot.ok ? '#ffb23e' : '#ff3dae'}" stroke-width="5" stroke-dasharray="${spot.ok ? '10 7' : '3 6'}"/>`,
          );
        }
      }
      previewLayer.replaceChildren(...nodesFromMarkup(doc, parts.join('')));
    }

    function renderSlots(): void {
      const mine = basesOf(bases, name, team);
      slotNav.replaceChildren(
        ...Array.from({ length: B.slots }, (_, i) => {
          const pieces = i === slot ? build.pieces : slotPieces(bases, name, team, i, owned());
          const filled = pieces.length > 0;
          const b = h(doc, 'button', {
            type: 'button',
            class: `tc-bb-slot${filled ? '' : ' is-empty'}`,
            'aria-pressed': String(i === slot),
            'aria-label': filled
              ? BUILDER_COPY.slotFull(i + 1, pieces.length)
              : BUILDER_COPY.slotEmpty(i + 1),
            'data-testid': `bb-slot-${i + 1}`,
            'data-chosen': String(mine.chosen === i),
          });
          b.append(
            filled
              ? baseThumb(doc, team, pieces)
              : svgFromString(
                  doc,
                  '<svg viewBox="0 0 40 40" width="32" height="32" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M20,6 V34 M6,20 H34"/></svg>',
                ),
            // The number is enough to see. The full name is the aria-label above.
            h(doc, 'span', { text: String(i + 1) }),
          );
          b.addEventListener('click', () => switchSlot(i));
          return b;
        }),
      );
    }

    function renderTray(): void {
      const have = owned();
      const scrap = walletOf(camp, name).scrap;
      scrapValue.textContent = String(scrap);
      tray.replaceChildren(
        ...piecesOf(team).map((def) => {
          const open = have.has(def.id);
          const cost = pieceScrap(def);
          const b = h(doc, 'button', {
            type: 'button',
            class: 'tc-bb-brick',
            'data-piece': def.id,
            'data-state': open ? 'owned' : 'locked',
            'aria-pressed': open ? String(armed?.id === def.id) : null,
            'aria-label': open ? def.name : BUILDER_COPY.lockedLabel(def.name, cost ?? 0),
            'data-testid': `bb-brick-${def.id}`,
          });
          b.append(
            trayIcon(doc, def),
            h(doc, 'span', {
              class: 'tc-bb-brick-name',
              text: open
                ? def.name.replace(/^Long stone$/, 'Long')
                : BUILDER_COPY.unlockCost(cost ?? 0),
            }),
          );
          if (!open) {
            b.append(
              svgFromString(
                doc,
                '<svg viewBox="0 0 32 32" width="28" height="28" class="tc-bb-lock"><rect x="6" y="14" width="20" height="14" rx="3" fill="#ffb23e" stroke="#12102b" stroke-width="3"/><path d="M10,14 V10 a6,6 0 0 1 12,0 V14" fill="none" stroke="#12102b" stroke-width="3"/></svg>',
              ),
            );
          }
          // Keyboard (and a screen reader) pick with Enter. A mouse or finger uses the pointer path.
          b.addEventListener('click', (e) => {
            if (!open) unlock(def);
            else if (e.detail === 0) pickWithKeyboard(def);
          });
          b.addEventListener('pointerdown', (e) => {
            if (!open || (e.button ?? 0) !== 0) return;
            startDrag(e, { kind: 'new', id: def.id, rot: armed?.id === def.id ? armed.rot : 0 });
          });
          return b;
        }),
      );
      renderShapes();
    }

    /** The "My own shape" tile at the end of the tray. */
    const ownTile = h(doc, 'button', {
      type: 'button',
      class: 'tc-bb-own',
      'aria-label': SHAPE_COPY.ownTileLabel,
      'data-testid': 'bb-own',
    });
    ownTile.append(
      svgFromString(
        doc,
        '<svg viewBox="0 0 48 48" width="36" height="36" class="tc-bb-own-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><rect x="5" y="5" width="38" height="38" rx="8" stroke-dasharray="8 6"/><path d="M24,14 V34 M14,24 H34"/></svg>',
      ),
      h(doc, 'span', { class: 'tc-bb-own-name', text: SHAPE_COPY.ownTile }),
    );
    ownTile.addEventListener('click', () => openPad());

    /** The saved shapes, as tiles that drag like bricks, each with a delete button. */
    function renderShapes(): void {
      const keys = shapesOf(bases, name, team);
      shapesTray.replaceChildren(
        ownTile,
        h(doc, 'h2', {
          class: keys.length > 3 ? 'tc-bb-shapes-title tc-sr-only' : 'tc-bb-shapes-title',
          text: SHAPE_COPY.group,
        }),
        ...keys.map((key, i) => {
          const id = customId(team, key);
          const cells = cellsFromKey(key) ?? [];
          const tile = h(doc, 'button', {
            type: 'button',
            class: 'tc-bb-mine',
            'data-piece': id,
            'data-state': 'owned',
            'aria-pressed': String(armed?.id === id),
            'aria-label': SHAPE_COPY.shapeLabel(i + 1, cells.length),
            'data-testid': `bb-shape-${i + 1}`,
          });
          tile.append(shapeIcon(doc, team, cells, 48));
          tile.addEventListener('click', (e) => {
            if (e.detail === 0) pickWithKeyboard(pieceById(id)!);
          });
          tile.addEventListener('pointerdown', (e) => {
            if ((e.button ?? 0) !== 0) return;
            startDrag(e, { kind: 'new', id, rot: armed?.id === id ? armed.rot : 0 });
          });
          const del = h(doc, 'button', {
            type: 'button',
            class: 'tc-bb-mine-del',
            'aria-label': SHAPE_COPY.deleteLabel(i + 1),
            'data-testid': `bb-shape-del-${i + 1}`,
          });
          del.append(
            svgFromString(
              doc,
              '<svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M10,14 H38 M19,14 V8 H29 V14 M14,14 L16,40 H32 L34,14"/></svg>',
            ),
          );
          del.addEventListener('click', () =>
            ask(SHAPE_COPY.deleteAsk, SHAPE_COPY.deleteYes, SHAPE_COPY.deleteNo, del, () =>
              removeShape(key),
            ),
          );
          return h(doc, 'div', { class: 'tc-bb-mine-wrap' }, tile, del);
        }),
      );
    }

    function removeShape(key: string): void {
      bases = deleteShape(bases, name, team, key);
      options.saveBases(bases);
      if (armed?.id === customId(team, key)) {
        armed = null;
        cursor = null;
        drawArmed();
      }
      say(SHAPE_COPY.deleted);
      renderShapes();
      (shapesTray.querySelector<HTMLElement>('.tc-bb-mine') ?? ownTile).focus();
    }

    function renderTools(): void {
      snapBtn.querySelector('.tc-bb-tool-label')!.textContent = snap
        ? BUILDER_COPY.snapOn
        : BUILDER_COPY.snapOff;
      snapBtn.setAttribute('aria-pressed', String(snap));
      snapBtn.setAttribute('aria-label', BUILDER_COPY.snapLabel(snap));
      undoBtn.setAttribute('aria-disabled', String(build.undo.length === 0));
      clearBtn.setAttribute('aria-disabled', String(build.pieces.length === 0));
    }

    // ---------- Weapon spots ----------
    const spotName = (i: number): string | null => {
      const id = build.spots[i]?.weapon;
      return id ? (spotWeaponById(id)?.name ?? null) : null;
    };

    /** The pads on the plot. Tap circles are at least 56px on screen, whatever the plot size. */
    function renderSpots(): void {
      const live = mode === 'weapons';
      const { scale } = plotPoint(plotBox(), 0, 0);
      const hitR = (B.spots.tapPx / 2 + 2) / scale;
      const resolved = resolveSpots(build.pieces, build.spots);
      spotsLayer.replaceChildren(
        ...nodesFromMarkup(
          doc,
          spotsMarkup(
            resolved,
            (sp, on) => BUILDER_COPY.spotLabel(spotName(sp.index), sp.index + 1, on),
            live ? selSpot : null,
            live,
            hitR,
          ),
        ),
      );
      spotChip.textContent = BUILDER_COPY.spotsChip(spotsUsed(build.spots), B.spots.count);
    }

    function renderPanel(): void {
      const open = mode === 'weapons' && selSpot !== null;
      weaponPanel.hidden = !open;
      if (!open || selSpot === null) return;
      const n = selSpot + 1;
      const here = build.spots[selSpot]?.weapon;
      const have = ownedWeapons();
      const scrap = walletOf(camp, name).scrap;
      scrapValue.textContent = String(scrap);
      // The list sits on the side away from the chosen spot, so it never covers it.
      const pad = resolveSpots(build.pieces, build.spots)[selSpot];
      weaponPanel.setAttribute('data-side', pad && pad.x * STEP < PLOT_W / 2 ? 'right' : 'left');
      weaponPanel.setAttribute('aria-label', BUILDER_COPY.spotPanel(n));
      panelTitle.textContent = BUILDER_COPY.spotTitle(n);
      panelList.replaceChildren(
        ...spotWeaponsOf(team).map((def) => {
          const open = have.has(def.id);
          const on = here === def.id;
          const b = h(doc, 'button', {
            type: 'button',
            class: 'tc-bb-weapon',
            'data-weapon': def.id,
            'data-state': open ? (on ? 'on' : 'owned') : 'locked',
            'aria-pressed': open ? String(on) : null,
            'aria-label': open
              ? BUILDER_COPY.weaponLabel(def.name, on)
              : BUILDER_COPY.weaponLockedLabel(def.name, def.scrap ?? 0),
            'data-testid': `bb-weapon-${def.id}`,
          });
          const words = h(
            doc,
            'span',
            { class: 'tc-bb-weapon-words' },
            h(doc, 'span', { class: 'tc-bb-weapon-name', text: def.name }),
          );
          if (!open)
            words.append(h(doc, 'span', { text: BUILDER_COPY.unlockCost(def.scrap ?? 0) }));
          else if (on) words.append(h(doc, 'span', { text: BUILDER_COPY.onThisSpot }));
          b.append(weaponIcon(doc, def.id, 44), words);
          if (!open) {
            b.append(
              svgFromString(
                doc,
                '<svg viewBox="0 0 32 32" width="28" height="28" class="tc-bb-lock" aria-hidden="true"><rect x="6" y="14" width="20" height="14" rx="3" fill="#ffb23e" stroke="#12102b" stroke-width="3"/><path d="M10,14 V10 a6,6 0 0 1 12,0 V14" fill="none" stroke="#12102b" stroke-width="3"/></svg>',
              ),
            );
          }
          b.addEventListener('click', () => pickWeapon(def));
          return b;
        }),
      );
      clearSpotBtn.setAttribute('aria-label', BUILDER_COPY.clearSpotLabel(n));
      clearSpotBtn.setAttribute('aria-disabled', String(here === undefined));
    }

    function renderMode(): void {
      const weapons = mode === 'weapons';
      buildModeBtn.setAttribute('aria-pressed', String(!weapons));
      weaponsModeBtn.setAttribute('aria-pressed', String(weapons));
      screen.setAttribute('data-mode', mode);
      // Bricks and the tray wait while weapons are picked.
      syncInert();
      turnBtn.setAttribute('aria-disabled', String(weapons));
      snapBtn.setAttribute('aria-disabled', String(weapons));
    }

    function setMode(next: 'build' | 'weapons'): void {
      if (next === mode) return;
      mode = next;
      armed = null;
      cursor = null;
      selected = null;
      selSpot = null;
      hintDefault();
      renderAll();
    }

    /** Chooses a spot. `focus` moves the keyboard to the weapon list. */
    function selectSpot(i: number, focus: boolean): void {
      selSpot = i;
      say(BUILDER_COPY.spotChosen(i + 1));
      renderSpots();
      renderPanel();
      if (focus) {
        const target =
          weaponPanel.querySelector<HTMLElement>('.tc-bb-weapon[data-state="on"]') ??
          weaponPanel.querySelector<HTMLElement>('.tc-bb-weapon[data-state="owned"]');
        target?.focus();
      }
    }

    function focusSpot(i: number | null): void {
      if (i === null) return;
      (spotsLayer.querySelector(`[data-spot="${i}"]`) as SVGElement | null)?.focus();
    }

    function keepFocus(el: Element | null, fallback: () => void): void {
      const weapon = el?.getAttribute('data-weapon');
      const again = weapon
        ? weaponPanel.querySelector<HTMLElement>(`[data-weapon="${weapon}"]`)
        : null;
      if (again) again.focus();
      else fallback();
    }

    function pickWeapon(def: SpotWeaponDef): void {
      if (selSpot === null) return;
      const n = selSpot + 1;
      const had = doc.activeElement;
      if (!ownedWeapons().has(def.id)) {
        const outcome = unlockSpotWeapon(camp, name, team, def.id);
        if (outcome.ok) {
          camp = outcome.camp;
          options.saveCamp(camp);
          say(BUILDER_COPY.weaponUnlocked(def.name, n));
        } else if (outcome.reason === 'not_enough_scrap') {
          say(BUILDER_COPY.needMore(Math.max(1, (def.scrap ?? 0) - walletOf(camp, name).scrap)));
        }
        renderTray();
        renderPanel();
        keepFocus(had, () => undefined);
        return;
      }
      const result = assignWeapon(build, selSpot, def.id, ownedWeapons());
      if (!result.ok) return;
      if (result.state !== build) {
        build = result.state;
        persist();
      }
      say(BUILDER_COPY.weaponPlaced(def.name, n));
      renderAll();
      keepFocus(had, () => focusSpot(selSpot));
    }

    function doClearSpot(): void {
      if (selSpot === null) return;
      const n = selSpot + 1;
      const result = clearSpot(build, selSpot);
      if (!result.ok) {
        say(BUILDER_COPY.spotAlreadyEmpty(n));
        return;
      }
      build = result.state;
      persist();
      say(BUILDER_COPY.weaponCleared(n));
      renderAll();
    }

    function renderAll(): void {
      renderMode();
      renderSpots();
      renderPanel();
      renderPlot();
      renderSlots();
      renderTray();
      renderTools();
    }

    // ---------- Geometry ----------
    /** The plot picture on screen without its frame: every pixel of it is a place to build. */
    const plotBox = (): Box => innerBox(plotArt);
    /** The plot plus a narrow band around it, where a let-go brick is pushed back inside. */
    const onPlot = (x: number, y: number): boolean => {
      const b = plotBox();
      const g = EDGE_GRACE_PX;
      return within(
        { left: b.left - g, top: b.top - g, width: b.width + 2 * g, height: b.height + 2 * g },
        x,
        y,
      );
    };

    type Landing = { pos: Pos; ok: boolean; why: PlaceRefusal | null };

    /** Where a carried brick would land for a pointer position, and why not when it cannot. */
    function landing(
      id: string,
      rot: Rotation,
      cx: number,
      cy: number,
      grab: { gx: number; gy: number } | null,
      skip: number | null,
    ): Landing | null {
      const def = pieceById(id);
      if (!def) return null;
      const { ux, uy } = plotPoint(plotBox(), cx, cy);
      const f = footprint(def, rot);
      const fx = ux / CELL - (grab ? grab.gx : f.w / 2);
      const fy = uy / CELL - (grab ? grab.gy : f.h / 2);
      return resolveSpot(def, rot, positionFromPoint(fx, fy, snap), skip);
    }

    /**
     * The place for a brick let go at `want`: pushed inside the plot, then right there, dropped
     * onto what is just under it, or the nearest legal spot when it overlaps. A brick in mid-air
     * is refused (`floating`), and so is a move that would leave a brick with nothing under it.
     */
    function resolveSpot(def: PieceDef, rot: Rotation, want: Pos, skip: number | null): Landing {
      const pos = clampToPlot(def, rot, want);
      const cand: Placed = { piece: def.id, ...pos, rot, hp: def.hp };
      const r = landingFor(build.pieces, cand, skip);
      return r.pos ? { pos: r.pos, ok: true, why: null } : { pos, ok: false, why: r.why };
    }

    // ---------- Actions ----------
    function applied(result: ReturnType<typeof placePiece>, ok: string): boolean {
      if (!result.ok) {
        say(refusalText(result.reason));
        return false;
      }
      build = result.state;
      persist();
      say(ok);
      return true;
    }

    function putDown(id: string, rot: Rotation, pos: Pos): void {
      const result = placePiece(build, id, pos, rot);
      if (applied(result, BUILDER_COPY.placed(nameOf(id))) && result.ok) {
        selected = result.index;
        armed = null;
        cursor = null;
      }
      renderAll();
    }

    function doTurn(): void {
      if (armed) {
        const def = pieceById(armed.id);
        const before = def ? footprint(def, armed.rot).h : 0;
        armed = { ...armed, rot: rotate(armed.rot) };
        // The keyboard ghost keeps its bottom where it was, so a brick on the ground stays there.
        if (cursor && def) {
          const c = clampToPlot(def, armed.rot, {
            x: cursor.x,
            y: cursor.y + before - footprint(def, armed.rot).h,
            ox: 0,
            oy: 0,
          });
          cursor = { x: c.x, y: c.y };
        }
        drawArmed();
        say(BUILDER_COPY.turned(nameOf(armed.id)));
        return;
      }
      if (selected === null || !build.pieces[selected]) {
        say(BUILDER_COPY.pickFirst);
        return;
      }
      const result = turnPiece(build, selected);
      applied(result, BUILDER_COPY.turned(nameOf(build.pieces[selected]!.piece)));
      renderAll();
      focusPiece(selected);
    }

    function doUndo(): void {
      if (build.undo.length === 0) {
        say(BUILDER_COPY.nothingToUndo);
        return;
      }
      build = undoBuild(build);
      selected = null;
      persist();
      say(BUILDER_COPY.undone);
      renderAll();
    }

    /** Takes a brick off. A brick that holds another stays, and the status line says why. */
    function doRemove(index: number): boolean {
      const p = build.pieces[index];
      const result = removePiece(build, index);
      if (!p) return false;
      if (!result.ok) {
        say(refusalText(result.reason));
        renderAll();
        return false;
      }
      build = result.state;
      selected = null;
      persist();
      say(BUILDER_COPY.removed(nameOf(p.piece)));
      renderAll();
      return true;
    }

    /** Opens a slot. A base saved with floating bricks has them set down, saved, and said once. */
    function openSlot(): void {
      settledOnOpen = slotSettled();
      build = loadSlot();
      if (settledOnOpen) persist();
    }

    function switchSlot(i: number): void {
      if (i === slot) return;
      slot = i;
      bases = chooseSlot(bases, name, team, slot);
      options.saveBases(bases);
      openSlot();
      selected = null;
      selSpot = null;
      armed = null;
      cursor = null;
      if (settledOnOpen) say(BUILDER_COPY.settled);
      else hintDefault();
      renderAll();
    }

    function unlock(def: PieceDef): void {
      const cost = pieceScrap(def) ?? 0;
      const outcome = unlockPiece(camp, name, team, def.id);
      if (outcome.ok) {
        camp = outcome.camp;
        options.saveCamp(camp);
        say(BUILDER_COPY.unlocked(def.name));
      } else if (outcome.reason === 'not_enough_scrap') {
        say(BUILDER_COPY.needMore(Math.max(1, cost - walletOf(camp, name).scrap)));
      }
      renderTray();
      renderSlots();
    }

    function focusPiece(index: number | null): void {
      if (index === null) return;
      (piecesLayer.querySelector(`[data-index="${index}"]`) as SVGElement | null)?.focus();
    }

    // ---------- Picking a brick (tap or key) ----------
    /** Marks the picked tray brick without redrawing the whole tray. */
    function syncTray(): void {
      for (const b of screen.querySelectorAll<HTMLElement>(
        '.tc-bb-brick[data-state="owned"], .tc-bb-mine',
      )) {
        b.setAttribute('aria-pressed', String(armed?.id === b.getAttribute('data-piece')));
      }
    }

    function drawArmed(): void {
      syncTray();
      if (!armed) {
        drawPreview(null);
        return;
      }
      if (cursor) {
        const def = pieceById(armed.id)!;
        const r = resolveSpot(def, armed.rot, { x: cursor.x, y: cursor.y, ox: 0, oy: 0 }, null);
        drawPreview({ id: armed.id, rot: armed.rot, pos: r.pos, ok: r.ok });
      } else drawPreview(null);
    }

    function pick(def: PieceDef, withKeys: boolean): void {
      if (armed?.id === def.id) {
        armed = null;
        cursor = null;
        hintDefault();
      } else {
        armed = { id: def.id, rot: 0 };
        selected = null;
        for (const n of piecesLayer.querySelectorAll('[data-selected]'))
          n.removeAttribute('data-selected');
        cursor = withKeys
          ? { x: Math.floor(B.cols / 2 - def.w / 2), y: B.rows - B.groundRows - def.h }
          : null;
        say(
          withKeys
            ? BUILDER_COPY.ghostAt(def.name, cursor!.x, cursor!.y)
            : BUILDER_COPY.hintPicked(def.name),
        );
      }
      drawArmed();
      if (withKeys && armed) plotArt.focus();
    }
    const pickWithKeyboard = (def: PieceDef): void => pick(def, true);

    // ---------- Pointer dragging ----------
    /** The last refusal said while dragging, so the status line changes only when it must. */
    let dragWhy: PlaceRefusal | null = null;

    function startDrag(
      e: PointerEvent,
      from:
        | { kind: 'new'; id: string; rot: Rotation; fromPlot?: boolean }
        | { kind: 'move'; index: number },
    ): void {
      if (drag) return;
      const base = { sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
      dragWhy = null;
      if (from.kind === 'new') {
        drag = { ...base, kind: 'new', id: from.id, rot: from.rot, fromPlot: !!from.fromPlot };
        dragRot = from.rot;
      } else {
        const p = build.pieces[from.index];
        const r = p && rectOf(p);
        if (!p || !r) return;
        const { ux, uy } = plotPoint(plotBox(), e.clientX, e.clientY);
        drag = {
          ...base,
          kind: 'move',
          index: from.index,
          gx: ux / CELL - (r.l * STEP) / CELL,
          gy: uy / CELL - (r.t * STEP) / CELL,
        };
        dragRot = p.rot;
        selected = from.index;
      }
      doc.addEventListener('pointermove', onMove);
      doc.addEventListener('pointerup', onUp);
      doc.addEventListener('pointercancel', onCancel);
    }

    function dragInfo(): {
      id: string;
      skip: number | null;
      grab: { gx: number; gy: number } | null;
    } {
      const d = drag!;
      return d.kind === 'new'
        ? { id: d.id, skip: null, grab: null }
        : {
            id: build.pieces[d.index]!.piece,
            skip: d.index,
            grab: { gx: d.gx, gy: d.gy },
          };
    }

    function onMove(e: PointerEvent): void {
      const d = drag;
      if (!d || (d.pid !== undefined && e.pointerId !== undefined && e.pointerId !== d.pid)) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_START_PX) return;
      if (!d.moved) {
        d.moved = true;
        // A brick picked from the tray keeps its pick while a finger slides it on the plot.
        if (!(d.kind === 'new' && d.fromPlot)) armed = null;
        cursor = null;
      }
      const info = dragInfo();
      showGhost(info.id, dragRot, e.clientX, e.clientY);
      if (onPlot(e.clientX, e.clientY)) {
        const spot = landing(info.id, dragRot, e.clientX, e.clientY, info.grab, info.skip);
        drawPreview(spot ? { id: info.id, rot: dragRot, pos: spot.pos, ok: spot.ok } : null);
        ghost.setAttribute('data-ok', String(spot?.ok ?? false));
        const why = spot?.why ?? null;
        if (why !== dragWhy) {
          dragWhy = why;
          if (why) say(refusalText(why));
        }
      } else {
        drawPreview(null);
        ghost.removeAttribute('data-ok');
      }
      if (e.cancelable) e.preventDefault();
    }

    function endDrag(): Drag | null {
      const d = drag;
      drag = null;
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onCancel);
      ghost.hidden = true;
      ghost.removeAttribute('data-ok');
      return d;
    }

    function onCancel(): void {
      endDrag();
      say(BUILDER_COPY.cancelled);
      renderAll();
    }

    /** Puts the picked brick down where the pointer is. A refused place keeps it picked. */
    function putArmedAt(cx: number, cy: number): void {
      if (!armed) return;
      const spot = landing(armed.id, armed.rot, cx, cy, null, null);
      if (spot && spot.ok) putDown(armed.id, armed.rot, spot.pos);
      else {
        say(refusalText(spot?.why ?? 'overlap'));
        renderAll();
      }
    }

    function onUp(e: PointerEvent): void {
      const d = drag;
      if (!d || (d.pid !== undefined && e.pointerId !== undefined && e.pointerId !== d.pid)) return;
      const info = dragInfo();
      endDrag();
      const here = onPlot(e.clientX, e.clientY);
      if (!d.moved) {
        if (d.kind === 'new' && d.fromPlot) {
          // A tap on the plot with a picked brick puts it down right there.
          putArmedAt(e.clientX, e.clientY);
          return;
        }
        // A tap. A tray brick is picked (tap the plot to put it down). A placed brick is chosen.
        if (d.kind === 'new') pick(pieceById(d.id)!, false);
        else {
          selected = d.index;
          say(BUILDER_COPY.selected(nameOf(info.id)));
          renderAll();
          focusPiece(selected);
        }
        return;
      }
      if (here) {
        const spot = landing(info.id, dragRot, e.clientX, e.clientY, info.grab, info.skip);
        if (!spot || !spot.ok) {
          // Nothing changes: a carried brick goes back where it was, a new one back to the tray.
          say(refusalText(spot?.why ?? 'overlap'));
          renderAll();
        } else if (d.kind === 'new') {
          if (d.fromPlot && armed) armed = { ...armed, rot: dragRot };
          putDown(d.id, dragRot, spot.pos);
        } else moveTo(d.index, spot.pos, dragRot);
        return;
      }
      // Dropped off the plot. A placed brick dropped on the tray comes off. Anything else cancels.
      const overTray =
        within(tray.getBoundingClientRect(), e.clientX, e.clientY) ||
        within(shapesTray.getBoundingClientRect(), e.clientX, e.clientY);
      if (d.kind === 'move' && overTray) doRemove(d.index);
      else {
        say(BUILDER_COPY.cancelled);
        renderAll();
      }
    }

    function moveTo(index: number, pos: Pos, rot: Rotation): void {
      const cur = build.pieces[index];
      if (!cur) return;
      // A brick turned while it was carried moves and turns in one step (one Undo).
      const result = movePiece(build, index, pos, rot);
      if (!result.ok) {
        say(refusalText(result.reason));
        renderAll();
        return;
      }
      build = result.state;
      selected = index;
      persist();
      say(BUILDER_COPY.moved(nameOf(cur.piece)));
      renderAll();
      focusPiece(index);
    }

    function showGhost(id: string, rot: Rotation, cx: number, cy: number): void {
      const def = pieceById(id);
      if (!def) return;
      const { scale } = plotPoint(plotBox(), 0, 0);
      const f = footprint(def, rot);
      const w = f.w * CELL * scale;
      const hgt = f.h * CELL * scale;
      ghost.hidden = false;
      const art = ghostIcon(doc, id, rot);
      art.setAttribute('width', String(w));
      art.setAttribute('height', String(hgt));
      ghost.replaceChildren(art);
      ghost.style.left = `${cx - w / 2}px`;
      ghost.style.top = `${cy - hgt / 2}px`;
    }

    // ---------- Plot events ----------
    plotArt.addEventListener('pointerdown', (e) => {
      if ((e.button ?? 0) !== 0 || drag) return;
      if (mode === 'weapons') return;
      if (armed) {
        // A picked brick: a tap anywhere on the plot (even on a brick, to stack on it) puts it
        // down there, and a press and slide carries it to where the finger lets go.
        startDrag(e, { kind: 'new', id: armed.id, rot: armed.rot, fromPlot: true });
        showGhost(armed.id, armed.rot, e.clientX, e.clientY);
        if (e.cancelable) e.preventDefault();
        return;
      }
      const hit = (e.target as Element | null)?.closest?.('.tc-bb-piece');
      if (hit) {
        startDrag(e, { kind: 'move', index: Number(hit.getAttribute('data-index')) });
        return;
      }
      selected = null;
      drawPreview(null);
      piecesLayer
        .querySelectorAll('[data-selected]')
        .forEach((n) => n.removeAttribute('data-selected'));
    });
    plotArt.addEventListener('dragstart', (e) => e.preventDefault());
    // A mouse over the plot with a picked brick shows where it would go (a finger has no hover).
    plotArt.addEventListener('pointermove', (e) => {
      if (!armed || drag || mode !== 'build' || e.pointerType === 'touch') return;
      cursor = null;
      const spot = landing(armed.id, armed.rot, e.clientX, e.clientY, null, null);
      drawPreview(spot ? { id: armed.id, rot: armed.rot, pos: spot.pos, ok: spot.ok } : null);
    });
    plotArt.addEventListener('pointerleave', () => {
      if (armed && !drag && !cursor) drawPreview(null);
    });
    // Weapons mode: a tap on a pad chooses it. A tap anywhere else on the plot lets go of it.
    plotArt.addEventListener('click', (e) => {
      if (mode !== 'weapons') return;
      const pad = (e.target as Element | null)?.closest?.('.tc-bb-spot');
      if (pad) selectSpot(Number(pad.getAttribute('data-spot')), e.detail === 0);
      else if (selSpot !== null) {
        selSpot = null;
        hintDefault();
        renderSpots();
        renderPanel();
      }
    });
    buildModeBtn.addEventListener('click', () => setMode('build'));
    weaponsModeBtn.addEventListener('click', () => setMode('weapons'));
    clearSpotBtn.addEventListener('click', doClearSpot);
    const onResize = (): void => renderSpots();
    doc.defaultView?.addEventListener('resize', onResize);

    // ---------- Tools ----------
    turnBtn.addEventListener('click', () => {
      if (mode === 'build') doTurn();
    });
    undoBtn.addEventListener('click', doUndo);
    snapBtn.addEventListener('click', () => {
      if (mode !== 'build') return;
      snap = !snap;
      say(BUILDER_COPY.snapLabel(snap));
      renderTools();
    });
    clearBtn.addEventListener('click', () => {
      if (build.pieces.length === 0) return;
      ask(BUILDER_COPY.clearAsk, BUILDER_COPY.clearYes, BUILDER_COPY.clearNo, clearBtn, () => {
        build = clearBuild(build);
        selected = null;
        persist();
        say(BUILDER_COPY.cleared);
        renderAll();
      });
    });
    confirm.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
      if (!act) return;
      confirm.hidden = true;
      const yes = onYes;
      const back = askFrom;
      onYes = null;
      askFrom = null;
      if (act === 'yes') yes?.();
      if (back?.isConnected) back.focus();
    });

    // ---------- Keyboard ----------
    function weaponKeys(e: KeyboardEvent): void {
      const k = e.key;
      const target = e.target as Element;
      const pad = target.closest?.('.tc-bb-spot');
      if (pad) {
        const i = Number(pad.getAttribute('data-spot'));
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          selectSpot(i, true);
        } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
          e.preventDefault();
          const next = (i + (k === 'ArrowRight' ? 1 : -1) + B.spots.count) % B.spots.count;
          focusSpot(next);
        } else if (k === 'Delete' || k === 'Backspace') {
          e.preventDefault();
          const keep = selSpot;
          selSpot = i;
          doClearSpot();
          selSpot = keep;
          renderAll();
          focusSpot(i);
        }
        return;
      }
      if (!weaponPanel.contains(target)) return;
      const rows = [...weaponPanel.querySelectorAll<HTMLElement>('.tc-bb-weapon')];
      const at = rows.indexOf(target.closest('.tc-bb-weapon') as HTMLElement);
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        rows[(at + (k === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length]?.focus();
      } else if (k === 'Delete' || k === 'Backspace') {
        e.preventDefault();
        const keep = selSpot;
        doClearSpot();
        focusSpot(keep);
      } else if (k === 'Escape') {
        e.preventDefault();
        const keep = selSpot;
        selSpot = null;
        hintDefault();
        renderSpots();
        renderPanel();
        focusSpot(keep);
      }
    }

    screen.addEventListener('keydown', (e) => {
      const k = e.key;
      if (padOpen) {
        padKeyDown(e);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) {
        e.preventDefault();
        doUndo();
        return;
      }
      if (drag && (k === 'r' || k === 'R')) {
        dragRot = rotate(dragRot);
        return;
      }
      if (mode === 'weapons') {
        weaponKeys(e);
        return;
      }
      const onPiece = (e.target as Element).closest?.('.tc-bb-piece');
      if (armed && cursor && (e.target === plotArt || onPiece)) {
        const def = pieceById(armed.id)!;
        const move: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const dir = move[k];
        if (dir) {
          e.preventDefault();
          const c = clampToPlot(def, armed.rot, {
            x: cursor.x + dir[0],
            y: cursor.y + dir[1],
            ox: 0,
            oy: 0,
          });
          cursor = { x: c.x, y: c.y };
          say(BUILDER_COPY.ghostAt(def.name, c.x, c.y));
          drawArmed();
        } else if (k === 'r' || k === 'R') {
          doTurn();
          drawArmed();
        } else if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          const r = resolveSpot(def, armed.rot, { x: cursor.x, y: cursor.y, ox: 0, oy: 0 }, null);
          if (r.ok) {
            putDown(armed.id, armed.rot, r.pos);
            focusPiece(selected);
          } else say(refusalText(r.why ?? 'overlap'));
        } else if (k === 'Escape') {
          armed = null;
          cursor = null;
          hintDefault();
          drawArmed();
        }
        return;
      }
      if (onPiece) {
        const index = Number(onPiece.getAttribute('data-index'));
        const cur = build.pieces[index];
        if (!cur) return;
        const dirs: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const dir = dirs[k];
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          selected = index;
          say(BUILDER_COPY.selected(nameOf(cur.piece)));
          renderAll();
          focusPiece(index);
        } else if (dir) {
          e.preventDefault();
          selected = index;
          const def = pieceById(cur.piece)!;
          const to = clampToPlot(def, cur.rot, { ...cur, x: cur.x + dir[0], y: cur.y + dir[1] });
          moveTo(index, to, cur.rot);
        } else if (k === 'r' || k === 'R') {
          selected = index;
          doTurn();
        } else if (k === 'Delete' || k === 'Backspace') {
          e.preventDefault();
          // A brick that holds another stays, so the keyboard stays on it.
          if (doRemove(index)) plotArt.focus();
          else focusPiece(index);
        }
      }
    });

    // ---------- Your own shapes: the drawing pad ----------
    /** The L the pad starts with, so a first shape is one tap away. */
    const STARTER: readonly Cell[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    let padOpen = false;
    /** Filled squares as "column,row". */
    let padOn = new Set<string>();
    /** The one square that Tab reaches (the arrow keys move it). */
    let padAt = { r: 0, c: 0 };
    let paint: boolean | null = null;
    let skipClick: Element | null = null;

    const sqAt = (r: number, c: number): HTMLButtonElement | undefined =>
      padSquares[r * B.shapePad + c];
    const padCells = (): Cell[] =>
      [...padOn].map((k) => {
        const [c, r] = k.split(',').map(Number);
        return [c!, r!] as Cell;
      });

    /** Can this drawing be saved? If not, the plain words that say why. */
    function padStatus(): { ok: boolean; text: string } {
      const cells = padCells();
      const problem = shapeProblem(cells);
      if (problem) return { ok: false, text: SHAPE_COPY.problem[problem] };
      const have = shapesOf(bases, name, team);
      if (have.includes(shapeKey(cells))) return { ok: false, text: SHAPE_COPY.problem.duplicate };
      if (have.length >= B.maxShapes) return { ok: false, text: SHAPE_COPY.problem.full };
      return { ok: true, text: SHAPE_COPY.ok };
    }

    function syncInert(): void {
      const weapons = mode === 'weapons';
      tray.toggleAttribute('inert', weapons || padOpen);
      shapesTray.toggleAttribute('inert', weapons || padOpen);
      plotWrap.toggleAttribute('inert', padOpen);
      tools.toggleAttribute('inert', padOpen);
    }

    function renderPad(): void {
      for (const [i, sq] of padSquares.entries()) {
        const r = Math.floor(i / B.shapePad);
        const c = i % B.shapePad;
        const on = padOn.has(`${c},${r}`);
        sq.setAttribute('aria-pressed', String(on));
        sq.setAttribute('aria-label', SHAPE_COPY.square(r + 1, c + 1, on));
        sq.tabIndex = r === padAt.r && c === padAt.c ? 0 : -1;
      }
      const cells = padCells();
      padPreview.replaceChildren(...(cells.length ? [shapeIcon(doc, team, cells, 72)] : []));
      padCount.textContent = SHAPE_COPY.count(padOn.size);
      const st = padStatus();
      padMsg.textContent = st.text;
      padMsg.setAttribute('data-ok', String(st.ok));
      padSave.setAttribute('aria-disabled', String(!st.ok));
    }

    function setSquare(r: number, c: number, on: boolean): void {
      const k = `${c},${r}`;
      if (padOn.has(k) === on) return;
      if (on) padOn.add(k);
      else padOn.delete(k);
      padAt = { r, c };
      renderPad();
    }

    function openPad(): void {
      armed = null;
      cursor = null;
      selected = null;
      drawArmed();
      padOn = new Set(STARTER.map(([c, r]) => `${c},${r}`));
      padAt = { r: 0, c: 0 };
      padOpen = true;
      pad.hidden = false;
      syncInert();
      renderPad();
      sqAt(0, 0)?.focus();
    }

    function closePad(refocus = true): void {
      padOpen = false;
      pad.hidden = true;
      syncInert();
      if (refocus) ownTile.focus();
    }

    function savePad(): void {
      const st = padStatus();
      if (!st.ok) {
        padMsg.textContent = '';
        padMsg.textContent = st.text;
        return;
      }
      const result = saveShape(bases, name, team, padCells());
      if (!result.ok) {
        padMsg.textContent = SHAPE_COPY.problem[result.reason];
        return;
      }
      bases = result.state;
      options.saveBases(bases);
      closePad(false);
      renderAll();
      say(SHAPE_COPY.saved);
      const tile = [...shapesTray.querySelectorAll<HTMLElement>('.tc-bb-mine')].find(
        (t) => t.getAttribute('data-piece') === result.id,
      );
      tile?.focus();
    }

    function endPaint(): void {
      paint = null;
      doc.removeEventListener('pointermove', onPaint);
      doc.removeEventListener('pointerup', endPaint);
      doc.removeEventListener('pointercancel', endPaint);
      // The click that follows a press has already run by the time this timer does.
      doc.defaultView?.setTimeout(() => (skipClick = null), 0);
    }

    /** Dragging across the pad fills (or empties) every square the pointer crosses. */
    function onPaint(e: PointerEvent): void {
      if (paint === null) return;
      const under = doc.elementFromPoint?.(e.clientX, e.clientY)?.closest?.('.tc-bb-sq');
      if (!under || !padGrid.contains(under)) return;
      setSquare(Number(under.getAttribute('data-r')), Number(under.getAttribute('data-c')), paint);
      if (e.cancelable) e.preventDefault();
    }

    padGrid.addEventListener('pointerdown', (e) => {
      if ((e.button ?? 0) !== 0 || paint !== null) return;
      const sq = (e.target as Element | null)?.closest?.('.tc-bb-sq');
      if (!sq) return;
      const r = Number(sq.getAttribute('data-r'));
      const c = Number(sq.getAttribute('data-c'));
      paint = !padOn.has(`${c},${r}`);
      skipClick = sq;
      setSquare(r, c, paint);
      doc.addEventListener('pointermove', onPaint);
      doc.addEventListener('pointerup', endPaint);
      doc.addEventListener('pointercancel', endPaint);
    });
    // A key press (Space) or a tap that sent no pointer events toggles here.
    padGrid.addEventListener('click', (e) => {
      const sq = (e.target as Element | null)?.closest?.('.tc-bb-sq');
      if (!sq) return;
      if (skipClick === sq) {
        skipClick = null;
        return;
      }
      const r = Number(sq.getAttribute('data-r'));
      const c = Number(sq.getAttribute('data-c'));
      setSquare(r, c, !padOn.has(`${c},${r}`));
    });
    padClear.addEventListener('click', () => {
      padOn = new Set();
      renderPad();
      sqAt(padAt.r, padAt.c)?.focus();
    });
    padSave.addEventListener('click', savePad);
    padClose.addEventListener('click', () => closePad());

    function padKeyDown(e: KeyboardEvent): void {
      const k = e.key;
      if (k === 'Escape') {
        e.preventDefault();
        closePad();
        return;
      }
      const sq = (e.target as Element).closest?.('.tc-bb-sq');
      if (!sq) return;
      const r = Number(sq.getAttribute('data-r'));
      const c = Number(sq.getAttribute('data-c'));
      const move: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const dir = move[k];
      if (dir) {
        e.preventDefault();
        const nr = Math.min(Math.max(r + dir[1], 0), B.shapePad - 1);
        const nc = Math.min(Math.max(c + dir[0], 0), B.shapePad - 1);
        padAt = { r: nr, c: nc };
        renderPad();
        sqAt(nr, nc)?.focus();
      } else if (k === 'Enter') {
        e.preventDefault();
        savePad();
      }
    }

    // ---------- Finish ----------
    const close = ctx.openScreen(screen);
    const finish = (next: Team | null = null): void => {
      endDrag();
      endPaint();
      doc.defaultView?.removeEventListener('resize', onResize);
      close();
      resolve(next);
    };
    back.addEventListener('click', () => finish());
    doneBtn.addEventListener('click', () => finish());
    teamPicker.addEventListener('click', (e) => {
      const chip = (e.target as Element).closest<HTMLElement>('[data-team]');
      const picked = TEAMS.find((t) => t === chip?.dataset.team);
      if (picked && picked !== team) finish(picked);
    });
    // An old base with floating bricks was set down when it opened: save that and say so once.
    if (settledOnOpen) {
      persist();
      say(BUILDER_COPY.settled);
    } else hintDefault();
    renderAll();
    back.focus();
  });
}

export { TEST_IDS };
