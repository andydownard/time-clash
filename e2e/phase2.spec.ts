// Phase 2 end to end: the Battle Plan (place and base spot), special ammo unlocked with Scrap and
// fired in battle, and the evasion abilities. The turn is still two shots, then a reload.
import type { Page } from '@playwright/test';
import type { BattleLayout } from '../src/game/types';
import { ANGLE_LABEL_MAX, fighterKeepOut } from '../src/scenes/battle/angleLabel';
import { expect, test } from './fixtures';
import { giveScrap, savedCamp } from './support/camp';
import { saveShot } from './support/shots';
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

test('Team Past places its castle on the Battle Plan by keyboard, and it is remembered', async ({
  page,
  browserName,
}) => {
  await toCamp(page);
  await tid(page, 'camp-start').click();
  await expect(page.locator('[data-screen="plan"]')).toContainText('Alex, place your castle');
  // A new family sees the Village (villageWall) picked, the default, and only that one.
  await expect(tid(page, 'plan-fort-villageWall')).toHaveAttribute('aria-checked', 'true');
  for (const id of ['hillFort', 'drawbridge'])
    await expect(tid(page, `plan-fort-${id}`)).toHaveAttribute('aria-checked', 'false');
  const card = tid(page, 'plan-fort-drawbridge');
  const box = (await card.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(56);
  await card.focus();
  await page.keyboard.press('Space');
  await expect(card).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'plan-fort-villageWall')).toHaveAttribute('aria-checked', 'false');
  await expect(tid(page, 'plan-spot-foodTruck')).toHaveAttribute('aria-checked', 'true');
  await saveShot(page, browserName, 'plan-castle');
  await tid(page, 'plan-go').click();
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  const l = (await layout(page))!;
  expect(l.fort).toBe('drawbridge');
  expect(l.bases.PAST.y).toBe(520);
  // The aspen hill, the food truck wall, and the drawbridge.
  expect(l.terrain.obstacles).toHaveLength(3);
  await readyUp(page);
  await tid(page, 'pause').click();
  await tid(page, 'pause-leave').click();
  await tid(page, 'pause-leave-yes').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await tid(page, 'camp-start').click();
  await expect(tid(page, 'plan-fort-drawbridge')).toHaveAttribute('aria-checked', 'true');
});

test('every castle place and base spot draws on the field where shells hit', async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000);
  const tour = [
    { biome: 'aspen', fort: 'hillFort', spot: 'skyscraper', pastY: 330 },
    { biome: 'cherry', fort: 'villageWall', spot: 'foodTruck', pastY: 470 },
    { biome: 'temple', fort: 'drawbridge', spot: 'bridge', pastY: 520 },
  ] as const;
  await toCamp(page);
  for (const t of tour) {
    await tid(page, 'camp-start').click();
    await tid(page, `plan-biome-${t.biome}`).click();
    await tid(page, `plan-fort-${t.fort}`).click();
    await tid(page, `plan-spot-${t.spot}`).click();
    await tid(page, 'plan-go').click();
    await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
    const l = (await layout(page))!;
    expect(l.biome).toBe(t.biome);
    expect(l.fort).toBe(t.fort);
    expect(l.spot).toBe(t.spot);
    expect(l.bases.PAST.y).toBe(t.pastY);
    expect(l.terrain.obstacles).toHaveLength(3);
    await readyUp(page);
    // The angle number fits the size the unit sweep checks, and sits on no fighter.
    const label = (await page.evaluate(() => window.__timeclash!.aim()))?.label;
    expect(label).toBeTruthy();
    expect(label!.w).toBeLessThanOrEqual(ANGLE_LABEL_MAX.w);
    expect(label!.h).toBeLessThanOrEqual(ANGLE_LABEL_MAX.h);
    for (const k of fighterKeepOut(l as BattleLayout))
      expect(
        label!.x < k.x + k.w &&
          k.x < label!.x + label!.w &&
          label!.y < k.y + k.h &&
          k.y < label!.y + label!.h,
        `label on a fighter at ${t.fort}`,
      ).toBe(false);
    await saveShot(page, browserName, `battle-${t.fort}-${t.spot}`);
    await tid(page, 'pause').click();
    await tid(page, 'pause-leave').click();
    await tid(page, 'pause-leave-yes').click();
    await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  }
});

test('Back on the Battle Plan returns to the Camp and starts nothing', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-start').click();
  await tid(page, 'plan-back').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
  expect(await page.evaluate(() => window.__timeclash!.match())).toBeNull();
});

test('special ammo: unlock with Scrap, load it in battle, and a shot uses one', async ({
  page,
}) => {
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
  // Aspen hill, the food truck wall, the default Village, and now the stone wall.
  expect((await layout(page))!.terrain.obstacles).toHaveLength(4);
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
