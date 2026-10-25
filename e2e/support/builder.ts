// Helpers for the base builder specs: reach the Camp with the builder on, and drag bricks by cell.
import type { Page } from '@playwright/test';
import { expect } from '../fixtures';
import { FUTURE_SIDE, PAST_SIDE, fillTeam, tid, toSetup } from './game';
import './globals';

/** The plot picture is 24 by 12 cells of 40 units, fitted inside its box and centered. */
const COLS = 24;
const ROWS = 12;

/** First visit with the builder switched on (?builder=1): Setup, then the Camp. */
export async function toBuilderCamp(page: Page): Promise<void> {
  await toSetup(page, '&builder=1');
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

/** Screen point at the middle of a cell-sized box whose top-left is cell (col, row). */
export async function cellPoint(
  page: Page,
  col: number,
  row: number,
  w = 1,
  h = 1,
): Promise<{ x: number; y: number }> {
  const box = await tid(page, 'bb-plot').boundingBox();
  if (!box) throw new Error('no plot');
  const scale = Math.min(box.width / (COLS * 40), box.height / (ROWS * 40));
  const offX = (box.width - COLS * 40 * scale) / 2;
  const offY = (box.height - ROWS * 40 * scale) / 2;
  return {
    x: box.x + offX + (col + w / 2) * 40 * scale,
    y: box.y + offY + (row + h / 2) * 40 * scale,
  };
}

/** Drags a tray brick with the mouse and drops it so its top-left sits at cell (col, row). */
export async function dragBrick(
  page: Page,
  piece: string,
  col: number,
  row: number,
  w: number,
  h: number,
): Promise<void> {
  const from = await tid(page, `bb-brick-${piece}`).boundingBox();
  if (!from) throw new Error('no brick');
  const to = await cellPoint(page, col, row, w, h);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** Open the builder from the Camp, then pick the side with its Past and Future choice. */
export async function openBuilder(page: Page, team: 'PAST' | 'FUTURE'): Promise<void> {
  await tid(page, 'camp-build').click();
  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  // Build Base opens on Team Past. The picker inside it switches sides.
  if (team === 'FUTURE') await tid(page, 'bb-team-FUTURE').click();
  await expect(page.locator(`[data-screen="builder"][data-team="${team}"]`)).toBeVisible();
}

export const bricks = (page: Page) => page.locator('.tc-bb-piece');

/** A weapon pad by its number (1 to 4). Only Weapons mode makes the pads buttons. */
export const spotPad = (page: Page, n: number) => page.locator(`.tc-bb-spot[data-spot="${n - 1}"]`);

/** Switch to Weapons mode and choose a spot. Pass `tap` to use the touchscreen. */
export async function chooseSpot(page: Page, n: number, tap = false): Promise<void> {
  const mode = tid(page, 'bb-mode-weapons');
  if (tap) await mode.tap();
  else await mode.click();
  await expect(mode).toHaveAttribute('aria-pressed', 'true');
  if (tap) await spotPad(page, n).tap();
  else await spotPad(page, n).click();
  await expect(tid(page, 'bb-weapon-panel')).toBeVisible();
}
