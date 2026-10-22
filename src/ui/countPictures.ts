// A row of small pictures that lets a pre-reader count: stars for brain stats, dots for Scrap.
// Original shapes in palette colors only, drawn from fixed strings. The row is one labeled
// picture (role "img" with an aria-label), so a screen reader hears the count once and the
// icons are never read one by one. The words stay beside it for readers. The shape carries the
// meaning (a filled star is a right answer, a hollow star is not), so nothing rests on color.
import { svgFromString } from './svg';

const INK = '#12102b';
const EMBER = '#ffb23e';
const CREAM = '#f7ebcb';

/** Most icons in a row. Past this the row shows a "+" so it never grows wider than the card. */
export const COUNT_CAP = 10;

export type CountKind = 'star' | 'dot';

const STAR_PATH = 'M16 3 L20 12 L29 12.5 L22 18.5 L24.5 28 L16 23 L7.5 28 L10 18.5 L3 12.5 L12 12 Z';

function icon(doc: Document, kind: CountKind, filled: boolean): SVGElement {
  const markup =
    kind === 'star'
      ? filled
        ? `<svg viewBox="0 0 32 32"><path d="${STAR_PATH}" fill="${EMBER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>`
        : `<svg viewBox="0 0 32 32"><path d="${STAR_PATH}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3" stroke-linejoin="round"/></svg>`
      : `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="${filled ? EMBER : CREAM}" stroke="${INK}" stroke-width="2.4"/></svg>`;
  const svg = svgFromString(doc, markup, 'tc-count-icon');
  svg.setAttribute('data-filled', String(filled));
  return svg;
}

/**
 * `filled` of `total` icons are filled (a Scrap row passes the same number for both). Bad or
 * negative numbers draw nothing. Past COUNT_CAP only the first ten show, then a "+".
 */
export function countRow(
  doc: Document,
  kind: CountKind,
  filled: number,
  total: number,
  label: string,
): HTMLElement {
  const row = doc.createElement('span');
  row.className = 'tc-count-row';
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', label);
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const safeFilled = Number.isFinite(filled) ? Math.max(0, Math.floor(filled)) : 0;
  const shown = Math.min(safeTotal, COUNT_CAP);
  for (let i = 0; i < shown; i++) row.append(icon(doc, kind, i < safeFilled));
  if (safeTotal > COUNT_CAP) {
    const more = doc.createElement('span');
    more.className = 'tc-count-more';
    more.setAttribute('data-role', 'more');
    more.setAttribute('aria-hidden', 'true');
    more.textContent = '+';
    row.append(more);
  }
  return row;
}
