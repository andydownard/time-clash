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

for (const size of SIZES) {
  test.describe(`${size.name} landscape`, () => {
    test.use({ hasTouch: true, viewport: { width: size.width, height: size.height } });

    test('Setup fits with a bottom margin, Clear my data included', async ({ page }) => {
      await toSetup(page);
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-screen="setup"]')!;
        const bottoms = [...el.querySelectorAll<HTMLElement>('button')]
          .filter((b) => b.offsetParent !== null)
          .map((b) => b.getBoundingClientRect().bottom);
        return { scrolls: el.scrollHeight - el.clientHeight, lowest: Math.max(...bottoms) };
      });
      expect(r.scrolls).toBeLessThanOrEqual(1);
      expect(r.lowest).toBeLessThanOrEqual(size.height - MARGIN);
    });

    test('the Leave dialog text is at least 20px', async ({ page }) => {
      await toSetup(page);
      await startMatch(page);
      await readyUp(page);
      await tid(page, 'pause').click();
      await tid(page, 'pause-leave').click();
      await expect(page.locator('#tc-pause-heading')).toHaveText('Leave this game?');
      expect(await smallText(page)).toEqual([]);
    });
  });
}

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
