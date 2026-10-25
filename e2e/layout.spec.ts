// Nothing sits on top of the team cards, and the corner buttons never hide a setup control.
import { expect, test } from './fixtures';
import {
  expectAimPanelClearOfBases,
  expectBannerClear,
  expectHudClear,
  recordBannerBox,
} from './support/layout';
import { startMatch, tid, toSetup, waitAiming } from './support/game';

test('battle: nothing covers the team cards, and canvas labels are at least 20px', async ({
  page,
}) => {
  await toSetup(page);
  await startMatch(page);
  await recordBannerBox(page);
  await tid(page, 'pass-ready').click();
  await waitAiming(page, 0);
  // Corner buttons and the turn banner stay off the team cards (Regression 3).
  await expectBannerClear(page, 'banner');
  await expectHudClear(page, 'battle');
  await expectAimPanelClearOfBases(page, 'battle');
  // Labels drawn on the canvas are at least 20px on screen (Regression 8).
  const px = await page.evaluate(() => window.__timeclash!.labelPx());
  expect(px, 'canvas labels exist').not.toBeNull();
  expect(px!, 'smallest canvas label, in screen px').toBeGreaterThanOrEqual(20);
});

test('setup: the corner buttons do not sit on top of a control at the top of the page', async ({
  page,
}) => {
  await toSetup(page);
  const gear = await tid(page, 'settings-button').boundingBox();
  const name = await tid(page, 'setup-name-PAST').boundingBox();
  expect(gear!.y + gear!.height, 'gear is above the first field').toBeLessThanOrEqual(name!.y);
});
