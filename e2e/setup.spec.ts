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
  await expect(tid(page, 'camp-start')).toBeVisible();
});

// Setup and src/game/names.ts must refuse the same words ("poop", "butt", "fart" ...).
test('Setup refuses every word the game rules also refuse', async ({ page }) => {
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
  await expect(tid(page, 'camp-start')).toBeVisible();

  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'setup-next')).toBeVisible();
  await expect(tid(page, 'setup-name-PAST')).toHaveValue(PAST_SIDE.name);
  await expect(tid(page, 'setup-name-FUTURE')).toHaveValue(FUTURE_SIDE.name);
  await expect(tid(page, 'setup-grade-PAST-2')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'setup-grade-FUTURE-3')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'setup-subject-PAST-math')).toHaveAttribute('aria-checked', 'true');
});

test('the multiplication focus is off, is Team Past only, and is remembered', async ({ page }) => {
  await toSetup(page);
  const chip = tid(page, 'setup-topic-PAST-multiplication');
  await expect(chip).toHaveAttribute('aria-checked', 'false');
  await expect(tid(page, 'setup-topic-FUTURE-multiplication')).toHaveCount(0);
  const box = await chip.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(56);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await chip.click();
  await expect(chip).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible();

  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'setup-topic-PAST-multiplication')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(tid(page, 'setup-grade-FUTURE-3')).toHaveAttribute('aria-checked', 'true');
});

test('Loading shows for at least 1.5 seconds before Setup',async ({ page }) => {
  await page.goto('/');
  await tid(page, 'tap-to-play').click();
  // Stamp the two moments inside the page, so a slow test runner cannot shorten the gap.
  await page.evaluate(() => {
    const w = window as unknown as { __loadingAt?: number; __setupAt?: number };
    new MutationObserver(() => {
      if (w.__loadingAt === undefined && document.querySelector('[data-screen="loading"]'))
        w.__loadingAt = performance.now();
      if (w.__setupAt === undefined && document.querySelector('[data-testid="setup-next"]'))
        w.__setupAt = performance.now();
    }).observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  await tid(page, 'intro-skip').click();
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  const gap = await page.evaluate(() => {
    const w = window as unknown as { __loadingAt?: number; __setupAt?: number };
    return (w.__setupAt ?? 0) - (w.__loadingAt ?? 0);
  });
  expect(gap).toBeGreaterThanOrEqual(1_500);
  await expect(page.locator('[data-screen="loading"]')).toBeHidden();
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
