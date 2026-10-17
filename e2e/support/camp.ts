// Helpers for tests that need Scrap: write a saved camp, by player name, straight into storage.
import type { Page } from '@playwright/test';

export const CAMP_KEY = 'timeclash.camp';

type Kit = { weapon: string; owned: Record<string, number>; upgrades: Record<string, number> };
const starter = (weapon: string): Kit => ({ weapon, owned: { [weapon]: 1 }, upgrades: {} });

/** Gives Alex (Team Past) and Sam (Team Future) this much Scrap, with the starter weapons. */
export async function giveScrap(page: Page, alex: number, sam: number): Promise<void> {
  const wallet = (name: string, scrap: number) => ({
    name,
    scrap,
    earned: scrap,
    loadout: { PAST: starter('royalSword'), FUTURE: starter('plasmaBlade') },
  });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key as string, JSON.stringify(value)),
    [
      CAMP_KEY,
      {
        wallets: { alex: wallet('Alex', alex), sam: wallet('Sam', sam) },
        creditedSeed: null,
      },
    ] as const,
  );
}

/** Reads the saved camp back out of storage. */
export async function savedCamp(page: Page): Promise<{
  wallets: Record<
    string,
    { name: string; scrap: number; earned: number; loadout: Record<string, Kit> }
  >;
}> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), CAMP_KEY);
}
