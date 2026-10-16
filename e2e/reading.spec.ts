// A reading question: every card can be read aloud, and the card works with sound off.
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

test('a reading question has Hear it and a Sound button, and a clue after a miss', async ({
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
  await expect(tid(page, 'reload-speak')).toBeVisible();
  await expect(tid(page, 'cover-mute')).toBeVisible();
  // Layout height, so the card's pop-in animation cannot shrink the number.
  const height = await tid(page, 'reload-speak').evaluate((el) => (el as HTMLElement).offsetHeight);
  expect(height).toBeGreaterThanOrEqual(56);
  await saveShot(page, browserName, 'reload-reading');
  // Nothing is focused or picked when the card opens.
  const focusedChoice = await page.evaluate(() =>
    Boolean(document.activeElement?.matches('[data-testid^="reload-choice-"]')),
  );
  expect(focusedChoice).toBe(false);
  // Hear it never breaks the card, even where speech is stubbed or missing.
  await tid(page, 'reload-speak').click();
  await expect(tid(page, 'reload-modal')).toBeVisible();
  // A wrong tap shows the answer and waits for Got it.
  await tid(page, 'reload-choice-0').click();
  await expect(tid(page, 'reload-next')).toBeVisible();
  await tapGotIt(page);
  await waitPassScreen(page);
});
