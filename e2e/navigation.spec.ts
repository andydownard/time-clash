// Back and exit: every screen a family reaches has a way back, a game can be left, and a returning
// family never has to tap a front-door screen.
import { expect, test } from './fixtures';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  fillTeam,
  readyUp,
  tid,
  toSetup,
  clashFromCamp,
} from './support/game';

async function toCamp(page: Parameters<typeof tid>[0]): Promise<void> {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

test('a new family still sees the Tap to Play front door first', async ({ page }) => {
  await page.goto('/?e2e=1');
  await expect(tid(page, 'tap-to-play')).toBeVisible();
});

test('a returning family goes straight to the Camp, and the first tap there unlocks sound', async ({
  page,
}) => {
  await toCamp(page);
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await expect(tid(page, 'tap-to-play')).toHaveCount(0);
  await expect(tid(page, 'setup-next')).toHaveCount(0);
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
});

test('Setup has a Back button that returns to the Camp without saving', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'setup-back')).toBeVisible();
  await tid(page, 'setup-name-PAST').fill('Changed');
  await tid(page, 'setup-back').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'setup-name-PAST')).toHaveValue(PAST_SIDE.name);
});

test('a brand-new family goes to Setup, not the Camp, with no Back (nowhere to go back to)', async ({
  page,
}) => {
  await toSetup(page);
  await expect(tid(page, 'setup-back')).toHaveCount(0);
  await expect(tid(page, 'camp-start')).toHaveCount(0);
});

test('the Forge has Back, and so does the pause panel in a game', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-forge').click();
  await expect(tid(page, 'forge-back')).toBeVisible();
  await tid(page, 'forge-back').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
});

test('Leave game asks first. Stay keeps playing', async ({ page }) => {
  await toCamp(page);
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  await readyUp(page);
  await tid(page, 'pause').click();
  await tid(page, 'pause-leave').click();
  await expect(page.locator('#tc-pause-heading')).toHaveText('Leave this game?');
  await tid(page, 'pause-stay').click();
  await expect(page.locator('#tc-pause-heading')).toHaveText('Pause');
  await tid(page, 'pause-resume').click();
  await expect(tid(page, 'pause-panel')).toHaveCount(0);
  await expect(tid(page, 'fire')).toBeVisible();
});

test('Leave game goes back to the Camp, and a new match can start from there', async ({ page }) => {
  await toCamp(page);
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  await readyUp(page);
  await tid(page, 'pause').click();
  await tid(page, 'pause-leave').click();
  await tid(page, 'pause-leave-yes').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await expect(tid(page, 'fire')).toHaveCount(0);
  await expect(tid(page, 'pause')).toHaveCount(0);
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
});

test('Escape closes the pause panel and never leaves the game', async ({ page }) => {
  await startMatchFromCamp(page);
  await tid(page, 'pause').click();
  await tid(page, 'pause-leave').click();
  await page.keyboard.press('Escape');
  await expect(tid(page, 'pause-panel')).toHaveCount(0);
  await expect(tid(page, 'fire')).toBeVisible();
});

async function startMatchFromCamp(page: Parameters<typeof tid>[0]): Promise<void> {
  await toCamp(page);
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  await readyUp(page);
}
