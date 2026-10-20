// A tiny built site in a temp folder, for the app-server tests.
import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const INDEX_HTML = '<!doctype html><title>Time Clash</title><div id="game"></div>\n';
/** Well over 1 KiB of repeating text, so it compresses and is worth compressing. */
export const BIG_JS = `console.log("hello");\n`.repeat(400);
export const AUDIO = Uint8Array.from({ length: 200 }, (_, i) => i);

export function makeSite(opts: { headers?: string | null; index?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'tc-site-'));
  mkdirSync(join(dir, 'assets'));
  mkdirSync(join(dir, 'audio'));
  mkdirSync(join(dir, 'fonts'));
  if (opts.index !== false) writeFileSync(join(dir, 'index.html'), INDEX_HTML);
  // The real _headers file, the same one the production build ships.
  if (opts.headers === undefined) copyFileSync('public/_headers', join(dir, '_headers'));
  else if (opts.headers !== null) writeFileSync(join(dir, '_headers'), opts.headers);
  writeFileSync(join(dir, 'version.txt'), 'abc123\n');
  writeFileSync(join(dir, 'assets', 'index-AbC123.js'), BIG_JS);
  writeFileSync(join(dir, 'assets', 'index-AbC123.css'), 'body{margin:0}\n'.repeat(100));
  writeFileSync(join(dir, 'assets', 'tiny.js'), '1');
  writeFileSync(join(dir, 'audio', 'clip.m4a'), AUDIO);
  writeFileSync(join(dir, 'fonts', 'a.woff2'), Buffer.alloc(5000, 7));
  writeFileSync(join(dir, '.secret'), 'nope');
  writeFileSync(join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  return dir;
}
