// iPad audit fixes (docs/IPAD_AUDIT.md): Setup fits with a margin, dialogs use 20px text, the
// page opts into the full screen with safe-area padding, and the Battle readouts do not collide.
import { expect, test } from './fixtures';
import { smallText } from './support/audit';
import { readyUp, startMatch, tid, toSetup } from './support/game';

const SIZES = [
  { name: 'iPad mini', width: 1133, height: 744 },
  { name: 'iPad Pro 11in', width: 1194, height: 834 },
  { name: 'iPad Pro 13in', width: 1376, height: 1032 },
];
const MARGIN = 12;

// One page per check, resized through every iPad size: the layout is CSS, so a resize is the same
// as opening the screen at that size, and the screen is reached only once.
test.describe('iPad landscape, touch', () => {
  test.use({ hasTouch: true, viewport: { width: SIZES[0]!.width, height: SIZES[0]!.height } });

  test('Setup fits with a bottom margin, Clear my data included, at every size', async ({
    page,
  }) => {
    await toSetup(page);
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-screen="setup"]')!;
        const bottoms = [...el.querySelectorAll<HTMLElement>('button')]
          .filter((b) => b.offsetParent !== null)
          .map((b) => b.getBoundingClientRect().bottom);
        return { scrolls: el.scrollHeight - el.clientHeight, lowest: Math.max(...bottoms) };
      });
      expect.soft(r.scrolls, `${size.name}: Setup scrolls`).toBeLessThanOrEqual(1);
      expect
        .soft(r.lowest, `${size.name}: lowest button`)
        .toBeLessThanOrEqual(size.height - MARGIN);
    }
  });

  test('the Leave dialog text is at least 20px at every size', async ({ page }) => {
    await toSetup(page);
    await startMatch(page);
    await readyUp(page);
    await tid(page, 'pause').click();
    await tid(page, 'pause-leave').click();
    await expect(page.locator('#tc-pause-heading')).toHaveText('Leave this game?');
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      expect.soft(await smallText(page), `${size.name}: text under 20px`).toEqual([]);
    }
  });
});

test('the page uses the full screen and pads for the home bar', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toMatch(/<meta name="viewport"[^>]*viewport-fit=cover/);
  await page.goto('/');
  const vars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return ['--tc-safe-top', '--tc-safe-right', '--tc-safe-bottom', '--tc-safe-left'].map((n) =>
      cs.getPropertyValue(n).trim(),
    );
  });
  for (const v of vars) expect(v).not.toBe('');
});
