// "Make your own" with a finger on an iPad-sized screen (WebKit, 1024x768). Squares and buttons use
// the real touchscreen. The drag from the tray is sent as touch pointer events, as in
// base-builder-touch.spec.ts, because Playwright cannot drag with real touch in WebKit.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bricks, cellPoint, toBuilderCamp } from './support/builder';
import { tid } from './support/game';

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });
test.beforeEach(({ browserName }, info) => {
  test.skip(
    browserName !== 'webkit' || info.project.name !== 'webkit-1024x768',
    'The touch check runs once, in WebKit at 1024x768',
  );
});

type P = { x: number; y: number };

async function touchDrag(page: Page, from: string, via: P[]): Promise<void> {
  await page.evaluate(
    ([selector, path]) => {
      const el = document.querySelector(selector as string)!;
      const pts = path as P[];
      const fire = (target: EventTarget, type: string, p: P): void => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 9,
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
    [from, via] as const,
  );
}

test('touch: tap an L on the pad, save it, drag it on, turn it, reload and see it', async ({
  page,
}) => {
  await toBuilderCamp(page);
  await page.getByTestId('camp-build').tap();
  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  await tid(page, 'bb-own').tap();
  await tid(page, 'bb-pad-clear').tap();
  for (const [r, c] of [
    [1, 1],
    [2, 1],
    [3, 1],
    [3, 2],
  ] as const)
    await tid(page, `bb-sq-${r}-${c}`).tap();
  await expect(tid(page, 'bb-pad-count')).toHaveText('4 of 12 squares');
  await tid(page, 'bb-pad-save').tap();
  await expect(tid(page, 'bb-shape-1')).toBeVisible();

  const tile = (await tid(page, 'bb-shape-1').boundingBox())!;
  const start = { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
  const end = await cellPoint(page, 8, 8, 2, 3);
  await touchDrag(page, '[data-testid="bb-shape-1"]', [
    start,
    { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    end,
    end,
  ]);
  await expect(bricks(page)).toHaveCount(1);
  await tid(page, 'bb-turn').tap();
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);
  await tid(page, 'bb-done').tap();

  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('camp-build').tap();
  await expect(bricks(page)).toHaveCount(1);
  await expect(bricks(page).first()).toHaveAttribute('transform', /rotate\(90\)/);
});

test('touch: the pad and the saved shapes meet the 56px and 20px rules', async ({ page }) => {
  await toBuilderCamp(page);
  await page.getByTestId('camp-build').tap();
  await page.getByTestId('bb-team-FUTURE').tap();
  await tid(page, 'bb-own').tap();
  await tid(page, 'bb-pad-save').tap();
  await tid(page, 'bb-own').tap();
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-screen="builder"] button')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 56 || r.height < 56) out.push(`${el.dataset.testid}: ${r.width}x${r.height}`);
      if (el.textContent?.trim() && parseFloat(getComputedStyle(el).fontSize) < 20)
        out.push(`${el.dataset.testid}: small font`);
    }
    for (const el of document.querySelectorAll<HTMLElement>(
      '.tc-bb-pad p, .tc-bb-pad h2, .tc-bb-pad label, .tc-bb-mine-name',
    )) {
      if (el.getBoundingClientRect().width && parseFloat(getComputedStyle(el).fontSize) < 20)
        out.push(`${el.className}: small font`);
    }
    const s = document.querySelector<HTMLElement>('[data-screen="builder"]')!;
    if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1)
      out.push('screen overflows');
    return out;
  });
  expect(problems).toEqual([]);
});
