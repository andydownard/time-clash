// Production hardening that a unit test can pin: the e2e hook is left out of production
// builds, the host sends security headers, and Phaser does not announce itself.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findHookLeak } from '../scripts/check-dist';

const read = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('findHookLeak (the dist check)', () => {
  it('flags a bundle that still holds the e2e hook', () => {
    expect(findHookLeak([{ name: 'a.js', text: 'x.__timeclash={version:1}' }])).toEqual(['a.js']);
  });
  it('passes a clean bundle', () => {
    expect(findHookLeak([{ name: 'a.js', text: 'console.log(1)' }])).toEqual([]);
  });
  it('only looks at files it is given, and says which ones leak', () => {
    const hit = findHookLeak([
      { name: 'a.js', text: 'ok' },
      { name: 'b.js', text: '__timeclash' },
    ]);
    expect(hit).toEqual(['b.js']);
  });
});

describe('main.ts', () => {
  const main = read('src/main.ts');
  it('installs the test hook only outside production, so the build drops it', () => {
    expect(main).toMatch(/if \(import\.meta\.env\.MODE !== 'production'\)\s*\{?\s*installTestHook/);
  });
  it('turns off the Phaser console banner', () => {
    expect(main).toMatch(/banner:\s*false/);
  });
});

describe('public/_headers', () => {
  const headers = read('public/_headers');
  it.each([
    "frame-ancestors 'none'",
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: no-referrer',
    'Permissions-Policy: camera=(), microphone=(), geolocation=()',
  ])('sends %s', (line) => {
    expect(headers).toContain(line);
  });
  it('sends the same Content-Security-Policy as the page meta tag', () => {
    const meta = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(
      read('index.html'),
    );
    expect(meta).not.toBeNull();
    for (const part of meta![1]!
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      expect(headers, `CSP part: ${part}`).toContain(part);
    }
  });
});

describe('CI', () => {
  it('checks the production build for the test hook', () => {
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:dist');
    expect(read('package.json')).toContain('"check:dist"');
  });
});
