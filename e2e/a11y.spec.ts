// Accessibility floors, privacy, and resilience (AGENTS.md "Accessibility", risks 2 and 6).
import { expect, test } from './fixtures';
import { bigMotion, focusRing, smallTargets, smallText } from './support/audit';
import {
  answerReload,
  openGame,
  playShots,
  readyUp,
  startMatch,
  tid,
  toSetup,
  tapGotIt,
  waitPassScreen,
} from './support/game';

async function expectFloors(page: Parameters<typeof tid>[0], where: string) {
  expect.soft(await smallTargets(page), `targets under 56px on ${where}`).toEqual([]);
  expect.soft(await smallText(page), `text under 20px on ${where}`).toEqual([]);
}

test('every screen meets the 56px and 20px floors', async ({ page }) => {
  await openGame(page);
  await expectFloors(page, 'Tap to Start');
  await tid(page, 'tap-to-play').click();
  await expect(tid(page, 'intro-card')).toBeVisible();
  await expectFloors(page, 'Intro');
  await tid(page, 'intro-skip').click();
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  await expectFloors(page, 'Setup');
  await startMatch(page, undefined, undefined, undefined, () => expectFloors(page, 'Camp'));
  await expectFloors(page, 'Pass screen');
  await readyUp(page);
  await expect(tid(page, 'fire')).toBeEnabled({ timeout: 5_000 });
  await expectFloors(page, 'Battle HUD');
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await expectFloors(page, 'Reload modal');
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);
});

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
    await expect(page.locator('[data-tc-root][data-motion]')).toHaveAttribute(
      'data-motion',
      'reduced',
    );
    expect(await bigMotion(page), 'Tap to Start').toEqual([]);
    await tid(page, 'tap-to-play').click();
    await tid(page, 'intro-skip').click();
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

test('nothing leaves this device: no request goes to another origin', async ({ page, baseURL }) => {
  const origins = new Set<string>();
  page.on('request', (r) => {
    if (/^(data|blob|about):/.test(r.url())) return;
    origins.add(new URL(r.url()).origin);
  });
  await toSetup(page);
  await startMatch(page);
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  expect([...origins]).toEqual([new URL(baseURL!).origin]);
  // No cookies either (risk 2).
  expect(await page.context().cookies()).toEqual([]);
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
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  await startMatch(page);
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);
});
