// Spoken clips in a real browser, from the SAME origin as the game. A real app server (the
// production one, app-server/) runs on an ephemeral port. It serves the real built game
// (node_modules/.e2e-dist, made by playwright.config.ts with VITE_VOICE=on) and a fixture clip
// database (one real m4a). Question text is not spoken any more, so the reload card must make
// no clip request at all. This spec starts its own server (not the shared one) so it can watch the requests.
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

test('the question card has no Hear it and asks the server for no clip', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(origin)) outside.push(r.url());
  });
  await toReloadQuestion(page);
  // The owner removed read-aloud for questions (2026-10-23): every player reads the question.
  await expect(tid(page, 'reload-speak')).toHaveCount(0);
  await expect(tid(page, 'reload-modal').getByRole('button', { name: /hear|listen/i })).toHaveCount(0);
  await page.waitForTimeout(1_000);
  expect(clipRequests()).toEqual([]);
  expect(outside.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:'))).toEqual([]);
  await expect(tid(page, 'reload-modal')).toBeVisible();
});
