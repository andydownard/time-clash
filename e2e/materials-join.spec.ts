// Same-material squares join: in the My shape pad, in a saved shape tile, on the plot, and in
// battle. No seam or border between neighbours of one material; only the outer edge is outlined.
// Screenshots (UPDATE_SCREENSHOTS=1) are written at 1280x800 and 1024x768.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { chooseSlot, freshBases, saveSlot } from '../src/game/baseBuilder';
import { TYPICAL } from '../tests/helpers/builtBases';
import { bricks, dragBrick, openBuilder, toBuilderCamp } from './support/builder';
import { FUTURE_SIDE, PAST_SIDE, readyUp, snap, startMatch, tid, toSetup } from './support/game';
import { saveShot } from './support/shots';

/** Empties the pad, then fills these squares (row, column, counted from 1). */
async function draw(page: Page, squares: Array<[number, number]>): Promise<void> {
  await tid(page, 'bb-own').click();
  await expect(tid(page, 'bb-pad')).toBeVisible();
  await tid(page, 'bb-pad-clear').click();
  for (const [r, c] of squares) await tid(page, `bb-sq-${r}-${c}`).click();
}

/** A block of nine, rows 1 to 3 and columns 1 to 3. A wood column of three goes beside it. */
const BLOCK: Array<[number, number]> = [];
for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) BLOCK.push([r, c]);

test('My shape: a block of stone is one picture with one outline, and wood beside it is its own', async ({
  page,
  browserName,
}) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await draw(page, BLOCK);
  const art = page.locator('.tc-bb-pad-art');
  // 9 squares: the 1 inside one has no outline at all, the 8 round the edge have one path each.
  await expect(art.locator('rect')).toHaveCount(0);
  await expect(art.locator('path[stroke="#12102b"][stroke-width="4"]')).toHaveCount(8);
  // The seam between two stone squares is not drawn: no outline path has a vertical run on the
  // inside of the block (x = 40 or 80 in picture units).
  const inside = await art.evaluate((svg) =>
    [...svg.querySelectorAll('path[stroke="#12102b"][stroke-width="4"]')]
      .map((p) => p.getAttribute('d') ?? '')
      .filter((d) => /M(40|80),[\d.]+ V/.test(d)).length,
  );
  expect(inside).toBe(0);
  // Every square is still a 56px-or-bigger tap target and still reports it is filled.
  const sq = await tid(page, 'bb-sq-2-2').boundingBox();
  expect(sq!.width).toBeGreaterThanOrEqual(56);
  await expect(tid(page, 'bb-sq-2-2')).toHaveAttribute('aria-pressed', 'true');

  await tid(page, 'bb-mat-wood').click();
  for (const r of [1, 2, 3]) await tid(page, `bb-sq-${r}-4`).click();
  await expect(art.locator('rect')).toHaveCount(0);
  // The wood column keeps its own outline next to the stone: its west side is drawn.
  await expect(tid(page, 'bb-sq-2-4')).toHaveAttribute('data-mat', 'wood');
  await saveShot(page, browserName, 'my-shape-joined');

  await tid(page, 'bb-pad-save').click();
  await expect(tid(page, 'bb-shape-1')).toBeVisible();
  // The saved tile joins too.
  await expect(tid(page, 'bb-shape-1').locator('rect')).toHaveCount(0);
});

test('two bricks of one material side by side join on the plot', async ({ page, browserName }) => {
  await toBuilderCamp(page);
  await openBuilder(page, 'PAST');
  await dragBrick(page, 'stone', 6, 10, 2, 1);
  await dragBrick(page, 'stone', 8, 10, 2, 1);
  await expect(bricks(page)).toHaveCount(2);
  // The first brick's east side and the second's west side are not outlined.
  const verticalRuns = await page.evaluate(() =>
    [...document.querySelectorAll('.tc-bb-piece')].map(
      (g) =>
        [...g.querySelectorAll('path[stroke="#12102b"][stroke-width="4"]')]
          .map((p) => p.getAttribute('d') ?? '')
          .filter((d) => /M320,[\d.]+ V/.test(d)).length,
    ),
  );
  expect(verticalRuns).toEqual([0, 0]);
  // A brick of another material beside them keeps its own outline.
  await dragBrick(page, 'plank', 10, 10, 3, 1);
  await expect(bricks(page)).toHaveCount(3);
  await saveShot(page, browserName, 'bricks-joined');
});

test('in battle, touching bricks of one material are drawn as one piece', async ({
  page,
  browserName,
}) => {
  await toSetup(page);
  let st = freshBases();
  st = saveSlot(st, PAST_SIDE.name, 'PAST', 0, TYPICAL('PAST').pieces);
  st = chooseSlot(st, PAST_SIDE.name, 'PAST', 0);
  st = saveSlot(st, FUTURE_SIDE.name, 'FUTURE', 0, TYPICAL('FUTURE').pieces);
  st = chooseSlot(st, FUTURE_SIDE.name, 'FUTURE', 0);
  await startMatch(page, PAST_SIDE, FUTURE_SIDE, 4242, async () => {
    await page.evaluate((s) => localStorage.setItem('timeclash.bases', JSON.stringify(s)), st);
  });
  await readyUp(page);
  const m = await snap(page);
  const want = Object.values(m.bricks!).filter((b) => b.team === 'PAST').length;
  await expect
    .poll(async () => (await page.evaluate(() => window.__timeclash!.bricks()))[0]?.drawn, {
      timeout: 15_000,
    })
    .toBe(want);
  // The row of six stone bricks is joined: bricks with a neighbour use their own pictures.
  const layers = await page.evaluate(() => window.__timeclash!.bricks());
  expect(layers.find((l) => l.team === 'PAST')!.joined).toBeGreaterThanOrEqual(5);
  expect(layers.find((l) => l.team === 'FUTURE')!.joined).toBeGreaterThanOrEqual(5);
  await saveShot(page, browserName, 'bricks-joined-battle');
});
