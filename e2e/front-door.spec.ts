// The screens before the battle: tap, intro, loading, setup, and the always-there buttons.
// They use only what a family can see. (The fixture already fails any test that asks another site
// for anything, and e2e/setup.spec.ts covers the Setup form itself.)
import { expect, test } from './fixtures';
import { tid as id, toSetup } from './support/game';

test('shows the tap screen with one big button: Sound and Captions are in Settings', async ({
  page,
}) => {
  await page.goto('/');
  await expect(id(page, 'tap-to-play')).toBeVisible();
  await expect(page.getByText('Sound starts after you tap.')).toBeVisible();
  await expect(page.locator('[data-screen="tap"] [role="switch"]')).toHaveCount(0);
  await id(page, 'settings-button').click();
  await expect(id(page, 'settings-mute')).toBeVisible();
  await expect(id(page, 'settings-captions')).toBeVisible();
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

test('Settings: Bonus ring button is big, saves, and Clear my data resets it', async ({ page }) => {
  await page.goto('/');
  await id(page, 'settings-button').click();
  const ring = id(page, 'settings-bonus-ring');
  await expect(ring).toHaveText('Bonus ring: shown');
  const box = await ring.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(56);
  await ring.click();
  await expect(ring).toHaveText('Bonus ring: hidden');
  await page.reload();
  await id(page, 'settings-button').click();
  await expect(id(page, 'settings-bonus-ring')).toHaveText('Bonus ring: hidden');
  await id(page, 'settings-clear').click();
  await id(page, 'settings-clear-yes').click();
  await expect(id(page, 'settings-bonus-ring')).toHaveText('Bonus ring: shown');
});

test('the mute choice sticks across a reload', async ({ page }) => {
  await page.goto('/');
  await id(page, 'settings-button').click();
  await id(page, 'settings-mute').click();
  await expect(id(page, 'settings-mute')).toHaveText('Sound off');
  await page.reload();
  await id(page, 'settings-button').click();
  await expect(id(page, 'settings-mute')).toHaveText('Sound off');
});

test('buttons are at least 56px tall', async ({ page }) => {
  await page.goto('/');
  for (const t of [
    'tap-to-play',
    'how-to-play',
    'settings-button',
  ]) {
    const box = await id(page, t).boundingBox();
    expect(box, t).not.toBeNull();
    expect(box!.height, t).toBeGreaterThanOrEqual(56);
    expect(box!.width, t).toBeGreaterThanOrEqual(56);
  }
});
