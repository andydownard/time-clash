import { describe, expect, it } from 'vitest';
import { PALETTE, TOKEN_VAR, css } from '../../../src/scenes/palette';
import { parseCssVars, resolveCssVars } from '../../../src/ui/contrast';
import { readFileSync } from 'node:fs';

const vars = resolveCssVars(
  parseCssVars(readFileSync(new URL('../../../src/styles/tokens.css', import.meta.url), 'utf8')),
);

describe('scene palette mirrors the CSS design tokens', () => {
  it('names a CSS var for every entry', () => {
    expect(Object.keys(TOKEN_VAR).sort()).toEqual(Object.keys(PALETTE).sort());
  });
  for (const [key, name] of Object.entries(TOKEN_VAR)) {
    it(`${key} equals ${name}`, () => {
      const value = vars[name];
      expect(value, `${name} missing from tokens.css`).toBeDefined();
      expect(css(PALETTE[key as keyof typeof PALETTE])).toBe((value as string).toLowerCase());
    });
  }
  it('formats colors as lowercase hex', () => {
    expect(css(0x12102b)).toBe('#12102b');
    expect(css(0xff)).toBe('#0000ff');
  });
});
