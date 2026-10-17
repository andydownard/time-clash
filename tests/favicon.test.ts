// The game's icon, from the design: a sword crossed with a glowing laser sword on purple. It is
// linked for the browser tab and for the iPad home screen, and it is served from this site only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const html = readFileSync(join(root, 'index.html'), 'utf8');

/** Width and height from a PNG's header. */
function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(join(root, path));
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('favicon', () => {
  it('is linked from the page for the tab (128 and 32) and the iPad home screen (180)', () => {
    expect(html).toMatch(
      /<link rel="icon" type="image\/png" sizes="128x128" href="\/favicon-128\.png"/,
    );
    expect(html).toMatch(
      /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png"/,
    );
    expect(html).toMatch(
      /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/,
    );
  });

  it('has real PNGs at the sizes it says', () => {
    expect(pngSize('public/favicon-128.png')).toEqual({ w: 128, h: 128 });
    expect(pngSize('public/favicon-32.png')).toEqual({ w: 32, h: 32 });
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ w: 180, h: 180 });
  });

  it('links only files from this site, and the page still allows images from this site only', () => {
    for (const m of html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)) {
      expect(m[1]).toMatch(/^\/[a-z0-9-]+\.png$/);
    }
    expect(html).toMatch(/img-src 'self' data: blob:/);
  });
});
