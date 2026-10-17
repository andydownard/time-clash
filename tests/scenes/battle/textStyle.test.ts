import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UI } from '../../../src/game/config';
import {
  FONT_FAMILY,
  TEXT_ROLES,
  canvasFontSpecs,
  textStyle,
  type TextRole,
} from '../../../src/scenes/battle/textStyle';
import { contrastRatio, parseCssVars, resolveCssVars } from '../../../src/ui/contrast';

const css = readFileSync(new URL('../../../src/styles/tokens.css', import.meta.url), 'utf8');
const vars = resolveCssVars(parseCssVars(css));
const roles = Object.keys(TEXT_ROLES) as TextRole[];

describe('canvas text roles', () => {
  it('has every role at the 20px floor or larger', () => {
    for (const r of roles) expect(TEXT_ROLES[r].basePx, r).toBeGreaterThanOrEqual(UI.textMinPx);
  });
  it('meets 4.5:1 contrast for text on its own fill', () => {
    for (const r of roles) {
      const { color, bg } = TEXT_ROLES[r];
      expect(contrastRatio(color, bg), `${r} ${color} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('gives every role a solid fill, so text never sits on busy art', () => {
    for (const r of roles) expect(TEXT_ROLES[r].bg, r).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('keeps MedievalSharp off numbers and Orbitron off jokes', () => {
    for (const r of roles) {
      const spec = TEXT_ROLES[r];
      if (spec.numeric) expect(spec.family, r).toBe('new');
    }
    expect(TEXT_ROLES.hit.family).toBe('old');
    expect(TEXT_ROLES.bubble.family).toBe('old');
  });
  it('uses Orbitron weights the font files provide (700, 800, 900)', () => {
    for (const r of roles) {
      if (TEXT_ROLES[r].family === 'new') expect([700, 800, 900]).toContain(TEXT_ROLES[r].weight);
    }
  });
  it('uses the same font stacks as tokens.css', () => {
    expect(FONT_FAMILY.old).toBe(vars['--tc-font-voice-old']);
    expect(FONT_FAMILY.new).toBe(vars['--tc-font-voice-new']);
  });
  it('builds a Phaser style from a role', () => {
    const s = textStyle('hud');
    expect(s.fontFamily).toBe(FONT_FAMILY.new);
    expect(s.fontSize).toBe(`${TEXT_ROLES.hud.basePx}px`);
    expect(s.fontStyle).toBe('800');
    expect(s.color).toBe(TEXT_ROLES.hud.color);
    expect(s.backgroundColor).toBe(TEXT_ROLES.hud.bg);
  });
  it('lists the font faces to preload, one per family and weight in use', () => {
    const specs = canvasFontSpecs();
    expect(specs.some((s) => s.includes('MedievalSharp'))).toBe(true);
    expect(specs.some((s) => s.includes('Orbitron'))).toBe(true);
    expect(new Set(specs).size).toBe(specs.length);
  });
});

import { preloadCanvasFonts } from '../../../src/scenes/battle/textStyle';

describe('preloadCanvasFonts', () => {
  it('loads every face, then calls onReady once', async () => {
    const loaded: string[] = [];
    let ready = 0;
    await preloadCanvasFonts(
      { load: (s) => (loaded.push(s), Promise.resolve([])) },
      () => (ready += 1),
    );
    expect(loaded).toEqual(canvasFontSpecs());
    expect(ready).toBe(1);
  });
  it('still calls onReady when a font fails to load', async () => {
    let ready = 0;
    await preloadCanvasFonts(
      { load: () => Promise.reject(new Error('blocked')) },
      () => (ready += 1),
    );
    expect(ready).toBe(1);
  });
  it('does nothing without a font set (old browsers, tests)', async () => {
    let ready = 0;
    await preloadCanvasFonts(undefined, () => (ready += 1));
    expect(ready).toBe(0);
  });
});
