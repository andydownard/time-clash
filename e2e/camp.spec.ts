// The Camp hub sits between Setup and Battle. One big button starts the match. The other two
// are not open yet, so they say so and change nothing.
import { expect, test } from './fixtures';
import {
  PAST_SIDE,
  FUTURE_SIDE,
  fillTeam,
  snap,
  tid,
  toSetup,
  clashFromCamp,
} from './support/game';

async function toCamp(page: Parameters<typeof tid>[0], query = ''): Promise<void> {
  await toSetup(page, query);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

test('Setup leads to the Camp, and Time to Clash! starts the match', async ({ page }) => {
  await toCamp(page);
  await expect(page.locator('[data-screen="camp"] h1')).toHaveText('Time Clash Camp');
  await expect(tid(page, 'camp-start')).toHaveText('Time to Clash!');
  await expect(tid(page, 'camp-start')).toBeFocused();
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  const m = await snap(page);
  expect(m.players.map((p) => [p.team, p.name])).toEqual([
    ['PAST', PAST_SIDE.name],
    ['FUTURE', FUTURE_SIDE.name],
  ]);
});

test('Change players opens Setup with the saved players, then returns to the Camp', async ({
  page,
}) => {
  await toCamp(page);
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'setup-next')).toBeVisible();
  await expect(tid(page, 'setup-name-PAST')).toHaveValue(PAST_SIDE.name);
  await tid(page, 'setup-name-PAST').fill('Mia');
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  expect((await snap(page)).players[0].name).toBe('Mia');
});

test('the keyboard starts the match from the Camp', async ({ page }) => {
  await toCamp(page);
  // The Camp focuses "Time to Clash!" a moment after it shows. Enter goes nowhere until it does.
  await expect(tid(page, 'camp-start')).toBeFocused();
  await page.keyboard.press('Enter');
  // The Battle Plan opens with Lock it in! focused, so a second Enter starts the match.
  await expect(tid(page, 'plan-go')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
});

test('reduced motion stops the Camp animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toCamp(page);
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('.tc-camp-art [class]')]
      .map((el) => getComputedStyle(el).animationName)
      .filter((n) => n !== 'none'),
  );
  expect(names).toEqual([]);
});

// Regression 25: at 4:3 and 16:10 the Camp picture filled the height and lost its side castles and
// bases to the window edge. The whole 16:9 picture must show at every supported size.
const CAMP_SIZES = [
  [1024, 768],
  [1133, 744],
  [1280, 800],
  [1376, 1032],
] as const;
for (const [w, h] of CAMP_SIZES) {
  test(`the whole Camp picture shows, and buttons stay 56px, at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await toCamp(page);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const box = (el: Element) => el.getBoundingClientRect();
      const art = document.querySelector('.tc-camp-art')!;
      const castles = [...art.querySelectorAll('use[href="#tcCampCastle"]')].map(box);
      const bases = [...art.querySelectorAll('use[href="#tcCampBase"]')].map(box);
      return {
        art: box(art).toJSON(),
        left: Math.min(...castles.map((b) => b.left)),
        right: Math.max(...bases.map((b) => b.right)),
        logo: box(document.querySelector('.tc-camp-logo')!).toJSON(),
        buttons: [...document.querySelectorAll<HTMLElement>('[data-screen="camp"] button')].map(
          (b) => ({ id: b.dataset.testid, ...box(b).toJSON() }),
        ),
        w: innerWidth,
        h: innerHeight,
      };
    });
    // The picture is the whole 16:9 frame inside the window, never wider than it.
    expect(m.art.width).toBeLessThanOrEqual(m.w + 1);
    expect(Math.abs(m.art.height - (m.art.width * 9) / 16)).toBeLessThanOrEqual(1);
    expect(m.art.bottom).toBeLessThanOrEqual(m.h + 1);
    // The edge castle and the edge base are inside the window (a castle shadow reaches 23 picture
    // units past the edge, so allow 2.5 percent of the width).
    expect(m.left).toBeGreaterThanOrEqual(-0.025 * m.w);
    expect(m.right).toBeLessThanOrEqual(m.w * 1.025);
    expect(m.logo.left).toBeGreaterThanOrEqual(0);
    expect(m.logo.right).toBeLessThanOrEqual(m.w);
    expect(m.logo.top).toBeGreaterThanOrEqual(0);
    for (const b of m.buttons) {
      expect(b.height, `${b.id} height`).toBeGreaterThanOrEqual(56);
      expect(b.left, `${b.id} left`).toBeGreaterThanOrEqual(0);
      expect(b.right, `${b.id} right`).toBeLessThanOrEqual(m.w);
      expect(b.bottom, `${b.id} bottom`).toBeLessThanOrEqual(m.h);
    }
    await page.screenshot({ path: `test-results/camp-${w}x${h}.png` });
  });
}
