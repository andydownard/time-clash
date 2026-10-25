// Base builder: drag bricks onto the plot, turn, undo, keep three saved bases, and see the chosen
// base again after a reload.
import { expect, test } from './fixtures';
import {
  GROUND_ROW,
  bricks,
  cellPoint,
  chooseSpot,
  dragBrick,
  middleOf,
  mouseDrag,
  openBuilder,
  plotInner,
  spotPad,
  toBuilderCamp,
} from './support/builder';
import { giveScrap } from './support/camp';
import { tid } from './support/game';
import { saveShot } from './support/shots';

test('there is one Build Base button, no pictures of the bases, and a Past and Future picker inside', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await expect(tid(page, 'camp-upgrade')).toHaveCount(0);
  await expect(tid(page, 'camp-build')).toHaveText('Build Base');
  await expect(page.locator('.tc-camp-base')).toHaveCount(0);
  await tid(page, 'camp-build').click();
  await expect(page.locator('[data-screen="builder"][data-team="PAST"]')).toBeVisible();
  await expect(page.locator('[data-screen="upgrade"]')).toHaveCount(0);
  await tid(page, 'bb-team-FUTURE').click();
  await expect(page.locator('[data-screen="builder"][data-team="FUTURE"]')).toBeVisible();
  await expect(tid(page, 'bb-team-FUTURE')).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'bb-team-PAST').click();
  await expect(page.locator('[data-screen="builder"][data-team="PAST"]')).toBeVisible();
});

test('drag, turn, undo, save to slot 2, reload and see the base again', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await expect(tid(page, 'bb-slot-1')).toHaveAttribute('aria-pressed', 'true');
  await tid(page, 'bb-slot-2').click();
  await expect(tid(page, 'bb-slot-2')).toHaveAttribute('aria-pressed', 'true');

  await dragBrick(page, 'stone', 6, 10, 2, 1);
  await expect(bricks(page)).toHaveCount(1);
  await tid(page, 'bb-turn').click();
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);

  await dragBrick(page, 'tower', 12, 9, 1, 2);
  await expect(bricks(page)).toHaveCount(2);
  await tid(page, 'bb-undo').click();
  await expect(bricks(page)).toHaveCount(1);
  await dragBrick(page, 'tower', 12, 9, 1, 2);
  await expect(bricks(page)).toHaveCount(2);

  await tid(page, 'bb-done').click();

  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
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

  await dragBrick(page, 'stone', 4, 10, 2, 1);
  await expect(bricks(page)).toHaveCount(1);
  const at = await cellPoint(page, 4, 10, 2, 1);
  const tray = await tid(page, 'bb-brick-plank').boundingBox();
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(tray!.x + 30, tray!.y + 30, { steps: 6 });
  await page.mouse.up();
  await expect(bricks(page)).toHaveCount(0);
});

test('support: mid-air is refused, a second layer works, and the bottom brick stays put', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  // Carry a stone into the sky: the outline turns pink and dashed, and the reason shows.
  const from = await middleOf(page, 'bb-brick-stone');
  const sky = await cellPoint(page, 6, 3, 2, 1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(sky.x, sky.y, { steps: 8 });
  await expect(page.locator('.tc-bb-drop')).toHaveAttribute('data-ok', 'false');
  await expect(tid(page, 'bb-status')).toHaveText('Build on something that touches the ground.');
  await page.mouse.up();
  await expect(bricks(page)).toHaveCount(0);
  await expect(tid(page, 'bb-status')).toHaveText('Build on something that touches the ground.');

  // A first layer on the ground, and a second layer on top of it.
  await dragBrick(page, 'stone', 6, GROUND_ROW, 2, 1);
  await dragBrick(page, 'stone', 6, GROUND_ROW - 1, 2, 1);
  await expect(bricks(page)).toHaveCount(2);
  const bottom = bricks(page).first();
  await expect(bottom).toHaveAttribute('aria-label', /column 7, row 11\./);

  // Dragging the bottom one to the tray is refused: something sits on it.
  const at = await cellPoint(page, 6, GROUND_ROW, 2, 1);
  await mouseDrag(page, at, await middleOf(page, 'bb-brick-plank'));
  await expect(bricks(page)).toHaveCount(2);
  await expect(tid(page, 'bb-status')).toHaveText(
    'Something is sitting on that brick. Take the top one off first.',
  );
  // Dragging it along the ground is refused too, and it stays where it was.
  await mouseDrag(page, at, await cellPoint(page, 15, GROUND_ROW, 2, 1));
  await expect(bottom).toHaveAttribute('aria-label', /column 7, row 11\./);
  await expect(tid(page, 'bb-status')).toHaveText(
    'Something is sitting on that brick. Take the top one off first.',
  );
  // Take the top one off first, then the bottom one comes off.
  await mouseDrag(
    page,
    await cellPoint(page, 6, GROUND_ROW - 1, 2, 1),
    await middleOf(page, 'bb-brick-plank'),
  );
  await expect(bricks(page)).toHaveCount(1);
  await mouseDrag(page, at, await middleOf(page, 'bb-brick-plank'));
  await expect(bricks(page)).toHaveCount(0);
});

test('tap to pick, then tap the plot; a placed brick drags and a tap chooses it', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'FUTURE');
  // Tap Antenna, then a spot in the sky: refused, and Antenna stays picked.
  await tid(page, 'bb-brick-antenna').click();
  await expect(tid(page, 'bb-brick-antenna')).toHaveAttribute('aria-pressed', 'true');
  const sky = await cellPoint(page, 3, 2, 1, 2);
  await page.mouse.click(sky.x, sky.y);
  await expect(bricks(page)).toHaveCount(0);
  await expect(tid(page, 'bb-status')).toHaveText('Build on something that touches the ground.');
  await expect(tid(page, 'bb-brick-antenna')).toHaveAttribute('aria-pressed', 'true');
  // Before the click, the mouse shows where it would go.
  const spot = await cellPoint(page, 3, GROUND_ROW - 1, 1, 2);
  await page.mouse.move(spot.x, spot.y);
  await expect(page.locator('.tc-bb-drop')).toHaveAttribute('data-ok', 'true');
  await page.mouse.click(spot.x, spot.y);
  await expect(bricks(page)).toHaveCount(1);
  await expect(bricks(page).first()).toHaveAttribute('aria-label', /Antenna, column 4, row 10\./);
  await expect(tid(page, 'bb-brick-antenna')).toHaveAttribute('aria-pressed', 'false');

  // Drag the placed antenna somewhere else on the ground.
  await mouseDrag(page, spot, await cellPoint(page, 15, GROUND_ROW - 1, 1, 2));
  await expect(bricks(page).first()).toHaveAttribute('aria-label', /column 16, row 10\./);
  // Dropped in mid-air, it goes back where it was.
  await mouseDrag(
    page,
    await cellPoint(page, 15, GROUND_ROW - 1, 1, 2),
    await cellPoint(page, 10, 2, 1, 2),
  );
  await expect(bricks(page).first()).toHaveAttribute('aria-label', /column 16, row 10\./);
  // A plain tap chooses it, so Turn works on it.
  const now = await cellPoint(page, 15, GROUND_ROW - 1, 1, 2);
  await page.mouse.click(now.x, now.y);
  await expect(page.locator('.tc-bb-select')).toHaveCount(1);
  await tid(page, 'bb-turn').click();
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);

  // Team Past works the same way: tap Stone, tap the ground.
  await tid(page, 'bb-team-PAST').click();
  await expect(page.locator('[data-screen="builder"][data-team="PAST"]')).toBeVisible();
  await tid(page, 'bb-brick-stone').click();
  const ground = await cellPoint(page, 2, GROUND_ROW, 2, 1);
  await page.mouse.click(ground.x, ground.y);
  await expect(bricks(page)).toHaveCount(1);
});

test('the whole plot is a place to build: all four corners, and a drop past the edge lands', async ({
  page,
  browserName,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  const right = 23;
  // Bottom corners, dropped a little past the plot's left and right edges.
  const inner = await plotInner(page);
  const groundY = (await cellPoint(page, 0, GROUND_ROW, 1, 2)).y;
  const from = await middleOf(page, 'bb-brick-tower');
  await mouseDrag(page, from, { x: inner.x - 10, y: groundY - 10 });
  await mouseDrag(page, from, { x: inner.x + inner.width + 10, y: groundY - 10 });
  await expect(bricks(page)).toHaveCount(2);
  await expect(bricks(page).nth(0)).toHaveAttribute('aria-label', /column 1, row 10\./);
  await expect(bricks(page).nth(1)).toHaveAttribute('aria-label', /column 24, row 10\./);
  // Stack towers up both sides to the top row.
  for (const row of [7, 5, 3, 1]) {
    await dragBrick(page, 'tower', 0, row, 1, 2);
    await dragBrick(page, 'tower', right, row, 1, 2);
  }
  // A stone on each top tower reaches the very top row, in both top corners.
  await dragBrick(page, 'stone', 0, 0, 2, 1);
  await dragBrick(page, 'stone', right - 1, 0, 2, 1);
  await expect(bricks(page)).toHaveCount(12);
  const labels = await bricks(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label')),
  );
  expect(labels.some((l) => /Stone, column 1, row 1\./.test(l ?? ''))).toBe(true);
  expect(labels.some((l) => /Stone, column 23, row 1\./.test(l ?? ''))).toBe(true);
  // Nothing covers the plot: the rails sit beside it, level with its top.
  const rail = (await tid(page, 'bb-rail').boundingBox())!;
  const tools = (await page.locator('.tc-bb-tools').boundingBox())!;
  expect(rail.x + rail.width).toBeLessThanOrEqual(inner.x);
  expect(tools.x).toBeGreaterThanOrEqual(inner.x + inner.width);
  expect(Math.abs(rail.y - (inner.y - 6))).toBeLessThanOrEqual(8);
  await saveShot(page, browserName, 'base-builder-corners');
});

test('the rails fit with no overlap on an iPad mini (1133 by 744)', async ({ page }) => {
  await page.setViewportSize({ width: 1133, height: 744 });
  await toBuilderCamp(page);
  await openBuilder(page, 'FUTURE');
  const inner = await plotInner(page);
  const rail = (await tid(page, 'bb-rail').boundingBox())!;
  expect(rail.x + rail.width).toBeLessThanOrEqual(inner.x);
  for (const id of ['bb-team-PAST', 'bb-team-FUTURE', 'bb-mode-build', 'bb-mode-weapons']) {
    const b = (await tid(page, id).boundingBox())!;
    expect(b.height, id).toBeGreaterThanOrEqual(56);
    expect(b.y + b.height, id).toBeLessThanOrEqual(rail.y + rail.height);
  }
  const count = (await tid(page, 'bb-spots-chip').boundingBox())!;
  expect(count.y + count.height).toBeLessThanOrEqual(rail.y + rail.height);
  const overflow = await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('[data-screen="builder"]')!;
    return s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1;
  });
  expect(overflow).toBe(false);
});

test('Clear asks first, and bricks never overlap', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await dragBrick(page, 'long', 4, 10, 4, 1);
  // Dropped on top of the long brick: it lands on the nearest free spot instead.
  await dragBrick(page, 'long', 4, 10, 4, 1);
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
  await expect(tid(page, 'bb-status')).toHaveText('Not enough Scrap yet. You need 3 more.');
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
  await expect(tid(page, 'bb-status')).toHaveText('Not enough Scrap yet. You need 15 more.');
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
