// Turn rules a family must never be able to break, played with the keyboard and Space to fire.
// The whole match (aim, fire, reload, pass, win, rematch) is played in e2e/look.spec.ts, which
// checks the floors on every screen in the same run.
import { expect, test } from './fixtures';
import {
  answerReload,
  playShots,
  readQuestion,
  readyUp,
  snap,
  startMatch,
  tid,
  toSetup,
  tapGotIt,
  waitPassScreen,
} from './support/game';

test('a third shot is impossible, and the question stays up until it is answered', async ({
  page,
}) => {
  await toSetup(page);
  await startMatch(page);
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  // The HUD is locked while the question is up: Fire cannot be reached or pressed.
  await expect(tid(page, 'fire')).toBeHidden();
  for (const key of ['Escape', 'ArrowUp', 'ArrowRight', 'Tab']) await page.keyboard.press(key);
  await expect(tid(page, 'reload-modal')).toBeVisible();
  const s = await snap(page);
  expect(s.stats.PAST.shotsFired).toBe(2);
  expect(s.turn.phase).toBe('RELOAD');
  // Tab stays inside the question (the board cannot take focus).
  const inside = await page.evaluate(() => {
    // Safari may leave focus on the page itself; it must never land on the hidden board.
    const a = document.activeElement;
    return !a || a === document.body || a.closest('[data-testid="reload-modal"]') !== null;
  });
  expect(inside).toBe(true);
  // Only a choice moves on. A wrong one is fine.
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);
  expect((await snap(page)).turn).toMatchObject({ team: 'FUTURE', shotsFired: 0 });
  // The next turn is the other team's, and it also gets exactly two shots.
  await readyUp(page);
  await expect(tid(page, 'shots-left')).toContainText('2 of 2');
  const q = await readQuestionIfAny(page);
  expect(q).toBeNull();
});

async function readQuestionIfAny(page: import('@playwright/test').Page) {
  return (await tid(page, 'reload-modal').count()) === 0 ? null : readQuestion(page);
}
