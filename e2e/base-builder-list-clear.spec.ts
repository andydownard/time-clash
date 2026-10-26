// Build Base, Weapons mode: the weapon list never covers a pad. For every pad picked (1 to 4), at
// each landscape size and in the narrow 768x1024 window, with 0 and 6 weapons of your own, the
// list's box misses all four pad boxes (their 56px tap areas). Every tile stays 56px with 20px
// words, Done stays whole, and the page never scrolls. src/ui/weaponListPlace.ts picks the place.
// It runs in the 1280x800 project and resizes the page, so pull request CI covers every size.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { CAMP_KEY } from './support/camp';
import { chooseSpot, openBuilder, toBuilderCamp } from './support/builder';
import { tid } from './support/game';
import { saveShot } from './support/shots';

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 1133, height: 744 },
  { width: 768, height: 1024 },
];
const NAMES = ['Wobbly Noodle', 'Twang', 'Thunder Turnip', 'Zap Zap', 'Laser Llama', 'Mega Muffin'];

/** Alex (Past) and Sam (Future) each with `n` weapons of their own, then back to the Camp. */
async function giveMade(page: Page, n: number): Promise<void> {
  await page.evaluate(
    ([key, n, names]) => {
      const made = (p: string, base: string) =>
        Array.from({ length: n as number }, (_, i) => ({
          id: `custom:${p}:${i + 1}`,
          base,
          name: (names as string[])[i]!,
          power: 4,
          reach: 3,
          splash: 3,
        }));
      const kit = (weapon: string, mine: { id: string }[]) => ({
        weapon,
        owned: Object.fromEntries([[weapon, 1], ...mine.map((m) => [m.id, 1])]),
        upgrades: {},
        ...(mine.length ? { custom: mine } : {}),
      });
      const wallet = (name: string, past: { id: string }[], future: { id: string }[]) => ({
        name,
        scrap: 30,
        earned: 30,
        loadout: { PAST: kit('royalSword', past), FUTURE: kit('plasmaBlade', future) },
      });
      localStorage.setItem(
        key as string,
        JSON.stringify({
          wallets: {
            alex: wallet('Alex', made('P', 'royalSword'), []),
            sam: wallet('Sam', [], made('F', 'plasmaBlade')),
          },
          creditedSeed: null,
        }),
      );
    },
    [CAMP_KEY, n, NAMES] as const,
  );
}

type Box = { x: number; y: number; width: number; height: number };
const apart = (a: Box, b: Box): boolean =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

/** The list misses every pad, its tiles are whole-size, and nothing important is cut. */
async function listClear(page: Page, where: string): Promise<void> {
  const list = (await tid(page, 'bb-weapon-panel').boundingBox())!;
  for (const n of [1, 2, 3, 4]) {
    const pad = (await tid(page, `bb-spot-${n}`).boundingBox())!;
    expect.soft(apart(list, pad), `${where}: the list covers spot ${n}`).toBe(true);
  }
  const r = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="bb-weapon-panel"]')!;
    const tiles = [...panel.querySelectorAll<HTMLElement>('button')].map((b) =>
      b.getBoundingClientRect(),
    );
    const words = [...panel.querySelectorAll<HTMLElement>('span, h3, button')].filter(
      (el) => el.getBoundingClientRect().height > 0 && (el.textContent ?? '').trim() !== '',
    );
    const done = document.querySelector('[data-testid="bb-done"]')!.getBoundingClientRect();
    const screen = document.querySelector<HTMLElement>('[data-screen="builder"]')!;
    return {
      small: tiles.filter((b) => b.width < 55.5 || b.height < 55.5).length,
      tiny: words.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 19.99).length,
      doneH: done.height,
      doneInside: done.bottom <= innerHeight + 0.5,
      scrolls: screen.scrollHeight - screen.clientHeight,
    };
  });
  expect.soft(r.small, `${where}: tiles under 56px`).toBe(0);
  expect.soft(r.tiny, `${where}: words under 20px`).toBe(0);
  expect.soft(r.doneH, `${where}: Done is squashed`).toBeGreaterThanOrEqual(56);
  expect.soft(r.doneInside, `${where}: Done is cut off`).toBe(true);
  expect.soft(r.scrolls, `${where}: the screen scrolls`).toBeLessThanOrEqual(1);
}

for (const made of [0, 6]) {
  test(`the weapon list covers no pad, with ${made} weapons of your own`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(300_000);
    await toBuilderCamp(page);
    await giveMade(page, made);
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.reload();
      await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
      for (const team of ['PAST', 'FUTURE'] as const) {
        await openBuilder(page, team);
        await chooseSpot(page, 1);
        for (const n of [1, 2, 3, 4]) {
          // By keyboard, so the pick never depends on where the list was before.
          await tid(page, `bb-spot-${n}`).focus();
          await page.keyboard.press('Enter');
          await expect(tid(page, `bb-spot-${n}`)).toHaveAttribute('data-selected', 'true');
          await page.evaluate(() => document.fonts.ready);
          await listClear(page, `${size.width}x${size.height} ${team} ${made} made, spot ${n}`);
        }
        await saveShot(
          page,
          browserName,
          `base-builder-weapon-list-${team.toLowerCase()}-${made}-made`,
        );
        await tid(page, 'bb-done').click();
        await expect(tid(page, 'camp-start')).toBeVisible();
      }
    }
  });
}
