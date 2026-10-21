import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppServer } from '../../app-server/app';
import { loadSecurityHeaders, parseHeadersFile } from '../../app-server/headers';
import { openClipStore } from '../../voice-server/store';
import { makeFixtureDir, removeDir } from './fixture';
import { makeSite } from './site';

describe('parseHeadersFile', () => {
  it('reads the /* block, skips comments and other blocks', () => {
    const map = parseHeadersFile(
      ['# comment', '/*', '  A: one', '  B: two: three', '', '/other', '  C: nope'].join('\n'),
    );
    expect(map).toEqual({ A: 'one', B: 'two: three' });
  });
  it('fails on a missing /* block or a broken line', () => {
    expect(() => parseHeadersFile('/x\n  A: 1')).toThrow(/\/\*/);
    expect(() => parseHeadersFile('/*\n  no colon here')).toThrow(/cannot read/);
    expect(() => parseHeadersFile('/*\n  A:')).toThrow(/bad header/);
  });
  it('reads the real file with the four security headers', () => {
    const map = parseHeadersFile(readFileSync('public/_headers', 'utf8'));
    expect(Object.keys(map).sort()).toEqual([
      'Content-Security-Policy',
      'Permissions-Policy',
      'Referrer-Policy',
      'X-Content-Type-Options',
    ]);
  });
});

describe('loadSecurityHeaders', () => {
  it('fails with a clear message when the file is missing', () => {
    expect(() => loadSecurityHeaders('/no/such/_headers')).toThrow(
      /Cannot read the security headers/,
    );
  });
  it('fails when a required header is absent', () => {
    const dir = makeSite({ headers: '/*\n  X-Content-Type-Options: nosniff\n' });
    expect(() => loadSecurityHeaders(`${dir}/_headers`)).toThrow(/Content-Security-Policy/);
    removeDir(dir);
  });
  it('the server will not boot without dist/_headers', () => {
    const dir = makeSite({ headers: null });
    const store = { count: 0, load: () => null, close: () => {} };
    expect(() => createAppServer({ distDir: dir, store })).toThrow(/security headers/);
    removeDir(dir);
  });
});

describe('served headers equal public/_headers', () => {
  let server: Server;
  let site: string;
  let clips: string;
  afterEach(async () => {
    await new Promise((r) => server.close(r));
    removeDir(site);
    removeDir(clips);
  });

  it('on every kind of response', async () => {
    site = makeSite();
    clips = makeFixtureDir();
    const store = openClipStore(clips);
    server = createAppServer({ distDir: site, store, log: () => {} });
    server.on('close', () => store.close());
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const expected = parseHeadersFile(readFileSync('public/_headers', 'utf8'));
    expect(expected['Content-Security-Policy']).toContain("frame-ancestors 'none'");

    const html = { Accept: 'text/html' };
    const responses = await Promise.all([
      fetch(`${base}/`),
      fetch(`${base}/assets/index-AbC123.js`),
      fetch(`${base}/audio/clip.m4a`),
      fetch(`${base}/version.txt`),
      fetch(`${base}/deep/link`, { headers: html }),
      fetch(`${base}/missing.png`),
      fetch(`${base}/%2e%2e/x`),
      fetch(`${base}/`, { method: 'POST' }),
      fetch(`${base}/`, { method: 'HEAD' }),
      fetch(`${base}/health`),
      fetch(`${base}/v1/clips/t:0000000000000000`),
      fetch(`${base}/v1/clips/bad`),
      fetch(`${base}/`, { headers: { 'If-None-Match': '*' } }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([
      200, 200, 200, 200, 200, 404, 404, 405, 200, 200, 404, 400, 304,
    ]);
    for (const r of responses) {
      for (const [name, value] of Object.entries(expected)) {
        expect(r.headers.get(name), `${r.url} ${r.status} ${name}`).toBe(value);
      }
    }
  });
});
