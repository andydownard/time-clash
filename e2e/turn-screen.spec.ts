// "Turn your iPad sideways": shown on a touch tablet held upright, never on a mouse computer,
// and a running match is paused (not lost) while it is up.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { smallText } from './support/audit';
import {
  readQuestion,
  readyUp,
  snap,
  startMatch,
  takeShot,
  tid,
  toSetup,
  waitAiming,
} from './support/game';
import { saveShot } from './support/shots';

const PORTRAIT = { width: 744, height: 1133 };
const LANDSCAPE = { width: 1133, height: 744 };

const turn = (page: Page) => tid(page, 'turn-screen');

test.describe('touch tablet', () => {
  test.use({ hasTouch: true, viewport: PORTRAIT });

  test('portrait shows the screen, landscape hides it, and it comes back', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    await expect(turn(page)).toBeVisible();
    await expect(turn(page)).toHaveAttribute('role', 'dialog');
    await expect(turn(page)).toBeFocused();
    await expect(turn(page).getByRole('heading')).toHaveText('Turn your iPad sideways');
    const box = await turn(page).boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, ...PORTRAIT });
    const small = (await smallText(page)).filter((o) => /iPad|Time Clash/.test(o.what));
    expect(small, 'text under 20px').toEqual([]);
    await saveShot(page, browserName, 'turn-screen');

    await page.setViewportSize(LANDSCAPE);
    await expect(turn(page)).toBeHidden();
    await expect(tid(page, 'tap-to-play')).toBeVisible();
    await expect(tid(page, 'tap-to-play')).toBeInViewport();

    await page.setViewportSize(PORTRAIT);
    await expect(turn(page)).toBeVisible();
  });

  test('turning mid-turn pauses the match and loses nothing', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await toSetup(page);
    await startMatch(page);
    await readyUp(page);
    await takeShot(page, 'miss');
    await waitAiming(page, 1);
    const before = await snap(page);

    await page.setViewportSize(PORTRAIT);
    await expect(turn(page)).toBeVisible();
    await expect(tid(page, 'pause-panel')).toHaveCount(1);
    // The match did not move while it was up.
    expect((await snap(page)).turn).toEqual(before.turn);

    await page.setViewportSize(LANDSCAPE);
    await expect(turn(page)).toBeHidden();
    await expect(tid(page, 'pause-resume')).toBeFocused();
    await tid(page, 'pause-resume').click();
    await expect(tid(page, 'pause-panel')).toHaveCount(0);
    await takeShot(page, 'miss');
    await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  });

  test('turning while a question is up keeps the same question', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await toSetup(page);
    await startMatch(page);
    await readyUp(page);
    await takeShot(page, 'miss');
    await waitAiming(page, 1);
    await takeShot(page, 'miss');
    await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
    const q = await readQuestion(page);
    await page.setViewportSize(PORTRAIT);
    await expect(turn(page)).toBeVisible();
    await page.setViewportSize(LANDSCAPE);
    await expect(turn(page)).toBeHidden();
    expect(await readQuestion(page)).toEqual(q);
  });
});

test.describe('mouse computer', () => {
  test.use({ hasTouch: false, viewport: PORTRAIT });

  test('a tall narrow window never shows the screen', async ({ page }) => {
    await page.goto('/');
    await expect(tid(page, 'tap-to-play')).toBeVisible();
    await expect(turn(page)).toBeHidden();
  });
});

test.describe('phone-sized touch screen', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('is left alone (phones are not supported, and the rule is for tablets)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(turn(page)).toBeHidden();
  });
});
