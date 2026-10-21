// Static file serving for the built site (dist/). node:http, node:fs and node:zlib only.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { parseRange } from '../voice-server/range.ts';
import { sendText } from '../voice-server/clips.ts';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
};

export const contentType = (file: string): string =>
  TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';

/** Text-like types shrink well. Images, fonts (woff2) and audio are already compressed. */
const compressible = (type: string): boolean =>
  /^(text\/|application\/(json|xml|manifest\+json))|svg|font\/(ttf|otf)/.test(type);

const MIN_COMPRESS_BYTES = 1024;
const CACHE_LIMIT_BYTES = 32 * 1024 * 1024;

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';
const SHORT = 'public, max-age=3600';

/** Files that are never served, even if they sit in dist/. */
const hidden = (segments: string[]): boolean =>
  segments.some((s) => s.startsWith('.')) ||
  (segments.length === 1 && (segments[0] === '_headers' || segments[0] === '_redirects'));

export type PathResult =
  { ok: true; path: string; segments: string[] } | { ok: false; status: 400 | 404 };

/** Turns a request target into a safe path inside root, or says why not. */
export function safePath(root: string, target: string): PathResult {
  if (!target.startsWith('/')) return { ok: false, status: 400 };
  const q = target.search(/[?#]/);
  const rawPath = q === -1 ? target : target.slice(0, q);
  if (rawPath.includes('\\') || rawPath.includes('\0')) return { ok: false, status: 400 };
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { ok: false, status: 400 };
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return { ok: false, status: 400 };
  const segments = decoded.split('/').filter((s) => s !== '');
  if (segments.some((s) => s === '..' || s === '.')) return { ok: false, status: 400 };
  if (hidden(segments)) return { ok: false, status: 404 };
  const path = resolve(root, ...segments);
  if (path !== root && !path.startsWith(root + sep)) return { ok: false, status: 400 };
  return { ok: true, path, segments };
}

type Encoding = 'br' | 'gzip';

/** Picks br, then gzip, from Accept-Encoding. A coding with q=0 is refused. */
export function pickEncoding(header: string | undefined): Encoding | null {
  if (!header) return null;
  const q = new Map<string, number>();
  for (const part of header.split(',')) {
    const [name = '', ...params] = part.trim().toLowerCase().split(';');
    const qp = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    q.set(name.trim(), qp ? Number(qp.slice(2)) : 1);
  }
  const ok = (n: string): boolean => (q.get(n) ?? q.get('*') ?? 0) > 0;
  if (ok('br')) return 'br';
  if (ok('gzip')) return 'gzip';
  return null;
}

/** True when If-None-Match names this tag (or is *). Weak tags compare equal here. */
export function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  const strip = (t: string): string => t.trim().replace(/^W\//, '');
  return header.split(',').some((t) => strip(t) === strip(etag));
}

export type StaticHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export function createStaticHandler(opts: { root: string }): StaticHandler {
  const root = resolve(opts.root);
  // Compressed copies, made on first use and kept (bounded) until the file changes.
  const cache = new Map<string, Promise<Buffer>>();
  const sizes = new Map<string, number>();
  let cached = 0;

  function compressed(key: string, file: string, enc: Encoding): Promise<Buffer> {
    const hit = cache.get(key);
    if (hit) return hit;
    const made = (async () => {
      const input = await readFile(file);
      return enc === 'br'
        ? await brotli(input, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 9,
              [constants.BROTLI_PARAM_SIZE_HINT]: input.byteLength,
            },
          })
        : await gz(input, { level: 9 });
    })();
    cache.set(key, made);
    made.then(
      (buf) => {
        sizes.set(key, buf.byteLength);
        cached += buf.byteLength;
        // Oldest first. A Map keeps insertion order.
        for (const k of cache.keys()) {
          if (cached <= CACHE_LIMIT_BYTES) break;
          if (k === key) continue;
          cached -= sizes.get(k) ?? 0;
          sizes.delete(k);
          cache.delete(k);
        }
      },
      () => cache.delete(key),
    );
    return made;
  }

  async function sendFile(
    req: IncomingMessage,
    res: ServerResponse,
    file: string,
    st: Stats,
    cacheControl: string,
  ): Promise<void> {
    const head = req.method === 'HEAD';
    const type = contentType(file);
    const baseTag = `${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}`;
    const canCompress = compressible(type) && st.size >= MIN_COMPRESS_BYTES;
    const enc = canCompress ? pickEncoding(req.headers['accept-encoding']) : null;
    const etag = `"${baseTag}${enc ? `-${enc === 'br' ? 'br' : 'gz'}` : ''}"`;
    const lastModified = st.mtime.toUTCString();
    const common: Record<string, string | number> = {
      'Content-Type': type,
      'Cache-Control': cacheControl,
      ETag: etag,
      'Last-Modified': lastModified,
    };
    if (canCompress) common.Vary = 'Accept-Encoding';

    const inm = req.headers['if-none-match'];
    const ims = req.headers['if-modified-since'];
    const fresh = inm
      ? etagMatches(inm, etag)
      : ims
        ? Math.floor(st.mtimeMs / 1000) <= Math.floor(Date.parse(ims) / 1000)
        : false;
    if (fresh) {
      res.writeHead(304, common);
      return void res.end();
    }

    if (enc) {
      const body = await compressed(`${file}|${baseTag}|${enc}`, file, enc);
      res.writeHead(200, {
        ...common,
        'Content-Encoding': enc,
        'Content-Length': body.byteLength,
      });
      return void res.end(head ? undefined : body);
    }

    common['Accept-Ranges'] = 'bytes';
    // If-Range is not supported: a request with it simply gets the whole file.
    const range = req.headers['if-range']
      ? { kind: 'full' as const }
      : parseRange(req.headers.range, st.size);
    if (range.kind === 'unsatisfiable')
      return sendText(res, 416, { 'Content-Range': `bytes */${st.size}` });
    let start = 0;
    let end = st.size - 1;
    if (range.kind === 'partial') {
      ({ start, end } = range);
      res.writeHead(206, {
        ...common,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Content-Length': end - start + 1,
      });
    } else {
      res.writeHead(200, { ...common, 'Content-Length': st.size });
    }
    if (head || st.size === 0) return void res.end();
    pipeline(createReadStream(file, { start, end }), res, () => {
      // A reset client or a file that vanished ends the response. Nothing to log.
      if (!res.writableEnded) res.destroy();
    });
  }

  async function lookup(path: string): Promise<{ file: string; st: Stats } | null> {
    try {
      let st = await stat(path);
      let file = path;
      if (st.isDirectory()) {
        file = resolve(path, 'index.html');
        st = await stat(file);
      }
      return st.isFile() ? { file, st } : null;
    } catch {
      return null;
    }
  }

  const cacheFor = (segments: string[]): string => {
    if (segments[0] === 'assets') return IMMUTABLE;
    const last = segments[segments.length - 1] ?? 'index.html';
    if (last === 'version.txt') return 'no-store';
    if (last === 'index.html' || segments.length === 0) return REVALIDATE;
    return SHORT;
  };

  return async (req, res) => {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return sendText(res, 405, { Allow: 'GET, HEAD' });
    const target = safePath(root, req.url ?? '/');
    if (!target.ok) return sendText(res, target.status);
    const found = await lookup(target.path);
    if (found) {
      const segs =
        found.file === target.path ? target.segments : [...target.segments, 'index.html'];
      return sendFile(req, res, found.file, found.st, cacheFor(segs));
    }
    // The game is one page. A browser navigation to an unknown address gets the page; anything
    // else (a script, an image, an API call, the asset folder) gets a plain 404.
    const wantsPage = (req.headers.accept ?? '').includes('text/html');
    const apiLike = target.segments[0] === 'assets' || target.segments[0] === 'v1';
    if (wantsPage && !apiLike) {
      const index = await lookup(resolve(root, 'index.html'));
      if (index) return sendFile(req, res, index.file, index.st, REVALIDATE);
    }
    sendText(res, 404);
  };
}
