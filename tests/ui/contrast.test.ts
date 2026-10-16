import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseCssVars, resolveCssVars } from '../../src/ui/contrast';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const vars = resolveCssVars(parseCssVars(css));

describe('contrastRatio', () => {
  it('black on white is 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });
  it('same color is 1', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(contrastRatio('#fedcba', '#123456'), 8);
  });
  it('accepts 3-digit hex', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });
  it('throws on junk', () => {
    expect(() => contrastRatio('red', '#fff')).toThrow();
  });
});

describe('resolveCssVars', () => {
  it('follows var() references', () => {
    expect(resolveCssVars({ '--a': '#fff', '--b': 'var(--a)', '--c': 'var(--b)' })['--c']).toBe(
      '#fff',
    );
  });
  it('leaves unknown references alone', () => {
    expect(resolveCssVars({ '--b': 'var(--nope)' })['--b']).toBe('var(--nope)');
  });
});

describe('parseCssVars', () => {
  it('reads custom properties', () => {
    expect(parseCssVars(':root{--a:#abc; --b : #123456;}')).toEqual({
      '--a': '#abc',
      '--b': '#123456',
    });
  });
});

describe('design-brief palette is in tokens.css', () => {
  it.each([
    ['--tc-parchment', '#f3e3c3'],
    ['--tc-stone', '#8c8a84'],
    ['--tc-banner-red', '#b3372b'],
    ['--tc-torch-gold', '#f2b134'],
    ['--tc-wood', '#6b4423'],
    ['--tc-night', '#0e1a33'],
    ['--tc-cyan', '#2ee6ff'],
    ['--tc-magenta', '#ff3dae'],
    ['--tc-mint', '#7cffc4'],
    ['--tc-steel', '#b9c4d0'],
    ['--tc-orange', '#ff7a1a'],
    ['--tc-purple', '#3b2a5e'],
    ['--tc-white', '#ffffff'],
    ['--tc-ink', '#1b1b26'],
  ])('%s is %s', (name, hex) => {
    expect(vars[name]?.toLowerCase()).toBe(hex);
  });
});

// Text pairs the UI really uses. Body text needs 4.5:1. Large UI (buttons, headings) needs 3:1.
const BODY: Array<[string, string, string]> = [
  ['body text on page', '--tc-text', '--tc-page'],
  ['body text on card', '--tc-text', '--tc-card'],
  ['cover text on cover', '--tc-cover-text', '--tc-cover-bg'],
  ['caption text on caption bar', '--tc-caption-text', '--tc-caption-bg'],
  ['past button text', '--tc-past-btn-text', '--tc-past-btn-bg'],
  ['future button text', '--tc-future-btn-text', '--tc-future-btn-bg'],
  ['neutral button text', '--tc-neutral-btn-text', '--tc-neutral-btn-bg'],
  ['choice text on choice', '--tc-text', '--tc-choice-bg'],
  ['error text on card', '--tc-error-text', '--tc-card'],
  ['right answer text', '--tc-good-text', '--tc-good-bg'],
  ['kind wrong-answer text', '--tc-oops-text', '--tc-oops-bg'],
  ['muted helper text on card', '--tc-muted-text', '--tc-card'],
  ['banner text on past banner', '--tc-banner-text', '--tc-past-banner-bg'],
  ['banner text on future banner', '--tc-banner-text', '--tc-future-banner-bg'],
];

const LARGE_UI: Array<[string, string, string]> = [
  ['focus ring on page', '--tc-focus', '--tc-page'],
  ['focus ring on cover', '--tc-focus', '--tc-cover-bg'],
  ['focus ring on card', '--tc-focus', '--tc-card'],
  ['timer ring on card', '--tc-ring', '--tc-card'],
  ['input border on card', '--tc-border', '--tc-card'],
  ['past accent on page', '--tc-past-accent', '--tc-page'],
  ['future accent on cover', '--tc-future-accent', '--tc-cover-bg'],
];

describe('contrast: body text is at least 4.5:1', () => {
  it.each(BODY)('%s', (_n, fg, bg) => {
    expect(vars[fg], fg).toBeTruthy();
    expect(vars[bg], bg).toBeTruthy();
    expect(contrastRatio(vars[fg]!, vars[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('contrast: large UI is at least 3:1', () => {
  it.each(LARGE_UI)('%s', (_n, fg, bg) => {
    expect(vars[fg], fg).toBeTruthy();
    expect(vars[bg], bg).toBeTruthy();
    expect(contrastRatio(vars[fg]!, vars[bg]!)).toBeGreaterThanOrEqual(3);
  });
});

describe('tokens.css rules', () => {
  it('uses only hex colors in token values (no external urls)', () => {
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/@import/);
  });
  it('defines the 56px tap target and 20px text floors', () => {
    expect(vars['--tc-tap']).toBe('56px');
    expect(vars['--tc-text-min']).toBe('20px');
  });
});
