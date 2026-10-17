// Forge Weapon: opens from the Camp, spends Scrap, and the weapon shows up in the next match.
import { expect, test } from './fixtures';
import { FUTURE_SIDE, PAST_SIDE, fillTeam, snap, tid, toSetup } from './support/game';

const CAMP_KEY = 'timeclash.camp';

async function toCamp(page: Parameters<typeof tid>[0]): Promise<void> {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

async function giveScrap(page: Parameters<typeof tid>[0], past: number, future: number) {
  await page.evaluate(
    ([key, p, f]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          scrap: { PAST: p, FUTURE: f },
          loadout: {
            PAST: { weapon: 'royalSword', owned: { royalSword: 1 }, upgrades: {} },
            FUTURE: { weapon: 'plasmaBlade', owned: { plasmaBlade: 1 }, upgrades: {} },
          },
          creditedSeed: null,
        }),
      ),
    [CAMP_KEY, past, future] as const,
  );
}

test('the Forge opens from the Camp and Back returns to it', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-forge').click();
  await expect(page.locator('[data-screen="forge"] h1')).toHaveText('Forge Weapon');
  await expect(tid(page, 'forge-scrap')).toContainText('0');
  await tid(page, 'forge-back').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
  await expect(tid(page, 'forge-back')).toHaveCount(0);
});

test('too little Scrap changes nothing and says how much more is needed', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-forge').click();
  await tid(page, 'forge-weapon-elderLongbow').click({ force: true });
  await expect(tid(page, 'forge-status')).toHaveText('Not yet. You need 12 more Scrap.');
  await expect(tid(page, 'forge-scrap')).toContainText('0');
});

test('unlocking and equipping a weapon spends Scrap and is remembered after a reload', async ({
  page,
}) => {
  await toCamp(page);
  await giveScrap(page, 30, 30);
  await page.reload();
  await tid(page, 'camp-forge').click();
  await tid(page, 'forge-weapon-elderLongbow').click();
  await expect(tid(page, 'forge-status')).toHaveText('You unlocked Elder Longbow!');
  await expect(tid(page, 'forge-scrap')).toContainText('18');
  await tid(page, 'forge-weapon-elderLongbow').click();
  await expect(tid(page, 'forge-weapon-elderLongbow')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await tid(page, 'camp-forge').click();
  await expect(tid(page, 'forge-scrap')).toContainText('18');
  await expect(tid(page, 'forge-weapon-elderLongbow')).toHaveAttribute('aria-pressed', 'true');
});

test('Team Future has its own forge, Scrap and weapons', async ({ page }) => {
  await toCamp(page);
  await giveScrap(page, 0, 20);
  await page.reload();
  await tid(page, 'camp-forge').click();
  await tid(page, 'forge-team-FUTURE').click();
  await expect(tid(page, 'forge-scrap')).toContainText('20');
  await tid(page, 'forge-weapon-laserRifle').click();
  await expect(tid(page, 'forge-scrap')).toContainText('8');
  await tid(page, 'forge-team-PAST').click();
  await expect(tid(page, 'forge-scrap')).toContainText('0');
});

test('a forged weapon is used in the next match', async ({ page }) => {
  await toCamp(page);
  await giveScrap(page, 50, 0);
  await page.reload();
  await tid(page, 'camp-forge').click();
  await tid(page, 'forge-upgrade').click();
  await tid(page, 'forge-back').click();
  await tid(page, 'camp-start').click();
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  const m = await snap(page);
  expect(m.maxBaseHp).toEqual({ PAST: 100, FUTURE: 100 });
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), CAMP_KEY);
  expect(saved.loadout.PAST.owned.royalSword).toBe(2);
  expect(saved.scrap.PAST).toBe(44);
});

test('the keyboard can use the Forge', async ({ page }) => {
  await toCamp(page);
  await giveScrap(page, 30, 0);
  await page.reload();
  await tid(page, 'camp-forge').click();
  await expect(tid(page, 'forge-back')).toBeFocused();
  await tid(page, 'forge-weapon-elderLongbow').focus();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'forge-status')).toHaveText('You unlocked Elder Longbow!');
});
