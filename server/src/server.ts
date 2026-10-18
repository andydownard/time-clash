// The network edge: an HTTP server with /health, and a WebSocket upgrade on /ws.
// It does no game logic. It checks the Origin, counts sockets per address, and hands text
// frames to the room manager.
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { QuestionBank } from '../../src/questions/types';
import { HEARTBEAT_MS, LIMITS, MAX_MESSAGE_BYTES, SWEEP_MS } from './config';
import { createKeyedLimiter } from './rateLimit';
import { createRoomManager, type Conn, type ManagerOptions } from './rooms';

export type RelayOptions = {
  bank: QuestionBank;
  /** Build id for /health. */
  build?: string;
  /** Allowed Origin header values. Empty means any (local development and tests only). */
  allowedOrigins?: readonly string[];
  /** Read the client address from X-Forwarded-For (behind Railway's proxy). */
  trustProxy?: boolean;
  log?: ManagerOptions['log'];
  seeds?: ManagerOptions['seeds'];
  now?: () => number;
};

export type Relay = {
  listen(port: number, host?: string): Promise<number>;
  close(): Promise<void>;
  server: Server;
};

export function createRelay(options: RelayOptions): Relay {
  const now = options.now ?? Date.now;
  const allowed = new Set(options.allowedOrigins ?? []);
  const manager = createRoomManager({
    bank: options.bank,
    now,
    ...(options.log ? { log: options.log } : {}),
    ...(options.seeds ? { seeds: options.seeds } : {}),
  });
  // Addresses are hashed with a salt made at boot, kept in memory only, and never logged.
  const salt = randomBytes(16);
  const addrKey = (req: IncomingMessage): string => {
    let ip = req.socket.remoteAddress ?? 'unknown';
    if (options.trustProxy) {
      const parts = String(req.headers['x-forwarded-for'] ?? '').split(',');
      const last = parts[parts.length - 1]?.trim();
      if (last) ip = last;
    }
    return createHash('sha256').update(salt).update(ip).digest('hex').slice(0, 16);
  };
  const newSockets = createKeyedLimiter({
    ...LIMITS.socketsPerAddress,
    now,
    ttlMs: LIMITS.addressTtlMs,
  });
  const openByAddr = new Map<string, number>();

  const http = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, build: options.build ?? 'dev' }));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  });

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
    perMessageDeflate: false,
  });

  const refuse = (socket: Duplex, status: string): void => {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  };

  http.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/ws') return refuse(socket, '404 Not Found');
    if (allowed.size > 0 && !allowed.has(String(req.headers.origin ?? ''))) {
      return refuse(socket, '403 Forbidden');
    }
    const addr = addrKey(req);
    if (!newSockets.take(addr) || (openByAddr.get(addr) ?? 0) >= LIMITS.maxOpenSocketsPerAddress) {
      return refuse(socket, '429 Too Many Requests');
    }
    wss.handleUpgrade(req, socket, head, (ws) => attach(ws, addr));
  });

  const alive = new WeakMap<WebSocket, boolean>();
  function attach(ws: WebSocket, addr: string): void {
    openByAddr.set(addr, (openByAddr.get(addr) ?? 0) + 1);
    alive.set(ws, true);
    const conn: Conn = {
      addr,
      send: (text) => {
        if (ws.readyState === ws.OPEN) ws.send(text);
      },
      close: () => ws.close(1000),
    };
    manager.onConnect(conn);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('message', (data, isBinary) => {
      try {
        // A binary frame is never valid. An empty string fails parsing and gets bad_message.
        manager.onMessage(conn, isBinary ? '' : data.toString('utf8'));
      } catch {
        options.log?.('-', 'internal_error');
        ws.close(1011);
      }
    });
    ws.on('error', () => ws.terminate());
    ws.on('close', () => {
      const left = (openByAddr.get(addr) ?? 1) - 1;
      if (left <= 0) openByAddr.delete(addr);
      else openByAddr.set(addr, left);
      manager.onClose(conn);
    });
  }

  let timers: NodeJS.Timeout[] = [];

  return {
    server: http,
    listen(port, host = '0.0.0.0'): Promise<number> {
      return new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, () => {
          const address = http.address();
          timers = [
            setInterval(() => {
              manager.sweep();
              newSockets.sweep();
            }, SWEEP_MS),
            setInterval(() => {
              for (const ws of wss.clients) {
                if (alive.get(ws) === false) ws.terminate();
                else {
                  alive.set(ws, false);
                  ws.ping();
                }
              }
            }, HEARTBEAT_MS),
          ];
          for (const t of timers) t.unref();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      });
    },
    close(): Promise<void> {
      for (const t of timers) clearInterval(t);
      for (const ws of wss.clients) ws.terminate();
      return new Promise((resolve) => http.close(() => resolve()));
    },
  };
}
