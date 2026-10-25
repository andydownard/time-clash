// A reading question: the player reads it (no read-aloud), and the card works with sound off.
// The owner removed read-aloud for questions (2026-10-23), so the card has no Hear it and never
// asks the app server for a spoken clip (/v1/clips/).
import { expect, test } from './fixtures';
import { smallTargets, smallText } from './support/audit';
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

test('a reading question has no Hear it, asks for no clip, keeps the floors, and gives a clue after a miss', async ({
  page,
  browserName,
}) => {
  await toSetup(page);
  const kinder = { name: 'Alex', grade: 0, subject: 'reading' as const };
  await fillTeam(page, 'FUTURE', { ...kinder, name: 'Sam' });
  await startMatch(page, kinder, { ...kinder, name: 'Sam' });
  // Watch from the start of the turn, so a clip asked for as the card opens is seen.
  const clips: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/v1/clips/')) clips.push(r.url());
  });
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await expect(tid(page, 'reload-speak')).toHaveCount(0);
  await expect(tid(page, 'reload-modal').getByRole('button', { name: /hear|listen/i })).toHaveCount(
    0,
  );
  await expect(tid(page, 'cover-mute')).toBeVisible();
  // The floors: no sideways scroll, 56px targets, 20px text.
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect.soft(over, 'sideways scroll').toBeLessThanOrEqual(0);
  expect.soft(await smallTargets(page), 'targets under 56px').toEqual([]);
  expect.soft(await smallText(page), 'text under 20px').toEqual([]);
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
  // The card was up for the whole check above and never asked for a spoken clip.
  expect(clips).toEqual([]);
});
