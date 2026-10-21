// "Make your own": draw an L on the pad, save it, drag it onto the plot, turn it, reload and see it.
// The builder is behind ?builder=1 until the panel has reviewed it.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bricks, cellPoint, openBuilder, toBuilderCamp } from './support/builder';
import { tid } from './support/game';
import { saveShot } from './support/shots';

/** Empties the pad, then fills these squares (row, column, counted from 1). */
async function draw(page: Page, squares: Array<[number, number]>): Promise<void> {
  await tid(page, 'bb-own').click();
  await expect(tid(page, 'bb-pad')).toBeVisible();
  await tid(page, 'bb-pad-clear').click();
  for (const [r, c] of squares) await tid(page, `bb-sq-${r}-${c}`).click();
}

const L: Array<[number, number]> = [
  [1, 1],
  [2, 1],
  [3, 1],
  [3, 2],
];

/** Drags a saved shape tile with the mouse so the middle of its box lands on cell (col, row). */
async function dragShape(page: Page, n: number, col: number, row: number, w: number, h: number) {
  const tile = tid(page, `bb-shape-${n}`);
  await tile.scrollIntoViewIfNeeded();
  const from = (await tile.boundingBox())!;
  const to = await cellPoint(page, col, row, w, h);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

test('draw an L, save it, drag it on, turn it, reload and see it again', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await draw(page, L);
  await expect(tid(page, 'bb-pad-count')).toHaveText('4 of 8 squares');
  await expect(tid(page, 'bb-sq-3-2')).toHaveAttribute(
    'aria-label',
    'Square row 3 column 2, filled',
  );
  await tid(page, 'bb-pad-save').click();
  await expect(tid(page, 'bb-pad')).toBeHidden();
  await expect(tid(page, 'bb-shape-1')).toBeVisible();

  await dragShape(page, 1, 8, 7, 2, 3);
  await expect(bricks(page)).toHaveCount(1);
  await expect(bricks(page).first()).toHaveAttribute('data-piece', /^own:P:/);
  await tid(page, 'bb-turn').click();
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);

  await tid(page, 'bb-done').click();
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await openBuilder(page, 'PAST');
  await expect(bricks(page)).toHaveCount(1);
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);
  await expect(tid(page, 'bb-shape-1')).toBeVisible();
});

test('a bad drawing says why, and a saved shape can be deleted after asking', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await draw(page, [
    [1, 1],
    [3, 3],
  ]);
  await expect(tid(page, 'bb-pad-msg')).toHaveText('Squares must touch.');
  await expect(tid(page, 'bb-pad-save')).toHaveAttribute('aria-disabled', 'true');
  await tid(page, 'bb-sq-2-2').click();
  await expect(tid(page, 'bb-pad-msg')).toHaveText('Squares must touch.');
  await tid(page, 'bb-sq-2-1').click();
  await tid(page, 'bb-sq-3-2').click();
  // (1,1) (2,1) (2,2) (3,2) (3,3) is one connected group of five.
  await expect(tid(page, 'bb-pad-msg')).toHaveText('Looks good. Tap Save shape.');
  await tid(page, 'bb-pad-save').click();
  await expect(tid(page, 'bb-shape-1')).toBeVisible();
  await tid(page, 'bb-shape-del-1').click();
  await expect(tid(page, 'bb-clear-yes')).toBeVisible();
  await tid(page, 'bb-clear-no').click();
  await expect(tid(page, 'bb-shape-1')).toBeVisible();
  await tid(page, 'bb-shape-del-1').click();
  await tid(page, 'bb-clear-yes').click();
  await expect(tid(page, 'bb-shape-1')).toHaveCount(0);
});

test('keyboard: arrows move over the pad, Space fills, Enter saves', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'FUTURE');
  await tid(page, 'bb-own').focus();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'bb-sq-1-1')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tid(page, 'bb-sq-1-2')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(tid(page, 'bb-sq-1-2')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(tid(page, 'bb-pad')).toBeHidden();
  await expect(tid(page, 'bb-shape-1')).toBeFocused();
});

for (const team of ['PAST', 'FUTURE'] as const) {
  test(`${team} pad and a base with a shape of your own look right`, async ({
    page,
    browserName,
  }) => {
    await toBuilderCamp(page);
    await openBuilder(page, team);
    await tid(page, 'bb-own').click();
    await saveShot(page, browserName, `base-builder-shapes-pad-${team.toLowerCase()}`);
    await tid(page, 'bb-pad-save').click();
    await tid(page, 'bb-own').click();
    await tid(page, 'bb-pad-clear').click();
    for (const [r, c] of [
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 2],
    ] as const)
      await tid(page, `bb-sq-${r}-${c}`).click();
    await tid(page, 'bb-pad-save').click();
    await dragShape(page, 1, 6, 8, 2, 3);
    await dragShape(page, 2, 12, 9, 3, 2);
    await expect(bricks(page)).toHaveCount(2);
    await saveShot(page, browserName, `base-builder-shapes-${team.toLowerCase()}`);
    // The tray fits: nothing sticks out past the screen.
    const overflow = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-screen="builder"]')!;
      return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
}
