// A reading question: the player reads it (no read-aloud), and the card works with sound off.
import { expect, test } from './fixtures';
import {
  fillTeam,
  playShots,
  readyUp,
  startMatch,
  tapGotIt,
  tid,
  toSetup,
  waitPassScreen,
} from './support/game';
import { saveShot } from './support/shots';

test('a reading question has a Sound button and no Hear it, and a clue after a miss', async ({
  page,
  browserName,
}) => {
  await toSetup(page);
  const kinder = { name: 'Alex', grade: 0, subject: 'reading' as const };
  await fillTeam(page, 'FUTURE', { ...kinder, name: 'Sam' });
  await startMatch(page, kinder, { ...kinder, name: 'Sam' });
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await expect(tid(page, 'reload-speak')).toHaveCount(0);
  await expect(tid(page, 'cover-mute')).toBeVisible();
  await saveShot(page, browserName, 'reload-reading');
  // Nothing is focused or picked when the card opens.
  const focusedChoice = await page.evaluate(() =>
    Boolean(document.activeElement?.matches('[data-testid^="reload-choice-"]')),
  );
  expect(focusedChoice).toBe(false);
  // A wrong tap shows the answer and waits for Got it.
  await tid(page, 'reload-choice-0').click();
  await expect(tid(page, 'reload-next')).toBeVisible();
  await tapGotIt(page);
  await waitPassScreen(page);
});
