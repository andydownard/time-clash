// Scrap is kept by player name on this device. It shows while playing, carries between matches,
// and an old save (one pile per team) moves onto the current players' names.
import { expect, test } from './fixtures';
import { CAMP_KEY, giveScrap, savedCamp } from './support/camp';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  fillTeam,
  readyUp,
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

test('the Scrap each player has is shown while playing', async ({ page }) => {
  await toCamp(page);
  await giveScrap(page, 17, 4);
  await page.reload();
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  await readyUp(page);
  await expect(tid(page, 'hud-scrap-PAST')).toHaveText('17');
  await expect(tid(page, 'hud-scrap-FUTURE')).toHaveText('4');
});

test('a new name starts at zero Scrap, and the old name keeps its pile', async ({ page }) => {
  await toCamp(page);
  await giveScrap(page, 17, 4);
  await page.reload();
  await tid(page, 'camp-players').click();
  await tid(page, 'setup-name-PAST').fill('Mia');
  await tid(page, 'setup-next').click();
  await tid(page, 'camp-forge').click();
  await expect(tid(page, 'forge-scrap')).toContainText('Mia');
  await expect(tid(page, 'forge-scrap')).toContainText('0');
  await tid(page, 'forge-back').click();
  // Alex comes back (any capitals, extra spaces) and finds the same Scrap.
  await tid(page, 'camp-players').click();
  await tid(page, 'setup-name-PAST').fill('  aLEX ');
  await tid(page, 'setup-next').click();
  await tid(page, 'camp-forge').click();
  await expect(tid(page, 'forge-scrap')).toContainText('17');
});

test('an old save (one pile per team) moves onto the players names', async ({ page }) => {
  await toCamp(page);
  await page.evaluate(
    ([key]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          scrap: { PAST: 12, FUTURE: 7 },
          loadout: {
            PAST: { weapon: 'royalSword', owned: { royalSword: 1 }, upgrades: { tower: 1 } },
            FUTURE: { weapon: 'plasmaBlade', owned: { plasmaBlade: 1 }, upgrades: {} },
          },
          creditedSeed: null,
        }),
      ),
    [CAMP_KEY] as const,
  );
  await page.reload();
  await tid(page, 'camp-forge').click();
  await expect(tid(page, 'forge-scrap')).toContainText('12');
  await tid(page, 'forge-team-FUTURE').click();
  await expect(tid(page, 'forge-scrap')).toContainText('7');
  await tid(page, 'forge-back').click();
  await tid(page, 'camp-upgrade').click();
  await expect(tid(page, 'upgrade-row-tower')).toContainText('Level 1 of 3');
  await tid(page, 'upgrade-back').click();
  // After the first save the camp is in the new, by-name shape.
  await tid(page, 'camp-forge').click();
  await tid(page, 'forge-weapon-royalSword').click();
  const saved = await savedCamp(page);
  expect(Object.keys(saved.wallets).sort()).toEqual(['alex', 'sam']);
});
