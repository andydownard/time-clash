// The production app server: the built site (dist/) and the spoken clips (/v1/clips/:id) on ONE
// origin, in one Node process. Only node:* modules. To add the Phase 4 relay later, pass
// `onUpgrade` (it receives every WebSocket upgrade) and branch on req.url === '/ws' there.
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { resolve } from 'node:path';
import { createClipHandler, isClipPath, sendText } from '../voice-server/clips.ts';
import type { ClipStore } from '../voice-server/store.ts';
import { loadSecurityHeaders } from './headers.ts';
import { createStaticHandler } from './static.ts';

export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export type AppOptions = {
  /** Folder with the built site. Must hold index.html and _headers. */
  distDir: string;
  store: ClipStore;
  /** Shown by /health. Default: the text of dist/version.txt, else "dev". */
  build?: string;
  /** Clip requests per IP per minute. Default 120. */
  ratePerMinute?: number;
  now?: () => number;
  /** Gets "METHOD STATUSCLASS DURATION" only. Never an IP, id, path or query. */
  log?: (line: string) => void;
  /** The one place a WebSocket route (/ws) will be added. Default: refuse every upgrade. */
  onUpgrade?: UpgradeHandler;
};

const refuseUpgrade: UpgradeHandler = (_req, socket) => {
  socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
};

/** The build id the site was built with (the same value the build writes to /version.txt). */
export function readBuild(distDir: string): string {
  try {
    return readFileSync(resolve(distDir, 'version.txt'), 'utf8').trim() || 'dev';
  } catch {
    return 'dev';
  }
}

export function createAppServer(opts: AppOptions): Server {
  const root = resolve(opts.distDir);
  // Throws a clear error when dist/ was not built. The boot fails rather than serve without them.
  const security = loadSecurityHeaders(resolve(root, '_headers'));
  try {
    readFileSync(resolve(root, 'index.html'));
  } catch {
    throw new Error(`No index.html in ${root}. Run "npm run build" first.`);
  }
  const build = opts.build ?? readBuild(root);
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((line: string) => console.log(line));
  const serveStatic = createStaticHandler({ root });
  const clips = createClipHandler({
    store: opts.store,
    ...(opts.ratePerMinute !== undefined ? { ratePerMinute: opts.ratePerMinute } : {}),
    now,
  });

  function health(req: IncomingMessage, res: ServerResponse): void {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return sendText(res, 405, { Allow: 'GET, HEAD' });
    const body = JSON.stringify({ ok: true, build, clips: opts.store.count });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(method === 'HEAD' ? undefined : body);
  }

  const server = createServer((req, res) => {
    const started = now();
    res.on('finish', () =>
      log(`${req.method} ${Math.floor(res.statusCode / 100)}xx ${now() - started}ms`),
    );
    // The same headers on every response, including errors.
    for (const [name, value] of Object.entries(security)) res.setHeader(name, value);
    const url = req.url ?? '/';
    const fail = (): void => {
      if (!res.headersSent) sendText(res, 500);
      else res.destroy();
    };
    try {
      if (url === '/health' || url.startsWith('/health?')) return health(req, res);
      if (isClipPath(url)) return clips(req, res);
      serveStatic(req, res).catch(fail);
    } catch {
      fail();
    }
  });
  server.on('upgrade', opts.onUpgrade ?? refuseUpgrade);
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  // Longer than the proxy's idle time, so the proxy is never handed a connection we just closed.
  server.keepAliveTimeout = 65_000;
  server.setTimeout(60_000);
  return server;
}
