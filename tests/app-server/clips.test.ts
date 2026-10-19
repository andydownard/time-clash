import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clipId } from '../../src/audio/clipId';
import { createAppServer } from '../../app-server/app';
import { openClipStore, type ClipStore } from '../../voice-server/store';
import { FIXTURE_TEXTS, fixtureBytes, makeFixtureDir, removeDir } from './fixture';
import { makeSite } from './site';

let dir: string;
let site: string;
let store: ClipStore;
let server: Server;
let base: string;
const logs: string[] = [];
const ID = clipId(FIXTURE_TEXTS[0]!);

async function start(extra: { ratePerMinute?: number } = {}) {
  server = createAppServer({
    distDir: site,
    store,
    build: 'abc123',
    log: (l: string) => logs.push(l),
    ...extra,
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const bytes = async (r: Response) => new Uint8Array(await r.arrayBuffer());

beforeEach(() => {
  logs.length = 0;
  dir = makeFixtureDir();
  site = makeSite();
  store = openClipStore(dir);
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  store.close();
  removeDir(dir);
  removeDir(site);
});

describe('GET /v1/clips/:id', () => {
  it('serves the whole clip with the contract headers', async () => {
    await start();
    const r = await fetch(`${base}/v1/clips/${ID}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('audio/mp4');
    expect(r.headers.get('accept-ranges')).toBe('bytes');
    expect(r.headers.get('content-length')).toBe('100');
    expect(r.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    // Same origin as the game: no CORS headers are needed, so none are sent.
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(await bytes(r)).toEqual(fixtureBytes());
  });

  it('404 for an unknown id, 400 for a bad id', async () => {
    await start();
    expect((await fetch(`${base}/v1/clips/t:0000000000000000`)).status).toBe(404);
    for (const bad of [
      'abc',
      't:XYZ',
      't:8B53121FF423C149',
      't:8b53121ff423c14',
      't:8b53121ff423c1490',
      '%E0%A4%A',
    ]) {
      expect((await fetch(`${base}/v1/clips/${bad}`)).status, bad).toBe(400);
    }
  });

  it('refuses query strings, odd methods and path traversal', async () => {
    await start();
    expect((await fetch(`${base}/v1/clips/${ID}?x=1`)).status).toBe(400);
    expect((await fetch(`${base}/v1/clips/${ID}`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${base}/v1/clips/${ID}`, { method: 'DELETE' })).status).toBe(405);
    for (const p of [
      '/v1/clips/../../etc/passwd',
      '/v1/clips/..%2f..%2fetc%2fpasswd',
      '/v1/clips/%2e%2e/%2e%2e/x',
      '/v1/clips/t:8b53121ff423c149/../x',
      '//etc/passwd',
      '/db/voice-test.sqlite',
      '/v1/clips',
      '/v1/clips/',
      '/v1/other',
    ]) {
      const r = await fetch(`${base}${p}`, { redirect: 'manual' });
      expect([400, 404], p).toContain(r.status);
      expect(r.headers.get('content-type')).not.toBe('audio/mp4');
    }
  });

  it('raw traversal paths (not tidied by fetch) are refused', async () => {
    await start();
    const port = (server.address() as AddressInfo).port;
    const status = (path: string) =>
      new Promise<number>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, path }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end();
      });
    for (const p of [
      '/v1/clips/../../etc/passwd',
      '/v1/clips/..\\..\\x',
      '/v1/clips/t:8b53121ff423c149/..',
      '/v1/clips/%00',
      '/v1/clips/' + 'a'.repeat(5000),
    ]) {
      expect([400, 404], p).toContain(await status(p));
    }
  });

  it('no clip listing, and nothing under /v1 except a clip', async () => {
    await start();
    for (const p of ['/v1', '/v1/clips', '/v1/clips/', '/v1/x']) {
      const r = await fetch(`${base}${p}`, { headers: { Accept: 'text/html' } });
      expect([400, 404], p).toContain(r.status);
      expect(r.headers.get('content-type'), p).not.toBe('audio/mp4');
    }
  });

  it('HEAD returns the headers and no body', async () => {
    await start();
    const r = await fetch(`${base}/v1/clips/${ID}`, { method: 'HEAD' });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-length')).toBe('100');
    expect((await bytes(r)).length).toBe(0);
  });
});

describe('Range', () => {
  const get = (range: string) => fetch(`${base}/v1/clips/${ID}`, { headers: { Range: range } });

  it('first bytes', async () => {
    await start();
    const r = await get('bytes=0-9');
    expect(r.status).toBe(206);
    expect(r.headers.get('content-range')).toBe('bytes 0-9/100');
    expect(r.headers.get('content-length')).toBe('10');
    expect(await bytes(r)).toEqual(fixtureBytes().subarray(0, 10));
  });

  it('open ended, middle, and an end past the file', async () => {
    await start();
    const open = await get('bytes=0-');
    expect(open.status).toBe(206);
    expect(open.headers.get('content-range')).toBe('bytes 0-99/100');
    const mid = await get('bytes=40-49');
    expect(await bytes(mid)).toEqual(fixtureBytes().subarray(40, 50));
    const past = await get('bytes=90-5000');
    expect(past.headers.get('content-range')).toBe('bytes 90-99/100');
  });

  it('suffix range', async () => {
    await start();
    const r = await get('bytes=-10');
    expect(r.status).toBe(206);
    expect(r.headers.get('content-range')).toBe('bytes 90-99/100');
    expect(await bytes(r)).toEqual(fixtureBytes().subarray(90));
    const big = await get('bytes=-5000');
    expect(big.headers.get('content-range')).toBe('bytes 0-99/100');
  });

  it('416 for a start past the end, a zero suffix', async () => {
    await start();
    for (const range of ['bytes=100-', 'bytes=500-600', 'bytes=-0']) {
      const r = await get(range);
      expect(r.status, range).toBe(416);
      expect(r.headers.get('content-range')).toBe('bytes */100');
    }
  });

  it('a range it cannot read gets the full clip', async () => {
    await start();
    for (const range of ['bytes=5-2', 'items=0-5', 'bytes=0-1,5-6', 'garbage']) {
      expect((await get(range)).status, range).toBe(200);
    }
  });

  it('HEAD with a range gives 206 headers and no body', async () => {
    await start();
    const r = await fetch(`${base}/v1/clips/${ID}`, {
      method: 'HEAD',
      headers: { Range: 'bytes=0-9' },
    });
    expect(r.status).toBe(206);
    expect((await bytes(r)).length).toBe(0);
  });
});

describe('health, limits, logging', () => {
  it('GET /health reports the clip count and build', async () => {
    await start();
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ ok: true, clips: 3, build: 'abc123' });
    const head = await fetch(`${base}/health`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect((await bytes(head)).length).toBe(0);
    expect((await fetch(`${base}/health`, { method: 'POST' })).status).toBe(405);
  });

  it('/health reads the build from dist/version.txt when none is given', async () => {
    server = createAppServer({ distDir: site, store, log: () => {} });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    const r = await fetch(`http://127.0.0.1:${port}/health`);
    expect(await r.json()).toEqual({ ok: true, clips: 3, build: 'abc123' });
  });

  it('rate limits clip requests per IP with 429, but never the site or /health', async () => {
    await start({ ratePerMinute: 3 });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(`${base}/v1/clips/${ID}`)).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    const other = await fetch(`${base}/v1/clips/${ID}`, {
      headers: { 'X-Forwarded-For': '9.9.9.9' },
    });
    expect(other.status).toBe(200);
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await fetch(`${base}/`)).status).toBe(200);
  });

  it('logs only method, status class and duration', async () => {
    await start();
    await fetch(`${base}/v1/clips/${ID}`);
    await fetch(`${base}/v1/clips/t:0000000000000000`);
    await fetch(`${base}/assets/index-AbC123.js?x=secret`);
    await new Promise((r) => setTimeout(r, 20));
    expect(logs.length).toBe(3);
    for (const l of logs) expect(l).toMatch(/^(GET|HEAD) [1-5]xx \d+ms$/);
    expect(logs.join(' ')).not.toMatch(/127\.0\.0\.1|t:|clips|assets|secret|index/);
  });
});

describe('store', () => {
  it('merges every voice-*.sqlite and ignores other files', async () => {
    const extra = makeFixtureDir('voice-b.sqlite', ['Extra line one']);
    store.close();
    store = openClipStore(dir);
    expect(store.count).toBe(3);
    const other = openClipStore(extra);
    expect(other.count).toBe(1);
    expect(other.load(clipId('Extra line one'))?.byteLength).toBe(100);
    other.close();
    removeDir(extra);
    await start();
  });
});
