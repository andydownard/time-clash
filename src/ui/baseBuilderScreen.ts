// The base builder: build a castle (Team Past) or a base (Team Future) from bricks before a
// battle. Drag a brick from the tray onto the plot, turn it, move it, drag it back to remove it.
// Every change is saved at once through `saveBases`. The rules live in src/game/baseBuilder.ts.
import '../styles/baseBuilder.css';
import { BUILDER_COPY, FORGE_COPY } from '../data/copy';
import {
  assignWeapon,
  basesOf,
  chooseSlot,
  clampToPlot,
  clearBuild,
  clearSpot,
  check,
  findSpot,
  footprint,
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
  saveSlot,
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
  type SpotWeaponDef,
  type Pos,
  type Rotation,
} from '../game/baseBuilder';
import { BASE_BUILDER as B } from '../game/config';
import { unlockPiece, unlockSpotWeapon } from '../game/economy';
import { walletOf, type CampState } from '../game/loadout';
import type { UiCtx } from './ctx';
import { h } from './dom';
import {
  baseThumb,
  CELL,
  ghostIcon,
  nodesFromMarkup,
  placedMarkup,
  plotScene,
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

type Box = { left: number; top: number; width: number; height: number };

/**
 * Where a screen point is on the plot, in picture units, and how big one unit is on screen.
 * The picture is fitted inside its box and centered, so the empty side bands are skipped.
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
  | { kind: 'new'; id: string; rot: Rotation; sx: number; sy: number; moved: boolean; pid: number }
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

export function showBaseBuilder(ctx: UiCtx, options: BuilderOptions): Promise<void> {
  const { doc } = ctx;
  return new Promise<void>((resolve) => {
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

    const confirm = h(
      doc,
      'div',
      {
        class: 'tc-bb-confirm',
        role: 'alertdialog',
        'aria-label': BUILDER_COPY.clearAsk,
        hidden: true,
      },
      h(doc, 'p', { text: BUILDER_COPY.clearAsk }),
      h(
        doc,
        'div',
        { class: 'tc-row' },
        h(doc, 'button', {
          type: 'button',
          class: 'tc-btn tc-btn-primary',
          'data-testid': 'bb-clear-yes',
          'data-act': 'yes',
          text: BUILDER_COPY.clearYes,
        }),
        h(doc, 'button', {
          type: 'button',
          class: 'tc-btn tc-btn-neutral',
          'data-testid': 'bb-clear-no',
          'data-act': 'no',
          text: BUILDER_COPY.clearNo,
        }),
      ),
    );
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
    const spotChip = h(doc, 'p', { class: 'tc-bb-chip', 'data-testid': 'bb-spots-chip' });
    const modeBar = h(
      doc,
      'div',
      { class: 'tc-bb-modebar' },
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
    const plotWrap = h(doc, 'div', { class: 'tc-bb-plot' }, plotArt, modeBar, weaponPanel, confirm);

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
    const ghost = h(doc, 'div', { class: 'tc-bb-ghost', 'aria-hidden': 'true', hidden: true });
    const keys = h(doc, 'p', { class: 'tc-sr-only', text: BUILDER_COPY.keys });
    const spotKeys = h(doc, 'p', { class: 'tc-sr-only', text: BUILDER_COPY.spotKeys });

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
      h(doc, 'div', { class: 'tc-bb-main' }, plotWrap, tools),
      status,
      keys,
      spotKeys,
      tray,
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
            h(doc, 'span', { text: BUILDER_COPY.slot(i + 1) }),
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
          if (!open) words.append(h(doc, 'span', { text: BUILDER_COPY.unlockCost(def.scrap ?? 0) }));
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
      tray.toggleAttribute('inert', weapons);
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
          say(FORGE_COPY.needMore(Math.max(1, (def.scrap ?? 0) - walletOf(camp, name).scrap)));
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
    const plotBox = (): Box => plotArt.getBoundingClientRect();

    /** Where a carried brick would land for a pointer position (resolved to a free spot). */
    function landing(
      id: string,
      rot: Rotation,
      cx: number,
      cy: number,
      grab: { gx: number; gy: number } | null,
      skip: number | null,
    ): { pos: Pos; ok: boolean } | null {
      const def = pieceById(id);
      if (!def) return null;
      const { ux, uy } = plotPoint(plotBox(), cx, cy);
      const f = footprint(def, rot);
      const fx = ux / CELL - (grab ? grab.gx : f.w / 2);
      const fy = uy / CELL - (grab ? grab.gy : f.h / 2);
      return resolveSpot(def, rot, positionFromPoint(fx, fy, snap), skip);
    }

    function resolveSpot(
      def: PieceDef,
      rot: Rotation,
      want: Pos,
      skip: number | null,
    ): { pos: Pos; ok: boolean } {
      const pos = clampToPlot(def, rot, want);
      const cand: Placed = { piece: def.id, ...pos, rot, hp: def.hp };
      if (check(build.pieces, cand, skip) === null) return { pos, ok: true };
      const near = findSpot(build.pieces, cand, skip);
      return near ? { pos: near, ok: true } : { pos, ok: false };
    }

    // ---------- Actions ----------
    function applied(result: ReturnType<typeof placePiece>, ok: string): boolean {
      if (!result.ok) {
        say(result.reason === 'full' ? BUILDER_COPY.full : BUILDER_COPY.noRoom);
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
        armed = { ...armed, rot: rotate(armed.rot) };
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

    function doRemove(index: number): void {
      const p = build.pieces[index];
      const result = removePiece(build, index);
      if (!p || !result.ok) return;
      build = result.state;
      selected = null;
      persist();
      say(BUILDER_COPY.removed(nameOf(p.piece)));
      renderAll();
    }

    function switchSlot(i: number): void {
      if (i === slot) return;
      slot = i;
      bases = chooseSlot(bases, name, team, slot);
      options.saveBases(bases);
      build = loadSlot();
      selected = null;
      selSpot = null;
      armed = null;
      cursor = null;
      hintDefault();
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
        say(FORGE_COPY.needMore(Math.max(1, cost - walletOf(camp, name).scrap)));
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
      for (const b of tray.querySelectorAll<HTMLElement>('.tc-bb-brick[data-state="owned"]')) {
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
    function startDrag(
      e: PointerEvent,
      from: { kind: 'new'; id: string; rot: Rotation } | { kind: 'move'; index: number },
    ): void {
      if (drag) return;
      const base = { sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
      if (from.kind === 'new') {
        drag = { ...base, kind: 'new', id: from.id, rot: from.rot };
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
        armed = null;
        cursor = null;
      }
      const info = dragInfo();
      showGhost(info.id, dragRot, e.clientX, e.clientY);
      const box = plotBox();
      if (within(box, e.clientX, e.clientY)) {
        const spot = landing(info.id, dragRot, e.clientX, e.clientY, info.grab, info.skip);
        drawPreview(spot ? { id: info.id, rot: dragRot, pos: spot.pos, ok: spot.ok } : null);
      } else drawPreview(null);
      if (e.cancelable) e.preventDefault();
    }

    function endDrag(): Drag | null {
      const d = drag;
      drag = null;
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onCancel);
      ghost.hidden = true;
      return d;
    }

    function onCancel(): void {
      endDrag();
      say(BUILDER_COPY.cancelled);
      renderAll();
    }

    function onUp(e: PointerEvent): void {
      const d = drag;
      if (!d || (d.pid !== undefined && e.pointerId !== undefined && e.pointerId !== d.pid)) return;
      const info = dragInfo();
      endDrag();
      const box = plotBox();
      const onPlot = within(box, e.clientX, e.clientY);
      if (!d.moved) {
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
      if (onPlot) {
        const spot = landing(info.id, dragRot, e.clientX, e.clientY, info.grab, info.skip);
        if (!spot || !spot.ok) {
          say(BUILDER_COPY.noRoom);
          renderAll();
        } else if (d.kind === 'new') putDown(d.id, dragRot, spot.pos);
        else moveTo(d.index, spot.pos, dragRot);
        return;
      }
      // Dropped off the plot. A placed brick dropped on the tray comes off. Anything else cancels.
      const overTray = within(tray.getBoundingClientRect(), e.clientX, e.clientY);
      if (d.kind === 'move' && overTray) doRemove(d.index);
      else {
        say(BUILDER_COPY.cancelled);
        renderAll();
      }
    }

    function moveTo(index: number, pos: Pos, rot: Rotation): void {
      const cur = build.pieces[index];
      if (!cur) return;
      let state = build;
      if (rot !== cur.rot) {
        // The carried brick was turned in the air: turn it first, then move.
        let turns = 0;
        let r = cur.rot;
        while (r !== rot && turns < 4) {
          const t = turnPiece(state, index);
          if (!t.ok) break;
          state = { ...t.state, undo: state.undo };
          r = rotate(r);
          turns++;
        }
      }
      const result = movePiece(state, index, pos);
      if (!result.ok) {
        say(BUILDER_COPY.noRoom);
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
      const hit = (e.target as Element | null)?.closest?.('.tc-bb-piece');
      if (hit) {
        startDrag(e, { kind: 'move', index: Number(hit.getAttribute('data-index')) });
        return;
      }
      if (armed) {
        // Tap the plot to put down the picked brick.
        const spot = landing(armed.id, armed.rot, e.clientX, e.clientY, null, null);
        if (spot && spot.ok) putDown(armed.id, armed.rot, spot.pos);
        else say(BUILDER_COPY.noRoom);
        return;
      }
      selected = null;
      drawPreview(null);
      piecesLayer
        .querySelectorAll('[data-selected]')
        .forEach((n) => n.removeAttribute('data-selected'));
    });
    plotArt.addEventListener('dragstart', (e) => e.preventDefault());
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
      confirm.hidden = false;
      (confirm.querySelector('[data-act="no"]') as HTMLElement).focus();
    });
    confirm.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
      if (!act) return;
      confirm.hidden = true;
      if (act === 'yes') {
        build = clearBuild(build);
        selected = null;
        persist();
        say(BUILDER_COPY.cleared);
        renderAll();
      }
      clearBtn.focus();
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
          } else say(BUILDER_COPY.noRoom);
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
          doRemove(index);
          plotArt.focus();
        }
      }
    });

    // ---------- Finish ----------
    const close = ctx.openScreen(screen);
    const finish = (): void => {
      endDrag();
      doc.defaultView?.removeEventListener('resize', onResize);
      close();
      resolve();
    };
    back.addEventListener('click', finish);
    doneBtn.addEventListener('click', finish);
    hintDefault();
    renderAll();
    back.focus();
  });
}

export { TEST_IDS };
