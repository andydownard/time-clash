// iPad portrait (768x1024) smoke check: every key screen fits, nothing scrolls sideways.
import { expect, test } from './fixtures';
import { smallTargets } from './support/audit';
import {
  answerReload,
  playShots,
  readyUp,
  startMatch,
  tid,
  toSetup,
  waitPassScreen,
} from './support/game';
import {
  expectAimPanelClearOfBases,
  expectBannerClear,
  expectHudClear,
  recordBannerBox,
} from './support/layout';
import { saveShot } from './support/shots';

async function fits(page: Parameters<typeof tid>[0], ids: string[], where: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `${where}: sideways scroll`).toBeLessThanOrEqual(0);
  for (const id of ids) {
    const box = await tid(page, id).boundingBox();
    const view = page.viewportSize()!;
    expect(box, `${where}: ${id}`).not.toBeNull();
    expect(box!.x, `${where}: ${id} left`).toBeGreaterThanOrEqual(0);
    expect(box!.y, `${where}: ${id} top`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${where}: ${id} right`).toBeLessThanOrEqual(view.width + 0.5);
    expect(box!.y + box!.height, `${where}: ${id} bottom`).toBeLessThanOrEqual(view.height + 0.5);
  }
}

test('portrait: setup, battle, pass screen and reload all fit', async ({ page, browserName }) => {
  await page.goto('/');
  await fits(page, ['tap-to-play'], 'Tap to Start');
  await toSetup(page);
  await fits(page, ['setup-name-PAST', 'setup-name-FUTURE'], 'Setup');
  // The start button may sit below the fold (see the test.fail note below), so scroll to it.
  await tid(page, 'setup-next').scrollIntoViewIfNeeded();
  await expect(tid(page, 'setup-next')).toBeInViewport();
  await saveShot(page, browserName, 'setup');
  await startMatch(page);
  await fits(page, ['pass-ready'], 'Pass screen');
  await recordBannerBox(page);
  await readyUp(page);
  await expectBannerClear(page, 'portrait banner');
  await fits(
    page,
    ['fire', 'aim-angle', 'aim-power', 'wind', 'base-hp-PAST', 'base-hp-FUTURE'],
    'Battle',
  );
  expect(await smallTargets(page), 'targets in Battle').toEqual([]);
  await expectHudClear(page, 'portrait battle');
  await expectAimPanelClearOfBases(page, 'portrait battle');
  expect(await page.evaluate(() => window.__timeclash!.labelPx())).toBeGreaterThanOrEqual(20);
  await saveShot(page, browserName, 'battle-aiming');
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await fits(
    page,
    ['reload-choice-0', 'reload-choice-1', 'reload-choice-2', 'reload-choice-3'],
    'Reload',
  );
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);
});

// APP FINDING (reported): on iPad portrait the "Let's clash!" button is below the fold on
// Setup. The UI rule wants the primary action above the fold. test.fail() flips to a failure
// the day it is fixed, so this note cannot go stale.
test.fail('portrait: the start button is visible without scrolling', async ({ page }) => {
  await toSetup(page);
  await fits(page, ['setup-next'], 'Setup');
});
