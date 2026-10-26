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

/** The plot picture on screen without its frame (the part that is a place to build). */
export async function plotInner(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return tid(page, 'bb-plot').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const l = parseFloat(cs.borderLeftWidth) || 0;
    const t = parseFloat(cs.borderTopWidth) || 0;
    return {
      x: r.left + l,
      y: r.top + t,
      width: r.width - l - (parseFloat(cs.borderRightWidth) || 0),
      height: r.height - t - (parseFloat(cs.borderBottomWidth) || 0),
    };
  });
}

/** The lowest row a one-high brick can use: it stands on the foundation there. */
export const GROUND_ROW = ROWS - 2;

/** Screen point at the middle of a cell-sized box whose top-left is cell (col, row). */
export async function cellPoint(
  page: Page,
  col: number,
  row: number,
  w = 1,
  h = 1,
): Promise<{ x: number; y: number }> {
  const box = await plotInner(page);
  const scale = Math.min(box.width / (COLS * 40), box.height / (ROWS * 40));
  const offX = (box.width - COLS * 40 * scale) / 2;
  const offY = (box.height - ROWS * 40 * scale) / 2;
  return {
    x: box.x + offX + (col + w / 2) * 40 * scale,
    y: box.y + offY + (row + h / 2) * 40 * scale,
  };
}

/** Mouse drag from one point to another, in small steps like a hand. */
export async function mouseDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** The middle of an element with this test id. */
export async function middleOf(page: Page, testId: string): Promise<{ x: number; y: number }> {
  const b = await tid(page, testId).boundingBox();
  if (!b) throw new Error(`no ${testId}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * A real finger slide in Chromium: touch start, moves and end through the DevTools protocol, so
 * the browser makes the pointer events itself (as an iPad does). `hold` keeps the finger down at
 * the end so a test can look at the drag ghost before letting go.
 */
export async function fingerSlide(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: { hold?: boolean } = {},
): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, pts: Array<{ x: number; y: number }>) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts } as never);
  await send('touchStart', [from]);
  for (let i = 1; i <= 8; i++) {
    await send('touchMove', [
      { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 },
    ]);
  }
  const lift = async (): Promise<void> => {
    await send('touchEnd', []);
    await cdp.detach();
  };
  if (!opts.hold) await lift();
  return lift;
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

/** Saves `n` shapes for this side straight into storage, named One, Two, ... and reloads. */
export async function seedShapes(page: Page, team: 'PAST' | 'FUTURE', n: number): Promise<void> {
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
