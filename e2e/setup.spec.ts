// Setup: names are checked, choices are remembered, and each side picks its own grade.
import { expect, test } from './fixtures';
import { FUTURE_SIDE, PAST_SIDE, fillTeam, snap, startMatch, tid, toSetup } from './support/game';

const err = (page: Parameters<typeof tid>[0], team: 'PAST' | 'FUTURE') =>
  tid(page, `setup-error-${team}`);

test('an empty name shows a kind message and stays on Setup', async ({ page }) => {
  await toSetup(page);
  await tid(page, 'setup-name-PAST').fill('   ');
  await tid(page, 'setup-next').click();
  await expect(err(page, 'PAST')).toHaveText('Type a name first.');
  await expect(tid(page, 'setup-name-PAST')).toHaveAttribute('aria-invalid', 'true');
  await expect(tid(page, 'setup-name-PAST')).toBeFocused();
  await expect(tid(page, 'pass-screen')).toHaveCount(0);
});

test('typing is capped at 12 letters, and a longer name is still refused', async ({ page }) => {
  await toSetup(page);
  const input = tid(page, 'setup-name-FUTURE');
  await input.fill('');
  await input.pressSequentially('ABCDEFGHIJKLMNOP');
  await expect(input).toHaveValue('ABCDEFGHIJKL');
  // A paste or script can still set a long value. Setup must refuse it.
  await input.evaluate((el: HTMLInputElement) => {
    el.value = 'ABCDEFGHIJKLM';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await tid(page, 'setup-next').click();
  await expect(err(page, 'FUTURE')).toHaveText('Names can be up to 12 letters.');
  await expect(tid(page, 'pass-screen')).toHaveCount(0);
});

test('a rude name is refused, and fixing it lets the match start', async ({ page }) => {
  await toSetup(page);
  await tid(page, 'setup-name-PAST').fill('Hell');
  await tid(page, 'setup-next').click();
  await expect(err(page, 'PAST')).toHaveText("Let's pick a different name.");
  await tid(page, 'setup-name-PAST').fill('Alex');
  await expect(err(page, 'PAST')).toBeEmpty();
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'pass-screen')).toBeVisible();
});

// APP BUG (reported, src/ui/nameBlocklist.ts): Setup uses its own list, which lacks words that
// src/game/names.ts blocks ("poop", "butt", "fart" ...). test.fail() flips to a failure the day
// someone fixes it, so this note cannot go stale.
test.fail('Setup refuses every word the game rules also refuse', async ({ page }) => {
  await toSetup(page);
  await tid(page, 'setup-name-PAST').fill('Poop');
  await tid(page, 'setup-next').click();
  await expect(err(page, 'PAST')).toHaveText("Let's pick a different name.", { timeout: 2_000 });
});

test('each side keeps its own grade and subject, and they reach the match', async ({ page }) => {
  await toSetup(page);
  await startMatch(
    page,
    { name: 'Alex', grade: 3, subject: 'reading' },
    { name: 'Sam', grade: 8, subject: 'math' },
  );
  const m = await snap(page);
  expect(m.players.map((p) => [p.team, p.name, p.grade, p.subject])).toEqual([
    ['PAST', 'Alex', 3, 'reading'],
    ['FUTURE', 'Sam', 8, 'math'],
  ]);
});

test('names, grades and subjects are remembered after a reload', async ({ page }) => {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'pass-screen')).toBeVisible();

  await page.reload();
  await tid(page, 'tap-to-play').click();
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  await expect(tid(page, 'setup-name-PAST')).toHaveValue(PAST_SIDE.name);
  await expect(tid(page, 'setup-name-FUTURE')).toHaveValue(FUTURE_SIDE.name);
  await expect(tid(page, 'setup-grade-PAST-2')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'setup-grade-FUTURE-3')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'setup-subject-PAST-math')).toHaveAttribute('aria-checked', 'true');
});

test('Loading shows for at least 1.5 seconds before Setup', async ({ page }) => {
  await page.goto('/');
  await tid(page, 'tap-to-play').click();
  await tid(page, 'intro-skip').click();
  const loading = page.locator('[data-screen="loading"]');
  await expect(loading).toBeVisible();
  const shownAt = await page.evaluate(() => performance.now());
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  const doneAt = await page.evaluate(() => performance.now());
  // The check starts a moment after Loading opened, so allow a small margin.
  expect(doneAt - shownAt).toBeGreaterThan(1_200);
  await expect(loading).toBeHidden();
});

test('the clear-data confirm buttons stay hidden until Clear my data is tapped', async ({
  page,
}) => {
  await toSetup(page);
  await expect(tid(page, 'clear-data')).toBeVisible();
  await expect(tid(page, 'clear-data-yes')).toBeHidden();
  await expect(tid(page, 'clear-data-no')).toBeHidden();
  await tid(page, 'clear-data').click();
  await expect(tid(page, 'clear-data-yes')).toBeVisible();
  await tid(page, 'clear-data-no').click();
  await expect(tid(page, 'clear-data-yes')).toBeHidden();
});
