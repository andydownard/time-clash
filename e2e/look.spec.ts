// The look and feel: self-hosted fonts, floors on every screen (56px targets, 20px text,
// no sideways scroll), and the docs/screenshots set. Screens are walked in play order, in one
// whole match that also checks the rules of play (aim, fire, reload, pass, win, rematch).
// Screenshots are retaken only with UPDATE_SCREENSHOTS=1 (see e2e/support/shots.ts).
import type { Page } from '@playwright/test';
import { DAMAGE, LAUNCH_ORIGINS } from '../src/game/config';
import { VICTORY } from '../src/data/copy';
import { expect, test } from './fixtures';
import { smallTargets, smallText } from './support/audit';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  SEED,
  answerReload,
  bannerSeen,
  openGame,
  playShots,
  readyUp,
  skipLoadingWait,
  snap,
  startMatch,
  takeBonusShot,
  takeShot,
  tapGotIt,
  tid,
  toSetup,
  waitAiming,
  waitBonusAiming,
  waitPassScreen,
  watchBanner,
  wearDown,
} from './support/game';
import { saveShot } from './support/shots';

/** The cover must be solid, fill the window, and leave the board hidden and locked. */
async function expectCover(page: Page, testId: string) {
  const cover = tid(page, testId);
  await expect(cover).toBeVisible();
  const facts = await cover.evaluate(async (el) => {
    // Let the pop-in finish first, so the size is the settled size.
    await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
    const r = el.getBoundingClientRect();
    const bg = getComputedStyle(el).backgroundColor;
    const canvas = document.querySelector('#game canvas') as HTMLElement;
    const board = canvas.parentElement as HTMLElement;
    const hud = document.querySelector('[data-layer="hud"]') as HTMLElement;
    return {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      view: { w: window.innerWidth, h: window.innerHeight },
      bg,
      opacity: getComputedStyle(el).opacity,
      boardHidden: getComputedStyle(board).visibility === 'hidden',
      boardInert: board.hasAttribute('inert'),
      hudHidden: getComputedStyle(hud).visibility === 'hidden',
      hudInert: hud.hasAttribute('inert'),
    };
  });
  expect(facts.rect.x).toBeLessThanOrEqual(0);
  expect(facts.rect.y).toBeLessThanOrEqual(0);
  expect(facts.rect.w).toBeGreaterThanOrEqual(facts.view.w);
  expect(facts.rect.h).toBeGreaterThanOrEqual(facts.view.h);
  // "rgb(r, g, b)" has no alpha, so it is fully solid. "rgba(...)" must end in 1.
  expect(facts.bg, 'cover background must be opaque').toMatch(/^rgb\(|, 1\)$/);
  expect(facts.opacity).toBe('1');
  expect(facts.boardHidden && facts.boardInert, 'canvas hidden and locked').toBe(true);
  expect(facts.hudHidden && facts.hudInert, 'HUD hidden and locked').toBe(true);
}

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
    expect
      .soft(clear, `Setup ${w}x${h}: Clear my data clear of the bottom`)
      .toBeLessThanOrEqual(h - 8);
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

// A built base that lost bricks: Chrono tells that side, by name, that its saved base is safe
// (owner, 2026-10-25). The fullest screen: both sides tie every award (six medals each), a Scrap
// row with a plus, and the line for both sides. It must still fit on one screen at every iPad
// size. The test hook opens the real Victory screen with these results, so no whole match is
// needed.
test('Victory says a crumbled built base is safe, and still fits on one screen', async ({
  page,
  browserName,
}) => {
  const startSize = page.viewportSize()!;
  await toSetup(page);
  // Victory opens over Setup here (a real match has the podium behind it), so hide Setup.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-screen="setup"]')) {
      el.style.visibility = 'hidden';
    }
  });
  const full = {
    shotsFired: 30,
    directHits: 12,
    nearHits: 9,
    questionsAnswered: 10,
    correctAnswers: 10,
    fastestAnswerMs: 2100,
    scrapEarned: 14,
  };
  const show = (crumbled: Array<'PAST' | 'FUTURE'>) =>
    page.evaluate((o) => window.__timeclash!.previewVictory(o), {
      winner: 'PAST' as const,
      names: { PAST: PAST_SIDE.name, FUTURE: FUTURE_SIDE.name },
      stats: { PAST: full, FUTURE: full },
      crumbled,
    });
  await show(['PAST', 'FUTURE']);
  const victory = tid(page, 'victory');
  await expect(victory).toBeVisible();
  const line = victory.locator('[data-role="saved-base"]');
  await expect(line).toHaveText(VICTORY.savedBaseSafe(PAST_SIDE.name, FUTURE_SIDE.name));
  await expect(line).toBeVisible();
  // Chrono's bubble is a status region, so a screen reader says the line as well.
  await expect(victory.locator('[role="status"] [data-role="saved-base"]')).toBeVisible();
  await floors(page, 'Victory with the saved-base line');
  await fitsOnScreen(page, 'victory', 'Victory with the saved-base line');
  await saveShot(page, browserName, 'victory-saved-base');
  const dir = process.env.VICTORY_SHOTS;
  for (const { w, h } of IPAD_SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await fitsOnScreen(page, 'victory', `Victory with the saved-base line ${w}x${h}`);
    if (dir) await page.screenshot({ path: `${dir}/victory-saved-base-${w}x${h}.png` });
  }
  await page.setViewportSize(startSize);
  // Only the side that lost bricks is named.
  await tid(page, 'rematch').click();
  await show(['FUTURE']);
  await expect(line).toHaveText(VICTORY.savedBaseSafe(FUTURE_SIDE.name));
  await expect(line).not.toContainText(PAST_SIDE.name);
});

// How the test reaches Victory without editing the app: the ?e2e=1 hook pins the seed and reads
// state, but it cannot set health. So the test plays it out, with the keyboard and Space to fire.
// For each shot it asks the real game rules (src/game) which angle and power give a direct hit.
// Full health is DAMAGE.startingBaseHp, so Team Past needs about five turns of direct hits and
// Power Shots (the pace rule, done by wearDown). Team Future shoots short harmless shots, so it
// still takes its turns and answers its questions. Reload answers come from the bank on disk. "Slow"
// moves the page clock forward 9 seconds (window.__skew) instead of waiting.
test('a full match keeps the floors on every screen and plays by the rules: aim, fire, reload, pass, win, rematch', async ({
  page,
  browserName,
}) => {
  // A whole match is about five turns a side (the pace rule), and busy workers slow each one.
  // Allow five times the usual limit, no sleeps.
  test.setTimeout(5 * test.info().timeout);
  const shot = (name: string): Promise<void> => saveShot(page, browserName, name);
  const startSize = page.viewportSize()!;
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
  await skipLoadingWait(page);
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  await floors(page, 'Setup');
  await fitsOnScreen(page, 'setup', 'Setup');
  await shot('setup');

  await startMatch(page, PAST_SIDE, FUTURE_SIDE, SEED, async () => {
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

  // ----- Turn 1, Team Past: pass screen first -----
  let m = await snap(page);
  expect(m.seed).toBe(SEED);
  expect(m.turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'PAST', turnNumber: 0 });
  await expectCover(page, 'pass-screen');
  await expect(tid(page, 'reload-modal')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pass the screen!' })).toBeVisible();
  // Chrono's pass line has a caption above the cover, clear of the ready button. A browser
  // driven by a test tool never really speaks it (Regression 17).
  const caption = tid(page, 'caption-bar');
  await expect(caption).toHaveText('Pass the screen!');
  await expect(caption).toBeVisible();
  const [capBox, readyBox] = await Promise.all([
    caption.boundingBox(),
    tid(page, 'pass-ready').boundingBox(),
  ]);
  expect(capBox!.y).toBeGreaterThanOrEqual(readyBox!.y + readyBox!.height);
  expect(await page.evaluate(() => window.__silent?.speakCalls)).toBe(0);
  await floors(page, 'Pass screen');
  await shot('pass-screen');

  // Other keys on the pass screen must not start anything (Space on the focused
  // "I'm ready!" button is a real tap, so it is left out).
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');
  expect((await snap(page)).turn.phase).toBe('PASS_SCREEN');

  await watchBanner(page);
  await tid(page, 'pass-ready').click();
  await expect.poll(() => bannerSeen(page)).toContain('ALEX');
  await waitAiming(page, 0);
  await expect(tid(page, 'shots-left')).toContainText('2 of 2');
  await floors(page, 'Battle');
  await shot('battle-aiming');

  // Shot 1: a near miss, so the slapstick tumble and speech bubble show.
  await takeShot(page, 'near');
  // A second Space while the ball flies cannot fire again. The keys go in one page task with the
  // look at Fire, so a slow machine cannot land the ball (and turn Fire back on) in between.
  const pressedInFlight = await page.evaluate(() => {
    const fire = document.querySelector<HTMLButtonElement>('[data-testid="fire"]');
    if (!fire || !fire.disabled) return false;
    for (let i = 0; i < 2; i++)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    return true;
  });
  expect(pressedInFlight, 'Fire is off while the ball flies').toBe(true);
  await expect(tid(page, 'speech-bubble')).toBeVisible({ timeout: 45_000 });
  await floors(page, 'Tumble');
  await shot('tumble');
  m = await snap(page);
  expect(m.stats.PAST.shotsFired).toBe(1);
  expect(m.baseHp.FUTURE).toBe(DAMAGE.startingBaseHp - DAMAGE.near);

  // Shot 2: a direct hit.
  await waitAiming(page, 1);
  await takeShot(page, 'direct');
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  m = await snap(page);
  expect(m.baseHp.FUTURE).toBe(DAMAGE.startingBaseHp - DAMAGE.near - DAMAGE.direct);
  expect(m.turn).toMatchObject({ phase: 'RELOAD', shotsFired: 2 });

  // ----- Reload: nothing can skip it, and the third shot is impossible -----
  await expectCover(page, 'reload-modal');
  await floors(page, 'Reload math');
  await shot('reload-modal');
  const modalText = await tid(page, 'reload-modal').innerText();
  expect(modalText.toLowerCase()).toContain('reload time!');
  // (Space and Enter are left out: on a focused answer button they are a real answer.)
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.mouse.click(2, 2); // outside the card
  await expect(tid(page, 'reload-modal')).toBeVisible();
  expect((await snap(page)).stats.PAST.shotsFired).toBe(2);
  // The only buttons are the answers, a hint when there is one, and Sound on/off.
  const buttons = await tid(page, 'reload-modal')
    .getByRole('button')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(buttons.filter((b) => !/^(reload-(choice-[0-3]|hint)|cover-mute)$/.test(b ?? ''))).toEqual(
    [],
  );

  // Right and fast: +2 scrap.
  const first = await answerReload(page, 'right-fast');
  await expect(tid(page, 'reload-feedback')).toContainText('+2 scrap! Super fast!');
  // ----- A right answer earns one Power Shot (not a question, not shot 3) -----
  await watchBanner(page);
  await waitBonusAiming(page);
  await expect.poll(() => bannerSeen(page)).toContain('POWER SHOT!');
  await expect(tid(page, 'shots-left')).toContainText('Power Shot!');
  expect((await snap(page)).turn).toMatchObject({ phase: 'BONUS_AIMING', shotsFired: 2 });
  await takeBonusShot(page, 'miss');
  await waitPassScreen(page);
  m = await snap(page);
  expect(m.scrap.PAST).toBe(2);
  expect(m.stats.PAST.fastestAnswerMs).toBeLessThan(8000);
  expect(m.turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'FUTURE' });
  // The Power Shot happened: a third shot, with turn.shotsFired still 2.
  expect(m.stats.PAST.shotsFired).toBe(3);

  // ----- Pass screen hides the board and the last question -----
  await expectCover(page, 'pass-screen');
  await expect(tid(page, 'reload-modal')).toHaveCount(0);
  await expect(tid(page, 'reload-prompt')).toHaveCount(0);
  const pageText = await page.evaluate(() => document.documentElement.textContent ?? '');
  expect(pageText.includes(first.prompt), 'last question must not be in the page').toBe(false);
  // The second team's pass screen, so both team looks are on file.
  await shot('pass-screen-future');

  // ----- Turn 1, Team Future: wrong answer still reloads and shows the right one -----
  await readyUp(page);
  // The angle guide starts at Team Future's own muzzle.
  const guide = await page.evaluate(() => window.__timeclash!.aim());
  expect(guide!.team).toBe('FUTURE');
  expect(guide!.origin).toEqual(LAUNCH_ORIGINS.FUTURE);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  const wrong = await answerReload(page, 'wrong');
  await expect(tid(page, 'reload-feedback')).toContainText(`The answer is ${wrong.rightAnswer}.`);
  await expect(tid(page, 'reload-feedback')).toContainText('Reloaded anyway');
  await expect(tid(page, `reload-choice-${wrong.rightIndex}`)).toHaveAttribute(
    'data-state',
    'right',
  );
  // The clue stays up past the old 1.8 seconds (Regression 5). The card waits for Got it.
  await page.waitForTimeout(2500);
  await expect(tid(page, 'reload-modal')).toBeVisible();
  await tapGotIt(page);
  await waitPassScreen(page);
  m = await snap(page);
  expect(m.scrap.FUTURE).toBe(0);
  expect(m.stats.FUTURE.questionsAnswered).toBe(1);
  expect(m.turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'PAST' });

  // ----- Turn 2, Team Past: two direct hits, then a slow right answer: +1 scrap -----
  await readyUp(page);
  await playShots(page, ['direct', 'direct']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  expect((await snap(page)).baseHp.FUTURE).toBe(
    DAMAGE.startingBaseHp - DAMAGE.near - 3 * DAMAGE.direct,
  );
  await answerReload(page, 'right-slow');
  await expect(tid(page, 'reload-feedback')).toContainText('+1 scrap! Nice work!');
  await waitPassScreen(page);
  m = await snap(page);
  expect(m.scrap.PAST).toBe(3);

  // ----- Turn 2, Team Future: quiet turn -----
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);

  // ----- Team Past wears the base down until one direct hit is left (the pace rule) -----
  await wearDown(page);

  // ----- Team Past: the last hit ends the match on the spot -----
  await readyUp(page);
  await takeShot(page, 'direct');
  await expect(tid(page, 'victory')).toBeVisible({ timeout: 45_000 });
  // (The hook has no match once Victory is up, so the screen itself is the proof.)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alex');
  // No reload after the final hit.
  await expect(tid(page, 'reload-modal')).toHaveCount(0);
  await expect(tid(page, 'victory')).toContainText('Alex');
  await floors(page, 'Victory');
  await fitsOnScreen(page, 'victory', 'Victory');
  await shot('victory');
  // The iPad sizes too (docs/IPAD_AUDIT.md): the mini is the tightest.
  for (const { w, h } of IPAD_SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await fitsOnScreen(page, 'victory', `Victory ${w}x${h}`);
  }
  await page.setViewportSize(startSize);

  // ----- Rematch: Loading, then a fresh Battle with the other team first -----
  await tid(page, 'rematch').click();
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 45_000 });
  m = await snap(page);
  expect(m.status).toBe('PLAYING');
  expect(m.seed).toBe(SEED + 1);
  expect(m.baseHp).toEqual({ PAST: DAMAGE.startingBaseHp, FUTURE: DAMAGE.startingBaseHp });
  expect(m.scrap).toEqual({ PAST: 0, FUTURE: 0 });
  expect(m.turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'FUTURE', turnNumber: 0 });
  expect(m.players.map((p) => p.name)).toEqual(['Alex', 'Sam']);
  await watchBanner(page);
  await tid(page, 'pass-ready').click();
  await expect.poll(() => bannerSeen(page)).toContain('SAM');
  await waitAiming(page, 0);
  await expect(tid(page, 'fire')).toBeEnabled();
});
