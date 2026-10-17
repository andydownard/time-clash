// @vitest-environment jsdom
// Forge Weapon: pick, unlock and forge weapons with Scrap. Every tap that cannot work says why in
// words and changes nothing. Every change is saved at once.
import { beforeEach, describe, expect, it } from 'vitest';
import { FORGE_COPY } from '../../src/data/copy';
import { freshLoadout, walletOf, type CampState } from '../../src/game/loadout';
import type { Team } from '../../src/game/types';
import { NAMES, campWith } from '../helpers/camp';
import { FORGE, weaponById } from '../../src/game/weapons';
import { TEST_IDS } from '../../src/ui/types';
import { click, flush, q, qa, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const withScrap = campWith;
/** The wallet of the player on a side (Alex plays Past, Sam plays Future). */
const who = (c: CampState, team: Team) => walletOf(c, NAMES[team]);

function open(camp: CampState) {
  const saves: CampState[] = [];
  const done = s.overlay.showForge({ camp, names: NAMES, save: (c) => saves.push(c) });
  return { saves, done };
}

const status = () => q(TEST_IDS.forgeStatus)!.textContent;
const row = (id: string) => q(TEST_IDS.forgeWeapon(id))!;

describe('Forge screen', () => {
  it('names itself, shows the Scrap, and starts on Team Past', () => {
    open(withScrap(7));
    const screen = document.querySelector('[data-screen="forge"]')!;
    expect(screen.querySelector('h1')!.textContent).toBe(FORGE_COPY.title);
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain('7');
    expect(screen.getAttribute('data-team')).toBe('PAST');
    expect(q(TEST_IDS.forgeTeam('PAST'))!.getAttribute('aria-checked')).toBe('true');
    expect(q(TEST_IDS.forgeTeam('FUTURE'))!.getAttribute('aria-checked')).toBe('false');
  });

  it('draws a decorative scene behind it', () => {
    open(withScrap(0));
    const art = qa('.tc-forge-art')[0]!;
    expect(art.localName).toBe('svg');
    expect(art.getAttribute('aria-hidden')).toBe('true');
  });

  it('lists the three Past weapons with damage, range and level in words', () => {
    open(withScrap(0));
    const rows = qa('.tc-forge-row');
    expect(rows.map((r) => r.querySelector('.tc-forge-name')!.textContent)).toEqual([
      'Royal Sword',
      'Elder Longbow',
      'Iron Cannon',
    ]);
    expect(row('royalSword').querySelector('.tc-forge-stats')!.textContent).toBe(
      'Damage 25 · Range Short · Level 1',
    );
    expect(row('ironCannon').querySelector('.tc-forge-stats')!.textContent).toContain('Range Far');
    expect(rows.every((r) => r.querySelector('svg')!.getAttribute('aria-hidden') === 'true')).toBe(
      true,
    );
  });

  it('shows Equipped, Owned and the Scrap cost in words, not only by color', () => {
    const camp = withScrap(0);
    who(camp, 'PAST').loadout.PAST.owned.elderLongbow = 1;
    open(camp);
    const badge = (id: string) => row(id).querySelector('.tc-forge-badge')!.textContent;
    expect(badge('royalSword')).toBe(FORGE_COPY.equipped);
    expect(badge('elderLongbow')).toBe(FORGE_COPY.owned);
    expect(badge('ironCannon')).toBe(FORGE_COPY.unlockCost(weaponById('ironCannon')!.cost));
    expect(row('royalSword').getAttribute('aria-pressed')).toBe('true');
    expect(row('elderLongbow').getAttribute('aria-pressed')).toBe('false');
  });

  it('uses the Future weapons and a Future look when Team Future is picked', () => {
    open(withScrap(0, 5));
    click(q(TEST_IDS.forgeTeam('FUTURE')));
    expect(document.querySelector('[data-screen="forge"]')!.getAttribute('data-team')).toBe(
      'FUTURE',
    );
    expect(qa('.tc-forge-name').map((n) => n.textContent)).toEqual([
      'Plasma Blade',
      'Laser Rifle',
      'Rail Cannon',
    ]);
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain('5');
  });

  it('closes when Back is tapped', async () => {
    const { done } = open(withScrap(0));
    click(q(TEST_IDS.forgeBack));
    await done;
    expect(q(TEST_IDS.forgeBack)).toBeNull();
  });

  it('focuses Back first (a safe first stop, nothing is bought by a stray key)', () => {
    open(withScrap(50));
    expect(document.activeElement).toBe(q(TEST_IDS.forgeBack));
  });
});

describe('Scrap by player name', () => {
  it('shows the name of the player on the chosen side next to their Scrap', () => {
    open(withScrap(7, 9));
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain('Alex');
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain('7');
    click(q(TEST_IDS.forgeTeam('FUTURE')));
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain('Sam');
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain('9');
  });
  it('spends that player Scrap and records the purchase under their name', () => {
    const { saves } = open(withScrap(30, 0));
    click(row('elderLongbow'));
    expect(Object.keys(saves[0]!.wallets).sort()).toEqual(['alex', 'sam']);
    expect(walletOf(saves[0]!, 'alex').loadout.PAST.owned.elderLongbow).toBe(1);
  });
  it('keeps the lifetime Scrap when Scrap is spent', () => {
    const { saves } = open(withScrap(30, 0));
    click(row('elderLongbow'));
    expect(who(saves[0]!, 'PAST').earned).toBe(30);
  });
});

describe('unlocking a weapon', () => {
  it('spends the Scrap, owns it, saves, and says so', () => {
    const { saves } = open(withScrap(20));
    const w = weaponById('elderLongbow')!;
    click(row('elderLongbow'));
    expect(saves).toHaveLength(1);
    expect(who(saves[0]!, 'PAST').scrap).toBe(20 - w.cost);
    expect(who(saves[0]!, 'PAST').loadout.PAST.owned.elderLongbow).toBe(1);
    expect(status()).toBe(FORGE_COPY.unlocked('Elder Longbow'));
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain(String(20 - w.cost));
    expect(row('elderLongbow').querySelector('.tc-forge-badge')!.textContent).toBe(
      FORGE_COPY.owned,
    );
  });

  it('does nothing and says how much more Scrap is needed when it is too much', () => {
    const { saves } = open(withScrap(9));
    click(row('elderLongbow'));
    expect(saves).toEqual([]);
    expect(status()).toBe(FORGE_COPY.needMore(weaponById('elderLongbow')!.cost - 9));
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain('9');
    expect(row('elderLongbow').getAttribute('data-state')).toBe('locked');
  });

  it('marks a weapon you cannot pay for yet with aria-disabled, but keeps it tappable', () => {
    open(withScrap(0));
    expect(row('elderLongbow').getAttribute('aria-disabled')).toBe('true');
    expect(row('elderLongbow').hasAttribute('disabled')).toBe(false);
    expect(row('royalSword').getAttribute('aria-disabled')).toBe('false');
  });

  it('never takes Scrap from the other team', () => {
    const { saves } = open(withScrap(30, 30));
    click(row('elderLongbow'));
    expect(who(saves[0]!, 'FUTURE').scrap).toBe(30);
  });
});

describe('equipping a weapon', () => {
  it('equips an owned weapon for free, and saves', () => {
    const camp = withScrap(5);
    who(camp, 'PAST').loadout.PAST.owned.elderLongbow = 1;
    const { saves } = open(camp);
    click(row('elderLongbow'));
    expect(who(saves[0]!, 'PAST').loadout.PAST.weapon).toBe('elderLongbow');
    expect(who(saves[0]!, 'PAST').scrap).toBe(5);
    expect(status()).toBe(FORGE_COPY.equippedNow('Elder Longbow'));
    expect(row('elderLongbow').getAttribute('aria-pressed')).toBe('true');
    expect(row('royalSword').getAttribute('aria-pressed')).toBe('false');
  });

  it('tapping the weapon in use only says it is equipped, with no save', () => {
    const { saves } = open(withScrap(50));
    click(row('royalSword'));
    expect(saves).toEqual([]);
    expect(status()).toBe(FORGE_COPY.equippedNow('Royal Sword'));
  });

  it('remembers each team own choice when you switch sides', () => {
    const camp = withScrap(50, 50);
    who(camp, 'FUTURE').loadout.FUTURE = {
      ...freshLoadout('FUTURE'),
      owned: { plasmaBlade: 1, laserRifle: 1 },
    };
    open(camp);
    click(q(TEST_IDS.forgeTeam('FUTURE')));
    click(row('laserRifle'));
    click(q(TEST_IDS.forgeTeam('PAST')));
    expect(row('royalSword').getAttribute('aria-pressed')).toBe('true');
    click(q(TEST_IDS.forgeTeam('FUTURE')));
    expect(row('laserRifle').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('forge upgrade', () => {
  const upgrade = () => q<HTMLButtonElement>(TEST_IDS.forgeUpgrade)!;

  it('shows the price for the next level', () => {
    open(withScrap(50));
    expect(upgrade().textContent).toBe(FORGE_COPY.upgrade(FORGE.upgradeCost[0]!));
  });

  it('raises the weapon in use one level, spends the Scrap, and shows the new damage', () => {
    const { saves } = open(withScrap(50));
    click(upgrade());
    expect(who(saves[0]!, 'PAST').loadout.PAST.owned.royalSword).toBe(2);
    expect(who(saves[0]!, 'PAST').scrap).toBe(50 - FORGE.upgradeCost[0]!);
    expect(status()).toBe(FORGE_COPY.forged('Royal Sword', 2));
    expect(row('royalSword').querySelector('.tc-forge-stats')!.textContent).toContain(
      `Damage ${25 + FORGE.directPerLevel}`,
    );
    expect(row('royalSword').querySelector('.tc-forge-stats')!.textContent).toContain('Level 2');
  });

  it('says how much more Scrap it needs when poor, and changes nothing', () => {
    const { saves } = open(withScrap(2));
    expect(upgrade().getAttribute('aria-disabled')).toBe('true');
    click(upgrade());
    expect(saves).toEqual([]);
    expect(status()).toBe(FORGE_COPY.needMore(FORGE.upgradeCost[0]! - 2));
  });

  it('stops at the top level, says so, and never spends more', () => {
    const { saves } = open(withScrap(100));
    click(upgrade());
    click(upgrade());
    expect(upgrade().textContent).toBe(FORGE_COPY.upgradeMax);
    const before = saves.length;
    click(upgrade());
    expect(saves).toHaveLength(before);
    expect(status()).toBe(FORGE_COPY.atTop);
    expect(who(saves.at(-1)!, 'PAST').loadout.PAST.owned.royalSword).toBe(FORGE.maxLevel);
  });

  it('upgrades the weapon in use, not another one', () => {
    const camp = withScrap(100);
    who(camp, 'PAST').loadout.PAST.owned.elderLongbow = 1;
    who(camp, 'PAST').loadout.PAST.weapon = 'elderLongbow';
    const { saves } = open(camp);
    click(upgrade());
    expect(who(saves[0]!, 'PAST').loadout.PAST.owned).toEqual({ royalSword: 1, elderLongbow: 2 });
  });

  it('repeating a refused tap reads the message out again', async () => {
    open(withScrap(0));
    click(upgrade());
    const first = status();
    click(upgrade());
    expect(status()).toBe(first);
    await flush();
  });
});
