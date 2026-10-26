// Build Base in a tall, narrow window (768 by 1024, a mouse, no touch). A touch tablet held upright
// shows "Turn your iPad sideways", but a tall desktop window does not, so the builder must fit there
// too. Below 900px wide the rail goes above the plot, the tools go under it, and the plot uses the
// full width. This spec runs in the normal 1280x800 project and resizes the page, so pull request CI
// catches a return of the bug (the 768x1024 project runs only in the full matrix).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { smallTargets, smallText } from './support/audit';
import { CAMP_KEY } from './support/camp';
import { chooseSpot, openBuilder, seedShapes, spotPad, toBuilderCamp } from './support/builder';
import { tid } from './support/game';

const NARROW = { width: 768, height: 1024 };

/** Team Future (Sam) has two Workshop weapons, so its list shows "My weapons" too. */
async function giveFutureWeapons(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const made = [
      { id: 'custom:F:1', base: 'plasmaBlade', name: 'Zap Zap', power: 4, reach: 3, splash: 3 },
      { id: 'custom:F:2', base: 'laserRifle', name: 'Laser Llama', power: 2, reach: 5, splash: 3 },
    ];
    const kit = (weapon: string, mine: typeof made) => ({
      weapon,
      owned: Object.fromEntries([[weapon, 1], ...mine.map((m) => [m.id, 1])]),
      upgrades: {},
      ...(mine.length ? { custom: mine } : {}),
    });
    const wallet = (name: string, mine: typeof made) => ({
      name,
      scrap: 30,
      earned: 30,
      loadout: { PAST: kit('royalSword', []), FUTURE: kit('plasmaBlade', mine) },
    });
    localStorage.setItem(
      key,
      JSON.stringify({
        wallets: { alex: wallet('Alex', []), sam: wallet('Sam', made) },
        creditedSeed: null,
      }),
    );
  }, CAMP_KEY);
}

/**
 * Every visible button of the builder sits inside the window and is not cut by a box that clips
 * it. Buttons in the weapon list may sit lower in the list (it scrolls on purpose), so each one is
 * scrolled into view first and must then be whole inside the list. Nothing scrolls sideways.
 */
async function whole(page: Page, where: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const out: string[] = [];
    const s = document.querySelector<HTMLElement>('[data-screen="builder"]')!;
    if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1)
      out.push('screen scrolls');
    for (const sel of ['.tc-bb-rail', '.tc-bb-tools', '.tc-bb-tray', '.tc-bb-pad']) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && !el.hidden && el.scrollHeight > el.clientHeight + 1) out.push(`${sel} cut`);
    }
    const list = document.querySelector<HTMLElement>('.tc-bb-weapons');
    if (list && !list.hidden && list.scrollWidth > list.clientWidth + 1)
      out.push('weapon list scrolls sideways');
    for (const b of s.querySelectorAll<HTMLElement>('button, input')) {
      if (b.offsetParent === null || b.closest('[inert], [hidden]')) continue;
      const name = b.dataset.testid ?? b.textContent ?? b.tagName;
      if (list && list.contains(b)) b.scrollIntoView({ block: 'nearest' });
      const r = b.getBoundingClientRect();
      if (
        r.top < -0.5 ||
        r.left < -0.5 ||
        r.bottom > innerHeight + 0.5 ||
        r.right > innerWidth + 0.5
      )
        out.push(`${name} outside the window`);
      for (let p = b.parentElement; p && p !== s; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const q = p.getBoundingClientRect();
        if (
          r.left < q.left - 0.5 ||
          r.right > q.right + 0.5 ||
          r.top < q.top - 0.5 ||
          r.bottom > q.bottom + 0.5
        )
          out.push(`${name} cut by .${p.className.split(' ').join('.')}`);
        break;
      }
    }
    if (list) list.scrollTop = 0;
    return out;
  });
  expect.soft(r, `${where}: not whole`).toEqual([]);
  expect.soft(await smallTargets(page), `${where}: targets under 56px`).toEqual([]);
  expect.soft(await smallText(page), `${where}: text under 20px`).toEqual([]);
}

/** The plot uses the window's width, so the place to build is big enough to aim a drop. */
async function plotWide(page: Page, where: string): Promise<void> {
  const w = (await tid(page, 'bb-plot').boundingBox())!.width;
  expect.soft(w, `${where}: plot picture width`).toBeGreaterThanOrEqual(NARROW.width * 0.6);
}

test.describe('a tall, narrow window (768 by 1024, mouse)', () => {
  test.use({ viewport: NARROW });

  test('Build, My shape and Weapons all fit for both teams with 8 saved shapes', async ({
    page,
  }, info) => {
    test.skip(!info.project.name.endsWith('1280x800'), 'Sets its own size: run once per browser');
    await toBuilderCamp(page);
    await giveFutureWeapons(page);
    await seedShapes(page, 'PAST', 8);
    await seedShapes(page, 'FUTURE', 8);
    for (const team of ['PAST', 'FUTURE'] as const) {
      await openBuilder(page, team);
      await expect(page.locator('.tc-bb-mine')).toHaveCount(8);
      await plotWide(page, `${team} build`);
      await whole(page, `${team} build`);

      await tid(page, 'bb-own').click();
      await expect(tid(page, 'bb-pad')).toBeVisible();
      await whole(page, `${team} My shape`);
      await tid(page, 'bb-pad-close').click();

      await chooseSpot(page, 1);
      if (team === 'FUTURE') await expect(tid(page, 'bb-mine')).toBeVisible();
      await whole(page, `${team} weapons, spot 1`);
      // The list may sit over a far pad (as it always could), so pick spot 4 by keyboard.
      await spotPad(page, 4).focus();
      await page.keyboard.press('Enter');
      await expect(spotPad(page, 4)).toHaveAttribute('data-selected', 'true');
      await whole(page, `${team} weapons, spot 4`);
      await tid(page, 'bb-back').click();
      await expect(tid(page, 'camp-start')).toBeVisible();
    }
  });
});
