// Birds, gusts and recoil in a real browser: a bird is in the sky before the first shot, it keeps
// flying while the player aims, and Fire makes the Angle and Power sliders slide by the recoil.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readyUp, snap, startMatch, tid, toSetup } from './support/game';

/** Seed 4243: two birds in view on the first turn and a recoil that moves both dials. */
const SEED = 4243;

const birds = (page: Page) => page.evaluate(() => window.__timeclash!.birds());

/** Optional pictures for a person to look at (set DISTURB_SHOTS to a folder). Never tracked. */
async function look(page: Page, name: string): Promise<void> {
  const dir = process.env.DISTURB_SHOTS;
  const size = page.viewportSize();
  if (!dir || !size) return;
  await page.screenshot({ path: `${dir}/${name}-${size.width}x${size.height}.png` });
}

test('a bird flies across the sky before the first shot, and Fire kicks the sliders', async ({
  page,
}) => {
  await toSetup(page);
  await page.evaluate(() => window.__timeclash!.setDisturbances(true));
  await startMatch(page, undefined, undefined, SEED);
  await readyUp(page);

  const first = await birds(page);
  expect(first).not.toBeNull();
  expect(first!.birds.length).toBeGreaterThan(0);
  const inView = first!.birds.filter((b) => b.x >= 0 && b.x <= 1280);
  expect(inView.length).toBeGreaterThan(0);
  for (const b of first!.birds) {
    expect(b.y).toBeGreaterThan(100);
    expect(b.y).toBeLessThan(470);
  }
  await look(page, 'battle-birds');

  // The birds keep flying while the player aims.
  await expect
    .poll(async () => (await birds(page))!.birds[0]!.x, { timeout: 5000 })
    .not.toBe(first!.birds[0]!.x);

  const team = (await snap(page)).turn.team;
  const before = (await snap(page)).aim[team];
  await expect(tid(page, 'aim-angle')).toHaveValue(String(before.angleDeg));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snap(page)).stats[team].shotsFired).toBe(1);
  for (const ms of [250, 500, 750, 1000]) {
    await page.waitForTimeout(250);
    await look(page, `battle-flight-${ms}`);
  }

  const s = await snap(page);
  expect(s.lastShot?.birdMs).toBeGreaterThan(0);
  const kicked = s.aim[team];
  expect(kicked).not.toEqual(before);
  // The sliders show the kicked aim, so the child can see it moved and re-aim.
  await expect(tid(page, 'aim-angle')).toHaveValue(String(kicked.angleDeg), { timeout: 5000 });
  await expect(tid(page, 'aim-power')).toHaveValue(String(kicked.power), { timeout: 5000 });
});

test('a test run starts calm: no birds unless a test turns them on', async ({ page }) => {
  await toSetup(page);
  await startMatch(page, undefined, undefined, SEED);
  await readyUp(page);
  const s = await snap(page);
  expect(s.disturbances).toBe(false);
  expect(s.birds).toEqual([]);
  const drawn = await birds(page);
  expect(drawn?.birds ?? []).toEqual([]);
});
