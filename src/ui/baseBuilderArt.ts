// Base builder pictures, drawn as inline SVG: each brick, the build plot, and the small thumbnail
// shown on the Camp. Team Past bricks follow the design comp (thick ink outlines, stone, wood).
// Team Future bricks use the same outlines in the hologram and metal palette. Nothing is fetched,
// and no text a player typed ever goes into the markup (only fixed piece ids).
import { BASE_BUILDER as B } from '../game/config';
import {
  footprint,
  pieceById,
  rectOf,
  spotWeaponById,
  type PieceDef,
  type Placed,
  type ResolvedSpot,
} from '../game/baseBuilder';
import type { Team } from '../game/types';
import { svgFromString } from './svg';

/** One grid cell in picture units. The plot picture is cols * CELL wide. */
export const CELL = 40;
export const PLOT_W = B.cols * CELL;
export const PLOT_H = B.rows * CELL;
/** Steps (free grid) to picture units. */
export const STEP = CELL / B.freeSteps;

const INK = '#12102b';
const O = `stroke="${INK}" stroke-width="4"`;
const SHINE = (w: number): string =>
  `<path d="M6,10 H${Math.max(10, Math.min(w - 10, 30))}" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round" fill="none"/>`;

/** The picture of one brick, drawn upright in a W by H box (cells times CELL). */
function art(id: string, W: number, H: number): string {
  switch (id) {
    case 'stone':
      return `<rect width="${W}" height="${H}" rx="4" fill="#9aa8bd" ${O}/>${SHINE(W)}<path d="M${W - 30},${H - 5} l6,-8 l-3,-6" stroke="${INK}" stroke-opacity=".5" stroke-width="2" fill="none"/>`;
    case 'long':
      return `<rect width="${W}" height="${H}" rx="4" fill="#8c84a8" ${O}/>${SHINE(W)}<path d="M${W * 0.62},${H - 5} l6,-8 l-3,-6 M${W * 0.3},0 v${H}" stroke="${INK}" stroke-opacity=".4" stroke-width="2" fill="none"/>`;
    case 'plank': {
      const y = (H - 24) / 2;
      return `<g transform="translate(0 ${y})"><rect width="${W}" height="24" rx="3" fill="#a8672b" ${O}/><path d="M8,12 H${W - 8}" stroke="#6e3f17" stroke-width="2" fill="none" stroke-dasharray="14 8"/><circle cx="8" cy="12" r="2" fill="${INK}"/><circle cx="${W - 8}" cy="12" r="2" fill="${INK}"/></g>`;
    }
    case 'tower':
      return `<rect width="${W}" height="${H}" rx="12" fill="#9aa8bd" ${O}/><path d="M9,4 V${H - 4} M${W - 9},4 V${H - 4}" stroke="#6f7c93" stroke-width="3" fill="none" opacity=".7"/><path d="M4,${H / 2} H${W - 4}" stroke="${INK}" stroke-opacity=".45" stroke-width="2"/><path d="M${W / 2 - 5},14 h10 v18 q-5,5 -10,0 z" fill="${INK}"/>`;
    case 'wallTop': {
      const u = W / 120;
      const p = (n: number): number => Math.round(n * u * 10) / 10;
      return `<path d="M0,${H} V0 H${p(28)} V14 H${p(46)} V0 H${p(74)} V14 H${p(92)} V0 H${W} V${H} Z" fill="#b4bfd0" ${O} stroke-linejoin="round"/><path d="M4,${H - 12} H${W - 4}" stroke="${INK}" stroke-opacity=".4" stroke-width="2"/>`;
    }
    case 'arch':
      return `<rect width="${W}" height="${H}" rx="4" fill="#8c84a8" ${O}/><path d="M${W * 0.22},${H} V${H * 0.52} Q${W / 2},${H * 0.07} ${W * 0.78},${H * 0.52} V${H} Z" fill="#2b2548" ${O}/><path d="M8,12 H30" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>`;
    case 'gate':
      return `<rect width="${W}" height="${H}" fill="#5f5880" ${O}/><path d="M8,${H} V${H * 0.47} Q${W / 2},${H * 0.03} ${W - 8},${H * 0.47} V${H} Z" fill="#7a4a24" ${O}/><path d="M${W / 2},${H * 0.2} V${H} M${W * 0.3},${H * 0.42} V${H} M${W * 0.7},${H * 0.42} V${H} M10,${H * 0.65} H${W - 10}" stroke="${INK}" stroke-width="3" fill="none"/><circle cx="${W * 0.4}" cy="${H * 0.72}" r="3" fill="#ffb23e"/><circle cx="${W * 0.6}" cy="${H * 0.72}" r="3" fill="#ffb23e"/>`;
    case 'flag':
      return `<rect x="${W / 2 - 3}" y="2" width="6" height="${H - 4}" rx="2" fill="#f7ebcb" stroke="${INK}" stroke-width="3"/><path d="M${W / 2 + 3},6 L${W - 2},16 L${W / 2 + 3},28 Z" fill="#ff5fb0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="${W / 2}" cy="4" r="4" fill="#ffb23e" stroke="${INK}" stroke-width="2"/>`;
    case 'panel':
      return `<rect width="${W}" height="${H}" rx="6" fill="#2a3a66" ${O}/><rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="3" fill="#1d2744" stroke="#2ee6ff" stroke-width="2"/><path d="M12,${H / 2} H${W - 12}" stroke="#2ee6ff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
    case 'beam':
      return `<rect width="${W}" height="${H}" rx="6" fill="#5d6c8c" ${O}/><path d="M8,${H / 2} H${W - 8}" stroke="#2ee6ff" stroke-width="4" stroke-linecap="round"/><path d="M${W * 0.25},4 V${H - 4} M${W * 0.5},4 V${H - 4} M${W * 0.75},4 V${H - 4}" stroke="${INK}" stroke-opacity=".45" stroke-width="2"/>`;
    case 'solar': {
      const cols = [1, 2].map((i) => `M${(W * i) / 3},4 V${H - 4}`).join(' ');
      return `<rect width="${W}" height="${H}" rx="4" fill="#1d2744" ${O}/><path d="${cols} M4,${H / 2} H${W - 4}" stroke="#2ee6ff" stroke-width="2" opacity=".85" fill="none"/><path d="M8,9 H${W * 0.3}" stroke="#bfeaff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
    }
    case 'antenna':
      return `<path d="M${W / 2},${H - 2} V16" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${W / 2},${H - 2} V16" stroke="#b9c4d0" stroke-width="4" stroke-linecap="round"/><path d="M${W / 2 - 14},20 Q${W / 2},4 ${W / 2 + 14},20" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${W / 2 - 14},20 Q${W / 2},4 ${W / 2 + 14},20" fill="none" stroke="#2ee6ff" stroke-width="3.5" stroke-linecap="round"/><circle cx="${W / 2}" cy="10" r="5" fill="#ff3dae" stroke="${INK}" stroke-width="2"/>`;
    case 'laserBase':
      return `<path d="M2,${H} L12,${H * 0.55} H${W - 12} L${W - 2},${H} Z" fill="#5d6c8c" ${O} stroke-linejoin="round"/><circle cx="${W / 2}" cy="${H * 0.45}" r="${W * 0.2}" fill="#2a3a66" ${O}/><path d="M${W / 2},${H * 0.45} L${W - 6},${H * 0.12}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M${W / 2},${H * 0.45} L${W - 6},${H * 0.12}" stroke="#ff3dae" stroke-width="5" stroke-linecap="round"/><circle cx="${W / 2}" cy="${H * 0.45}" r="5" fill="#7cffc4"/>`;
    case 'hangarDoor': {
      const slats = [0.3, 0.45, 0.6, 0.75, 0.9].map((f) => `M10,${H * f} H${W - 10}`).join(' ');
      return `<rect width="${W}" height="${H}" rx="4" fill="#b9c4d0" ${O}/><rect x="10" y="10" width="${W - 20}" height="${H - 10}" fill="#5d6c8c" stroke="${INK}" stroke-width="3"/><path d="${slats}" stroke="${INK}" stroke-width="3" fill="none"/><path d="M12,16 H${W - 12}" stroke="#2ee6ff" stroke-width="4" stroke-linecap="round"/>`;
    }
    case 'powerCore':
      return `<rect width="${W}" height="${H}" rx="10" fill="#2a3a66" ${O}/><circle cx="${W / 2}" cy="${H / 2}" r="${W * 0.28}" fill="#7cffc4" stroke="${INK}" stroke-width="4"/><circle cx="${W / 2}" cy="${H / 2}" r="${W * 0.14}" fill="#fff" opacity=".85"/><path d="M8,8 h14 M${W - 22},${H - 8} h14" stroke="#2ee6ff" stroke-width="3" stroke-linecap="round"/>`;
    default:
      return '';
  }
}

/** Where a brick sits and how it is turned, as an SVG transform, in picture units. */
function placeTransform(def: PieceDef, rot: number, left: number, top: number): string {
  const f = footprint(def, rot as 0 | 90 | 180 | 270);
  const cx = left + (f.w * CELL) / 2;
  const cy = top + (f.h * CELL) / 2;
  return `translate(${cx} ${cy}) rotate(${rot}) translate(${(-def.w * CELL) / 2} ${(-def.h * CELL) / 2})`;
}

/** One placed brick, as markup. `index` lets a tap find it. */
export function placedMarkup(p: Placed, index: number, label: string): string {
  const def = pieceById(p.piece);
  const rect = rectOf(p);
  if (!def || !rect) return '';
  const tf = placeTransform(def, p.rot, rect.l * STEP, rect.t * STEP);
  return `<g class="tc-bb-piece" data-index="${index}" data-piece="${def.id}" tabindex="0" role="button" aria-label="${label}" transform="${tf}">${art(def.id, def.w * CELL, def.h * CELL)}</g>`;
}

/** A brick at a spot with no handlers (preview, thumbnail). */
export function staticMarkup(id: string, rot: number, left: number, top: number): string {
  const def = pieceById(id);
  if (!def) return '';
  return `<g transform="${placeTransform(def, rot, left, top)}">${art(def.id, def.w * CELL, def.h * CELL)}</g>`;
}

/** A tray icon for one brick: the upright piece, fitted to a 100 by 80 box. */
export function trayIcon(doc: Document, def: PieceDef): SVGElement {
  const W = def.w * CELL;
  const H = def.h * CELL;
  const scale = Math.min(96 / W, 72 / H, 1.1);
  const x = (112 - W * scale) / 2;
  const y = (84 - H * scale) / 2;
  return svgFromString(
    doc,
    `<svg viewBox="0 0 112 84" width="104" height="78" class="tc-bb-icon"><g transform="translate(${x} ${y}) scale(${scale})">${art(def.id, W, H)}</g></svg>`,
  );
}

/** Same-size outline of a brick that follows the pointer (the floating ghost). */
export function ghostIcon(doc: Document, id: string, rot: number): SVGElement {
  const def = pieceById(id);
  if (!def) return svgFromString(doc, '<svg viewBox="0 0 1 1"></svg>');
  const f = footprint(def, rot as 0 | 90 | 180 | 270);
  const W = f.w * CELL;
  const H = f.h * CELL;
  return svgFromString(
    doc,
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="tc-bb-ghost-art">${staticMarkup(id, rot, 0, 0)}</svg>`,
  );
}

const PAST_SCENE = `<defs>
<linearGradient id="tcBbSkyP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2a8c"/><stop offset=".6" stop-color="#8a4fc0"/><stop offset="1" stop-color="#f0a0b8"/></linearGradient>
<linearGradient id="tcBbGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fa070"/><stop offset="1" stop-color="#2b6a4c"/></linearGradient>
<pattern id="tcBbStone" width="40" height="24" patternUnits="userSpaceOnUse"><rect width="40" height="24" fill="#8c84a8"/><path d="M0,0 H40 M0,12 H40 M20,0 V12 M0,12 V24 M40,12 V24" stroke="#5f5880" stroke-width="2" fill="none"/></pattern>
</defs>
<rect width="${PLOT_W}" height="${PLOT_H}" fill="url(#tcBbSkyP)"/>
<path d="M0,${PLOT_H - 70} C300,${PLOT_H - 100} 600,${PLOT_H - 60} ${PLOT_W},${PLOT_H - 80} V${PLOT_H} H0 Z" fill="url(#tcBbGrass)"/>`;

const FUTURE_SCENE = `<defs>
<linearGradient id="tcBbSkyF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1a33"/><stop offset=".65" stop-color="#1d2744"/><stop offset="1" stop-color="#2a5a8c"/></linearGradient>
<pattern id="tcBbPlate" width="48" height="40" patternUnits="userSpaceOnUse"><rect width="48" height="40" fill="#5d6c8c"/><path d="M0,0 H48 M0,0 V40" stroke="#2a3a66" stroke-width="3" fill="none"/><circle cx="6" cy="6" r="2" fill="#2a3a66"/></pattern>
</defs>
<rect width="${PLOT_W}" height="${PLOT_H}" fill="url(#tcBbSkyF)"/>
<g fill="#2ee6ff" opacity=".5"><circle cx="90" cy="60" r="2"/><circle cx="260" cy="110" r="2"/><circle cx="470" cy="50" r="2"/><circle cx="700" cy="90" r="2"/><circle cx="880" cy="40" r="2"/></g>
<path d="M0,${PLOT_H - 90} L120,${PLOT_H - 150} L200,${PLOT_H - 110} L330,${PLOT_H - 200} L450,${PLOT_H - 120} L600,${PLOT_H - 170} L760,${PLOT_H - 110} L880,${PLOT_H - 160} L${PLOT_W},${PLOT_H - 100} V${PLOT_H} H0 Z" fill="#12102b" opacity=".55"/>`;

const SILHOUETTE: Record<Team, string> = {
  PAST: `M160,${PLOT_H - 40} V160 H320 V240 H440 V180 H540 V240 H700 V120 H820 V${PLOT_H - 40}`,
  FUTURE: `M140,${PLOT_H - 40} V280 H260 V200 H360 V140 H480 V200 H600 V280 H700 V200 H820 V${PLOT_H - 40}`,
};

function gridLines(): string {
  const v = Array.from({ length: B.cols - 1 }, (_, i) => `M${(i + 1) * CELL},0 V${PLOT_H}`);
  const hh = Array.from({ length: B.rows - 1 }, (_, i) => `M0,${(i + 1) * CELL} H${PLOT_W}`);
  return `<path d="${[...v, ...hh].join(' ')}" stroke="#f7ebcb" stroke-opacity=".2" stroke-width="2" fill="none"/>`;
}

/** The foundation along the bottom. It is part of the picture, not a place to build. */
function foundation(team: Team): string {
  const y = PLOT_H - B.groundRows * CELL;
  const h = B.groundRows * CELL;
  return team === 'PAST'
    ? `<rect y="${y}" width="${PLOT_W}" height="${h}" fill="url(#tcBbStone)" stroke="#3b3560" stroke-width="4"/>`
    : `<rect y="${y}" width="${PLOT_W}" height="${h}" fill="url(#tcBbPlate)" stroke="#2ee6ff" stroke-width="3"/>`;
}

/** The whole plot picture with empty layers for bricks and the drop preview. */
export function plotScene(doc: Document, team: Team): SVGElement {
  return svgFromString(
    doc,
    `<svg viewBox="0 0 ${PLOT_W} ${PLOT_H}" preserveAspectRatio="xMidYMid meet" class="tc-bb-plot-art">
${team === 'PAST' ? PAST_SCENE : FUTURE_SCENE}
${gridLines()}
${foundation(team)}
<path d="${SILHOUETTE[team]}" fill="#f7ebcb" fill-opacity=".07" stroke="#f7ebcb" stroke-opacity=".6" stroke-width="4" stroke-dasharray="4 10" stroke-linecap="round" stroke-linejoin="round"/>
<g class="tc-bb-pieces"></g><g class="tc-bb-spots"></g><g class="tc-bb-preview"></g>
</svg>`,
  );
}

/** Parses brick markup into nodes of `doc`, so they can be put in a layer. */
export function nodesFromMarkup(doc: Document, markup: string): Element[] {
  const svg = svgFromString(doc, `<svg>${markup}</svg>`);
  return [...svg.children];
}

/** A small picture of a whole base for the Camp and the slot tabs. */
export function baseThumb(doc: Document, team: Team, pieces: readonly Placed[]): SVGElement {
  const sky = team === 'PAST' ? '#6a4fb0' : '#1d2744';
  const ground = team === 'PAST' ? '#3b8a5c' : '#5d6c8c';
  const bricks = pieces
    .map((p) => {
      const rect = rectOf(p);
      return rect ? staticMarkup(p.piece, p.rot, rect.l * STEP, rect.t * STEP) : '';
    })
    .join('');
  return svgFromString(
    doc,
    `<svg viewBox="0 0 ${PLOT_W} ${PLOT_H}" preserveAspectRatio="xMidYMid meet" class="tc-bb-thumb"><rect width="${PLOT_W}" height="${PLOT_H}" fill="${sky}"/><rect y="${PLOT_H - B.groundRows * CELL}" width="${PLOT_W}" height="${B.groundRows * CELL}" fill="${ground}"/>${bricks}</svg>`,
  );
}

// ---------- Weapon spots ----------

/** The weapon pictures (48 by 48), from the design boards. Outlines use the ink colour. */
const WEAPON_ART: Record<string, string> = {
  cannon:
    '<rect x="4" y="16" width="32" height="14" rx="5" transform="rotate(-16 20 23)" fill="#6f7c93"/><path d="M32,12 l8,-2"/><circle cx="19" cy="35" r="9" fill="#a8672b"/><circle cx="19" cy="35" r="2.5" fill="#12102b"/><circle cx="42" cy="8" r="4" fill="#12102b"/>',
  catapult:
    '<rect x="4" y="34" width="38" height="8" rx="2" fill="#a8672b"/><path d="M12,34 L32,8 L39,13 L19,38 Z" fill="#a8672b"/><path d="M27,5 h14 l-2,8 h-10 z" fill="#8c84a8"/><circle cx="12" cy="43" r="4" fill="#9aa8bd"/><circle cx="36" cy="43" r="4" fill="#9aa8bd"/>',
  archerPost:
    '<rect x="12" y="20" width="18" height="24" fill="#9aa8bd"/><path d="M8,20 V8 h6 v5 h4 V8 h4 v5 h4 V8 h6 v12 z" fill="#b4bfd0"/><path d="M36,14 q10,10 0,22" fill="none" stroke-width="4"/><path d="M36,14 L36,36" stroke-width="2"/><path d="M18,34 V44"/>',
  ballista:
    '<path d="M6,16 Q24,4 42,16" fill="none" stroke="#a8672b" stroke-width="6"/><rect x="20" y="12" width="8" height="26" rx="2" fill="#a8672b"/><path d="M24,1 L30,12 H18 Z" fill="#f7ebcb"/><path d="M14,46 L24,36 L34,46" fill="none"/>',
  laser:
    '<rect x="6" y="32" width="36" height="10" rx="3" fill="#8fa3c4"/><path d="M10,32 A14,12 0 0 1 38,32 Z" fill="#5a6f9a"/><rect x="24" y="12" width="20" height="7" rx="3" transform="rotate(-24 24 15)" fill="#c9d6ee"/><circle cx="43" cy="6" r="4" fill="#4fd8ff"/>',
  missilePod:
    '<rect x="6" y="20" width="36" height="22" rx="3" fill="#5a6f9a"/><circle cx="16" cy="28" r="4" fill="#0a1236"/><circle cx="32" cy="28" r="4" fill="#0a1236"/><circle cx="16" cy="36" r="2" fill="#4fd8ff"/><circle cx="32" cy="36" r="2" fill="#4fd8ff"/><path d="M19,20 V12 L24,4 L29,12 V20" fill="#ff4fa8"/>',
  turret:
    '<rect x="8" y="34" width="32" height="9" rx="3" fill="#8fa3c4"/><path d="M12,34 A12,12 0 0 1 36,34 Z" fill="#5a6f9a"/><rect x="26" y="14" width="18" height="6" rx="2" fill="#c9d6ee"/><rect x="26" y="23" width="18" height="6" rx="2" fill="#c9d6ee"/>',
  shieldGen:
    '<path d="M24,3 L41,9 V24 Q41,39 24,45 Q7,39 7,24 V9 Z" fill="#7fe8ff"/><path d="M27,13 L18,26 H25 L22,37 L32,22 H26 Z" fill="#0a1236"/>',
};

const inkFor = (id: string): string => (spotWeaponById(id)?.team === 'FUTURE' ? '#0a1236' : INK);

/** The picture of one weapon, as markup for a 48 by 48 box. */
const weaponInner = (id: string): string =>
  `<g stroke="${inkFor(id)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${WEAPON_ART[id] ?? ''}</g>`;

/** A weapon icon for the panel and the mode switch. */
export function weaponIcon(doc: Document, id: string, size = 44): SVGElement {
  return svgFromString(
    doc,
    `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" class="tc-bb-weapon-icon">${weaponInner(id)}</svg>`,
  );
}

const PAD_R = B.spots.padSteps * STEP;

/**
 * The weapon pads, as markup in picture units. With `interactive` each pad is a focusable button
 * with a transparent tap circle of radius `hitR` (never smaller than the pad). Without it the pads
 * are only drawn (Build mode).
 */
export function spotsMarkup(
  spots: readonly ResolvedSpot[],
  label: (spot: ResolvedSpot, selected: boolean) => string,
  selected: number | null,
  interactive: boolean,
  hitR: number,
): string {
  return spots
    .map((sp) => {
      const cx = sp.x * STEP;
      const cy = sp.y * STEP;
      const on = sp.index === selected;
      const body = sp.weapon
        ? `<circle cx="${cx}" cy="${cy}" r="${PAD_R}" fill="#f7ebcb" stroke="${INK}" stroke-width="4"/><g transform="translate(${cx - PAD_R * 0.72} ${cy - PAD_R * 0.72}) scale(${(PAD_R * 1.44) / 48})">${weaponInner(sp.weapon)}</g>`
        : `<circle cx="${cx}" cy="${cy}" r="${PAD_R}" fill="${INK}" fill-opacity=".85" stroke="#f7ebcb" stroke-width="4" stroke-dasharray="7 5"/><path d="M${cx},${cy - 9} V${cy + 9} M${cx - 9},${cy} H${cx + 9}" stroke="#f7ebcb" stroke-width="4" stroke-linecap="round"/>`;
      const ring = on
        ? `<circle class="tc-bb-spot-ring" cx="${cx}" cy="${cy}" r="${PAD_R + 6}" fill="none" stroke="#ffb23e" stroke-width="6"/>`
        : '';
      const badge = `<circle cx="${cx - PAD_R * 0.8}" cy="${cy - PAD_R * 0.8}" r="14" fill="${INK}" stroke="#f7ebcb" stroke-width="3"/><text class="tc-bb-spot-n" x="${cx - PAD_R * 0.8}" y="${cy - PAD_R * 0.8}" text-anchor="middle" dominant-baseline="central" fill="#f7ebcb">${sp.index + 1}</text>`;
      const hit = interactive
        ? `<circle class="tc-bb-spot-hit" data-spot-hit="true" cx="${cx}" cy="${cy}" r="${Math.max(PAD_R + 6, hitR)}" fill="transparent"/>`
        : '';
      const attrs = interactive
        ? `tabindex="0" role="button" aria-pressed="${on}" aria-label="${label(sp, on)}"`
        : 'aria-hidden="true"';
      return `<g class="tc-bb-spot" data-spot="${sp.index}" data-weapon="${sp.weapon ?? ''}"${on ? ' data-selected="true"' : ''} data-live="${interactive}" ${attrs}>${hit}${ring}${body}${badge}</g>`;
    })
    .join('');
}
