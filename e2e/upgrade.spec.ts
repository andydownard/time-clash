// Build Base (old shop, ?builder=0): opens from the Camp, spends Scrap, and the upgrade shows up in the next match.
import { expect, test } from './fixtures';
import { DAMAGE } from '../src/game/config';
import { upgradeById } from '../src/game/upgrades';
import { giveScrap } from './support/camp';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  fillTeam,
  snap,
  tid,
  toSetup,
  clashFromCamp,
} from './support/game';

async function toCamp(page: Parameters<typeof tid>[0]): Promise<void> {
  await toSetup(page, '&builder=0');
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
}

test('too little Scrap changes nothing and says how much more is needed', async ({ page }) => {
  await toCamp(page);
  await tid(page, 'camp-upgrade').click();
  await tid(page, 'upgrade-row-tower').click({ force: true });
  await expect(tid(page, 'upgrade-status')).toHaveText('Not yet. You need 6 more Scrap.');
  await expect(tid(page, 'upgrade-scrap')).toContainText('0');
});

test('an upgrade spends Scrap, is remembered after a reload, and rises level by level', async ({
  page,
}) => {
  await toCamp(page);
  await giveScrap(page, 40, 40);
  await page.reload();
  await tid(page, 'camp-upgrade').click();
  await tid(page, 'upgrade-row-tower').click();
  await expect(tid(page, 'upgrade-status')).toHaveText('Upgrade the Tower is now level 1!');
  await expect(tid(page, 'upgrade-scrap')).toContainText('34');
  await tid(page, 'upgrade-row-tower').click();
  await expect(tid(page, 'upgrade-scrap')).toContainText('24');

  await page.reload();
  await tid(page, 'camp-upgrade').click();
  await expect(tid(page, 'upgrade-scrap')).toContainText('24');
  await expect(tid(page, 'upgrade-row-tower')).toContainText('Level 2 of 3');
});

test('Team Future has its own upgrades and Scrap', async ({ page }) => {
  await toCamp(page);
  await giveScrap(page, 0, 20);
  await page.reload();
  await tid(page, 'camp-upgrade').click();
  await tid(page, 'upgrade-team-FUTURE').click();
  await expect(tid(page, 'upgrade-scrap')).toContainText('20');
  await tid(page, 'upgrade-row-forceField').click();
  await expect(tid(page, 'upgrade-scrap')).toContainText('12');
  await tid(page, 'upgrade-team-PAST').click();
  await expect(tid(page, 'upgrade-scrap')).toContainText('0');
});

test('Upgrade the Tower gives more base health in the next match, shown in the HUD', async ({
  page,
}) => {
  await toCamp(page);
  await giveScrap(page, 40, 0);
  await page.reload();
  await tid(page, 'camp-upgrade').click();
  await tid(page, 'upgrade-row-tower').click();
  await tid(page, 'upgrade-back').click();
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  const m = await snap(page);
  const full = DAMAGE.startingBaseHp;
  const tower = full + upgradeById('tower')!.perLevel;
  expect(m.maxBaseHp).toEqual({ PAST: tower, FUTURE: full });
  expect(m.baseHp.PAST).toBe(tower);
  await tid(page, 'pass-ready').click();
  await expect(tid(page, 'base-hp-PAST')).toContainText(`${tower} / ${tower}`);
  await expect(tid(page, 'base-hp-FUTURE')).toContainText(`${full} / ${full}`);
});

test('the keyboard can use Build Base', async ({ page }) => {
  await toCamp(page);
  await giveScrap(page, 30, 0);
  await page.reload();
  await tid(page, 'camp-upgrade').click();
  await expect(tid(page, 'upgrade-back')).toBeFocused();
  await tid(page, 'upgrade-row-wall').focus();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'upgrade-status')).toHaveText('Reinforce the Wall is now level 1!');
});
