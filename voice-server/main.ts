// npm run voice:start. Env: PORT, VOICE_DB_DIR (default "db"), ALLOWED_ORIGIN.
import { resolve } from 'node:path';
import { createVoiceServer } from './app.ts';
import { openClipStore } from './store.ts';

const dir = resolve(process.env.VOICE_DB_DIR ?? 'db');
const store = openClipStore(dir);
const port = Number(process.env.PORT ?? 8080);
const server = createVoiceServer({
  store,
  build: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ?? 'dev',
  ...(process.env.ALLOWED_ORIGIN ? { allowedOrigin: process.env.ALLOWED_ORIGIN } : {}),
});
server.listen(port, () => console.log(`voice service: ${store.count} clips, port ${port}`));
const stop = (): void => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
