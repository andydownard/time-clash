// npm start. Env: PORT (default 8080), DIST_DIR (default "dist"), VOICE_DB_DIR (default "db").
// None of these are secrets.
import { resolve } from 'node:path';
import { createAppServer } from './app.ts';
import { openClipStore, type ClipStore } from '../voice-server/store.ts';

const port = Number(process.env.PORT ?? 8080);
const distDir = resolve(process.env.DIST_DIR ?? 'dist');
const dbDir = resolve(process.env.VOICE_DB_DIR ?? 'db');

// A bad voice database must never take the game down. The game falls back to the browser voice.
let store: ClipStore;
try {
  store = openClipStore(dbDir);
} catch (err) {
  console.warn(`clips off: cannot read ${dbDir}: ${(err as Error).message}`);
  store = { count: 0, load: () => null, close: () => {} };
}

const server = createAppServer({ distDir, store });
server.listen(port, () => console.log(`time-clash: ${store.count} clips, port ${port}`));

let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  server.closeIdleConnections();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
