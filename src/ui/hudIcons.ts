// Small pictures for pre-readers beside the HUD readouts: a heart for Base health, a ball for
// Shots left, and a gear for Scrap. Original shapes in palette colors only, drawn here from fixed
// strings. They are decorative (aria-hidden): the words always sit next to them, and the shape
// carries the meaning, so nothing rests on color alone.
import { svgFromString } from './svg';

const INK = '#12102b';
const CREAM = '#f7ebcb';
const MAGENTA = '#ff3dae';
const STEEL = '#b9c4d0';
const EMBER = '#ffb23e';

export const HUD_ICON_IDS = ['health', 'shots', 'scrap'] as const;
export type HudIconId = (typeof HUD_ICON_IDS)[number];

const ICONS: Record<HudIconId, string> = {
  // A heart: how much health the base has left. Cream edge so it reads on the dark cards.
  health: `<svg viewBox="0 0 32 32"><path d="M16 28 C6 21 3 15 3 10.5 C3 6.5 6 4 9.5 4 C12.5 4 14.6 5.8 16 8.3 C17.4 5.8 19.5 4 22.5 4 C26 4 29 6.5 29 10.5 C29 15 26 21 16 28 Z" fill="${MAGENTA}" stroke="${CREAM}" stroke-width="2.4" stroke-linejoin="round"/><path d="M8.5 9.5 q1.5 -2.5 4 -2" fill="none" stroke="${CREAM}" stroke-width="2" stroke-linecap="round"/></svg>`,
  // A ball flying right with speed lines: the shots this turn. Ink, for the Ember turn strip.
  shots: `<svg viewBox="0 0 32 32"><path d="M2 11 H11 M4 16 H10 M2 21 H11" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><circle cx="21" cy="16" r="9" fill="${INK}"/><circle cx="18" cy="13" r="2.6" fill="${CREAM}"/></svg>`,
  // A gear with a bolt in the middle: Scrap.
  scrap: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11.5" fill="none" stroke="${STEEL}" stroke-width="5" stroke-dasharray="4.5 4.5"/><circle cx="16" cy="16" r="9" fill="${STEEL}" stroke="${INK}" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="${EMBER}" stroke="${INK}" stroke-width="2"/></svg>`,
};

export function hudIcon(doc: Document, id: HudIconId): SVGElement {
  const svg = svgFromString(doc, ICONS[id], 'tc-hud-icon');
  svg.setAttribute('data-icon', id);
  return svg;
}
