// The game's icon: a sword crossed with a laser sword on a purple and blue split. It is our own
// drawing, in the palette colors only, and nothing in it reaches another site.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCssVars, resolveCssVars } from '../src/ui/contrast';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const svg = read('public/favicon.svg');
const html = read('index.html');
const palette = new Set(
  Object.values(resolveCssVars(parseCssVars(read('src/styles/tokens.css'))))
    .filter((v) => /^#[0-9a-f]{6}$/i.test(v))
    .map((v) => v.toLowerCase()),
);

/** Width and height from a PNG's header. */
function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(join(root, path));
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('favicon', () => {
  it('is linked from the page, as an SVG, a 32px PNG and an iPad home-screen icon', () => {
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
    expect(html).toMatch(
      /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png"/,
    );
    expect(html).toMatch(
      /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/,
    );
  });

  it('has real PNGs at the sizes it says', () => {
    expect(pngSize('public/favicon-32.png')).toEqual({ w: 32, h: 32 });
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ w: 180, h: 180 });
  });

  it('is a square picture with a name for assistive tech', () => {
    expect(svg).toMatch(/viewBox="0 0 64 64"/);
    expect(svg).toMatch(/aria-label="Time Clash"/);
  });

  it('uses only palette colors', () => {
    const used = new Set([...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
    expect(used.size).toBeGreaterThanOrEqual(5);
    expect([...used].filter((c) => !palette.has(c))).toEqual([]);
  });

  it('fetches nothing: no outside address, image, script or style import', () => {
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
    expect(svg).not.toMatch(/<image\b|<script\b|<foreignObject\b|@import|href=/i);
    // The page's own security rule still allows images from this site only.
    expect(html).toMatch(/img-src 'self' data: blob:/);
  });
});
