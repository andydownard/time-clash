// The Weapon Workshop: Make my own weapon from the Forge, spend points, name it, forge it with
// Scrap, see it in My weapons (equipped), and find it there after a reload. The Workshop and a
// full My weapons section fit the screen: 56px targets, 20px text, no scrolling.
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { smallTargets, smallText } from './support/audit';
import { CAMP_KEY, giveScrap, savedCamp } from './support/camp';
import { FUTURE_SIDE, PAST_SIDE, fillTeam, tid, toSetup } from './support/game';
import { saveShot } from './support/shots';

async function toCamp(page: Page): Promise<void> {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

/** 56px targets, 20px text, no sideways scroll, no scrolling, every button inside the window. */
async function fits(page: Page, screen: string, where: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect.soft(over, `${where}: sideways scroll`).toBeLessThanOrEqual(0);
  expect.soft(await smallTargets(page), `${where}: targets under 56px`).toEqual([]);
  expect.soft(await smallText(page), `${where}: text under 20px`).toEqual([]);
  const r = await page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(`[data-screen="${sel}"]`)!;
    const buttons = [...el.querySelectorAll<HTMLElement>('button, select, input')].filter(
      (b) => b.offsetParent !== null,
    );
    return {
      scrolls: el.scrollHeight - el.clientHeight,
      outside: buttons
        .map((b) => ({ id: b.dataset.testid ?? b.textContent, box: b.getBoundingClientRect() }))
        .filter(
          ({ box }) =>
            box.top < 0 || box.left < 0 || box.bottom > innerHeight || box.right > innerWidth,
        )
        .map((x) => x.id),
    };
  }, screen);
  expect.soft(r.scrolls, `${where}: the screen scrolls`).toBeLessThanOrEqual(1);
  expect.soft(r.outside, `${where}: controls not fully inside the window`).toEqual([]);
}

/** A picture to look at: docs/screenshots with UPDATE_SCREENSHOTS=1, else the test output. */
async function shot(page: Page, info: TestInfo, browserName: string, name: string) {
  await saveShot(page, browserName, name);
  const size = page.viewportSize()!;
  await page.screenshot({ path: info.outputPath(`${name}-${size.width}x${size.height}.png`) });
}

test('make, name and forge my own weapon; it is equipped and still there after a reload', async ({
  page,
  browserName,
}, info) => {
  await toCamp(page);
  await giveScrap(page, 40, 0);
  await page.reload();
  await tid(page, 'camp-forge').click();
  await tid(page, 'forge-make').click();
  await expect(page.locator('[data-screen="workshop"]')).toBeVisible();
  await fits(page, 'workshop', 'Workshop Past');
  await shot(page, info, browserName, 'workshop-past');

  // Pick the cannon style, then move points: one more Power, one less Splash.
  await tid(page, 'workshop-style-ironCannon').click();
  await expect(tid(page, 'workshop-style-ironCannon')).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'workshop-more-power').click();
  await tid(page, 'workshop-less-splash').click();
  await expect(tid(page, 'workshop-stat-power')).toHaveText('2');
  await expect(tid(page, 'workshop-stat-splash')).toHaveText('2');

  // A typed name that is not okay is never used; a good one is.
  await tid(page, 'workshop-typed').fill('Alex Zapper');
  await expect(tid(page, 'workshop-status')).toContainText('Keep your own name a secret.');
  await expect(tid(page, 'workshop-preview')).toContainText('Wobbly Thunder');
  await tid(page, 'workshop-typed').fill('Big Bonk');
  await expect(tid(page, 'workshop-preview')).toContainText('Big Bonk');

  await tid(page, 'workshop-forge').click();
  await expect(page.locator('[data-screen="workshop"]')).toHaveCount(0);
  await expect(tid(page, 'forge-status')).toHaveText('You made Big Bonk! It is equipped.');
  const mine = tid(page, 'forge-weapon-custom:P:1');
  await expect(mine).toHaveAttribute('aria-pressed', 'true');
  await expect(mine).toContainText('Big Bonk');
  await expect(tid(page, 'forge-scrap')).toContainText('34');
  await fits(page, 'forge', 'Forge My weapons');

  await page.reload();
  await tid(page, 'camp-forge').click();
  await expect(tid(page, 'forge-weapon-custom:P:1')).toHaveAttribute('aria-pressed', 'true');
  const saved = await savedCamp(page);
  const kit = saved.wallets.alex!.loadout.PAST! as unknown as {
    weapon: string;
    custom: Array<{ name: string; base: string }>;
  };
  expect(kit.weapon).toBe('custom:P:1');
  expect(kit.custom).toEqual([expect.objectContaining({ name: 'Big Bonk', base: 'ironCannon' })]);
});

test('the Future Workshop fits and looks like Team Future', async ({ page, browserName }, info) => {
  await toCamp(page);
  await tid(page, 'camp-forge').click();
  await tid(page, 'forge-team-FUTURE').click();
  await tid(page, 'forge-make').click();
  await expect(page.locator('[data-screen="workshop"][data-team="FUTURE"]')).toBeVisible();
  await tid(page, 'workshop-typed').fill('kill');
  await expect(tid(page, 'workshop-status')).toContainText('friendlier');
  await fits(page, 'workshop', 'Workshop Future');
  await shot(page, info, browserName, 'workshop-future');
  // Not enough Scrap: it says so and stays open.
  await tid(page, 'workshop-forge').click({ force: true });
  await expect(tid(page, 'workshop-status')).toContainText('Not yet. You need');
  await tid(page, 'workshop-back').click();
  await expect(tid(page, 'forge-make')).toBeFocused();
});

test('six weapons of my own fit, in My weapons and in the full list', async ({
  page,
  browserName,
}, info) => {
  await toCamp(page);
  const custom = Array.from({ length: 6 }, (_, i) => ({
    id: `custom:P:${i + 1}`,
    base: ['royalSword', 'elderLongbow', 'ironCannon'][i % 3],
    name: [
      'Sparkly Pancake',
      'Big Bonk',
      'Rumbly Thunder',
      'Zippy Taco',
      'Jolly Gizmo',
      'Fuzzy Sock',
    ][i],
    power: 3,
    reach: 3,
    splash: 3,
  }));
  await page.evaluate(
    ([key, list]) => {
      const kit = (weapon: string) => ({ weapon, owned: { [weapon]: 1 }, upgrades: {} });
      const owned = Object.fromEntries((list as Array<{ id: string }>).map((c) => [c.id, 1]));
      localStorage.setItem(
        key as string,
        JSON.stringify({
          wallets: {
            alex: {
              name: 'Alex',
              scrap: 99,
              earned: 99,
              loadout: {
                PAST: {
                  weapon: 'custom:P:6',
                  owned: { royalSword: 1, ...owned },
                  upgrades: {},
                  custom: list,
                },
                FUTURE: kit('plasmaBlade'),
              },
            },
          },
          creditedSeed: null,
        }),
      );
    },
    [CAMP_KEY, custom] as const,
  );
  await page.reload();
  await tid(page, 'camp-forge').click();
  await expect(page.locator('.tc-forge-card')).toHaveCount(6);
  await expect(tid(page, 'forge-make')).toHaveAttribute('aria-disabled', 'true');
  await fits(page, 'forge', 'Forge, six of my own');
  await shot(page, info, browserName, 'forge-my-weapons');
  await tid(page, 'forge-make').click({ force: true });
  await expect(tid(page, 'forge-status')).toHaveText('You have 6 of your own. That is the most.');
  await tid(page, 'forge-mine').click();
  await expect(tid(page, 'forge-weapon-royalSword')).toBeVisible();
  await fits(page, 'forge', 'Forge, full list with My weapons button');
});
