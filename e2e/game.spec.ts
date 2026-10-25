// The whole game, played the way a family plays it: keyboard aiming, Space to fire.
//
// How the test reaches Victory without editing the app: the ?e2e=1 hook pins the seed and
// reads state, but it cannot set health. So the test plays it out. For each shot it asks the
// real game rules (src/game) which angle and power give a direct hit, then types that aim
// with the arrow keys. Full health is DAMAGE.startingBaseHp, so Team Past needs about five turns
// of direct hits and Power Shots (the pace rule). Team Future shoots short harmless shots, so it
// still takes its turns and answers its questions.
//
// Reload answers: the test looks the question up in the bank on disk to know the right
// choice. "Slow" moves the page clock forward 9 seconds (window.__skew) instead of waiting.
import { DAMAGE } from '../src/game/config';
import { expect, test } from './fixtures';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  SEED,
  answerReload,
  bannerSeen,
  watchBanner,
  playShots,
  wearDown,
  readQuestion,
  readyUp,
  snap,
  startMatch,
  takeBonusShot,
  takeShot,
  tid,
  toSetup,
  waitAiming,
  waitBonusAiming,
  tapGotIt,
  waitPassScreen,
} from './support/game';
import { saveShot } from './support/shots';

/** The cover must be solid, fill the window, and leave the board hidden and locked. */
async function expectCover(page: import('@playwright/test').Page, testId: string) {
  const cover = tid(page, testId);
  await expect(cover).toBeVisible();
  const facts = await cover.evaluate(async (el) => {
    // Let the pop-in finish first, so the size is the settled size.
    await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
    const r = el.getBoundingClientRect();
    const bg = getComputedStyle(el).backgroundColor;
    const canvas = document.querySelector('#game canvas') as HTMLElement;
    const board = canvas.parentElement as HTMLElement;
    const hud = document.querySelector('[data-layer="hud"]') as HTMLElement;
    return {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      view: { w: window.innerWidth, h: window.innerHeight },
      bg,
      opacity: getComputedStyle(el).opacity,
      boardHidden: getComputedStyle(board).visibility === 'hidden',
      boardInert: board.hasAttribute('inert'),
      hudHidden: getComputedStyle(hud).visibility === 'hidden',
      hudInert: hud.hasAttribute('inert'),
    };
  });
  expect(facts.rect.x).toBeLessThanOrEqual(0);
  expect(facts.rect.y).toBeLessThanOrEqual(0);
  expect(facts.rect.w).toBeGreaterThanOrEqual(facts.view.w);
  expect(facts.rect.h).toBeGreaterThanOrEqual(facts.view.h);
  // "rgb(r, g, b)" has no alpha, so it is fully solid. "rgba(...)" must end in 1.
  expect(facts.bg, 'cover background must be opaque').toMatch(/^rgb\(|, 1\)$/);
  expect(facts.opacity).toBe('1');
  expect(facts.boardHidden && facts.boardInert, 'canvas hidden and locked').toBe(true);
  expect(facts.hudHidden && facts.hudInert, 'HUD hidden and locked').toBe(true);
}

test('plays a full match: aim, fire, reload, pass, win, rematch', async ({ page, browserName }) => {
  // A whole match is about five turns a side (the pace rule), and busy workers slow each one.
  // Allow five times the usual limit, no sleeps.
  test.setTimeout(5 * test.info().timeout);
  await toSetup(page);
  await saveShot(page, browserName, 'setup');
  await startMatch(page, PAST_SIDE, FUTURE_SIDE, SEED);

  // ----- Turn 1, Team Past: pass screen first -----
  let m = await snap(page);
  expect(m.seed).toBe(SEED);
  expect(m.turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'PAST', turnNumber: 0 });
  await expectCover(page, 'pass-screen');
  await expect(tid(page, 'reload-modal')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pass the screen!' })).toBeVisible();
  // Chrono's pass line has a caption above the cover, clear of the ready button. A browser
  // driven by a test tool never really speaks it (Regression 17).
  const caption = tid(page, 'caption-bar');
  await expect(caption).toHaveText('Pass the screen! No peeking at their question!');
  await expect(caption).toBeVisible();
  const [capBox, readyBox] = await Promise.all([
    caption.boundingBox(),
    tid(page, 'pass-ready').boundingBox(),
  ]);
  expect(capBox!.y).toBeGreaterThanOrEqual(readyBox!.y + readyBox!.height);
  expect(await page.evaluate(() => window.__silent?.speakCalls)).toBe(0);
  await saveShot(page, browserName, 'pass-screen');

  // Other keys on the pass screen must not start anything (Space on the focused
  // "I'm ready!" button is a real tap, so it is left out).
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');
  expect((await snap(page)).turn.phase).toBe('PASS_SCREEN');

  await watchBanner(page);
  await tid(page, 'pass-ready').click();
  await expect.poll(() => bannerSeen(page)).toContain('ALEX');
  await waitAiming(page, 0);
  await expect(tid(page, 'shots-left')).toContainText('2 of 2');
  await saveShot(page, browserName, 'battle-aiming');

  // Shot 1: a near miss, so the slapstick tumble and speech bubble show.
  await takeShot(page, 'near');
  // A second Space while the ball flies cannot fire again.
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await expect(tid(page, 'speech-bubble')).toBeVisible({ timeout: 45_000 });
  await saveShot(page, browserName, 'tumble');
  m = await snap(page);
  expect(m.stats.PAST.shotsFired).toBe(1);
  expect(m.baseHp.FUTURE).toBe(DAMAGE.startingBaseHp - DAMAGE.near);

  // Shot 2: a direct hit.
  await waitAiming(page, 1);
  await takeShot(page, 'direct');
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  m = await snap(page);
  expect(m.baseHp.FUTURE).toBe(DAMAGE.startingBaseHp - DAMAGE.near - DAMAGE.direct);
  expect(m.turn).toMatchObject({ phase: 'RELOAD', shotsFired: 2 });

  // ----- Reload: nothing can skip it, and the third shot is impossible -----
  await expectCover(page, 'reload-modal');
  await saveShot(page, browserName, 'reload-modal');
  const modalText = await tid(page, 'reload-modal').innerText();
  expect(modalText.toLowerCase()).toContain('reload time!');
  // (Space and Enter are left out: on a focused answer button they are a real answer.)
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.mouse.click(2, 2); // outside the card
  await expect(tid(page, 'reload-modal')).toBeVisible();
  expect((await snap(page)).stats.PAST.shotsFired).toBe(2);
  // The only buttons are the answers, a hint when there is one, and Sound on/off.
  const buttons = await tid(page, 'reload-modal')
    .getByRole('button')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(
    buttons.filter((b) => !/^(reload-(choice-[0-3]|hint)|cover-mute)$/.test(b ?? '')),
  ).toEqual([]);

  // Right and fast: +2 scrap.
  const first = await answerReload(page, 'right-fast');
  await expect(tid(page, 'reload-feedback')).toContainText('+2 scrap! Super fast!');
  // ----- A right answer earns one Power Shot (not a question, not shot 3) -----
  await watchBanner(page);
  await waitBonusAiming(page);
  await expect.poll(() => bannerSeen(page)).toContain('POWER SHOT!');
  await expect(tid(page, 'shots-left')).toContainText('Power Shot!');
  expect((await snap(page)).turn).toMatchObject({ phase: 'BONUS_AIMING', shotsFired: 2 });
  await takeBonusShot(page, 'miss');
  await waitPassScreen(page);
  m = await snap(page);
  expect(m.scrap.PAST).toBe(2);
  expect(m.stats.PAST.fastestAnswerMs).toBeLessThan(8000);
  expect(m.turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'FUTURE' });
  // The Power Shot happened: a third shot, with turn.shotsFired still 2.
  expect(m.stats.PAST.shotsFired).toBe(3);

  // ----- Pass screen hides the board and the last question -----
  await expectCover(page, 'pass-screen');
  await expect(tid(page, 'reload-modal')).toHaveCount(0);
  await expect(tid(page, 'reload-prompt')).toHaveCount(0);
  const pageText = await page.evaluate(() => document.documentElement.textContent ?? '');
  expect(pageText.includes(first.prompt), 'last question must not be in the page').toBe(false);

  // ----- Turn 1, Team Future: wrong answer still reloads and shows the right one -----
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  const wrong = await answerReload(page, 'wrong');
  await expect(tid(page, 'reload-feedback')).toContainText(`The answer is ${wrong.rightAnswer}.`);
  await expect(tid(page, 'reload-feedback')).toContainText('Reloaded anyway');
  await expect(tid(page, `reload-choice-${wrong.rightIndex}`)).toHaveAttribute(
    'data-state',
    'right',
  );
  // The clue stays up past the old 1.8 seconds. The card waits for Got it.
  await page.waitForTimeout(2500);
  await expect(tid(page, 'reload-modal')).toBeVisible();
  await tapGotIt(page);
  await waitPassScreen(page);
  m = await snap(page);
  expect(m.scrap.FUTURE).toBe(0);
  expect(m.stats.FUTURE.questionsAnswered).toBe(1);
  expect(m.turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'PAST' });

  // ----- Turn 2, Team Past: two direct hits, then a slow right answer: +1 scrap -----
  await readyUp(page);
  await playShots(page, ['direct', 'direct']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  expect((await snap(page)).baseHp.FUTURE).toBe(
    DAMAGE.startingBaseHp - DAMAGE.near - 3 * DAMAGE.direct,
  );
  await answerReload(page, 'right-slow');
  await expect(tid(page, 'reload-feedback')).toContainText('+1 scrap! Nice work!');
  await waitPassScreen(page);
  m = await snap(page);
  expect(m.scrap.PAST).toBe(3);

  // ----- Turn 2, Team Future: quiet turn -----
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);

  // ----- Team Past wears the base down until one direct hit is left (the pace rule) -----
  await wearDown(page);

  // ----- Team Past: the last hit ends the match on the spot -----
  await readyUp(page);
  await takeShot(page, 'direct');
  await expect(tid(page, 'victory')).toBeVisible({ timeout: 45_000 });
  // (The hook has no match once Victory is up, so the screen itself is the proof.)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alex');
  // No reload after the final hit.
  await expect(tid(page, 'reload-modal')).toHaveCount(0);
  await expect(tid(page, 'victory')).toContainText('Alex');
  await saveShot(page, browserName, 'victory');

  // ----- Rematch: Loading, then a fresh Battle with the other team first -----
  await tid(page, 'rematch').click();
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 45_000 });
  m = await snap(page);
  expect(m.status).toBe('PLAYING');
  expect(m.seed).toBe(SEED + 1);
  expect(m.baseHp).toEqual({ PAST: DAMAGE.startingBaseHp, FUTURE: DAMAGE.startingBaseHp });
  expect(m.scrap).toEqual({ PAST: 0, FUTURE: 0 });
  expect(m.turn).toMatchObject({ phase: 'PASS_SCREEN', team: 'FUTURE', turnNumber: 0 });
  expect(m.players.map((p) => p.name)).toEqual(['Alex', 'Sam']);
  await watchBanner(page);
  await tid(page, 'pass-ready').click();
  await expect.poll(() => bannerSeen(page)).toContain('SAM');
  await waitAiming(page, 0);
  await expect(tid(page, 'fire')).toBeEnabled();
});

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
