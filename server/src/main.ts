// Starts the relay. Run with `npm run relay`. Settings come from the environment (.env.example).
import { loadBank } from './bank';
import { createRelay } from './server';

const env = process.env;
const production = env.NODE_ENV === 'production';
const origins = (env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (production && origins.length === 0) {
  console.error('Refusing to start: ALLOWED_ORIGINS is required when NODE_ENV=production.');
  process.exit(1);
}

const relay = createRelay({
  bank: loadBank(),
  build: env.RAILWAY_GIT_COMMIT_SHA?.trim() || 'dev',
  allowedOrigins: origins,
  trustProxy: env.TRUST_PROXY === '1',
  // Room code and event type only. Never names, addresses, secrets or questions.
  log: (room, event) => console.log(JSON.stringify({ room, event })),
});

const port = await relay.listen(Number(env.PORT ?? 8787));
console.log(JSON.stringify({ room: '-', event: `listening:${port}` }));

const stop = (): void => {
  void relay.close().then(() => process.exit(0));
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
