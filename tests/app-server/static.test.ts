import { readFileSync } from 'node:fs';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAppServer } from '../../app-server/app';
import { etagMatches, pickEncoding, safePath } from '../../app-server/static';
import { openClipStore } from '../../voice-server/store';
import { makeFixtureDir, removeDir } from './fixture';
import { AUDIO, BIG_JS, INDEX_HTML, makeSite } from './site';

let site: string;
let clipDir: string;
let server: Server;
let base: string;
let port: number;

beforeEach(async () => {
  site = makeSite();
  clipDir = makeFixtureDir();
  const store = openClipStore(clipDir);
  server = createAppServer({ distDir: site, store, log: () => {} });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
  server.on('close', () => store.close());
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  removeDir(site);
  removeDir(clipDir);
});

// fetch() decodes gzip and br for us. Ask for identity unless a test is about encodings.
const get = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
  fetch(`${base}${path}`, { method, headers: { 'Accept-Encoding': 'identity', ...headers } });

/** Sends the path exactly as written (fetch would tidy ".." away). */
function raw(path: string, headers: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

describe('content types', () => {
  it.each([
    ['/', 'text/html; charset=utf-8'],
    ['/index.html', 'text/html; charset=utf-8'],
    ['/assets/index-AbC123.js', 'text/javascript; charset=utf-8'],
    ['/assets/index-AbC123.css', 'text/css; charset=utf-8'],
    ['/version.txt', 'text/plain; charset=utf-8'],
    ['/favicon.svg', 'image/svg+xml'],
    ['/audio/clip.m4a', 'audio/mp4'],
    ['/fonts/a.woff2', 'font/woff2'],
  ])('%s is %s', async (path, type) => {
    const r = await get(path);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe(type);
  });

  it('serves the exact bytes', async () => {
    expect(await (await get('/')).text()).toBe(INDEX_HTML);
    expect(await (await get('/assets/index-AbC123.js')).text()).toBe(BIG_JS);
    expect(new Uint8Array(await (await get('/audio/clip.m4a')).arrayBuffer())).toEqual(AUDIO);
  });

  it('/version.txt is the build id', async () => {
    expect((await (await get('/version.txt')).text()).trim()).toBe('abc123');
  });
});

describe('cache headers', () => {
  it('hashed assets are immutable for a year', async () => {
    const r = await get('/assets/index-AbC123.js');
    expect(r.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
  it('index.html must be revalidated, on / and on its own name', async () => {
    for (const p of ['/', '/index.html']) {
      expect((await get(p)).headers.get('cache-control'), p).toBe('no-cache');
    }
  });
  it('version.txt is never cached', async () => {
    expect((await get('/version.txt')).headers.get('cache-control')).toBe('no-store');
  });
  it('other files get a short cache', async () => {
    expect((await get('/audio/clip.m4a')).headers.get('cache-control')).toBe(
      'public, max-age=3600',
    );
  });
});

describe('conditional requests', () => {
  it('ETag and Last-Modified come with a file, and If-None-Match gives 304 with no body', async () => {
    const first = await get('/assets/index-AbC123.js');
    const etag = first.headers.get('etag')!;
    expect(etag).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
    expect(first.headers.get('last-modified')).toBeTruthy();
    const again = await get('/assets/index-AbC123.js', { 'If-None-Match': etag });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
    expect(again.headers.get('etag')).toBe(etag);
    const other = await get('/assets/index-AbC123.js', { 'If-None-Match': '"nope"' });
    expect(other.status).toBe(200);
  });
  it('If-Modified-Since gives 304 when the file is not newer', async () => {
    const lm = (await get('/')).headers.get('last-modified')!;
    expect((await get('/', { 'If-Modified-Since': lm })).status).toBe(304);
    expect((await get('/', { 'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT' })).status).toBe(
      200,
    );
  });
  it('a 304 still carries the security headers', async () => {
    const etag = (await get('/')).headers.get('etag')!;
    const r = await get('/', { 'If-None-Match': etag });
    expect(r.headers.get('content-security-policy')).toBeTruthy();
  });
  it('etagMatches reads lists, weak tags and *', () => {
    expect(etagMatches('"a", "b"', '"b"')).toBe(true);
    expect(etagMatches('W/"a"', '"a"')).toBe(true);
    expect(etagMatches('*', '"z"')).toBe(true);
    expect(etagMatches('"a"', '"b"')).toBe(false);
    expect(etagMatches(undefined, '"b"')).toBe(false);
  });
});

describe('compression', () => {
  it('sends brotli when asked, and the bytes decode to the file', async () => {
    const { status, headers, body } = await rawGet('/assets/index-AbC123.js', 'br, gzip');
    expect(status).toBe(200);
    expect(headers['content-encoding']).toBe('br');
    expect(headers.vary).toBe('Accept-Encoding');
    expect(body.byteLength).toBeLessThan(BIG_JS.length / 4);
    expect(brotliDecompressSync(body).toString()).toBe(BIG_JS);
  });
  it('falls back to gzip, then to identity', async () => {
    const gz = await rawGet('/assets/index-AbC123.js', 'gzip');
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(gz.body).toString()).toBe(BIG_JS);
    const none = await rawGet('/assets/index-AbC123.js', undefined);
    expect(none.headers['content-encoding']).toBeUndefined();
    expect(none.body.toString()).toBe(BIG_JS);
  });
  it('each encoding has its own ETag and a 304 works per encoding', async () => {
    const a = await rawGet('/assets/index-AbC123.js', 'br');
    const b = await rawGet('/assets/index-AbC123.js', 'gzip');
    expect(a.headers.etag).not.toBe(b.headers.etag);
    const again = await rawGet('/assets/index-AbC123.js', 'br', {
      'If-None-Match': a.headers.etag as string,
    });
    expect(again.status).toBe(304);
  });
  it('leaves small files, images, fonts and audio alone', async () => {
    for (const p of ['/assets/tiny.js', '/fonts/a.woff2', '/audio/clip.m4a']) {
      const r = await rawGet(p, 'br, gzip');
      expect(r.headers['content-encoding'], p).toBeUndefined();
    }
  });
  it('pickEncoding honours q=0 and prefers br', () => {
    expect(pickEncoding('gzip, br')).toBe('br');
    expect(pickEncoding('br;q=0, gzip')).toBe('gzip');
    expect(pickEncoding('identity')).toBeNull();
    expect(pickEncoding('*')).toBe('br');
    expect(pickEncoding(undefined)).toBeNull();
  });
});

function rawGet(
  path: string,
  acceptEncoding: string | undefined,
  extra: Record<string, string> = {},
) {
  return new Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
  }>((resolve, reject) => {
    const headers: Record<string, string> = { ...extra };
    if (acceptEncoding) headers['Accept-Encoding'] = acceptEncoding;
    const req = request({ host: '127.0.0.1', port, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

describe('HEAD', () => {
  it('has the same headers as GET and no body, with and without compression', async () => {
    const g = await get('/assets/index-AbC123.js');
    const h = await get('/assets/index-AbC123.js', {}, 'HEAD');
    expect(h.status).toBe(200);
    expect(h.headers.get('content-length')).toBe(g.headers.get('content-length'));
    expect(h.headers.get('etag')).toBe(g.headers.get('etag'));
    expect((await h.arrayBuffer()).byteLength).toBe(0);
    const hz = await fetch(`${base}/assets/index-AbC123.js`, {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'br' },
    });
    expect(hz.headers.get('content-encoding')).toBe('br');
  });
  it('HEAD of an unknown page falls back like GET, HEAD of a missing file is 404', async () => {
    expect((await get('/some/page', { Accept: 'text/html' }, 'HEAD')).status).toBe(200);
    expect((await get('/missing.png', {}, 'HEAD')).status).toBe(404);
  });
});

describe('Range for static files (iPad Safari needs 206 for audio)', () => {
  it('answers a range with 206 and the right bytes', async () => {
    const r = await get('/audio/clip.m4a', { Range: 'bytes=10-19' });
    expect(r.status).toBe(206);
    expect(r.headers.get('content-range')).toBe('bytes 10-19/200');
    expect(r.headers.get('accept-ranges')).toBe('bytes');
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(AUDIO.subarray(10, 20));
  });
  it('416 past the end', async () => {
    const r = await get('/audio/clip.m4a', { Range: 'bytes=500-' });
    expect(r.status).toBe(416);
    expect(r.headers.get('content-range')).toBe('bytes */200');
  });
});

describe('unknown routes (the game is one page)', () => {
  it('a browser navigation gets index.html with 200 and no-cache', async () => {
    for (const p of ['/some/deep/link', '/camp', '/x.y']) {
      const r = await get(p, { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' });
      expect(r.status, p).toBe(200);
      expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(r.headers.get('cache-control')).toBe('no-cache');
      expect(await r.text()).toBe(INDEX_HTML);
    }
  });
  it('anything that does not ask for a page gets 404', async () => {
    for (const p of ['/some/deep/link', '/missing.js', '/robots.txt']) {
      expect((await get(p, { Accept: '*/*' })).status, p).toBe(404);
      expect((await get(p, { Accept: 'application/json' })).status, p).toBe(404);
    }
  });
  it('a missing asset or API path is 404 even for a browser', async () => {
    for (const p of ['/assets/nope.js', '/v1/whatever', '/v1/clips']) {
      expect((await get(p, { Accept: 'text/html' })).status, p).toBe(404);
    }
  });
  it('other methods get 405 with Allow', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const r = await get('/', {}, method);
      expect(r.status, method).toBe(405);
      expect(r.headers.get('allow')).toBe('GET, HEAD');
    }
  });
  it('WebSocket upgrades are refused until a relay is mounted', async () => {
    const status = await new Promise<string>((resolve, reject) => {
      const req = request({
        host: '127.0.0.1',
        port,
        path: '/ws',
        headers: { Connection: 'Upgrade', Upgrade: 'websocket' },
      });
      req.on('response', (res) => resolve(`response ${res.statusCode}`));
      req.on('upgrade', () => resolve('upgraded'));
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe('response 404');
  });
});

describe('path safety', () => {
  it('never serves hidden files or the headers file', async () => {
    for (const p of [
      '/.secret',
      '/_headers',
      '/_redirects',
      '/assets/../.secret',
      '/.git/config',
    ]) {
      const r = await get(p, { Accept: '*/*' });
      expect([400, 404], p).toContain(r.status);
      expect(await r.text(), p).not.toContain('nope');
    }
  });
  it('refuses traversal in every spelling, sent raw', async () => {
    const attempts = [
      '/../package.json',
      '/assets/../../package.json',
      '/%2e%2e/package.json',
      '/%2E%2E/%2E%2E/etc/passwd',
      '/assets/%2e%2e/%2e%2e/package.json',
      '/..%2fpackage.json',
      '/assets/..%2f..%2fpackage.json',
      '/..%5cpackage.json',
      '/assets/..\\..\\package.json',
      '/%00',
      '/index.html%00.png',
      '/assets/\0x',
      '/%c0%ae%c0%ae/package.json',
      '//etc/passwd',
      '/%',
      '/%E0%A4%A',
      '/.',
      '/./index.html',
    ];
    for (const p of attempts) {
      let status: number;
      try {
        status = await raw(p, { Accept: '*/*' });
      } catch {
        continue; // Node refused to even send it (control characters): also fine.
      }
      expect([400, 404], p).toContain(status);
    }
    // And none of it ever returned a file from outside dist.
    const body = await (await get('/%2e%2e/package.json', { Accept: '*/*' })).text();
    expect(body).not.toContain('"time-clash"');
  });
  it('a double-encoded dot dot is just a file name that does not exist', async () => {
    expect((await get('/%252e%252e/package.json', { Accept: '*/*' })).status).toBe(404);
  });
  it('does not follow an absolute-form target to another place', async () => {
    expect(await raw('http://evil.example/../../etc/passwd', { Accept: '*/*' })).toBe(400);
  });
  it('safePath keeps the result inside the root', () => {
    expect(safePath('/srv/dist', '/a/b.js?x=1')).toEqual({
      ok: true,
      path: '/srv/dist/a/b.js',
      segments: ['a', 'b.js'],
    });
    expect(safePath('/srv/dist', '/../x')).toEqual({ ok: false, status: 400 });
    expect(safePath('/srv/dist', '/%2e%2e/x')).toEqual({ ok: false, status: 400 });
    expect(safePath('/srv/dist', '/a\0b')).toEqual({ ok: false, status: 400 });
    expect(safePath('/srv/dist', 'x')).toEqual({ ok: false, status: 400 });
  });
});

describe('boot', () => {
  it('refuses to start without index.html', () => {
    const bad = makeSite({ index: false });
    const store = { count: 0, load: () => null, close: () => {} };
    expect(() => createAppServer({ distDir: bad, store })).toThrow(/index\.html/);
    removeDir(bad);
  });
  it('test fixtures match the real built page shape', () => {
    expect(readFileSync('public/_headers', 'utf8')).toContain('Content-Security-Policy');
  });
});
