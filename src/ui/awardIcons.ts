// A small picture for each end-of-match award. Original shapes in the palette colors only. They
// are decorative (aria-hidden): the award's name is always written next to its picture, so no
// meaning rests on the picture or its color alone.
import type { AwardId } from '../game/awards';
import { svgFromString } from './svg';

const INK = '#12102b';
const EMBER = '#ffb23e';
const CREAM = '#f7ebcb';
const PULSE = '#4fd8ff';
const PURPLE = '#8247e8';
const WHITE = '#ffffff';

const ICONS: Record<AwardId, string> = {
  // A lightning bolt: fast thinking.
  quickestBrain: `<svg viewBox="0 0 32 32"><path d="M19 3 L7 18 H15 L13 29 L26 12 H18 Z" fill="${EMBER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>`,
  // A dizzy spiral: lots of wobbles.
  mostWobbles: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="${PULSE}" stroke="${INK}" stroke-width="2"/><path d="M16 16 m0 -2 a2 2 0 1 1 -2 2 a4 4 0 1 1 4 4 a6 6 0 1 1 -6 -6 a8 8 0 1 1 8 8" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  // A target with an arrow: sharp shots.
  sharpestShot: `<svg viewBox="0 0 32 32"><circle cx="15" cy="17" r="12" fill="${CREAM}" stroke="${INK}" stroke-width="2"/><circle cx="15" cy="17" r="8" fill="${PURPLE}" stroke="${INK}" stroke-width="2"/><circle cx="15" cy="17" r="4" fill="${EMBER}" stroke="${INK}" stroke-width="2"/><path d="M28 4 L16 16" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M28 4 l-4 0.5 M28 4 l-0.5 4" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  // A light bulb: brain power.
  brainPower: `<svg viewBox="0 0 32 32"><path d="M16 3 a9 9 0 0 1 5 16.5 V23 H11 V19.5 A9 9 0 0 1 16 3 Z" fill="${EMBER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="11" y="23" width="10" height="5" rx="2" fill="${CREAM}" stroke="${INK}" stroke-width="2"/><path d="M13 12 q3 -3 6 0" fill="none" stroke="${WHITE}" stroke-width="2" stroke-linecap="round"/></svg>`,
  // A gear: scrap.
  scrapCollector: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="${INK}" stroke-width="5" stroke-dasharray="4.7 4.7"/><circle cx="16" cy="16" r="9" fill="${CREAM}" stroke="${INK}" stroke-width="2"/><circle cx="16" cy="16" r="3.5" fill="${INK}"/></svg>`,
  // A smiley: good sport.
  goodSport: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="${EMBER}" stroke="${INK}" stroke-width="2"/><circle cx="11" cy="13" r="1.9" fill="${INK}"/><circle cx="21" cy="13" r="1.9" fill="${INK}"/><path d="M9.5 19 Q16 26 22.5 19" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/></svg>`,
};

export function awardIcon(doc: Document, id: AwardId): SVGElement {
  return svgFromString(doc, ICONS[id], 'tc-badge-art');
}
