// Phase 2 end to end: the Battle Plan (place and base spot), special ammo unlocked with Scrap and
// fired in battle, and the evasion abilities. The turn is still two shots, then a reload.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { giveScrap, savedCamp } from './support/camp';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  SEED,
  answerReload,
  fillTeam,
  readyUp,
  snap,
  takeShot,
  tapGotIt,
  tid,
  toSetup,
  waitAiming,
  waitPassScreen,
} from './support/game';

async function toCamp(page: Page): Promise<void> {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await page.evaluate((s) => window.__timeclash!.setSeed(s), SEED);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

const layout = (page: Page) => page.evaluate(() => window.__timeclash!.layout());

test('the Battle Plan picks the place and the base spot, and remembers them', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-start').click();
  await expect(tid(page, 'plan-go')).toBeFocused();
  await expect(tid(page, 'plan-biome-aspen')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'plan-spot-foodTruck')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-screen="plan"]')).toContainText('Sam, hide your base');
  await tid(page, 'plan-biome-temple').click();
  await tid(page, 'plan-spot-skyscraper').click();
  await tid(page, 'plan-go').click();
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  const l = (await layout(page))!;
  expect(l.biome).toBe('temple');
  expect(l.spot).toBe('skyscraper');
  expect(l.bases.FUTURE.y).toBe(330);
  // Leave the game, and the next Battle Plan has the same picks.
  await readyUp(page);
  await tid(page, 'pause').click();
  await tid(page, 'pause-leave').click();
  await tid(page, 'pause-leave-yes').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await tid(page, 'camp-start').click();
  await expect(tid(page, 'plan-biome-temple')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'plan-spot-skyscraper')).toHaveAttribute('aria-checked', 'true');
});

test('Back on the Battle Plan returns to the Camp and starts nothing', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-start').click();
  await tid(page, 'plan-back').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
  expect(await page.evaluate(() => window.__timeclash!.match())).toBeNull();
});

test('special ammo: unlock with Scrap, load it in battle, and it runs out', async ({ page }) => {
  await toCamp(page);
  await giveScrap(page, 20, 0);
  await page.reload();
  await tid(page, 'camp-start').click();
  await tid(page, 'plan-ammo-PAST-confetti').click();
  await expect(tid(page, 'plan-status')).toHaveText('Confetti unlocked!');
  await expect(tid(page, 'plan-scrap-PAST')).toContainText('10');
  // Too little Scrap says so and changes nothing.
  await tid(page, 'plan-ammo-FUTURE-bowling').click();
  await expect(tid(page, 'plan-status')).toContainText('You need 18 Scrap');
  const camp = await savedCamp(page);
  expect(camp.wallets.alex!.loadout.PAST).toMatchObject({ ammo: ['confetti'] });
  await tid(page, 'plan-go').click();
  await readyUp(page);
  // The ammo button shows, and a tap loads Confetti.
  await expect(tid(page, 'gear-ammo')).toBeVisible();
  await tid(page, 'gear-ammo').click();
  await expect.poll(async () => (await snap(page)).ammo.PAST).toBe('confetti');
  await takeShot(page, 'miss');
  await expect.poll(async () => (await snap(page)).ammoLeft.PAST.confetti).toBe(2);
  expect((await snap(page)).lastShot?.ammo).toBe('confetti');
});

test('evasion: the Stone Wall stands during Team Future’s turn, and the turn shape holds', async ({
  page,
}) => {
  await toCamp(page);
  await tid(page, 'camp-start').click();
  await tid(page, 'plan-go').click();
  await readyUp(page);
  const button = tid(page, 'gear-evasion');
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await snap(page)).evasion.PAST.phase).toBe('armed');
  // Arming is free: still shot 1 of 2.
  expect((await snap(page)).turn.shotsFired).toBe(0);
  await takeShot(page, 'miss');
  await waitAiming(page, 1);
  await takeShot(page, 'miss');
  // Exactly two shots, then the covered reload question.
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('body')).toHaveAttribute('data-cover', 'reload');
  expect((await snap(page)).stats.PAST.shotsFired).toBe(2);
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);
  await readyUp(page);
  const s = await snap(page);
  expect(s.turn.team).toBe('FUTURE');
  expect(s.evasion.PAST.phase).toBe('active');
  // Aspen hill, the food truck wall, and now the stone wall.
  expect((await layout(page))!.terrain.obstacles).toHaveLength(3);
  // Team Future's own button is the Hoverboard Dodge.
  await expect(button).toHaveAttribute('aria-label', /Hoverboard Dodge: ready/);
});

test('the gear sits by Fire, inside the window, and covers no other control', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-start').click();
  await tid(page, 'plan-go').click();
  await readyUp(page);
  const gear = await page.locator('.tc-gear').boundingBox();
  const fire = await tid(page, 'fire').boundingBox();
  const vp = page.viewportSize()!;
  expect(gear).not.toBeNull();
  expect(gear!.x).toBeGreaterThanOrEqual(0);
  expect(gear!.y).toBeGreaterThanOrEqual(0);
  expect(gear!.x + gear!.width).toBeLessThanOrEqual(vp.width);
  expect(gear!.y + gear!.height).toBeLessThanOrEqual(vp.height);
  const btn = await tid(page, 'gear-evasion').boundingBox();
  expect(btn!.height).toBeGreaterThanOrEqual(56);
  expect(btn!.width).toBeGreaterThanOrEqual(56);
  const overlap = (a: typeof gear, b: typeof gear) =>
    !!a &&
    !!b &&
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;
  for (const sel of ['.tc-turn-strip', '.tc-units', '.tc-aim', '[data-testid="fire"]']) {
    const box = await page.locator(sel).boundingBox();
    expect(overlap(gear, box), `gear covers ${sel}`).toBe(false);
  }
  // It sits right by Fire (centered over or under it).
  const center = (b: NonNullable<typeof gear>) => b.x + b.width / 2;
  expect(Math.abs(center(gear!) - center(fire!))).toBeLessThan(4);
});
