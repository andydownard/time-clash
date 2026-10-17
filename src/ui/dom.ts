// Tiny DOM helpers. Text always goes in with textContent, never innerHTML, so a player's
// name can never become markup.
import { COVER_BG_FALLBACK, Z } from './constants';

type Attrs = Record<string, string | number | boolean | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Attrs = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    el.append(typeof c === 'string' ? doc.createTextNode(c) : c);
  }
  return el;
}

/** Opaque, full-viewport cover. Inline styles so it is opaque even if the stylesheet fails. */
export function styleAsCover(el: HTMLElement): void {
  const s = el.style;
  s.position = 'fixed';
  s.top = '0';
  s.right = '0';
  s.bottom = '0';
  s.left = '0';
  s.width = '100%';
  s.height = '100%';
  s.zIndex = String(Z.cover);
  s.backgroundColor = COVER_BG_FALLBACK;
  s.opacity = '1';
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside a container (used by covers, so focus cannot reach the hidden board). */
export function trapTab(container: HTMLElement): void {
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0] as HTMLElement;
    const last = items[items.length - 1] as HTMLElement;
    const active = container.ownerDocument.activeElement;
    if (e.shiftKey && (active === first || !container.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !container.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });
}

/**
 * Real operator symbols for display. A spaced hyphen between numbers becomes a minus sign, a spaced
 * x becomes a times sign, and a spaced slash becomes a divide sign. Fractions (3/4), negatives and
 * variables (2x) stay as written. The answer key keeps ASCII; only what is drawn changes.
 */
export function toMathSymbols(text: string): string {
  return text
    .replace(/(?<=[\d)])\s-\s(?=[\d(])/g, ' \u2212 ')
    .replace(/(?<=[\d)])\s[xX]\s(?=[\d(])/g, ' \u00D7 ')
    .replace(/(?<=[\d)])\s\/\s(?=[\d(])/g, ' \u00F7 ');
}

/** Renders `x^2` as x with a raised 2, and `3/4` as a stacked fraction. Plain text stays plain. */
export function renderMath(doc: Document, raw: string): Node[] {
  const text = toMathSymbols(raw);
  const out: Node[] = [];
  const re = /(\d+)\/(\d+)|\^(-?\d+|\([^)]*\))/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push(doc.createTextNode(text.slice(last, at)));
    if (m[1] !== undefined) {
      out.push(
        h(
          doc,
          'span',
          { class: 'tc-frac' },
          h(doc, 'span', { class: 'tc-frac-top', text: m[1] }),
          h(doc, 'span', { class: 'tc-frac-bottom', text: m[2] }),
        ),
      );
    } else {
      const power = (m[3] as string).replace(/^\(|\)$/g, '');
      out.push(h(doc, 'sup', { text: power }));
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(doc.createTextNode(text.slice(last)));
  return out;
}
