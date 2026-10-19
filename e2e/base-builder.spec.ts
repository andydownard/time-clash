// Base builder: drag bricks onto the plot, turn, undo, keep three saved bases, and see the chosen
// base again after a reload. The builder is behind ?builder=1 until the panel has reviewed it.
import { expect, test } from './fixtures';
import { bricks, cellPoint, dragBrick, openBuilder, toBuilderCamp } from './support/builder';
import { giveScrap } from './support/camp';
import { tid } from './support/game';
import { saveShot } from './support/shots';

test('the Camp has no Build buttons unless the builder is switched on', async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__timeclash));
  await expect(tid(page, 'camp-build-PAST')).toHaveCount(0);
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
