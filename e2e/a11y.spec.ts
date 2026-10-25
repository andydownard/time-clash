// Accessibility and resilience (AGENTS.md "Accessibility", risks 2 and 6). The 56px and 20px
// floors on every screen are in e2e/look.spec.ts. No request to another origin and no cookie is
// checked after every test by e2e/fixtures.ts.
import { expect, test } from './fixtures';
import { bigMotion, focusRing } from './support/audit';
import {
  answerReload,
  openGame,
  playShots,
  readyUp,
  skipLoadingWait,
  startMatch,
  tid,
  toSetup,
  tapGotIt,
  waitPassScreen,
} from './support/game';

// Safari does not Tab onto buttons by default, so keyboard focus is checked in Chromium.
test('the keyboard shows a clear focus ring on every kind of control', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Safari does not Tab onto buttons by default');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await tid(page, 'tap-to-play').focus();
  const seen: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ring = await focusRing(page);
    if (!ring) break;
    const visible = ring!.style !== 'none' && ring!.width >= 2 ? true : ring!.shadow !== 'none';
    expect(visible, `focus ring on ${ring!.id}: ${JSON.stringify(ring)}`).toBe(true);
    seen.push(ring!.id);
    await page.keyboard.press('Tab');
  }
  expect(new Set(seen).size, `controls checked: ${seen.join(', ')}`).toBeGreaterThan(2);
});

test('Setup chips and inputs show a focus ring', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Safari does not Tab onto buttons by default');
  await toSetup(page);
  for (const id of [
    'setup-name-PAST',
    'setup-grade-PAST-2',
    'setup-subject-PAST-both',
    'setup-next',
  ]) {
    await tid(page, id).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await focusRing(page);
    expect(ring?.id, id).toBe(id);
    expect(ring!.style !== 'none' && ring!.width >= 2, `${id}: ${JSON.stringify(ring)}`).toBe(true);
  }
});

test.describe('reduced motion', () => {
  test.use({ colorScheme: 'light' });

  test('the screens and covers stop big motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openGame(page);
    await expect(page.locator('[data-tc-root][data-motion]:not([data-tc-chrome])')).toHaveAttribute(
      'data-motion',
      'reduced',
    );
    await expect(page.locator('[data-tc-chrome][data-motion]')).toHaveAttribute(
      'data-motion',
      'reduced',
    );
    expect(await bigMotion(page), 'Tap to Start').toEqual([]);
    await tid(page, 'tap-to-play').click();
    await tid(page, 'intro-skip').click();
    await skipLoadingWait(page);
    await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
    expect(await bigMotion(page), 'Setup').toEqual([]);
    await startMatch(page);
    expect(await bigMotion(page), 'Pass screen').toEqual([]);
    await readyUp(page);
    await playShots(page, ['miss', 'miss']);
    await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
    expect(await bigMotion(page), 'Reload modal').toEqual([]);
  });
});

test('the game still runs when localStorage throws', async ({ page }) => {
  await page.addInitScript(() => {
    const boom = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', { get: boom, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { get: boom, configurable: true });
  });
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__timeclash));
  await tid(page, 'tap-to-play').click();
  await tid(page, 'intro-skip').click();
  await skipLoadingWait(page);
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  await startMatch(page);
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);
});
