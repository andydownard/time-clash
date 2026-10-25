// Every text and UI pair in docs/DESIGN_SYSTEM.md. The doc table is checked against this list.
import { readFileSync } from 'node:fs';
import { contrastRatio, parseCssVars, resolveCssVars } from '../../src/ui/contrast';

export type Pair = { name: string; fg: string; bg: string; min: 3 | 4.5 };

export const tokensCss = readFileSync(
  new URL('../../src/styles/tokens.css', import.meta.url),
  'utf8',
);
export const vars = resolveCssVars(parseCssVars(tokensCss));

const body = (name: string, fg: string, bg: string): Pair => ({ name, fg, bg, min: 4.5 });
const large = (name: string, fg: string, bg: string): Pair => ({ name, fg, bg, min: 3 });

export const PAIRS: Pair[] = [
  body('Body text on parchment', '--tc-on-light', '--tc-surface-light'),
  body('Body text on ink', '--tc-on-dark', '--tc-surface-dark'),
  body('Body text on Past surface (Purple 900)', '--tc-on-dark', '--tc-surface-past'),
  body('Body text on Future surface (Blue 900)', '--tc-on-future', '--tc-surface-future'),
  body('Past label on Past surface', '--tc-eyebrow-past', '--tc-surface-past'),
  body('Past label on ink', '--tc-eyebrow-past', '--tc-surface-dark'),
  body('Future label on Future surface', '--tc-eyebrow-future', '--tc-surface-future'),
  body('Future label on ink', '--tc-eyebrow-future', '--tc-surface-dark'),
  body('Wood button text, top of gradient (Purple 700)', '--tc-btn-wood-text', '--tc-purple-700'),
  body(
    'Wood button text, bottom of gradient (Purple 900)',
    '--tc-btn-wood-text',
    '--tc-purple-900',
  ),
  body('Neon button text, top of gradient (Blue 700)', '--tc-btn-neon-text', '--tc-blue-700'),
  body('Neon button text, bottom of gradient (Blue 900)', '--tc-btn-neon-text', '--tc-blue-900'),
  body('Primary button text on Purple 700', '--tc-btn-primary-text', '--tc-purple-700'),
  body('Primary button text on Blue 700', '--tc-btn-primary-text', '--tc-blue-700'),
  body('Primary button text on Blue 900', '--tc-btn-primary-text', '--tc-blue-900'),
  body('Turn banner text on Ember', '--tc-banner-turn-text', '--tc-banner-turn-bg'),
  body('Speech bubble text', '--tc-bubble-text', '--tc-bubble-bg'),
  body('Selector text on ink', '--tc-on-dark', '--tc-surface-dark'),
  body('Picked chip text on Ember', '--tc-chip-picked-text', '--tc-chip-picked-bg'),
  body('Chip text on Past card', '--tc-on-dark', '--tc-card-past-bg'),
  body('Chip text on Future card', '--tc-on-future', '--tc-card-future-bg'),
  large('Chip edge on Past card', '--tc-chip-past-edge', '--tc-card-past-bg'),
  large('Chip edge on Future card', '--tc-chip-future-edge', '--tc-card-future-bg'),
  large('Picked chip edge on Ember', '--tc-chip-picked-edge', '--tc-chip-picked-bg'),
  large('Pulse glow edge on Future card', '--tc-pulse', '--tc-card-future-bg'),
  large('Past card edge on ink', '--tc-card-past-edge', '--tc-surface-dark'),
  body('Input text', '--tc-input-text', '--tc-input-bg'),
  body('Progress label on Future surface', '--tc-on-future', '--tc-bar-track'),
  large('Focus ring on parchment', '--tc-focus-on-light', '--tc-surface-light'),
  large('Focus ring on ink', '--tc-focus-on-dark', '--tc-surface-dark'),
  large('Focus ring on Past surface', '--tc-focus-on-dark', '--tc-surface-past'),
  large('Focus ring on Future surface', '--tc-focus-on-dark', '--tc-surface-future'),
  large('Selector outline on ink', '--tc-sel-edge', '--tc-surface-dark'),
  large('Selector outline on parchment', '--tc-on-light', '--tc-surface-light'),
  large('Picked selector fill (Ember) on ink', '--tc-chip-picked-bg', '--tc-surface-dark'),
  large('Input border on white', '--tc-oak', '--tc-input-bg'),
  large('Progress edge on ink', '--tc-bar-edge', '--tc-surface-dark'),
  large('Progress fill (Blue 500) on track', '--tc-blue-500', '--tc-bar-track'),
  large('Progress fill (Purple 500) on track', '--tc-purple-500', '--tc-bar-track'),
  large('Blue 500 line on parchment', '--tc-blue-500', '--tc-surface-light'),
  large('Blue 500 line on ink', '--tc-blue-500', '--tc-surface-dark'),
  large('Purple 500 line on parchment', '--tc-purple-500', '--tc-surface-light'),
];

export function ratio(p: Pair): number {
  const fg = vars[p.fg];
  const bg = vars[p.bg];
  if (!fg || !bg) throw new Error(`Undefined token in pair ${p.name}`);
  return contrastRatio(fg, bg);
}

/** The markdown table that docs/DESIGN_SYSTEM.md carries. */
export function contrastTable(): string {
  const rows = PAIRS.map((p) => {
    const r = ratio(p);
    const shown = (Math.floor(r * 100) / 100).toFixed(2);
    return `| ${p.name} | \`${p.fg}\` ${vars[p.fg]} | \`${p.bg}\` ${vars[p.bg]} | ${shown}:1 | ${p.min}:1 | ${r >= p.min ? 'pass' : 'FAIL'} |`;
  });
  return [
    '| Pair | Foreground | Background | Ratio | Needs | Result |',
    '|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}
