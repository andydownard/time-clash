// Birds, gusts and recoil in a real browser: a bird is in the sky before the first shot, it keeps
// flying while the player aims, and Fire makes the Angle and Power sliders slide by the recoil.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { DISTURBANCE_COPY } from '../src/data/copy';
import { readyUp, snap, startMatch, tid, toSetup, waitAiming } from './support/game';

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

test('the first kick of the match says Kick! once, in the lane, clear of the controls', async ({
  page,
}) => {
  await toSetup(page);
  await page.evaluate(() => window.__timeclash!.setDisturbances(true));
  await startMatch(page, undefined, undefined, SEED);
  await readyUp(page);
  // Count every time the caption bar starts to show the Kick! line.
  await page.evaluate((kick) => {
    const bar = document.querySelector('[data-testid="caption-bar"]')!;
    const w = window as unknown as { __kicks: number };
    w.__kicks = 0;
    let up = false;
    new MutationObserver(() => {
      const now = !(bar as HTMLElement).hidden && bar.textContent === kick;
      if (now && !up) w.__kicks++;
      up = now;
    }).observe(bar, { childList: true, characterData: true, subtree: true, attributes: true });
  }, DISTURBANCE_COPY.kick);
  const kicks = () => page.evaluate(() => (window as unknown as { __kicks: number }).__kicks);

  const team = (await snap(page)).turn.team;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Space');
  const bar = tid(page, 'caption-bar');
  // It shows once the shot has landed, so it never hides the shell or the "Gust!" word.
  await expect(bar).toHaveText(DISTURBANCE_COPY.kick, { timeout: 10_000 });
  // It sits in the message lane: never over the control bar, a team card or the sliders.
  const box = (await bar.boundingBox())!;
  for (const id of ['aim-angle', 'aim-power', 'fire']) {
    const other = await tid(page, id).boundingBox();
    if (!other) continue;
    const overlap =
      box.x < other.x + other.width &&
      other.x < box.x + box.width &&
      box.y < other.y + other.height &&
      other.y < box.y + box.height;
    expect(overlap, `Kick! covers ${id}`).toBe(false);
  }
  const bottom = await page.locator('.tc-hud-bottom').boundingBox();
  if (bottom) expect(box.y + box.height).toBeLessThanOrEqual(bottom.y);
  await look(page, 'battle-kick');

  // It stays up while the player aims again, and comes down when they fire. The second shot
  // kicks too, but the line does not come back.
  await waitAiming(page, 1);
  await expect(bar).toHaveText(DISTURBANCE_COPY.kick);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Space');
  await expect(bar).not.toHaveText(DISTURBANCE_COPY.kick, { timeout: 5000 });
  await expect.poll(async () => (await snap(page)).stats[team].shotsFired).toBe(2);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 30_000 });
  expect(await kicks()).toBe(1);
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
