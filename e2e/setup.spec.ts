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

// Setup and src/game/names.ts must refuse the same words ("poop", "butt", "fart" ...).
test('a rude name is refused, and fixing it lets the match start', async ({ page }) => {
  await toSetup(page);
  for (const rude of ['Hell', 'Poop']) {
    await tid(page, 'setup-name-PAST').fill(rude);
    await tid(page, 'setup-next').click();
    await expect(err(page, 'PAST'), rude).toHaveText("Let's pick a different name.");
  }
  await tid(page, 'setup-name-PAST').fill('Alex');
  await expect(err(page, 'PAST')).toBeEmpty();
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
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
  await expect(tid(page, 'setup-grade-PAST')).toHaveValue('2');
  await expect(tid(page, 'setup-grade-FUTURE')).toHaveValue('3');
  await expect(tid(page, 'setup-subject-PAST-math')).toHaveAttribute('aria-checked', 'true');
});

test('Setup has no Focus switch and no line about Both', async ({ page }) => {
  await toSetup(page);
  await expect(page.locator('[data-testid^="setup-topic-"]')).toHaveCount(0);
  await expect(page.getByText('Focus:')).toHaveCount(0);
  await expect(page.getByText('Both mixes reading and math.')).toHaveCount(0);
  // The summary line repeats the cards, so only a screen reader hears it.
  const box = await tid(page, 'setup-read-back').boundingBox();
  expect(box === null || box.width <= 1).toBe(true);
});

test('the grade is a big dropdown, and the grown-up note shows only for K and Grade 1', async ({
  page,
}) => {
  await toSetup(page);
  for (const team of ['PAST', 'FUTURE'] as const) {
    const sel = tid(page, `setup-grade-${team}`);
    const box = await sel.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    const font = await sel.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(font).toBeGreaterThanOrEqual(20);
    await expect(page.locator(`label[for="${await sel.getAttribute('id')}"]`)).toHaveText('Grade');
  }
  await tid(page, 'setup-grade-PAST').selectOption('0');
  await tid(page, 'setup-grade-FUTURE').selectOption('5');
  await expect(tid(page, 'setup-grade-note-PAST')).toBeVisible();
  await expect(tid(page, 'setup-grade-note-PAST')).toHaveText(
    'A grown-up can read the questions with you.',
  );
  await expect(tid(page, 'setup-grade-note-FUTURE')).toBeHidden();
  // The native picker owns the keys (macOS opens a list, others step), so pick through it.
  await tid(page, 'setup-grade-PAST').selectOption('1');
  await expect(tid(page, 'setup-grade-note-PAST')).toBeVisible();
  await tid(page, 'setup-grade-PAST').selectOption('2');
  await expect(tid(page, 'setup-grade-note-PAST')).toBeHidden();
  const fits = await page.evaluate(
    () => document.documentElement.scrollHeight <= window.innerHeight,
  );
  expect(fits).toBe(true);
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
  // A quiet underlined link, still a 56px tap and 20px text.
  const link = tid(page, 'clear-data');
  const look = await link.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      underline: cs.textDecorationLine.includes('underline'),
      font: parseFloat(cs.fontSize),
      border: parseFloat(cs.borderTopWidth),
    };
  });
  expect(look).toEqual({ underline: true, font: 20, border: 0 });
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await expect(tid(page, 'clear-data-yes')).toBeHidden();
  await expect(tid(page, 'clear-data-no')).toBeHidden();
  await tid(page, 'clear-data').click();
  await expect(tid(page, 'clear-data-yes')).toBeVisible();
  await tid(page, 'clear-data-no').click();
  await expect(tid(page, 'clear-data-yes')).toBeHidden();
});

test('Match length: Normal at first, big enough to tap, and it stays on screen', async ({
  page,
}) => {
  await toSetup(page);
  const normal = tid(page, 'setup-length-normal');
  await expect(normal).toHaveAttribute('aria-checked', 'true');
  for (const id of ['short', 'normal', 'long']) {
    const chip = tid(page, `setup-length-${id}`);
    const box = await chip.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    expect(box!.width).toBeGreaterThanOrEqual(56);
    const font = await chip.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(font).toBeGreaterThanOrEqual(20);
  }
  await tid(page, 'setup-length-short').click();
  await expect(tid(page, 'setup-length-short')).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'setup-length-short').press('ArrowRight');
  await expect(normal).toHaveAttribute('aria-checked', 'true');
  const fits = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="setup-length-row"]')!.getBoundingClientRect();
    return row.bottom <= window.innerHeight && row.right <= window.innerWidth && row.left >= 0;
  });
  expect(fits).toBe(true);
});
