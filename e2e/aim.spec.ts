// The angle guide sits at the muzzle of the fighter about to fire. Power lives only in the bottom bar.
import type { Page } from '@playwright/test';
import { LAUNCH_ORIGINS } from '../src/game/config';
import { unitById } from '../src/game/units';
import type { Team } from '../src/game/types';
import { expect, test } from './fixtures';
import {
  answerReload,
  playShots,
  readyUp,
  snap,
  startMatch,
  tid,
  toSetup,
  waitAiming,
  waitPassScreen,
} from './support/game';

const aim = (page: Page) => page.evaluate(() => window.__timeclash!.aim());

test('battle: power is only in the bottom bar and the guide starts at the muzzle', async ({
  page,
}) => {
  await toSetup(page);
  await startMatch(page);
  await tid(page, 'pass-ready').click();
  await waitAiming(page, 0);
  const team = (await snap(page)).turn.team;

  await expect(tid(page, 'aim-power')).toBeVisible();
  await expect(tid(page, 'aim-angle')).toBeVisible();

  const first = await aim(page);
  expect(first!.team).toBe(team);
  expect(first!.origin).toEqual(LAUNCH_ORIGINS[team]);
  // Only the small angle number is drawn in the world. No power meter, no POWER text.
  expect(first!.texts).toHaveLength(1);
  expect(first!.texts[0]).toMatch(/^\d+°$/);
  expect(first!.texts.join(' ').toLowerCase()).not.toContain('power');

  // Picking another fighter moves the guide to that fighter's own muzzle.
  const other = team === 'PAST' ? 'D' : '3';
  await tid(page, `unit-${other}`).click();
  await expect.poll(async () => (await aim(page))!.origin).toEqual(unitById(other)!.origin);
});

test('battle: screenshots of the angle guide', async ({ page }, info) => {
  const size = info.project.name.replace(/^[a-z]+-/, '');
  test.skip(!info.project.name.startsWith('chromium'), 'screenshots come from Chromium');
  await toSetup(page);
  await startMatch(page);
  await tid(page, 'pass-ready').click();
  await waitAiming(page, 0);
  const shoot = async (want: Team, alt: string): Promise<void> => {
    expect((await snap(page)).turn.team).toBe(want);
    await page.screenshot({ path: `docs/screenshots/aim-${want.toLowerCase()}-${size}.png` });
    await tid(page, `unit-${alt}`).click();
    await expect.poll(async () => (await aim(page))!.origin).toEqual(unitById(alt)!.origin);
    await page.screenshot({
      path: `docs/screenshots/aim-${want.toLowerCase()}-${alt}-${size}.png`,
    });
  };
  await shoot('PAST', 'A');
  // Pick the default again, play the turn out, and the other team is up.
  await tid(page, 'unit-C').click();
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 20_000 });
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);
  await readyUp(page);
  await shoot('FUTURE', '2');
});
