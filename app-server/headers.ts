// Reads the security headers from public/_headers (shipped as dist/_headers), so there is ONE
// source of truth for them. The same file is what a static host such as Cloudflare Pages reads.
import { readFileSync } from 'node:fs';

/** Header name to value, for the `/*` block (every path). */
export type HeaderMap = Record<string, string>;

/**
 * Parses the Cloudflare Pages `_headers` format. Only the catch-all `/*` block is used: this
 * site has no other block. Comment lines start with `#`. A header line is indented `Name: value`.
 */
export function parseHeadersFile(text: string): HeaderMap {
  const out: HeaderMap = {};
  let inAll = false;
  let sawAll = false;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      inAll = raw.trim() === '/*';
      if (inAll) sawAll = true;
      continue;
    }
    if (!inAll) continue;
    const at = raw.indexOf(':');
    if (at < 1) throw new Error(`_headers: cannot read this line: ${raw.trim()}`);
    const name = raw.slice(0, at).trim();
    const value = raw.slice(at + 1).trim();
    if (!/^[A-Za-z0-9-]+$/.test(name) || value === '')
      throw new Error(`_headers: bad header line: ${raw.trim()}`);
    out[name] = value;
  }
  if (!sawAll) throw new Error('_headers: there is no "/*" block');
  return out;
}

/** Headers every response must carry. Boot fails if one is missing. */
const REQUIRED = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
];

export function loadSecurityHeaders(file: string): HeaderMap {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read the security headers file ${file}: ${(err as Error).message}`, {
      cause: err,
    });
  }
  const map = parseHeadersFile(text);
  const missing = REQUIRED.filter((n) => !(n in map));
  if (missing.length > 0) throw new Error(`${file} is missing: ${missing.join(', ')}`);
  return map;
}
