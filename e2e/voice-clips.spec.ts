// The voice service in a real browser. A real voice server runs on an ephemeral port against a
// fixture database (one real m4a clip). With the game pointed at it (?e2e=1&voice=<url>, the
// stand-in for VITE_VOICE_URL), the reload "Hear it" button must ask for /v1/clips/<id> with a
// Range request. With no voice address, no request goes out. Chromium and WebKit both run it.
// This spec uses the plain Playwright test (not ./fixtures) because it MUST talk to a second origin.
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { clipId } from '../src/audio/clipId';
import { createVoiceHandler } from '../voice-server/app';
import { openClipStore, type ClipStore } from '../voice-server/store';
import { makeFixtureDir, removeDir } from '../tests/voice-server/fixture';
import { installSilent } from './support/silent';
import { fillTeam, playShots, readyUp, startMatch, tid } from './support/game';

type Seen = { url: string; range: string | undefined };

const M4A = readFileSync(new URL('../public/audio/voice/intro-01-welcome.m4a', import.meta.url));
const KNOWN = 'e2e fixture line';

let dir: string;
let real: ClipStore;
let server: Server;
let origin: string;
let seen: Seen[] = [];

test.beforeAll(async () => {
  dir = makeFixtureDir('voice-e2e.sqlite', [KNOWN], new Uint8Array(M4A));
  real = openClipStore(dir);
  // The test cannot know which question the seed picks, so any unknown id gets the fixture clip.
  const store: ClipStore = {
    get count() {
      return real.count;
    },
    load: (id) => real.load(id) ?? real.load(clipId(KNOWN)),
    close: () => real.close(),
  };
  const handler = createVoiceHandler({
    store,
    allowedOrigin: '*',
    log: () => {},
    ratePerMinute: 100_000,
  });
  server = createServer((req, res) => {
    seen.push({ url: req.url ?? '', range: req.headers.range });
    handler(req, res);
  });
  await new Promise<void>((r) => server.listen(0, r));
  origin = `http://localhost:${(server.address() as AddressInfo).port}`;
});
test.afterAll(async () => {
  await new Promise((r) => server.close(r));
  real.close();
  removeDir(dir);
});
test.beforeEach(() => {
  seen = [];
});

const kinder = { name: 'Alex', grade: 0, subject: 'reading' as const };

async function toReloadQuestion(page: import('@playwright/test').Page, query: string) {
  // The page's CSP names the planned production voice origin. Allow this test server too,
  // by rewriting the page's meta tag in flight (the shipped CSP is checked in tests/hardening).
  // Chromium's Local Network Access checks are off in playwright.config.ts (Chromium projects only).
  await page.route(
    (u) => u.pathname === '/',
    async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replace("media-src 'self'", `media-src 'self' ${origin}`);
      await route.fulfill({ response: res, body });
    },
  );
  await page.goto(`/?e2e=1${query}`);
  await page.waitForFunction(() => Boolean(window.__timeclash));
  await tid(page, 'tap-to-play').click();
  await tid(page, 'intro-skip').click();
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  await fillTeam(page, 'FUTURE', { ...kinder, name: 'Sam' });
  await startMatch(page, kinder, { ...kinder, name: 'Sam' });
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
}

test('with a voice address, Hear it asks the service for /v1/clips/<id> with a Range request', async ({
  page,
  browserName,
}) => {
  // Real audio elements, kept muted so the test makes no sound. Record each one's text-free src.
  await page.addInitScript(() => {
    const Real = window.Audio;
    window.Audio = function (src?: string) {
      const el = new Real(src);
      el.muted = true;
      return el;
    } as unknown as typeof Audio;
  });
  await toReloadQuestion(page, `&voice=${encodeURIComponent(origin)}`);
  // The intro never asks the service (it has its own files), and nothing yet for the question.
  expect(seen.filter((s) => s.url.startsWith('/v1/clips/'))).toEqual([]);

  await tid(page, 'reload-speak').click();
  await expect
    .poll(() => seen.filter((s) => s.url.startsWith('/v1/clips/')).length, { timeout: 10_000 })
    .toBeGreaterThan(0);
  const first = seen.find((s) => s.url.startsWith('/v1/clips/'))!;
  expect(first.url).toMatch(/^\/v1\/clips\/t:[0-9a-f]{16}$/);
  // Media elements ask for bytes by Range (Chromium and Safari on Apple systems do; iPad Safari
  // insists on it). WebKit on Linux (the CI build, GStreamer) may fetch the whole file with no
  // Range header, so there we only prove the clip was requested.
  if (browserName === 'chromium' || process.platform === 'darwin') {
    const ranges = seen.filter((s) => s.url.startsWith('/v1/clips/')).map((s) => s.range);
    expect(
      ranges.some((r) => /^bytes=\d+-\d*$/.test(r ?? '')),
      'a Range request',
    ).toBe(true);
  }
  // The card still works after the clip was asked for.
  await expect(tid(page, 'reload-modal')).toBeVisible();
});

test('with no voice address, no request goes to the service', async ({ page }) => {
  await installSilent(page);
  await toReloadQuestion(page, '');
  await tid(page, 'reload-speak').click();
  await expect(tid(page, 'reload-modal')).toBeVisible();
  // Give a stray request time to arrive: wait for a round trip through the page.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  expect(seen).toEqual([]);
});
