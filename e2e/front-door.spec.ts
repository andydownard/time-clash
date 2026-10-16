// The screens before the battle: tap, intro, loading, setup, and the always-there buttons.
// These run against the production build, so they use only what a family can see.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const id = (page: Page, testid: string) => page.getByTestId(testid);

/** First visit: tap, skip the intro, wait out Loading, land on Setup. */
async function toSetup(page: Page): Promise<void> {
  await page.goto('/');
  await id(page, 'tap-to-play').click();
  await id(page, 'intro-skip').click();
  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
}

test('shows the tap screen with Sound and Captions buttons', async ({ page }) => {
  await page.goto('/');
  await expect(id(page, 'tap-to-play')).toBeVisible();
  await expect(id(page, 'mute-toggle')).toBeVisible();
  await expect(id(page, 'captions-toggle')).toBeVisible();
});

test('the tap button works with the keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(id(page, 'tap-to-play')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(id(page, 'intro-card').first()).toBeVisible();
});

test('first visit plays the intro with captions, and Skip leads on to Loading then Setup', async ({
  page,
}) => {
  await page.goto('/');
  await id(page, 'tap-to-play').click();
  await expect(id(page, 'intro-card')).toBeVisible();
  await expect(id(page, 'caption-bar')).toBeVisible();
  await id(page, 'intro-skip').click();
  await expect(page.locator('[data-screen="loading"]')).toBeVisible();
  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
});

test('Setup keeps two different sides and remembers them after a reload', async ({ page }) => {
  await toSetup(page);
  await id(page, 'setup-name-PAST').fill('Alex');
  await id(page, 'setup-name-FUTURE').fill('Sam');
  await id(page, 'setup-grade-PAST-3').click();
  await id(page, 'setup-grade-FUTURE-8').click();
  await id(page, 'setup-subject-FUTURE-math').click();
  await id(page, 'setup-next').click();
  await expect(id(page, 'setup-next')).toBeHidden();

  await page.reload();
  await id(page, 'tap-to-play').click();
  // The intro was seen, so Loading then Setup follow the tap.
  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  await expect(id(page, 'setup-name-PAST')).toHaveValue('Alex');
  await expect(id(page, 'setup-name-FUTURE')).toHaveValue('Sam');
  await expect(id(page, 'setup-grade-PAST-3')).toHaveAttribute('aria-checked', 'true');
  await expect(id(page, 'setup-grade-FUTURE-8')).toHaveAttribute('aria-checked', 'true');
});

test('an empty name keeps you on Setup', async ({ page }) => {
  await toSetup(page);
  await id(page, 'setup-name-PAST').fill('   ');
  await id(page, 'setup-next').click();
  await expect(id(page, 'setup-next')).toBeVisible();
});

test('the ? button opens How to Play from Setup, and Skip returns', async ({ page }) => {
  await toSetup(page);
  await id(page, 'how-to-play').click();
  await expect(id(page, 'intro-card')).toBeVisible();
  await id(page, 'intro-skip').click();
  await expect(id(page, 'intro-card')).toBeHidden();
  await expect(id(page, 'setup-next')).toBeVisible();
});

test('Settings: Clear my data asks first, then forgets the players', async ({ page }) => {
  await toSetup(page);
  await id(page, 'setup-name-PAST').fill('Alex');
  await id(page, 'setup-next').click();
  await page.reload();
  await id(page, 'settings-button').click();
  await id(page, 'settings-clear').click();
  await id(page, 'settings-clear-no').click();
  await id(page, 'settings-clear').click();
  await id(page, 'settings-clear-yes').click();
  await expect(id(page, 'settings-note')).not.toBeEmpty();
  await id(page, 'settings-close').click();
  const saved = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((k) => k.startsWith('timeclash.')),
  );
  expect(saved).toEqual([]);
});

test('the mute choice sticks across a reload', async ({ page }) => {
  await page.goto('/');
  await id(page, 'mute-toggle').click();
  await expect(id(page, 'mute-toggle')).toHaveText('Sound off');
  await page.reload();
  await expect(id(page, 'mute-toggle')).toHaveText('Sound off');
});

test('buttons are at least 56px tall', async ({ page }) => {
  await page.goto('/');
  for (const t of [
    'tap-to-play',
    'mute-toggle',
    'captions-toggle',
    'how-to-play',
    'settings-button',
  ]) {
    const box = await id(page, t).boundingBox();
    expect(box, t).not.toBeNull();
    expect(box!.height, t).toBeGreaterThanOrEqual(56);
    expect(box!.width, t).toBeGreaterThanOrEqual(56);
  }
});

test('makes no requests outside this site', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http')) {
      outside.push(r.url());
    }
  });
  await toSetup(page);
  expect(outside).toEqual([]);
});
