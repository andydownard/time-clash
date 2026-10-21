// The clip route: GET /v1/clips/:id (and HEAD). Read-only. The app server mounts it on the same
// origin as the game, so it needs no CORS. Security headers come from the app server for every
// response, so this file sets none of them.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRateLimiter } from './rateLimit.ts';
import { parseRange } from './range.ts';
import type { ClipStore } from './store.ts';

export const CLIP_ID = /^t:[0-9a-f]{16}$/;
export const CLIP_PREFIX = '/v1/clips/';

export type ClipOptions = {
  store: ClipStore;
  /** Requests per IP per minute. Default 120. */
  ratePerMinute?: number;
  now?: () => number;
};

/** Behind Railway's proxy the last X-Forwarded-For entry is the one the proxy added. */
function clientKey(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  const last = (Array.isArray(xff) ? xff.join(',') : (xff ?? '')).split(',').pop()?.trim();
  return last || req.socket.remoteAddress || 'unknown';
}

/** A small text answer (404, 400, 416, 429 ...). */
export function sendText(
  res: ServerResponse,
  status: number,
  headers: Record<string, string | number> = {},
): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(`${status}\n`);
}

export function isClipPath(url: string): boolean {
  return url.startsWith(CLIP_PREFIX);
}

/** Handles one request whose url starts with /v1/clips/. */
export function createClipHandler(
  opts: ClipOptions,
): (req: IncomingMessage, res: ServerResponse) => void {
  const now = opts.now ?? Date.now;
  const limiter = createRateLimiter({ limit: opts.ratePerMinute ?? 120, windowMs: 60_000, now });

  return (req, res) => {
    const method = req.method ?? 'GET';
    if (!limiter.allow(clientKey(req))) return sendText(res, 429, { 'Retry-After': '60' });
    if (method !== 'GET' && method !== 'HEAD') return sendText(res, 405, { Allow: 'GET, HEAD' });
    const raw = req.url ?? '/';
    if (raw.includes('?')) return sendText(res, 400);
    let id: string;
    try {
      id = decodeURIComponent(raw.slice(CLIP_PREFIX.length));
    } catch {
      return sendText(res, 400);
    }
    if (!CLIP_ID.test(id)) return sendText(res, 400);
    const audio = opts.store.load(id);
    if (!audio) return sendText(res, 404);

    const size = audio.byteLength;
    const common = {
      'Content-Type': 'audio/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    const range = parseRange(req.headers.range, size);
    if (range.kind === 'unsatisfiable')
      return sendText(res, 416, { 'Content-Range': `bytes */${size}` });
    const head = method === 'HEAD';
    if (range.kind === 'partial') {
      const part = audio.subarray(range.start, range.end + 1);
      res.writeHead(206, {
        ...common,
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Content-Length': part.byteLength,
      });
      return void res.end(head ? undefined : part);
    }
    res.writeHead(200, { ...common, 'Content-Length': size });
    res.end(head ? undefined : audio);
  };
}
