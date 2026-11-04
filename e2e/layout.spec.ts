// Nothing sits on top of the team cards, and the corner buttons never hide a setup control.
// Captions and hints show in the message lane, clear of the bar, the cards, fighters and bricks.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { chooseSlot, freshBases, saveSlot } from '../src/game/baseBuilder';
import { TYPICAL } from '../tests/helpers/builtBases';
import {
  expectAimPanelClearOfBases,
  expectBannerClear,
  expectHudClear,
  expectMessageClear,
  recordBannerBox,
  recordCaptionBox,
  recordedCaptionBox,
} from './support/layout';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  readyUp,
  snap,
  startMatch,
  tid,
  toSetup,
  waitAiming,
} from './support/game';

/** A match with a typical built base on each side, with Squads on or off. */
async function builtMatch(page: Page, squads: boolean): Promise<void> {
  await toSetup(page);
  await page.evaluate((v) => window.__timeclash!.setSquads(v), squads);
  let st = freshBases();
  st = saveSlot(st, PAST_SIDE.name, 'PAST', 0, TYPICAL('PAST').pieces);
  st = chooseSlot(st, PAST_SIDE.name, 'PAST', 0);
  st = saveSlot(st, FUTURE_SIDE.name, 'FUTURE', 0, TYPICAL('FUTURE').pieces);
  st = chooseSlot(st, FUTURE_SIDE.name, 'FUTURE', 0);
  await startMatch(page, PAST_SIDE, FUTURE_SIDE, 4242, async () => {
    await page.evaluate((b) => localStorage.setItem('timeclash.bases', JSON.stringify(b)), st);
  });
  expect((await snap(page)).builtBase).toEqual({ PAST: true, FUTURE: true });
  await recordCaptionBox(page, 'Press Fire!');
  await readyUp(page);
  // The brick pictures load as images. Wait until both sides have drawn some.
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.__timeclash!.bricks())).every((l) => l.drawn > 0),
    )
    .toBe(true);
}

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
  // Health shows once, on the pill by the base. The team cards draw no heart and no bar.
  for (const t of ['PAST', 'FUTURE']) {
    const card = page.locator(`.tc-team-panel[data-team="${t}"]`);
    await expect(card.locator('svg[data-icon="health"]')).toHaveCount(0);
    await expect(card.locator('svg[data-icon="scrap"]')).toBeVisible();
    await expect(card.locator('[role="meter"]')).toHaveCount(1);
    expect((await card.locator('[role="meter"]').boundingBox())!.width).toBeLessThanOrEqual(1);
  }
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

test('battle, Squads on: the first-go caption, the first-go hint and a long caption sit in the lane', async ({
  page,
}, info) => {
  await builtMatch(page, true);
  const caption = tid(page, 'caption-bar');
  // Chrono says the first-go hint out loud, with a caption, as the turn starts.
  // It lasts about 2.5 seconds, so its box was recorded the moment it showed.
  await expectMessageClear(page, await recordedCaptionBox(page), 'first-go caption');
  // The hint itself comes back once the caption is done. Only one message is up at a time.
  const hint = tid(page, 'go-hint');
  await expect(hint).toBeVisible();
  await expect(caption).toBeHidden();
  await expectMessageClear(page, hint, 'first-go hint');
  await page.screenshot({ path: info.outputPath(`lane-first-go-hint-${info.project.name}.png`) });
  // A long caption (Hear it on the walking helper) wraps inside the lane, at 20px or more.
  await tid(page, 'helper-PAST-dasher').click();
  await tid(page, 'helper-hear').click();
  await expect(caption).toContainText('walks across');
  await expect(hint).toBeHidden();
  await expectMessageClear(page, caption, 'long caption');
  const size = await caption.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(20);
  const fits = await caption.evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
  expect(fits, 'the long caption fits inside the lane').toBe(true);
  await page.screenshot({ path: info.outputPath(`lane-long-caption-${info.project.name}.png`) });
});

test('battle, Squads off: the coach line sits in the lane, clear of a built base', async ({
  page,
}, info) => {
  await builtMatch(page, false);
  const coach = page.locator('.tc-hint');
  await expect(coach).toBeVisible();
  await expect(coach).toContainText('Slide Angle and Power');
  await expectMessageClear(page, coach, 'coach line');
  await page.screenshot({ path: info.outputPath(`lane-coach-${info.project.name}.png`) });
});

test('iPad mini (1133x744): the first-go hint, a caption and the coach line sit in the lane', async ({
  page,
}, info) => {
  test.skip(!info.project.name.endsWith('1280x800'), 'one run of this size is enough');
  await page.setViewportSize({ width: 1133, height: 744 });
  await builtMatch(page, true);
  const caption = tid(page, 'caption-bar');
  await expectMessageClear(page, await recordedCaptionBox(page), '1133 first-go caption');
  await expect(tid(page, 'go-hint')).toBeVisible();
  await expectMessageClear(page, tid(page, 'go-hint'), '1133 first-go hint');
  await page.screenshot({
    path: info.outputPath(`lane-first-go-hint-1133x744-${info.project.name}.png`),
  });
  await tid(page, 'helper-PAST-dasher').click();
  await tid(page, 'helper-hear').click();
  await expect(caption).toContainText('walks across');
  await expectMessageClear(page, caption, '1133 long caption');
  await page.screenshot({
    path: info.outputPath(`lane-long-caption-1133x744-${info.project.name}.png`),
  });
});

test('iPad mini (1133x744): the coach line sits in the lane, clear of a built base', async ({
  page,
}, info) => {
  test.skip(!info.project.name.endsWith('1280x800'), 'one run of this size is enough');
  await page.setViewportSize({ width: 1133, height: 744 });
  await builtMatch(page, false);
  const coach = page.locator('.tc-hint');
  await expect(coach).toBeVisible();
  await expectMessageClear(page, coach, '1133 coach line');
  await page.screenshot({ path: info.outputPath(`lane-coach-1133x744-${info.project.name}.png`) });
});
