// Squads S1 end to end, with the e2e switch on. A turn is 2 goes, then the covered reload, then the
// other side with its full crew. A wrong answer never skips the question or shrinks the next turn.
// With the switch left alone the page plays exactly as before.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  answerReload,
  readyUp,
  snap,
  startMatch,
  takeShot,
  tapGotIt,
  tid,
  toSetup,
  waitAiming,
  waitPassScreen,
} from './support/game';

async function toSquadMatch(page: Page, on: boolean | null): Promise<void> {
  await toSetup(page);
  if (on !== null) await page.evaluate((v) => window.__timeclash!.setSquads(v), on);
  await startMatch(page);
}

test('the helper bar is not on the page when Squads is left at its default', async ({ page }) => {
  await toSquadMatch(page, null);
  await readyUp(page);
  await expect(tid(page, 'go-banner')).toBeHidden();
  await expect(tid(page, 'helper-PAST-launcher')).toBeHidden();
  await expect(tid(page, 'helper-hear')).toBeHidden();
  await expect(tid(page, 'turn-banner')).toContainText('SHOT 1 OF 2');
  expect((await snap(page)).squads).toBeUndefined();
});

test('2 goes, then the covered reload, then the next side with its full crew', async ({ page }) => {
  await toSquadMatch(page, true);
  await readyUp(page);

  // The first go shows the finger hint and the words, and the bar counts goes.
  await expect(tid(page, 'go-banner')).toHaveText('GO 1 OF 2');
  await expect(tid(page, 'go-hint')).toBeVisible();
  await expect(tid(page, 'helper-PAST-launcher')).toHaveAttribute('aria-checked', 'true');

  // Hear it has a caption, and Back returns to the launcher.
  await tid(page, 'helper-hear').click();
  await expect(tid(page, 'caption-bar')).toContainText('Cannon Crew');
  await tid(page, 'helper-PAST-dasher').click();
  await expect(tid(page, 'helper-back')).toBeVisible();
  await expect(tid(page, 'fire')).toBeDisabled();
  await tid(page, 'helper-back').click();
  await expect(tid(page, 'helper-PAST-launcher')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'helper-back')).toBeHidden();
  await expect(tid(page, 'fire')).toBeEnabled();

  // Go 1: roll the dasher to a spot. It is a whole go.
  await tid(page, 'helper-PAST-dasher').click();
  const spots = page.locator('[data-testid^="dash-g"]');
  await expect(spots.first()).toBeVisible();
  await spots.first().click();
  await expect.poll(async () => (await snap(page)).turn.shotsFired).toBe(1);
  await expect(tid(page, 'go-banner')).toHaveText('GO 2 OF 2');
  await expect(tid(page, 'go-hint')).toBeHidden();

  // Go 2: Back to the launcher with the keyboard path (Tab to the button), then fire.
  await expect(spots.first()).toBeVisible();
  await tid(page, 'helper-back').click();
  await waitAiming(page, 1);
  await takeShot(page, 'miss');

  // The reload question always comes up, and a wrong answer is fine.
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => document.body.dataset.cover)).toBe('reload');
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);

  // The other side starts a fresh turn: full crew, 2 goes, its own first-go hint.
  await readyUp(page);
  const m = await snap(page);
  expect(m.turn.team).toBe('FUTURE');
  expect(m.turn.shotsFired).toBe(0);
  await expect(tid(page, 'go-banner')).toHaveText('GO 1 OF 2');
  await expect(tid(page, 'go-hint')).toBeVisible();
  await expect(tid(page, 'helper-FUTURE-launcher')).toBeVisible();
  await expect(tid(page, 'helper-FUTURE-dasher')).toBeVisible();
  await expect(tid(page, 'helper-PAST-launcher')).toBeHidden();
});

test('the helper buttons are big enough and the keyboard reaches them', async ({ page }) => {
  await toSquadMatch(page, true);
  await readyUp(page);
  for (const id of ['helper-PAST-launcher', 'helper-PAST-dasher', 'helper-hear']) {
    const box = (await tid(page, id).boundingBox())!;
    expect(box.width, id).toBeGreaterThanOrEqual(56);
    expect(box.height, id).toBeGreaterThanOrEqual(56);
    const size = await tid(page, id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size, id).toBeGreaterThanOrEqual(20);
  }
  // Enter on a focused helper picks it.
  await tid(page, 'helper-PAST-dasher').focus();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'helper-PAST-dasher')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'helper-back')).toBeVisible();
  await tid(page, 'helper-back').focus();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'helper-PAST-launcher')).toHaveAttribute('aria-checked', 'true');
});

test('the hint finger holds still under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toSquadMatch(page, true);
  await readyUp(page);
  await expect(tid(page, 'go-hint')).toBeVisible();
  const anim = await page
    .locator('.tc-go-finger')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
});
