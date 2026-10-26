// "My weapons" in Build Base: weapons made in the Forge Workshop sit at the top of the Weapons-mode
// list, mount on a pad for no Scrap, stay after a reload, and fit with no scrolling.
// With none made, one quiet link opens the Forge Workshop right from the builder.
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { CAMP_KEY, savedCamp } from './support/camp';
import { chooseSpot, openBuilder, spotPad, toBuilderCamp } from './support/builder';
import { tid } from './support/game';
import { saveShot } from './support/shots';

type Made = {
  id: string;
  base: string;
  name: string;
  power: number;
  reach: number;
  splash: number;
};

const PAST_MADE: Made[] = [
  { id: 'custom:P:1', base: 'royalSword', name: 'Wobbly Noodle', power: 4, reach: 3, splash: 3 },
  { id: 'custom:P:2', base: 'elderLongbow', name: 'Twang', power: 2, reach: 5, splash: 3 },
  { id: 'custom:P:3', base: 'ironCannon', name: 'Thunder Turnip', power: 5, reach: 1, splash: 4 },
];
const FUTURE_MADE: Made[] = [
  { id: 'custom:F:1', base: 'plasmaBlade', name: 'Zap Zap', power: 4, reach: 3, splash: 3 },
  { id: 'custom:F:2', base: 'laserRifle', name: 'Laser Llama', power: 2, reach: 5, splash: 3 },
  { id: 'custom:F:3', base: 'railCannon', name: 'Mega Muffin', power: 5, reach: 1, splash: 4 },
];

/** Alex (Team Past) and Sam (Team Future) with these weapons of their own and some Scrap. */
async function giveMade(page: Page, past: Made[], future: Made[]): Promise<void> {
  const kit = (weapon: string, made: Made[]) => ({
    weapon,
    owned: Object.fromEntries([[weapon, 1], ...made.map((m) => [m.id, 1])]),
    upgrades: {},
    ...(made.length ? { custom: made } : {}),
  });
  const wallet = (name: string, past: Made[], future: Made[]) => ({
    name,
    scrap: 30,
    earned: 30,
    loadout: { PAST: kit('royalSword', past), FUTURE: kit('plasmaBlade', future) },
  });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key as string, JSON.stringify(value)),
    [
      CAMP_KEY,
      {
        wallets: { alex: wallet('Alex', past, []), sam: wallet('Sam', [], future) },
        creditedSeed: null,
      },
    ] as const,
  );
  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

/**
 * The weapon list: inside the plot area and the window, the page never scrolls, 56px targets and
 * 20px text. The list itself may scroll (it always could, `overflow-y: auto`) on a small screen
 * with many weapons, so every button must be reachable inside it. `fits` says it must not scroll.
 */
async function listFits(page: Page, where: string, fits = false): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const r = await tid(page, 'bb-weapon-panel').evaluate((panel) => {
    const items = [...panel.querySelectorAll<HTMLElement>('button')];
    const texts = [...panel.querySelectorAll<HTMLElement>('span, h3, button')].filter(
      (el) => el.getBoundingClientRect().height > 0 && (el.textContent ?? '').trim() !== '',
    );
    const box = panel.getBoundingClientRect();
    const cell = panel.parentElement!.getBoundingClientRect();
    const unreachable = items.filter((b) => {
      b.scrollIntoView({ block: 'nearest' });
      const r = b.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      return r.top < p.top - 0.5 || r.bottom > p.bottom + 0.5;
    }).length;
    panel.scrollTop = 0;
    return {
      scrolls: panel.scrollHeight - panel.clientHeight,
      pageScrolls: document.documentElement.scrollHeight - innerHeight,
      inside:
        box.top >= cell.top - 0.5 &&
        box.bottom <= cell.bottom + 0.5 &&
        box.left >= cell.left - 0.5 &&
        box.right <= cell.right + 0.5 &&
        box.bottom <= innerHeight,
      unreachable,
      small: items
        .map((b) => b.getBoundingClientRect())
        .filter((b) => b.width < 55.5 || b.height < 55.5).length,
      tiny: texts.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 19.99).length,
    };
  });
  test.info().annotations.push({ type: 'list-scroll', description: `${where}: ${r.scrolls}px` });
  if (fits) expect.soft(r.scrolls, `${where}: the list scrolls`).toBeLessThanOrEqual(2);
  expect.soft(r.pageScrolls, `${where}: the page scrolls`).toBeLessThanOrEqual(0);
  expect.soft(r.inside, `${where}: the list leaves the plot area`).toBe(true);
  expect.soft(r.unreachable, `${where}: buttons that cannot be reached`).toBe(0);
  expect.soft(r.small, `${where}: targets under 56px`).toBe(0);
  expect.soft(r.tiny, `${where}: text under 20px`).toBe(0);
}

/** Choose a pad by keyboard. (base-builder-list-clear.spec.ts checks the list covers no pad.) */
async function pickPad(page: Page, n: number): Promise<void> {
  await spotPad(page, n).focus();
  await page.keyboard.press('Enter');
  await expect(spotPad(page, n)).toHaveAttribute('data-selected', 'true');
}

/** The chosen pad is never under the list. */
async function padClear(page: Page, n: number): Promise<void> {
  const panel = (await tid(page, 'bb-weapon-panel').boundingBox())!;
  const pad = (await spotPad(page, n).locator('.tc-bb-spot-ring').boundingBox())!;
  const apart =
    pad.x + pad.width <= panel.x ||
    pad.x >= panel.x + panel.width ||
    pad.y + pad.height <= panel.y ||
    pad.y >= panel.y + panel.height;
  expect.soft(apart, `spot ${n} is covered by the list`).toBe(true);
}

async function shot(page: Page, info: TestInfo, browserName: string, name: string) {
  await saveShot(page, browserName, name);
  const size = page.viewportSize()!;
  await page.screenshot({ path: info.outputPath(`${name}-${size.width}x${size.height}.png`) });
}

for (const team of ['PAST', 'FUTURE'] as const) {
  const made = team === 'PAST' ? PAST_MADE : FUTURE_MADE;
  const t = team.toLowerCase();

  test(`${team}: My weapons sit on top, mount for no Scrap, and stay after a reload`, async ({
    page,
    browserName,
  }, info) => {
    await toBuilderCamp(page);
    await giveMade(page, team === 'PAST' ? made : [], team === 'FUTURE' ? made : []);
    await openBuilder(page, team);
    await chooseSpot(page, 2);
    const list = tid(page, 'bb-weapon-panel');
    await expect(tid(page, 'bb-mine')).toBeVisible();
    await expect(tid(page, 'bb-make-weapon')).toHaveCount(0);
    // My weapons come first in the list.
    const first = list.locator('.tc-bb-weapon').first();
    await expect(first).toHaveAttribute('data-weapon', made[0]!.id);
    for (const m of made) await expect(tid(page, `bb-mine-${m.id}`)).toContainText(m.name);
    await expect(tid(page, `bb-mine-${made[0]!.id}`)).toContainText(/Damage \d+/);
    for (const n of [1, 2, 3, 4]) {
      await pickPad(page, n);
      const wide = page.viewportSize()!.width >= 1280;
      await listFits(page, `${team} 3 made, spot ${n}`, wide);
      await padClear(page, n);
    }

    await pickPad(page, 2);
    await tid(page, `bb-mine-${made[2]!.id}`).click();
    await expect(tid(page, 'bb-status')).toHaveText(`${made[2]!.name} is on spot 2.`);
    await expect(spotPad(page, 2)).toHaveAttribute('data-weapon', made[2]!.id);
    await expect(spotPad(page, 2).locator('.tc-bb-myw-star')).toHaveCount(1);
    await expect(tid(page, `bb-mine-${made[2]!.id}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(tid(page, 'bb-scrap')).toContainText('30');
    await pickPad(page, 4);
    await tid(page, `bb-mine-${made[0]!.id}`).click();
    await pickPad(page, 2);
    await expect(tid(page, 'bb-spots-chip')).toHaveText('Spots 2 of 4 used');
    await shot(page, info, browserName, `base-builder-my-weapons-${t}`);

    await tid(page, 'bb-done').click();
    await page.reload();
    await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
    await openBuilder(page, team);
    await tid(page, 'bb-mode-weapons').click();
    await expect(spotPad(page, 2)).toHaveAttribute('data-weapon', made[2]!.id);
    await expect(spotPad(page, 4)).toHaveAttribute('data-weapon', made[0]!.id);
    const camp = await savedCamp(page);
    const key = team === 'PAST' ? 'alex' : 'sam';
    expect(camp.wallets[key]!.scrap).toBe(30);
  });

  test(`${team}: with none made, one quiet link opens the Forge Workshop`, async ({
    page,
    browserName,
  }, info) => {
    await toBuilderCamp(page);
    await giveMade(page, [], []);
    await openBuilder(page, team);
    await chooseSpot(page, 3);
    await expect(tid(page, 'bb-mine')).toHaveCount(0);
    const link = tid(page, 'bb-make-weapon');
    await expect(link).toHaveText('Make a weapon in the Forge');
    await expect(link).toHaveClass(/tc-link/);
    for (const n of [1, 2, 3, 4]) {
      await pickPad(page, n);
      await listFits(page, `${team} none made, spot ${n}`, true);
      await padClear(page, n);
    }
    await pickPad(page, 3);
    await shot(page, info, browserName, `base-builder-my-weapons-none-${t}`);

    // Forge one from the builder: it shows up in My weapons and mounts.
    await link.click();
    await expect(tid(page, 'workshop-forge')).toBeVisible();
    await tid(page, 'workshop-forge').click();
    await expect(tid(page, 'workshop-forge')).toBeHidden();
    await expect(tid(page, 'bb-mine')).toBeVisible();
    await expect(tid(page, 'bb-status')).toContainText('It is in My weapons now.');
    const tile = tid(page, 'bb-mine').locator('.tc-bb-weapon').first();
    await expect(tile).toBeFocused();
    await tile.click();
    await expect(spotPad(page, 3)).toHaveAttribute('data-weapon', /^custom:/);
  });
}
