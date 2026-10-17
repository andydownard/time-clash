// @vitest-environment jsdom
// The pictures are inline SVG from our own source. They must parse, stay decorative, fetch
// nothing, and use only the palette plus the short scene-only list.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ART_EXTRA_COLORS,
  chronoFace,
  introArt,
  loadingScene,
  loadingTimeline,
  skyline,
} from '../../src/ui/art';
import { parseCssVars, resolveCssVars } from '../../src/ui/contrast';
import { INTRO_SCRIPT } from '../../src/data/introScript';
import { svgFromString } from '../../src/ui/svg';

const source = readFileSync(join(process.cwd(), 'src/ui/art.ts'), 'utf8');
const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const palette = new Set(
  Object.values(resolveCssVars(parseCssVars(tokens)))
    .filter((v) => /^#[0-9a-f]{6}$/i.test(v))
    .map((v) => v.toLowerCase()),
);

const all: Array<[string, SVGElement]> = [
  ['loading scene', loadingScene(document)],
  ['loading timeline', loadingTimeline(document)],
  ['skyline', skyline(document)],
  ['Chrono', chronoFace(document)],
  ...INTRO_SCRIPT.map((c): [string, SVGElement] => [`intro ${c.art}`, introArt(document, c.art)]),
];

describe('art', () => {
  it.each(all)('%s parses and is decorative', (_n, svg) => {
    expect(svg.localName).toBe('svg');
    expect(svg.hasAttribute('hidden')).toBe(false);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelectorAll('*').length).toBeGreaterThan(3);
  });

  it('has one picture for each How to Play card', () => {
    expect(INTRO_SCRIPT.map((c) => c.art)).toEqual([
      'welcome',
      'aim',
      'two-shots',
      'reload',
      'wipeouts',
    ]);
    const shapes = INTRO_SCRIPT.map((c) => introArt(document, c.art).innerHTML);
    expect(new Set(shapes).size).toBe(5);
  });

  it('uses only palette colors and the scene-only list', () => {
    const allowed = new Set([...palette, ...ART_EXTRA_COLORS.map((c) => c.toLowerCase())]);
    const used = new Set([...source.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
    const stray = [...used].filter((c) => !allowed.has(c));
    expect(stray).toEqual([]);
    // Every scene-only color is really used, so the list cannot grow stale.
    const unused = ART_EXTRA_COLORS.filter((c) => !used.has(c.toLowerCase()));
    expect(unused).toEqual([]);
  });

  it('fetches nothing: no image, no outside href, no style import, no script', () => {
    expect(source).not.toMatch(/<image\b|<script\b|<foreignObject\b|@import|url\(\s*['"]?http/i);
    for (const [, svg] of all) {
      for (const el of svg.querySelectorAll('[href]')) {
        expect(el.getAttribute('href')).toMatch(/^#/);
      }
      expect(svg.querySelector('image, script, foreignObject')).toBeNull();
    }
  });

  it('every use points at a shape that exists in the same picture', () => {
    for (const [name, svg] of all) {
      for (const use of svg.querySelectorAll('use')) {
        const id = (use.getAttribute('href') ?? '').slice(1);
        expect(svg.querySelector(`[id="${id}"]`), `${name} ${id}`).not.toBeNull();
      }
    }
  });

  it('gradient ids are unique to the app, so two pictures never share one', () => {
    const ids = all.flatMap(([, svg]) => [...svg.querySelectorAll('[id]')].map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the timeline path is 100 long, so a dash length is a percent', () => {
    const fill = loadingTimeline(document).querySelector('.tc-bar-fill')!;
    expect(fill.getAttribute('pathLength')).toBe('100');
    expect(fill.getAttribute('stroke-dasharray')).toBe('0 100');
  });

  it('a broken picture leaves a hidden empty svg, never an exception', () => {
    const bad = svgFromString(document, '<svg><g></svg>');
    expect(bad.localName).toBe('svg');
    expect(bad.hasAttribute('hidden')).toBe(true);
  });

  it('an unknown intro id falls back to the welcome picture', () => {
    expect(introArt(document, 'nope').innerHTML).toBe(introArt(document, 'welcome').innerHTML);
  });
});
