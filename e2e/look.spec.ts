// The look and feel: self-hosted fonts, floors on every screen (56px targets, 20px text,
// no sideways scroll), and the docs/screenshots set. Screens are walked in play order.
// Screenshots are retaken only with UPDATE_SCREENSHOTS=1 (see e2e/support/shots.ts).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { smallTargets, smallText } from './support/audit';
import {
  answerReload,
  fillTeam,
  openGame,
  playShots,
  readyUp,
  startMatch,
  takeShot,
  tapGotIt,
  tid,
  toSetup,
  waitAiming,
  waitPassScreen,
  wearDown,
} from './support/game';
import { saveShot } from './support/shots';

async function floors(page: Page, where: string): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect.soft(over, `${where}: sideways scroll`).toBeLessThanOrEqual(0);
  expect.soft(await smallTargets(page), `${where}: targets under 56px`).toEqual([]);
  expect.soft(await smallText(page), `${where}: text under 20px`).toEqual([]);
}

/** A whole screen fits: it does not scroll, and every button is fully inside the window. */
async function fitsOnScreen(page: Page, screen: string, where: string): Promise<void> {
  // A fallback font is taller than the real one, so measure only after the fonts are in.
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(`[data-screen="${sel}"]`)!;
    const buttons = [...el.querySelectorAll<HTMLElement>('button')].filter(
      (b) => b.offsetParent !== null,
    );
    return {
      scrolls: el.scrollHeight - el.clientHeight,
      parts: [...el.children].map(
        (c) => `${c.className || c.tagName}:${Math.round(c.getBoundingClientRect().height)}`,
      ),
      outside: buttons
        .map((b) => ({ id: b.dataset.testid ?? b.textContent, box: b.getBoundingClientRect() }))
        .filter(
          ({ box }) =>
            box.top < 0 || box.left < 0 || box.bottom > innerHeight || box.right > innerWidth,
        )
        .map((x) => x.id),
    };
  }, screen);
  expect
    .soft(r.scrolls, `${where}: the screen scrolls (${r.parts.join(' ')})`)
    .toBeLessThanOrEqual(1);
  expect.soft(r.outside, `${where}: buttons not fully inside the window`).toEqual([]);
}

const IPAD_SIZES = [
  { w: 1024, h: 768 },
  { w: 1133, h: 744 },
  { w: 1280, h: 800 },
  { w: 1376, h: 1032 },
];

test('Setup fits every iPad landscape size, Clear my data included', async ({ page }) => {
  await toSetup(page);
  for (const { w, h } of IPAD_SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await fitsOnScreen(page, 'setup', `Setup ${w}x${h}`);
    const clear = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>('[data-testid="clear-data"]');
      return b ? b.getBoundingClientRect().bottom : -1;
    });
    expect.soft(clear, `Setup ${w}x${h}: Clear my data bottom edge`).toBeGreaterThan(0);
    expect.soft(clear, `Setup ${w}x${h}: Clear my data clear of the bottom`).toBeLessThanOrEqual(h - 8);
  }
});

test('fonts come from this site and are loaded', async ({ page, baseURL }) => {
  const fontUrls: string[] = [];
  page.on('response', (r) => {
    if (/\.(woff2?|ttf|otf)(\?|$)/.test(r.url())) fontUrls.push(r.url());
  });
  await openGame(page);
  await tid(page, 'tap-to-play').click();
  await expect(tid(page, 'intro-card')).toBeVisible();
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('400 32px MedievalSharp'),
      document.fonts.load('700 20px Orbitron'),
      document.fonts.load('800 20px Orbitron'),
      document.fonts.load('900 20px Orbitron'),
    ]);
    return [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => `${f.family.replace(/["']/g, '')} ${f.weight}`);
  });
  expect(loaded).toEqual(
    expect.arrayContaining(['MedievalSharp 400', 'Orbitron 700', 'Orbitron 800', 'Orbitron 900']),
  );
  expect(fontUrls.length, 'font files were requested').toBeGreaterThan(0);
  for (const u of fontUrls) expect(new URL(u).origin, u).toBe(new URL(baseURL!).origin);
  // The screens use them: buttons in Orbitron, the title in MedievalSharp.
  const families = await page.evaluate(() => ({
    button: getComputedStyle(document.querySelector('[data-testid="intro-skip"]')!).fontFamily,
    heading: getComputedStyle(document.querySelector('h1, h2')!).fontFamily,
  }));
  expect(families.button).toContain('Orbitron');
  expect(families.heading).toContain('MedievalSharp');
});

test('the page links no outside style, script or font', async ({ page }) => {
  await openGame(page);
  const outside = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('link[href], script[src], img[src], source[src]')]
      .map((e) => e.getAttribute('href') ?? e.getAttribute('src') ?? '')
      .filter(
        (u) => /^(https?:)?\/\//.test(u) && new URL(u, location.href).origin !== location.origin,
      ),
  );
  expect(outside).toEqual([]);
});

test('every screen keeps the floors (UPDATE_SCREENSHOTS=1 also retakes the screenshots)', async ({
  page,
  browserName,
}) => {
  // A whole match under four busy workers can pass 3 minutes. Triple the limit, no sleeps.
  test.slow();
  const shot = (name: string): Promise<void> => saveShot(page, browserName, name);
  await openGame(page);
  await floors(page, 'Tap to Start');
  await shot('tap-to-start');

  await tid(page, 'tap-to-play').click();
  await expect(tid(page, 'intro-card')).toBeVisible();
  await floors(page, 'Intro');
  await shot('intro');

  await tid(page, 'intro-skip').click();
  // Loading is brief: look at it the moment it shows.
  await expect(page.locator('[data-screen="loading"]')).toBeVisible();
  await shot('loading');
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  await floors(page, 'Setup');
  await fitsOnScreen(page, 'setup', 'Setup');
  await saveShot(page, browserName, 'setup');

  await startMatch(page, undefined, undefined, undefined, async () => {
    await floors(page, 'Camp');
    await fitsOnScreen(page, 'camp', 'Camp');
    await shot('camp');
    // The Forge, for both teams, then back to the Camp.
    await tid(page, 'camp-forge').click();
    await expect(tid(page, 'forge-back')).toBeVisible();
    await floors(page, 'Forge Past');
    await fitsOnScreen(page, 'forge', 'Forge Past');
    await shot('forge-past');
    await tid(page, 'forge-team-FUTURE').click();
    await floors(page, 'Forge Future');
    await fitsOnScreen(page, 'forge', 'Forge Future');
    await shot('forge-future');
    await tid(page, 'forge-back').click();
    await expect(tid(page, 'camp-start')).toBeVisible();
    // Build Base (the builder), for both teams, then back to the Camp.
    await tid(page, 'camp-build').click();
    for (const team of ['PAST', 'FUTURE'] as const) {
      if (team === 'FUTURE') await tid(page, 'bb-team-FUTURE').click();
      await expect(page.locator(`[data-screen="builder"][data-team="${team}"]`)).toBeVisible();
      await floors(page, `Builder ${team}`);
      await fitsOnScreen(page, 'builder', `Builder ${team}`);
    }
    await tid(page, 'bb-back').click();
    await expect(tid(page, 'camp-start')).toBeVisible();
    // The Battle Plan (Phase 2), then Back to the Camp. startMatch locks it in after this.
    await tid(page, 'camp-start').click();
    await expect(tid(page, 'plan-go')).toBeVisible();
    await floors(page, 'Battle Plan');
    await fitsOnScreen(page, 'plan', 'Battle Plan');
    await shot('plan');
    await tid(page, 'plan-back').click();
    await expect(tid(page, 'camp-start')).toBeVisible();
  });
  await floors(page, 'Pass screen');
  await shot('pass-screen');
  await readyUp(page);
  await expect(tid(page, 'fire')).toBeEnabled({ timeout: 5_000 });
  await floors(page, 'Battle');
  await saveShot(page, browserName, 'battle-aiming');

  await takeShot(page, 'near');
  await expect(tid(page, 'speech-bubble')).toBeVisible({ timeout: 15_000 });
  await floors(page, 'Tumble');
  await shot('tumble');
  await waitAiming(page, 1);
  await takeShot(page, 'direct');
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await floors(page, 'Reload math');
  await shot('reload-modal');
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);
  // The second team's pass screen, so both team looks are on file.
  await shot('pass-screen-future');

  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);

  await readyUp(page);
  await playShots(page, ['direct', 'direct']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);

  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);

  // Full health takes several turns (the pace rule): wear it down to one hit.
  await wearDown(page);
  await readyUp(page);
  await takeShot(page, 'direct');
  await expect(tid(page, 'victory')).toBeVisible({ timeout: 45_000 });
  await floors(page, 'Victory');
  await fitsOnScreen(page, 'victory', 'Victory');
  await shot('victory');
  // The iPad sizes too (docs/IPAD_AUDIT.md): the mini is the tightest.
  for (const { w, h } of IPAD_SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await fitsOnScreen(page, 'victory', `Victory ${w}x${h}`);
  }
});

test('a reading reload keeps the floors', async ({ page, browserName }) => {
  await toSetup(page);
  const kid = { name: 'Alex', grade: 1, subject: 'reading' as const };
  await fillTeam(page, 'FUTURE', { ...kid, name: 'Sam' });
  await startMatch(page, kid, { ...kid, name: 'Sam' });
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await floors(page, 'Reload reading');
  await saveShot(page, browserName, 'reload-reading');
});
