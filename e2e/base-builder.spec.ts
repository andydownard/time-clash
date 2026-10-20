// Base builder: drag bricks onto the plot, turn, undo, keep three saved bases, and see the chosen
// base again after a reload. The builder is behind ?builder=1 until the panel has reviewed it.
import { expect, test } from './fixtures';
import {
  bricks,
  cellPoint,
  chooseSpot,
  dragBrick,
  openBuilder,
  spotPad,
  toBuilderCamp,
} from './support/builder';
import { giveScrap } from './support/camp';
import { tid } from './support/game';
import { saveShot } from './support/shots';

test('the Camp has no Build buttons unless the builder is switched on', async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__timeclash));
  await expect(tid(page, 'camp-build-PAST')).toHaveCount(0);
  await expect(tid(page, 'camp-build-FUTURE')).toHaveCount(0);
  // The old shop button stays, under the new name.
  await expect(tid(page, 'camp-upgrade')).toHaveText('Build Base');
});

test('with the builder on, each side has one Build Base button and no old shop button', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await expect(tid(page, 'camp-upgrade')).toHaveCount(0);
  await expect(tid(page, 'camp-build-PAST')).toHaveText('Build Base');
  await expect(tid(page, 'camp-build-FUTURE')).toHaveText('Build Base');
  await tid(page, 'camp-build-FUTURE').click();
  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  await expect(page.locator('[data-screen="upgrade"]')).toHaveCount(0);
});

test('drag, turn, undo, save to slot 2, reload and see the base again', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await expect(tid(page, 'bb-slot-1')).toHaveAttribute('aria-pressed', 'true');
  await tid(page, 'bb-slot-2').click();
  await expect(tid(page, 'bb-slot-2')).toHaveAttribute('aria-pressed', 'true');

  await dragBrick(page, 'stone', 6, 9, 2, 1);
  await expect(bricks(page)).toHaveCount(1);
  await tid(page, 'bb-turn').click();
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);

  await dragBrick(page, 'tower', 12, 8, 1, 2);
  await expect(bricks(page)).toHaveCount(2);
  await tid(page, 'bb-undo').click();
  await expect(bricks(page)).toHaveCount(1);
  await dragBrick(page, 'tower', 12, 8, 1, 2);
  await expect(bricks(page)).toHaveCount(2);

  await tid(page, 'bb-done').click();
  await expect(tid(page, 'camp-base-PAST')).toHaveAttribute('data-bricks', '2');

  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await expect(tid(page, 'camp-base-PAST')).toHaveAttribute('data-bricks', '2');
  await openBuilder(page, 'PAST');
  await expect(tid(page, 'bb-slot-2')).toHaveAttribute('aria-pressed', 'true');
  await expect(bricks(page)).toHaveCount(2);
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);
  // The other two slots are still empty.
  await tid(page, 'bb-slot-1').click();
  await expect(bricks(page)).toHaveCount(0);
});

test('a drag that ends outside the plot cancels, and a placed brick dragged to the tray comes off', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  const from = await tid(page, 'bb-brick-stone').boundingBox();
  await page.mouse.move(from!.x + 20, from!.y + 20);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 5 });
  await page.mouse.up();
  await expect(bricks(page)).toHaveCount(0);

  await dragBrick(page, 'stone', 4, 9, 2, 1);
  await expect(bricks(page)).toHaveCount(1);
  const at = await cellPoint(page, 4, 9, 2, 1);
  const tray = await tid(page, 'bb-brick-plank').boundingBox();
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(tray!.x + 30, tray!.y + 30, { steps: 6 });
  await page.mouse.up();
  await expect(bricks(page)).toHaveCount(0);
});

test('Clear asks first, and bricks never overlap', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await dragBrick(page, 'long', 4, 9, 4, 1);
  // Dropped on top of the long brick: it lands on the nearest free spot instead.
  await dragBrick(page, 'long', 4, 9, 4, 1);
  await expect(bricks(page)).toHaveCount(2);
  await tid(page, 'bb-clear').click();
  await expect(tid(page, 'bb-clear-yes')).toBeVisible();
  await tid(page, 'bb-clear-no').click();
  await expect(bricks(page)).toHaveCount(2);
  await tid(page, 'bb-clear').click();
  await tid(page, 'bb-clear-yes').click();
  await expect(bricks(page)).toHaveCount(0);
  await tid(page, 'bb-undo').click();
  await expect(bricks(page)).toHaveCount(2);
});

test('keyboard: Enter picks, arrows move, R turns, Enter places, Delete removes, Ctrl+Z undoes', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await tid(page, 'bb-brick-tower').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expect(bricks(page)).toHaveCount(1);
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);
  await page.keyboard.press('Delete');
  await expect(bricks(page)).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(bricks(page)).toHaveCount(1);
});

test('a locked piece costs Scrap, once, and then is yours', async ({ page }) => {
  await toBuilderCamp(page);
  await giveScrap(page, 7, 0);
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await openBuilder(page, 'PAST');
  await expect(tid(page, 'bb-scrap')).toContainText('7');
  await tid(page, 'bb-brick-gate').click();
  await expect(tid(page, 'bb-status')).toHaveText('Not yet. You need 3 more Scrap.');
  await tid(page, 'bb-brick-arch').click();
  await expect(tid(page, 'bb-status')).toHaveText('You unlocked Arch!');
  await expect(tid(page, 'bb-scrap')).toContainText('1');
  await expect(tid(page, 'bb-brick-arch')).toHaveAttribute('data-state', 'owned');
  await dragBrick(page, 'arch', 8, 9, 2, 2);
  await expect(bricks(page)).toHaveCount(1);
});

for (const team of ['PAST', 'FUTURE'] as const) {
  test(`${team} builder looks right`, async ({ page, browserName }) => {
    await toBuilderCamp(page);
    await giveScrap(page, 40, 40);
    await page.reload();
    await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
    await openBuilder(page, team);
    const set =
      team === 'PAST'
        ? ([
            ['long', 7, 10, 4, 1],
            ['long', 12, 10, 4, 1],
            ['tower', 7, 8, 1, 2],
            ['tower', 14, 8, 1, 2],
            ['wallTop', 9, 9, 3, 1],
            ['stone', 9, 8, 2, 1],
          ] as const)
        : ([
            ['beam', 7, 10, 4, 1],
            ['beam', 12, 10, 4, 1],
            ['antenna', 7, 8, 1, 2],
            ['solar', 9, 9, 3, 1],
            ['panel', 14, 9, 2, 1],
          ] as const);
    for (const [id, c, r, pw, ph] of set) await dragBrick(page, id, c, r, pw, ph);
    await expect(bricks(page)).toHaveCount(set.length);
    await saveShot(page, browserName, `base-builder-${team.toLowerCase()}`);
    await tid(page, 'bb-done').click();
    await saveShot(page, browserName, `base-builder-camp-${team.toLowerCase()}`);
  });
}

test('weapons: pick spot 2, mount a weapon, reload, and it is still there', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await expect(tid(page, 'bb-spots-chip')).toHaveText('Spots 0 of 4 used');
  await expect(tid(page, 'bb-weapon-panel')).toBeHidden();
  await chooseSpot(page, 2);
  await expect(tid(page, 'bb-weapon-panel')).toContainText('Spot 2: pick a weapon');
  await expect(spotPad(page, 2)).toHaveAttribute('aria-label', 'Spot 2, empty, selected');
  await tid(page, 'bb-weapon-catapult').click();
  await expect(tid(page, 'bb-status')).toHaveText('Catapult is on spot 2.');
  await expect(spotPad(page, 2)).toHaveAttribute('aria-label', 'Spot 2, catapult, selected');
  await expect(tid(page, 'bb-weapon-catapult')).toContainText('On this spot');
  await expect(tid(page, 'bb-spots-chip')).toHaveText('Spots 1 of 4 used');

  // Replace it, then Undo brings the Catapult back.
  await tid(page, 'bb-weapon-cannon').click();
  await expect(spotPad(page, 2)).toHaveAttribute('aria-label', 'Spot 2, cannon, selected');
  await tid(page, 'bb-undo').click();
  await expect(spotPad(page, 2)).toHaveAttribute('aria-label', 'Spot 2, catapult, selected');

  await tid(page, 'bb-done').click();
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await openBuilder(page, 'PAST');
  await expect(tid(page, 'bb-spots-chip')).toHaveText('Spots 1 of 4 used');
  await tid(page, 'bb-mode-weapons').click();
  await expect(spotPad(page, 2)).toHaveAttribute('aria-label', 'Spot 2, catapult');
  await expect(spotPad(page, 1)).toHaveAttribute('aria-label', 'Spot 1, empty');
  // Clear spot empties it and the weapon stays gone after a reload.
  await spotPad(page, 2).click();
  await tid(page, 'bb-spot-clear').click();
  await expect(tid(page, 'bb-spots-chip')).toHaveText('Spots 0 of 4 used');
  await tid(page, 'bb-done').click();
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await openBuilder(page, 'PAST');
  await expect(tid(page, 'bb-spots-chip')).toHaveText('Spots 0 of 4 used');
});

test('weapons: the list never covers the chosen spot, and pads have a 56px tap area', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'FUTURE');
  for (const n of [1, 2, 3, 4]) {
    await chooseSpot(page, n);
    const panel = (await tid(page, 'bb-weapon-panel').boundingBox())!;
    const pad = (await spotPad(page, n).locator('.tc-bb-spot-ring').boundingBox())!;
    const apart =
      pad.x + pad.width <= panel.x ||
      pad.x >= panel.x + panel.width ||
      pad.y + pad.height <= panel.y ||
      pad.y >= panel.y + panel.height;
    expect(apart, `spot ${n} is covered by the list`).toBe(true);
    const tap = (await spotPad(page, n).locator('[data-spot-hit]').boundingBox())!;
    expect(Math.min(tap.width, tap.height)).toBeGreaterThanOrEqual(56);
  }
});

test('weapons: a locked weapon needs Scrap, once, and then mounts', async ({ page }) => {
  await toBuilderCamp(page);
  await giveScrap(page, 20, 0);
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await openBuilder(page, 'PAST');
  await chooseSpot(page, 1);
  await expect(tid(page, 'bb-weapon-ballista')).toHaveAttribute('data-state', 'locked');
  await tid(page, 'bb-weapon-ballista').click();
  await expect(tid(page, 'bb-status')).toHaveText('Not yet. You need 15 more Scrap.');
  await expect(tid(page, 'bb-scrap')).toContainText('20');
  await expect(spotPad(page, 1)).toHaveAttribute('aria-label', 'Spot 1, empty, selected');

  await tid(page, 'bb-done').click();
  await giveScrap(page, 40, 0);
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await openBuilder(page, 'PAST');
  await chooseSpot(page, 1);
  await tid(page, 'bb-weapon-ballista').click();
  await expect(tid(page, 'bb-status')).toContainText('You unlocked Ballista!');
  await expect(tid(page, 'bb-scrap')).toContainText('5');
  await expect(tid(page, 'bb-weapon-ballista')).toHaveAttribute('data-state', 'owned');
  await tid(page, 'bb-weapon-ballista').click();
  await expect(spotPad(page, 1)).toHaveAttribute('aria-label', 'Spot 1, ballista, selected');
  await expect(tid(page, 'bb-scrap')).toContainText('5');
});

test('weapons keyboard: Tab to a spot, Enter, arrows, Enter to mount, Delete to clear', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'FUTURE');
  await tid(page, 'bb-mode-weapons').click();
  await spotPad(page, 3).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(spotPad(page, 2)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(tid(page, 'bb-weapon-laser')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(tid(page, 'bb-weapon-missilePod')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(spotPad(page, 3)).toHaveAttribute('aria-label', 'Spot 3, missile pod, selected');
  await expect(tid(page, 'bb-weapon-missilePod')).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(spotPad(page, 3)).toHaveAttribute('aria-label', 'Spot 3, empty, selected');
  await expect(spotPad(page, 3)).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(tid(page, 'bb-weapon-panel')).toBeHidden();
  await expect(spotPad(page, 3)).toBeFocused();
});

for (const team of ['PAST', 'FUTURE'] as const) {
  test(`${team} builder looks right in Weapons mode`, async ({ page, browserName }) => {
    await toBuilderCamp(page);
    await giveScrap(page, 40, 40);
    await page.reload();
    await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
    await openBuilder(page, team);
    const set =
      team === 'PAST'
        ? ([
            ['long', 7, 10, 4, 1],
            ['long', 12, 10, 4, 1],
            ['tower', 7, 8, 1, 2],
            ['tower', 14, 8, 1, 2],
            ['wallTop', 9, 9, 3, 1],
            ['stone', 9, 8, 2, 1],
          ] as const)
        : ([
            ['beam', 7, 10, 4, 1],
            ['beam', 12, 10, 4, 1],
            ['antenna', 7, 8, 1, 2],
            ['solar', 9, 9, 3, 1],
            ['panel', 14, 9, 2, 1],
          ] as const);
    for (const [id, c, r, pw, ph] of set) await dragBrick(page, id, c, r, pw, ph);
    const weapons =
      team === 'PAST'
        ? (['cannon', 'catapult', 'archerPost'] as const)
        : (['laser', 'missilePod', 'turret'] as const);
    await tid(page, 'bb-mode-weapons').click();
    for (const [i, w] of weapons.entries()) {
      await spotPad(page, i + 1).click();
      await tid(page, `bb-weapon-${w}`).click();
    }
    await spotPad(page, 2).click();
    await expect(tid(page, 'bb-spots-chip')).toHaveText('Spots 3 of 4 used');
    await saveShot(page, browserName, `base-builder-weapons-${team.toLowerCase()}`);
  });
}
