// Base builder with a finger on an iPad-sized screen (WebKit, 1024x768). Playwright cannot drag
// with a real touch in WebKit, so the drag is sent as touch pointer events (the same events a
// finger makes) and the taps use the real touchscreen.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bricks, cellPoint, chooseSpot, spotPad, toBuilderCamp } from './support/builder';
import { giveScrap } from './support/camp';
import { tid } from './support/game';

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });
test.beforeEach(({ browserName }, info) => {
  test.skip(
    browserName !== 'webkit' || info.project.name !== 'webkit-1024x768',
    'The touch check runs once, in WebKit at 1024x768',
  );
});

type P = { x: number; y: number };

/** A finger press, slide and lift, as pointer events. The press lands on `from`. */
async function touchDrag(page: Page, from: string, via: P[], pointerId = 7): Promise<void> {
  await page.evaluate(
    ([selector, path, id]) => {
      const el = document.querySelector(selector as string)!;
      const pts = path as P[];
      const fire = (target: EventTarget, type: string, p: P): void => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: id as number,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: p.x,
            clientY: p.y,
          }),
        );
      };
      fire(el, 'pointerdown', pts[0]!);
      for (const p of pts.slice(1, -1)) fire(document, 'pointermove', p);
      fire(document, 'pointerup', pts[pts.length - 1]!);
    },
    [from, via, pointerId] as const,
  );
}

async function center(page: Page, testId: string): Promise<P> {
  const b = (await tid(page, testId).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function fingerDrop(
  page: Page,
  piece: string,
  col: number,
  row: number,
  w: number,
  h: number,
) {
  const start = await center(page, `bb-brick-${piece}`);
  const end = await cellPoint(page, col, row, w, h);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  await touchDrag(page, `[data-testid="bb-brick-${piece}"]`, [start, mid, end, end]);
}

test('touch: drag a brick on, turn, undo, save to slot 2, reload and see it again', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await page.getByTestId('camp-build-PAST').tap();
  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  await tid(page, 'bb-slot-2').tap();
  await expect(tid(page, 'bb-slot-2')).toHaveAttribute('aria-pressed', 'true');

  await fingerDrop(page, 'stone', 6, 9, 2, 1);
  await expect(bricks(page)).toHaveCount(1);
  await tid(page, 'bb-turn').tap();
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);

  await fingerDrop(page, 'tower', 12, 8, 1, 2);
  await expect(bricks(page)).toHaveCount(2);
  await tid(page, 'bb-undo').tap();
  await expect(bricks(page)).toHaveCount(1);
  await fingerDrop(page, 'tower', 12, 8, 1, 2);
  await expect(bricks(page)).toHaveCount(2);

  // A finger drag that ends off the plot puts the brick back.
  const before = await bricks(page).count();
  const start = await center(page, 'bb-brick-plank');
  await touchDrag(page, '[data-testid="bb-brick-plank"]', [start, { x: 5, y: 5 }, { x: 5, y: 5 }]);
  await expect(bricks(page)).toHaveCount(before);

  await tid(page, 'bb-done').tap();
  await expect(tid(page, 'camp-base-PAST')).toHaveAttribute('data-bricks', '2');
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('camp-build-PAST').tap();
  await expect(tid(page, 'bb-slot-2')).toHaveAttribute('aria-pressed', 'true');
  await expect(bricks(page)).toHaveCount(2);
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);
});

test('touch: every tool and tray brick is at least 56px, and text is at least 20px', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await page.getByTestId('camp-build-FUTURE').tap();
  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-screen="builder"] button')) {
      const r = el.getBoundingClientRect();
      // The Clear question is hidden until Clear is tapped.
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 56 || r.height < 56) out.push(`${el.dataset.testid}: ${r.width}x${r.height}`);
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (el.textContent?.trim() && fs < 20) out.push(`${el.dataset.testid}: font ${fs}`);
    }
    for (const el of document.querySelectorAll<HTMLElement>(
      '[data-screen="builder"] .tc-bb-hint, [data-screen="builder"] .tc-bb-scrap, [data-screen="builder"] .tc-bb-brick-name',
    )) {
      if (parseFloat(getComputedStyle(el).fontSize) < 20) out.push(`${el.className}: small font`);
    }
    return out;
  });
  expect(small).toEqual([]);
  const box = await page.locator('[data-screen="builder"]').boundingBox();
  const overflow = await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('[data-screen="builder"]')!;
    return s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1;
  });
  expect(overflow).toBe(false);
  expect(box!.width).toBe(1024);
});

test('touch: tap Weapons, tap spot 2, tap a weapon, reload, and it is still there', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await giveScrap(page, 10, 0);
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('camp-build-PAST').tap();
  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  await chooseSpot(page, 2, true);
  await tid(page, 'bb-weapon-archerPost').tap();
  await expect(spotPad(page, 2)).toHaveAttribute('aria-label', 'Spot 2, archer post, selected');
  // A locked weapon needs Scrap: 10 is not enough for the Ballista (35).
  await tid(page, 'bb-weapon-ballista').tap();
  await expect(tid(page, 'bb-status')).toHaveText('Not enough Scrap yet. You need 25 more.');
  await expect(spotPad(page, 2)).toHaveAttribute('aria-label', 'Spot 2, archer post, selected');
  await tid(page, 'bb-done').tap();
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('camp-build-PAST').tap();
  await tid(page, 'bb-mode-weapons').tap();
  await expect(spotPad(page, 2)).toHaveAttribute('aria-label', 'Spot 2, archer post');
  await expect(tid(page, 'bb-spots-chip')).toHaveText('Spots 1 of 4 used');
});

test('touch: weapon pads and the weapon list meet the 56px and 20px rules', async ({ page }) => {
  await toBuilderCamp(page);
  await page.getByTestId('camp-build-FUTURE').tap();
  await chooseSpot(page, 4, true);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-screen="builder"] button')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 56 || r.height < 56) out.push(`${el.dataset.testid}: ${r.width}x${r.height}`);
      if (el.textContent?.trim() && parseFloat(getComputedStyle(el).fontSize) < 20)
        out.push(`${el.dataset.testid}: small font`);
    }
    for (const el of document.querySelectorAll<SVGElement>('.tc-bb-spot-hit')) {
      const r = el.getBoundingClientRect();
      if (r.width < 56 || r.height < 56) out.push(`pad tap ${r.width}x${r.height}`);
    }
    for (const el of document.querySelectorAll<SVGTextElement>('.tc-bb-spot-n')) {
      const r = el.getBoundingClientRect();
      if (r.height < 14) out.push(`pad number ${r.height}`);
    }
    const s = document.querySelector<HTMLElement>('[data-screen="builder"]')!;
    if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1)
      out.push('screen overflows');
    return out;
  });
  expect(problems).toEqual([]);
});
