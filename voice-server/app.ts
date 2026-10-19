// The voice service: GET /v1/clips/:id and GET /health. Nothing else. Read-only.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createRateLimiter } from './rateLimit.ts';
import { parseRange } from './range.ts';
import type { ClipStore } from './store.ts';

export const CLIP_ID = /^t:[0-9a-f]{16}$/;
const CLIP_PREFIX = '/v1/clips/';

export type VoiceOptions = {
  store: ClipStore;
  /** The one site allowed to use the audio. Default https://timeclash.rallytasks.com */
  allowedOrigin?: string;
  build?: string;
  /** Requests per IP per minute. Default 120. */
  ratePerMinute?: number;
  now?: () => number;
  /** Gets "METHOD STATUSCLASS DURATION" only. Never an IP, id or text. */
  log?: (line: string) => void;
};

/** Behind Railway's proxy the last X-Forwarded-For entry is the one the proxy added. */
function clientKey(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  const last = (Array.isArray(xff) ? xff.join(',') : (xff ?? '')).split(',').pop()?.trim();
  return last || req.socket.remoteAddress || 'unknown';
}

export function createVoiceHandler(
  opts: VoiceOptions,
): (req: IncomingMessage, res: ServerResponse) => void {
  const allowedOrigin = opts.allowedOrigin ?? 'https://timeclash.rallytasks.com';
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((line: string) => console.log(line));
  const limiter = createRateLimiter({ limit: opts.ratePerMinute ?? 120, windowMs: 60_000, now });

  const baseHeaders = (): Record<string, string> => ({
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'",
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    Vary: 'Origin',
  });

  function send(
    res: ServerResponse,
    status: number,
    headers: Record<string, string | number>,
    body?: Uint8Array | string,
  ) {
    res.writeHead(status, { ...baseHeaders(), ...headers });
    res.end(body);
  }
  const text = (
    res: ServerResponse,
    status: number,
    headers: Record<string, string | number> = {},
  ) =>
    send(
      res,
      status,
      { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
      `${status}\n`,
    );

  function route(req: IncomingMessage, res: ServerResponse): void {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return text(res, 405, { Allow: 'GET, HEAD' });
    const raw = req.url ?? '/';
    if (raw.includes('?')) return text(res, 400);
    if (raw === '/health') {
      const body = JSON.stringify({
        ok: true,
        clips: opts.store.count,
        build: opts.build ?? 'dev',
      });
      return send(
        res,
        200,
        {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Content-Length': Buffer.byteLength(body),
        },
        method === 'HEAD' ? undefined : body,
      );
    }
    if (!raw.startsWith(CLIP_PREFIX)) return text(res, 404);
    let id: string;
    try {
      id = decodeURIComponent(raw.slice(CLIP_PREFIX.length));
    } catch {
      return text(res, 400);
    }
    if (!CLIP_ID.test(id)) return text(res, 400);
    const audio = opts.store.load(id);
    if (!audio) return text(res, 404);

    const size = audio.byteLength;
    const common = {
      'Content-Type': 'audio/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    const range = parseRange(req.headers.range, size);
    if (range.kind === 'unsatisfiable')
      return text(res, 416, { 'Content-Range': `bytes */${size}` });
    const head = method === 'HEAD';
    if (range.kind === 'partial') {
      const part = audio.subarray(range.start, range.end + 1);
      return send(
        res,
        206,
        {
          ...common,
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
          'Content-Length': part.byteLength,
        },
        head ? undefined : part,
      );
    }
    return send(res, 200, { ...common, 'Content-Length': size }, head ? undefined : audio);
  }

  return (req, res) => {
    const started = now();
    res.on('finish', () =>
      log(`${req.method} ${Math.floor(res.statusCode / 100)}xx ${now() - started}ms`),
    );
    try {
      if (!limiter.allow(clientKey(req))) return text(res, 429, { 'Retry-After': '60' });
      route(req, res);
    } catch {
      if (!res.headersSent) text(res, 500);
      else res.end();
    }
  };
}

export function createVoiceServer(opts: VoiceOptions): Server {
  const server = createServer(createVoiceHandler(opts));
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.setTimeout(30_000);
  return server;
}
