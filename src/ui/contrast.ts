// WCAG contrast math. Used by tests to check the color tokens in src/styles/tokens.css.

function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex color: ${hex}`);
  let h = m[1] as string;
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Reads `--name: value;` pairs out of CSS text. */
export function parseCssVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+?)\s*[;}]/g)) {
    out[m[1] as string] = m[2] as string;
  }
  return out;
}

/** Replaces `var(--x)` values with the value they point to. */
export function resolveCssVars(vars: Record<string, string>): Record<string, string> {
  const resolve = (value: string, depth = 0): string => {
    const m = /^var\((--[\w-]+)\)$/.exec(value.trim());
    if (!m || depth > 10) return value;
    const next = vars[m[1] as string];
    return next === undefined ? value : resolve(next, depth + 1);
  };
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, resolve(v)]));
}
