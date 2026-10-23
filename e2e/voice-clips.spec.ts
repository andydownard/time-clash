// Spoken clips in a real browser, from the SAME origin as the game. A real app server (the
// production one, app-server/) runs on an ephemeral port. It serves the real built game
// (node_modules/.e2e-dist, made by playwright.config.ts with VITE_VOICE=on) and a fixture clip
// database (one real m4a). The reload "Hear it" button must ask the page's own origin for
// /v1/clips/<id> with a Range request, and fall back quietly when the clip is missing.
// This spec starts its own server (not the shared one) so it can watch the requests.
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { clipId } from '../src/audio/clipId';
import { createAppServer } from '../app-server/app';
import { openClipStore, type ClipStore } from '../voice-server/store';
import { makeFixtureDir, removeDir } from '../tests/app-server/fixture';
import { fillTeam, playShots, readyUp, startMatch, tid } from './support/game';

type Seen = { url: string; range: string | undefined };

const M4A = readFileSync(new URL('../public/audio/voice/intro-01-welcome.m4a', import.meta.url));
const KNOWN = 'e2e fixture line';
const DIST = new URL('../node_modules/.e2e-dist', import.meta.url).pathname;

let dir: string;
let real: ClipStore;
let server: Server;
let origin: string;
let seen: Seen[] = [];
/** When true every id gets the fixture clip. When false the store is empty (all 404). */
let haveClips = true;

test.beforeAll(async () => {
  dir = makeFixtureDir('voice-e2e.sqlite', [KNOWN], new Uint8Array(M4A));
  real = openClipStore(dir);
  // The test cannot know which question the seed picks, so any unknown id gets the fixture clip.
  const store: ClipStore = {
    get count() {
      return real.count;
    },
    load: (id) => (haveClips ? (real.load(id) ?? real.load(clipId(KNOWN))) : null),
    close: () => real.close(),
  };
  server = createAppServer({
    distDir: DIST,
    store,
    log: () => {},
    ratePerMinute: 100_000,
  });
  server.prependListener('request', (req) => {
    seen.push({ url: req.url ?? '', range: req.headers.range });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(async () => {
  await new Promise((r) => server.close(r));
  real.close();
  removeDir(dir);
});
test.beforeEach(() => {
  seen = [];
  haveClips = true;
});

const clipRequests = () => seen.filter((s) => s.url.startsWith('/v1/clips/'));
const kinder = { name: 'Alex', grade: 0, subject: 'reading' as const };

async function toReloadQuestion(page: import('@playwright/test').Page) {
  await page.goto(`${origin}/?e2e=1`);
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

test("Hear it asks the page's own origin for /v1/clips/<id> with a Range request", async ({
  page,
  browserName,
}) => {
  // Real audio elements, kept muted so the test makes no sound.
  await page.addInitScript(() => {
    const Real = window.Audio;
    window.Audio = function (src?: string) {
      const el = new Real(src);
      el.muted = true;
      return el;
    } as unknown as typeof Audio;
  });
  const outside: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(origin)) outside.push(r.url());
  });
  await toReloadQuestion(page);
  // The intro never asks for a clip (it has its own files), and nothing yet for the question.
  expect(clipRequests()).toEqual([]);

  await tid(page, 'reload-speak').click();
  await expect.poll(() => clipRequests().length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(clipRequests()[0]!.url).toMatch(/^\/v1\/clips\/t:[0-9a-f]{16}$/);
  // Media elements ask for bytes by Range (Chromium and Safari on Apple systems do; iPad Safari
  // insists on it). WebKit on Linux (the CI build, GStreamer) may fetch the whole file with no
  // Range header, so there we only prove the clip was requested.
  if (browserName === 'chromium' || process.platform === 'darwin') {
    expect(
      clipRequests().some((s) => /^bytes=\d+-\d*$/.test(s.range ?? '')),
      'a Range request',
    ).toBe(true);
  }
  // Nothing went to any other origin, and the card still works.
  expect(outside.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:'))).toEqual([]);
  await expect(tid(page, 'reload-modal')).toBeVisible();
});

test('a missing clip (404) falls back quietly and is not asked for twice', async ({
  page,
  browserName,
}) => {
  haveClips = false;
  // Count the clip elements that report an error, so the test waits for the browser's answer
  // instead of sleeping. The listener only counts. The game's own handler runs in the same event.
  await page.addInitScript(() => {
    const w = window as unknown as { __clipErrors: number };
    w.__clipErrors = 0;
    const Real = window.Audio;
    window.Audio = function (src?: string) {
      const el = new Real(src);
      el.addEventListener('error', () => {
        w.__clipErrors++;
      });
      return el;
    } as unknown as typeof Audio;
  });
  await toReloadQuestion(page);
  const settle = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await tid(page, 'reload-speak').click();
  await expect.poll(() => clipRequests().length, { timeout: 10_000 }).toBeGreaterThan(0);
  // The game gives up on a clip at once on an error (and after CLIP_START_TIMEOUT_MS if the browser
  // reports nothing). Chromium reports the 404, so wait for that report. Safari reports it late, and
  // only the "card still works" check below is promised there.
  if (browserName === 'chromium') {
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __clipErrors: number }).__clipErrors))
      .toBeGreaterThan(0);
  }
  await settle();
  // A browser may probe a few times for the one clip. Asking again must add nothing.
  const afterFirst = clipRequests().length;
  await tid(page, 'reload-speak').click();
  await settle();
  // Safari reports a failed media request late, after a short line has already ended, so the
  // miss is only guaranteed to be remembered in Chromium. In every browser the card must still work.
  if (browserName === 'chromium') expect(clipRequests().length).toBe(afterFirst);
  await expect(tid(page, 'reload-modal')).toBeVisible();
});
