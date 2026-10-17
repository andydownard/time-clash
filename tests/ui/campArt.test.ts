// @vitest-environment jsdom
// The Camp picture is inline SVG from our own source. It must parse, stay decorative, fetch
// nothing, and use only the palette plus its own short scene-only list.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAMP_EXTRA_COLORS, campScene } from '../../src/ui/campArt';
import { parseCssVars, resolveCssVars } from '../../src/ui/contrast';

const source = readFileSync(join(process.cwd(), 'src/ui/campArt.ts'), 'utf8');
const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const ui = readFileSync(join(process.cwd(), 'src/styles/ui.css'), 'utf8');
const palette = new Set(
  Object.values(resolveCssVars(parseCssVars(tokens)))
    .filter((v) => /^#[0-9a-f]{6}$/i.test(v))
    .map((v) => v.toLowerCase()),
);

describe('Camp art', () => {
  const svg = campScene(document);

  it('parses and is decorative', () => {
    expect(svg.localName).toBe('svg');
    expect(svg.hasAttribute('hidden')).toBe(false);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.getAttribute('class')).toBe('tc-camp-art');
    expect(svg.querySelectorAll('*').length).toBeGreaterThan(100);
  });

  it('uses only palette colors and the scene-only list, and every extra is used', () => {
    const allowed = new Set([...palette, ...CAMP_EXTRA_COLORS.map((c) => c.toLowerCase())]);
    const used = new Set([...source.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
    expect([...used].filter((c) => !allowed.has(c))).toEqual([]);
    expect(CAMP_EXTRA_COLORS.filter((c) => !used.has(c.toLowerCase()))).toEqual([]);
  });

  it('fetches nothing: no image, no outside href, no style import, no script', () => {
    expect(source).not.toMatch(/<image\b|<script\b|<foreignObject\b|@import|url\(\s*['"]?http/i);
    for (const el of svg.querySelectorAll('[href]')) {
      expect(el.getAttribute('href')).toMatch(/^#/);
    }
    expect(svg.querySelector('image, script, foreignObject')).toBeNull();
  });

  it('every use and url() points at a shape that exists in the same picture', () => {
    for (const use of svg.querySelectorAll('use')) {
      const id = (use.getAttribute('href') ?? '').slice(1);
      expect(svg.querySelector(`[id="${id}"]`), id).not.toBeNull();
    }
    const refs = new Set([...svg.innerHTML.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]));
    for (const id of refs) expect(svg.querySelector(`[id="${id}"]`), id).not.toBeNull();
  });

  it('prefixes every id, so it cannot clash with another screen', () => {
    const ids = [...svg.querySelectorAll('[id]')].map((e) => e.getAttribute('id')!);
    expect(ids.length).toBeGreaterThan(20);
    expect(ids.filter((i) => !i.startsWith('tcCamp'))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a style rule for every animation class it uses', () => {
    const classes = new Set(
      [...svg.querySelectorAll('[class]')].flatMap((e) =>
        (e.getAttribute('class') ?? '').split(' '),
      ),
    );
    expect(classes.size).toBeGreaterThan(5);
    for (const c of classes) expect(ui, c).toContain(`.${c}`);
  });
});
