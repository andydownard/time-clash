// Inline SVG from fixed strings in our own source. Nothing a player types ever goes through
// here, and nothing is fetched: every picture is drawn from shapes in this repo.
const NS = 'http://www.w3.org/2000/svg';

/**
 * Parses a static `<svg>` string into an element of `doc`. The string must be well formed XML.
 * Returns an empty, hidden SVG if parsing fails, so a bad picture can never break a screen.
 */
export function svgFromString(doc: Document, markup: string, className?: string): SVGElement {
  const view = doc.defaultView;
  const Parser = view?.DOMParser ?? (typeof DOMParser === 'undefined' ? undefined : DOMParser);
  let el: SVGElement | null = null;
  try {
    const parsed = Parser
      ? new Parser().parseFromString(markup.replace('<svg', `<svg xmlns="${NS}"`), 'image/svg+xml')
      : null;
    const root = parsed?.documentElement;
    if (root && root.localName === 'svg' && !parsed?.querySelector('parsererror')) {
      el = doc.importNode(root, true) as unknown as SVGElement;
    }
  } catch {
    el = null;
  }
  if (!el) {
    el = doc.createElementNS(NS, 'svg');
    el.setAttribute('hidden', '');
  }
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  if (className) el.setAttribute('class', className);
  return el;
}
