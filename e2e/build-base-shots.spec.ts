// Build Base screenshots for the docs: the Camp and the builder screen.
import { test } from './fixtures';
import { openBuilder, toBuilderCamp } from './support/builder';
import { saveShot } from './support/shots';

test('Build Base with the builder on: Camp and builder screen', async ({ page, browserName }) => {
  await toBuilderCamp(page);
  await saveShot(page, browserName, 'build-base-on-camp');
  await openBuilder(page, 'FUTURE');
  await saveShot(page, browserName, 'build-base-on-screen');
});
