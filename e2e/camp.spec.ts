// The Camp hub sits between Setup and Battle. One big button starts the match. The other two
// are not open yet, so they say so and change nothing.
import { expect, test } from './fixtures';
import { PAST_SIDE, FUTURE_SIDE, fillTeam, snap, tid, toSetup } from './support/game';

async function toCamp(page: Parameters<typeof tid>[0]): Promise<void> {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

test('Setup leads to the Camp, and Time to Clash! starts the match', async ({ page }) => {
  await toCamp(page);
  await expect(page.locator('[data-screen="camp"] h1')).toHaveText('Time Clash Camp');
  await expect(tid(page, 'camp-start')).toHaveText('Time to Clash!');
  await expect(tid(page, 'camp-start')).toBeFocused();
  await tid(page, 'camp-start').click();
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  const m = await snap(page);
  expect(m.players.map((p) => [p.team, p.name])).toEqual([
    ['PAST', PAST_SIDE.name],
    ['FUTURE', FUTURE_SIDE.name],
  ]);
});

test('Build Base (builder off) opens the old shop screen and Back returns to the Camp', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-upgrade').click();
  await expect(page.locator('[data-screen="upgrade"] h1')).toHaveText('Build Base');
  await tid(page, 'upgrade-back').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
  await expect(tid(page, 'pass-screen')).toHaveCount(0);
});

test('a returning family lands on the Camp with no Tap to Play screen', async ({ page }) => {
  await toCamp(page);
  await page.reload();
  // A returning family goes straight to the Camp: there is no Tap to Play screen.
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await expect(tid(page, 'tap-to-play')).toHaveCount(0);
  await expect(tid(page, 'setup-next')).toHaveCount(0);
});

test('a new family goes to Setup first, not the Camp', async ({ page }) => {
  await toSetup(page);
  await expect(tid(page, 'camp-start')).toHaveCount(0);
});

test('Change players opens Setup with the saved players, then returns to the Camp', async ({
  page,
}) => {
  await toCamp(page);
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'setup-next')).toBeVisible();
  await expect(tid(page, 'setup-name-PAST')).toHaveValue(PAST_SIDE.name);
  await tid(page, 'setup-name-PAST').fill('Mia');
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
  await tid(page, 'camp-start').click();
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  expect((await snap(page)).players[0].name).toBe('Mia');
});

test('the keyboard starts the match from the Camp', async ({ page }) => {
  await toCamp(page);
  await page.keyboard.press('Enter');
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
});

test('reduced motion stops the Camp animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toCamp(page);
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('.tc-camp-art [class]')]
      .map((el) => getComputedStyle(el).animationName)
      .filter((n) => n !== 'none'),
  );
  expect(names).toEqual([]);
});
