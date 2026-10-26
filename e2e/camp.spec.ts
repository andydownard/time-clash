// The Camp hub sits between Setup and Battle. One big button starts the match. The other two
// are not open yet, so they say so and change nothing.
import { expect, test } from './fixtures';
import {
  PAST_SIDE,
  FUTURE_SIDE,
  fillTeam,
  snap,
  tid,
  toSetup,
  clashFromCamp,
} from './support/game';

async function toCamp(page: Parameters<typeof tid>[0], query = ''): Promise<void> {
  await toSetup(page, query);
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
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  const m = await snap(page);
  expect(m.players.map((p) => [p.team, p.name])).toEqual([
    ['PAST', PAST_SIDE.name],
    ['FUTURE', FUTURE_SIDE.name],
  ]);
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
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  expect((await snap(page)).players[0].name).toBe('Mia');
});

test('the keyboard starts the match from the Camp', async ({ page }) => {
  await toCamp(page);
  // The Camp focuses "Time to Clash!" a moment after it shows. Enter goes nowhere until it does.
  await expect(tid(page, 'camp-start')).toBeFocused();
  await page.keyboard.press('Enter');
  // The Battle Plan opens with Lock it in! focused, so a second Enter starts the match.
  await expect(tid(page, 'plan-go')).toBeFocused();
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
