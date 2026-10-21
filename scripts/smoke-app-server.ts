// npm run smoke:server. Builds nothing. Starts the COMPILED app server (what `npm start` runs)
// on a free port against dist/, with a small fixture clip database, and checks it with fetch.
// Run `npm run build` first.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { clipId } from '../src/audio/clipId.ts';
import { loadSecurityHeaders } from '../app-server/headers.ts';
import { makeFixtureDir, removeDir } from '../tests/app-server/fixture.ts';
import { request } from 'node:http';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const entry = resolve(root, 'dist-server/app-server/server.js');
for (const [path, hint] of [
  [resolve(dist, 'index.html'), 'dist/'],
  [entry, 'dist-server/'],
] as const) {
  if (!existsSync(path)) {
    console.error(`smoke:server: ${hint} not found. Run npm run build first.`);
    process.exit(1);
  }
}

const results: { name: string; ok: boolean; note?: string }[] = [];
async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, note: (err as Error).message });
  }
}
function expectEq<T>(got: T, want: T, what: string): void {
  if (got !== want) throw new Error(`${what}: got ${String(got)}, wanted ${String(want)}`);
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });
}

/** Raw request so the path is sent exactly as written. Returns the status code. */
function rawStatus(port: number, path: string): Promise<number> {
  return new Promise((ok, fail) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { Accept: '*/*' } }, (res) => {
      res.resume();
      ok(res.statusCode ?? 0);
    });
    req.on('error', fail);
    req.end();
  });
}

const TEXT = 'smoke test line';
const clips = makeFixtureDir('voice-smoke.sqlite', [TEXT]);
const port = await freePort();
const child = spawn(process.execPath, [entry], {
  cwd: root,
  env: { ...process.env, PORT: String(port), DIST_DIR: dist, VOICE_DB_DIR: clips },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', (d: Buffer) => (output += d.toString()));
child.stderr.on('data', (d: Buffer) => (output += d.toString()));
const base = `http://127.0.0.1:${port}`;

async function waitUp(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${output}`);
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not start:\n${output}`);
}

try {
  await waitUp();
  const expected = loadSecurityHeaders(resolve(dist, '_headers'));
  const headersOk = (r: Response): void => {
    for (const [name, value] of Object.entries(expected))
      expectEq(r.headers.get(name), value, `header ${name}`);
  };
  const version = readFileSync(resolve(dist, 'version.txt'), 'utf8').trim();

  await check('GET / is 200 text/html with the full security header set', async () => {
    const r = await fetch(`${base}/`);
    expectEq(r.status, 200, 'status');
    expectEq(r.headers.get('content-type'), 'text/html; charset=utf-8', 'content-type');
    expectEq(r.headers.get('cache-control'), 'no-cache', 'cache-control');
    headersOk(r);
    if (!(await r.text()).includes('<div id="game"')) throw new Error('not the game page');
  });

  await check('a hashed asset is immutable with the right content type', async () => {
    const html = await (await fetch(`${base}/`)).text();
    const m = /(?:src|href)="\.?\/?(assets\/[^"]+\.js)"/.exec(html);
    if (!m) throw new Error('no script asset in index.html');
    const r = await fetch(`${base}/${m[1]}`);
    expectEq(r.status, 200, 'status');
    expectEq(r.headers.get('content-type'), 'text/javascript; charset=utf-8', 'content-type');
    expectEq(r.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'cache');
    headersOk(r);
  });

  await check('/version.txt works and matches dist/version.txt', async () => {
    const r = await fetch(`${base}/version.txt`);
    expectEq(r.status, 200, 'status');
    expectEq((await r.text()).trim(), version, 'body');
  });

  await check('an unknown deep link: page for a browser, 404 for anything else', async () => {
    const nav = await fetch(`${base}/some/deep/link`, { headers: { Accept: 'text/html' } });
    expectEq(nav.status, 200, 'navigation status');
    expectEq(nav.headers.get('content-type'), 'text/html; charset=utf-8', 'navigation type');
    const other = await fetch(`${base}/some/deep/link`, { headers: { Accept: '*/*' } });
    expectEq(other.status, 404, 'non-navigation status');
    headersOk(other);
  });

  await check('/health is JSON with the build and clip count', async () => {
    const r = await fetch(`${base}/health`);
    expectEq(r.status, 200, 'status');
    const j = (await r.json()) as { ok: boolean; build: string; clips: number };
    expectEq(j.ok, true, 'ok');
    expectEq(j.build, version, 'build');
    expectEq(j.clips, 1, 'clips');
    headersOk(r);
  });

  await check('/v1/clips/<known id> answers a Range request with 206', async () => {
    const id = clipId(TEXT);
    const r = await fetch(`${base}/v1/clips/${id}`, { headers: { Range: 'bytes=0-9' } });
    expectEq(r.status, 206, 'status');
    expectEq(r.headers.get('content-range'), 'bytes 0-9/100', 'content-range');
    expectEq(r.headers.get('content-type'), 'audio/mp4', 'content-type');
    expectEq((await r.arrayBuffer()).byteLength, 10, 'length');
    headersOk(r);
    expectEq((await fetch(`${base}/v1/clips/t:0000000000000000`)).status, 404, 'unknown id');
  });

  await check('traversal attempts get 400 or 404', async () => {
    for (const p of [
      '/../package.json',
      '/assets/../../package.json',
      '/%2e%2e/package.json',
      '/..%2fpackage.json',
      '/%00',
      '/v1/clips/../../package.json',
      '/_headers',
      '/.env',
    ]) {
      const status = await rawStatus(port, p);
      if (status !== 400 && status !== 404) throw new Error(`${p} gave ${status}`);
    }
  });

  await check('gzip works (and brotli)', async () => {
    const html = await (await fetch(`${base}/`)).text();
    const m = /(assets\/[^"]+\.js)/.exec(html);
    const path = m ? `/${m[1]}` : '/';
    const plain = await fetch(`${base}${path}`, { headers: { 'Accept-Encoding': 'identity' } });
    const size = (await plain.arrayBuffer()).byteLength;
    const res = await new Promise<{ enc: string | undefined; body: Buffer }>((ok, fail) => {
      const req = request(
        { host: '127.0.0.1', port, path, headers: { 'Accept-Encoding': 'gzip' } },
        (r) => {
          const parts: Buffer[] = [];
          r.on('data', (c: Buffer) => parts.push(c));
          r.on('end', () => ok({ enc: r.headers['content-encoding'], body: Buffer.concat(parts) }));
        },
      );
      req.on('error', fail);
      req.end();
    });
    expectEq(res.enc, 'gzip', 'content-encoding');
    expectEq(gunzipSync(res.body).byteLength, size, 'decoded size');
    if (res.body.byteLength >= size) throw new Error('gzip did not shrink the file');
    const br = await fetch(`${base}${path}`, { headers: { 'Accept-Encoding': 'br' } });
    expectEq(br.headers.get('content-encoding'), 'br', 'brotli content-encoding');
  });

  await check('the log holds no ids, paths or addresses', async () => {
    await new Promise((r) => setTimeout(r, 50));
    for (const line of output.split('\n').filter((l) => /^(GET|HEAD|POST)/.test(l))) {
      if (!/^(GET|HEAD|POST) [1-5]xx \d+ms$/.test(line)) throw new Error(`log line: ${line}`);
    }
  });
} finally {
  child.kill('SIGTERM');
  await new Promise<void>((r) => {
    if (child.exitCode !== null) return r();
    child.once('exit', () => r());
  });
  removeDir(clips);
}

const failed = results.filter((r) => !r.ok);
for (const r of results)
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `\n      ${r.note}` : ''}`);
console.log(
  `\nsmoke:server: ${results.length - failed.length}/${results.length} passed (port ${port}, build ${readFileSync(resolve(dist, 'version.txt'), 'utf8').trim()})`,
);
if (failed.length > 0) process.exit(1);
