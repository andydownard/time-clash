// Build Base screenshots for the docs: the Camp and the screen, builder off (old shop) and on.
import { expect, test } from './fixtures';
import { FUTURE_SIDE, PAST_SIDE, fillTeam, tid, toSetup } from './support/game';
import { openBuilder, toBuilderCamp } from './support/builder';
import { saveShot } from './support/shots';

test('Build Base with the builder off: Camp and old shop screen', async ({ page, browserName }) => {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await saveShot(page, browserName, 'build-base-off-camp');
  await tid(page, 'camp-upgrade').click();
  await expect(tid(page, 'upgrade-back')).toBeVisible();
  await saveShot(page, browserName, 'build-base-off-screen');
});

test('Build Base with the builder on: Camp and builder screen', async ({ page, browserName }) => {
  await toBuilderCamp(page);
  await saveShot(page, browserName, 'build-base-on-camp');
  await openBuilder(page, 'FUTURE');
  await saveShot(page, browserName, 'build-base-on-screen');
});
