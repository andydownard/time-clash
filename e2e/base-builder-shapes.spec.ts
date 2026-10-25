// "My shape": draw on the pad with materials, name the shape, save it, find it in the main bar
// (before the last "My shape" tile), drag it on, turn it, reload and see it. Delete it from the
// trash can in its tile after a Yes. The builder is behind ?builder=1 until the panel has reviewed it.
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
  const from = (await tile.boundingBox())!;
  const to = await cellPoint(page, col, row, w, h);
  // Press low on the tile, away from the trash can at its upper right.
  await page.mouse.move(from.x + from.width / 3, from.y + from.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** Saves `n` shapes for this side straight into storage, named One, Two, ... and reloads. */
async function seedShapes(page: Page, team: 'PAST' | 'FUTURE', n: number): Promise<void> {
  await page.evaluate(
    ([team, n]) => {
      const keys = [
        '10/10/11',
        'w1j',
        '111/0g0',
        'jj/jj',
        'g/g/g',
        '1w1/1w1',
        'wwww',
        '010/111/010',
      ];
      const words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
      const shapes = keys
        .slice(0, n as number)
        .map((k) => (team === 'FUTURE' ? k.replace(/w/g, 'm') : k));
      const shapeNames: Record<string, string> = {};
      shapes.forEach((k, i) => (shapeNames[k] = words[i]!));
      const raw = localStorage.getItem('timeclash.bases');
      const st = raw ? JSON.parse(raw) : { players: {} };
      const who = team === 'PAST' ? 'alex' : 'sam';
      const empty = () => ({ chosen: 0, slots: [null, null, null] });
      st.players[who] ??= { PAST: empty(), FUTURE: empty() };
      st.players[who][team as string] = { ...st.players[who][team as string], shapes, shapeNames };
      localStorage.setItem('timeclash.bases', JSON.stringify(st));
    },
    [team, n] as const,
  );
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

/** Nothing on the builder scrolls or sticks out, and the rails and the bar are whole. */
async function fits(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const s = document.querySelector<HTMLElement>('[data-screen="builder"]')!;
    if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1)
      out.push('screen');
    for (const sel of ['.tc-bb-rail', '.tc-bb-tools', '.tc-bb-tray', '.tc-bb-pad']) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el || el.hidden) continue;
      if (el.scrollHeight > el.clientHeight + 1) out.push(`${sel} cut`);
      const r = el.getBoundingClientRect();
      if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1) out.push(`${sel} off screen`);
    }
    return out;
  });
}

test('draw an L, save it, drag it on, turn it, reload and see it again', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await draw(page, L);
  await expect(tid(page, 'bb-pad-count')).toHaveText('4 of 12 squares');
  await expect(tid(page, 'bb-sq-3-2')).toHaveAttribute(
    'aria-label',
    'Square row 3 column 2, Stone',
  );
  await expect(tid(page, 'bb-pad-name')).toHaveValue('Shape 1');
  await tid(page, 'bb-pad-save').click();
  await expect(tid(page, 'bb-pad')).toBeHidden();
  await expect(tid(page, 'bb-shape-1')).toBeVisible();
  await expect(tid(page, 'bb-shape-1')).toHaveAttribute('aria-label', 'Shape 1');

  await dragShape(page, 1, 8, 8, 2, 3);
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

test('materials and a name: paint wood and glass, name it, find it in the bar, place it', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await draw(page, L);
  await tid(page, 'bb-mat-wood').click();
  await expect(tid(page, 'bb-mat-wood')).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'bb-sq-1-1').click();
  await tid(page, 'bb-mat-glass').click();
  await tid(page, 'bb-sq-3-2').click();
  await expect(tid(page, 'bb-sq-1-1')).toHaveAttribute('data-mat', 'wood');
  await expect(tid(page, 'bb-sq-3-2')).toHaveAttribute('data-mat', 'glass');
  await expect(tid(page, 'bb-pad-strength')).toHaveText('Strength 24');
  await tid(page, 'bb-pad-name').fill('Lookout');
  await tid(page, 'bb-pad-save').click();
  await expect(tid(page, 'bb-shape-1')).toHaveAttribute('aria-label', 'Lookout');
  await expect(tid(page, 'bb-shape-1')).toContainText('Lookout');
  // The saved shape sits right before "My shape", the last tile in the bar.
  const order = await tid(page, 'bb-tray').evaluate((el) =>
    [...el.children].map(
      (c) =>
        c.getAttribute('data-testid') ??
        c.querySelector('[data-testid]')?.getAttribute('data-testid'),
    ),
  );
  expect(order.slice(-2)).toEqual(['bb-shape-wrap-1', 'bb-own']);
  await dragShape(page, 1, 8, 8, 2, 3);
  await expect(bricks(page).first()).toHaveAttribute('data-piece', 'own:P:w0/10/1g');
  await expect(tid(page, 'bb-status')).toHaveText('Lookout placed.');
});

test('a bad drawing says why, and the trash can deletes after a Yes', async ({ page }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await draw(page, [
    [1, 1],
    [3, 3],
  ]);
  await expect(tid(page, 'bb-pad-msg')).toHaveText('Squares must touch side to side.');
  await expect(tid(page, 'bb-pad-save')).toHaveAttribute('aria-disabled', 'true');
  await tid(page, 'bb-sq-2-2').click();
  await expect(tid(page, 'bb-pad-msg')).toHaveText('Squares must touch side to side.');
  await tid(page, 'bb-sq-2-1').click();
  await tid(page, 'bb-sq-3-2').click();
  // (1,1) (2,1) (2,2) (3,2) (3,3) is one connected group of five.
  await expect(tid(page, 'bb-pad-msg')).toHaveText('Looks good. Tap Save shape.');
  await tid(page, 'bb-pad-save').click();
  await expect(tid(page, 'bb-shape-1')).toBeVisible();

  // The trash can is a 56px button inside the tile's upper right corner.
  const tile = (await tid(page, 'bb-shape-wrap-1').boundingBox())!;
  const can = (await tid(page, 'bb-shape-del-1').boundingBox())!;
  expect(can.width).toBeGreaterThanOrEqual(56);
  expect(can.height).toBeGreaterThanOrEqual(56);
  expect(Math.abs(can.x + can.width - (tile.x + tile.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(can.y - tile.y)).toBeLessThanOrEqual(1);

  await tid(page, 'bb-shape-del-1').click();
  await expect(tid(page, 'bb-shape-ask-1')).toBeVisible();
  await expect(tid(page, 'bb-shape-no-1')).toBeFocused();
  for (const id of ['bb-shape-yes-1', 'bb-shape-no-1']) {
    const b = (await tid(page, id).boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(56);
    expect(b.height).toBeGreaterThanOrEqual(56);
  }
  await tid(page, 'bb-shape-no-1').click();
  await expect(tid(page, 'bb-shape-ask-1')).toBeHidden();
  await expect(tid(page, 'bb-shape-1')).toBeVisible();
  await tid(page, 'bb-shape-del-1').click();
  await tid(page, 'bb-shape-yes-1').click();
  await expect(tid(page, 'bb-shape-1')).toHaveCount(0);
  await expect(tid(page, 'bb-own')).toBeFocused();
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
  test(`${team}: 0, 3 and 8 saved shapes, the pad and the delete question all fit`, async ({
    page,
    browserName,
  }) => {
    const side = team.toLowerCase();
    await toBuilderCamp(page);
    for (const n of [0, 3, 8]) {
      await seedShapes(page, team, n);
      await openBuilder(page, team);
      await expect(page.locator('.tc-bb-mine')).toHaveCount(n);
      await expect(tid(page, 'bb-own')).toBeInViewport({ ratio: 1 });
      expect(await fits(page)).toEqual([]);
      await saveShot(page, browserName, `base-builder-shapes-${n}-${side}`);
      if (n === 8) {
        await tid(page, 'bb-shape-del-3').click();
        await expect(tid(page, 'bb-shape-ask-3')).toBeInViewport({ ratio: 1 });
        await saveShot(page, browserName, `base-builder-shapes-delete-${side}`);
        await tid(page, 'bb-shape-no-3').click();
        await tid(page, 'bb-own').click();
        await tid(page, `bb-mat-${team === 'PAST' ? 'wood' : 'metal'}`).click();
        await tid(page, 'bb-sq-1-2').click();
        await tid(page, 'bb-sq-2-2').click();
        await tid(page, 'bb-mat-glass').click();
        await tid(page, 'bb-sq-3-3').click();
        await tid(page, 'bb-mat-jelly').click();
        await tid(page, 'bb-sq-4-3').click();
        await expect(tid(page, 'bb-sq-6-6')).toBeInViewport({ ratio: 1 });
        await expect(tid(page, 'bb-pad-save')).toBeInViewport({ ratio: 1 });
        expect(await fits(page)).toEqual([]);
        await saveShot(page, browserName, `base-builder-shapes-pad-${side}`);
        await tid(page, 'bb-pad-close').click();
      }
      await tid(page, 'bb-back').click();
    }
  });
}

test.describe('iPad mini (1133 by 744)', () => {
  test.use({ viewport: { width: 1133, height: 744 } });
  test('8 saved shapes, the pad and the delete question fit', async ({ page }, info) => {
    test.skip(!info.project.name.endsWith('1280x800'), 'One extra size, run once per browser');
    await toBuilderCamp(page);
    await seedShapes(page, 'PAST', 8);
    await openBuilder(page, 'PAST');
    expect(await fits(page)).toEqual([]);
    await tid(page, 'bb-shape-del-8').click();
    await expect(tid(page, 'bb-shape-ask-8')).toBeInViewport({ ratio: 1 });
    await tid(page, 'bb-shape-no-8').click();
    await tid(page, 'bb-own').click();
    await expect(tid(page, 'bb-sq-6-6')).toBeInViewport({ ratio: 1 });
    expect(await fits(page)).toEqual([]);
  });
});
