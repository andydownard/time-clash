// iPad portrait (768x1024) smoke check: every key screen fits, nothing scrolls sideways.
import { expect, test } from './fixtures';
import { WORLD } from '../src/game/config';
import { UNIT_IDS, unitBox, unitById } from '../src/game/units';
import { smallTargets } from './support/audit';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  SEED,
  answerReload,
  fillTeam,
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
  await expect(tid(page, 'setup-next')).toBeInViewport();
  await saveShot(page, browserName, 'setup');
  await startMatch(page);
  await fits(page, ['pass-ready'], 'Pass screen');
  await recordBannerBox(page);
  await readyUp(page);
  await expectBannerClear(page, 'portrait banner');
  await fits(
    page,
    [
      'fire',
      'aim-angle',
      'aim-power',
      'wind',
      'base-hp-PAST',
      'base-hp-FUTURE',
      'hud-mute',
      'pause',
    ],
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

// The UI rule wants the primary action above the fold. Setup must show "Let's clash!" with no scrolling.
test('portrait: the start button is visible without scrolling', async ({ page }) => {
  await toSetup(page);
  await fits(page, ['setup-next'], 'Setup');
});

// Regression #3 style: in portrait the team cards must not sit on top of fighters, even with
// Team Future's base high on the Skyscraper.
test('portrait: the team cards clear every fighter on the Skyscraper', async ({ page }) => {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await page.evaluate((s) => window.__timeclash!.setSeed(s), SEED);
  await tid(page, 'setup-next').click();
  await tid(page, 'camp-start').click();
  await tid(page, 'plan-spot-skyscraper').click();
  await tid(page, 'plan-go').click();
  await waitPassScreen(page);
  await readyUp(page);
  await expect(tid(page, 'fire')).toBeVisible();
  const layout = (await page.evaluate(() => window.__timeclash!.layout()))!;
  expect(layout.spot).toBe('skyscraper');
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  const k = canvas.width / WORLD.width;
  for (const team of ['PAST', 'FUTURE'] as const) {
    const card = (await tid(page, `base-hp-${team}`)
      .locator('xpath=ancestor::*[@data-team][1]')
      .boundingBox())!;
    for (const id of UNIT_IDS) {
      if (unitById(id)!.team !== team) continue;
      const b = unitBox(team, id, layout);
      const x = canvas.x + b.x * k;
      const y = canvas.y + b.y * k;
      const hit =
        x < card.x + card.width &&
        card.x < x + b.w * k &&
        y < card.y + card.height &&
        card.y < y + b.h * k;
      expect(hit, `${team} card covers fighter ${id}`).toBe(false);
    }
  }
});

// The Both chip must stay on the same row as Reading and Math.
test('portrait: the subject chips share one row on Setup', async ({ page }) => {
  await toSetup(page);
  for (const team of ['PAST', 'FUTURE'] as const) {
    const tops: number[] = [];
    for (const s of ['reading', 'math', 'both']) {
      const box = (await tid(page, `setup-subject-${team}-${s}`).boundingBox())!;
      tops.push(Math.round(box.y));
    }
    expect(new Set(tops).size, `${team} subject chips on one row: ${tops}`).toBe(1);
  }
});
