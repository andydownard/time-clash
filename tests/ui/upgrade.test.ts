// @vitest-environment jsdom
// Upgrade Base: spend Scrap on three levels of each upgrade. Every tap that cannot work says why in
// words and changes nothing. Every change is saved at once.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UPGRADE_COPY, upgradeEffect } from '../../src/data/copy';
import { walletOf, type CampState } from '../../src/game/loadout';
import type { Team } from '../../src/game/types';
import { NAMES, campWith } from '../helpers/camp';
import { UPGRADE_MAX_LEVEL, upgradeById } from '../../src/game/upgrades';
import { TEST_IDS } from '../../src/ui/types';
import { click, q, qa, setup } from './helpers';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const withScrap = campWith;
/** The wallet of the player on a side (Alex plays Past, Sam plays Future). */
const who = (c: CampState, team: Team) => walletOf(c, NAMES[team]);

function open(camp: CampState) {
  const saves: CampState[] = [];
  const done = s.overlay.showUpgrade({ camp, names: NAMES, save: (c) => saves.push(c) });
  return { saves, done };
}

const status = () => q(TEST_IDS.upgradeStatus)!.textContent;
const row = (id: string) => q(TEST_IDS.upgradeRow(id))!;
const badge = (id: string) => row(id).querySelector('.tc-forge-badge')!.textContent;
const stats = (id: string) => row(id).querySelector('.tc-forge-stats')!.textContent;

describe('Upgrade screen', () => {
  it('is named Upgrade Base, never Build, shows the Scrap, and starts on Team Past', () => {
    open(withScrap(7));
    const screen = document.querySelector('[data-screen="upgrade"]')!;
    expect(screen.querySelector('h1')!.textContent).toBe('Upgrade Base');
    expect(document.body.textContent).not.toMatch(/\bbuild\b/i);
    expect(q(TEST_IDS.upgradeScrap)!.textContent).toContain('7');
    expect(screen.getAttribute('data-team')).toBe('PAST');
    expect(q(TEST_IDS.upgradeTeam('PAST'))!.getAttribute('aria-checked')).toBe('true');
  });

  it('draws a decorative scene behind it', () => {
    open(withScrap(0));
    const art = qa('.tc-forge-art')[0]!;
    expect(art.localName).toBe('svg');
    expect(art.getAttribute('aria-hidden')).toBe('true');
  });

  it('lists the three Past upgrades with what they do, the level and the cost in words', () => {
    open(withScrap(0));
    expect(qa('.tc-forge-name').map((n) => n.textContent)).toEqual([
      'Upgrade the Tower',
      'Reinforce the Wall',
      'New Castle Gate',
    ]);
    expect(stats('tower')).toBe(
      `${upgradeEffect('maxHp', 12)} · ${UPGRADE_COPY.level(0, UPGRADE_MAX_LEVEL)}`,
    );
    expect(badge('tower')).toBe(UPGRADE_COPY.cost(upgradeById('tower')!.cost[0]));
  });

  it('switches to the Future upgrades, Scrap and look when Team Future is picked', () => {
    open(withScrap(0, 9));
    click(q(TEST_IDS.upgradeTeam('FUTURE')));
    expect(document.querySelector('[data-screen="upgrade"]')!.getAttribute('data-team')).toBe(
      'FUTURE',
    );
    expect(qa('.tc-forge-name').map((n) => n.textContent)).toEqual([
      'Force Field',
      'Missile Launcher',
      'Laser Squad',
    ]);
    expect(q(TEST_IDS.upgradeScrap)!.textContent).toContain('9');
  });

  it('closes when Back is tapped, and focuses Back first so a stray key buys nothing', async () => {
    const { done } = open(withScrap(50));
    expect(document.activeElement).toBe(q(TEST_IDS.upgradeBack));
    click(q(TEST_IDS.upgradeBack));
    await done;
    expect(q(TEST_IDS.upgradeBack)).toBeNull();
  });
});

describe('Scrap by player name', () => {
  it('shows the name of the player on the chosen side next to their Scrap', () => {
    open(withScrap(7, 9));
    expect(q(TEST_IDS.upgradeScrap)!.textContent).toContain('Alex');
    click(q(TEST_IDS.upgradeTeam('FUTURE')));
    expect(q(TEST_IDS.upgradeScrap)!.textContent).toContain('Sam');
    expect(q(TEST_IDS.upgradeScrap)!.textContent).toContain('9');
  });
  it('records the upgrade under that player name and keeps their lifetime Scrap', () => {
    const { saves } = open(withScrap(30, 0));
    click(row('tower'));
    expect(who(saves[0]!, 'PAST').loadout.PAST.upgrades.tower).toBe(1);
    expect(who(saves[0]!, 'PAST').earned).toBe(30);
  });
});

describe('upgrading', () => {
  it('spends the Scrap for the next level, saves, and says so', () => {
    const { saves } = open(withScrap(30));
    const u = upgradeById('tower')!;
    click(row('tower'));
    expect(saves).toHaveLength(1);
    expect(who(saves[0]!, 'PAST').scrap).toBe(30 - u.cost[0]);
    expect(who(saves[0]!, 'PAST').loadout.PAST.upgrades.tower).toBe(1);
    expect(status()).toBe(UPGRADE_COPY.upgraded('Upgrade the Tower', 1));
    expect(q(TEST_IDS.upgradeScrap)!.textContent).toContain(String(30 - u.cost[0]));
    expect(stats('tower')).toContain(UPGRADE_COPY.level(1, UPGRADE_MAX_LEVEL));
    expect(badge('tower')).toBe(UPGRADE_COPY.cost(u.cost[1]));
  });

  it('goes up one level at a time to the top, each at its own price, then stops', () => {
    const { saves } = open(withScrap(200));
    const u = upgradeById('wall')!;
    for (let level = 1; level <= UPGRADE_MAX_LEVEL; level++) click(row('wall'));
    expect(saves).toHaveLength(3);
    expect(who(saves.at(-1)!, 'PAST').loadout.PAST.upgrades.wall).toBe(3);
    expect(who(saves.at(-1)!, 'PAST').scrap).toBe(200 - u.cost[0] - u.cost[1] - u.cost[2]);
    expect(badge('wall')).toBe(UPGRADE_COPY.topLevel);
    expect(row('wall').getAttribute('data-state')).toBe('max');
    click(row('wall'));
    expect(saves).toHaveLength(3);
    expect(status()).toBe(UPGRADE_COPY.atTop);
  });

  it('says who owns an upgrade once it has a level, and nothing before', () => {
    open(withScrap(30, 30));
    const owner = (id: string) => row(id).querySelector('.tc-forge-owned')?.textContent;
    expect(owner('tower')).toBeUndefined();
    click(row('tower'));
    expect(owner('tower')).toBe(UPGRADE_COPY.ownedBy('Alex'));
    click(q(TEST_IDS.upgradeTeam('FUTURE')));
    click(row('forceField'));
    expect(owner('forceField')).toBe('Owned by Sam');
  });

  it('has no loose button at the bottom and no word rebuild or build', () => {
    open(withScrap(50));
    const screen = document.querySelector('[data-screen="upgrade"]')!;
    expect(screen.querySelectorAll('.tc-forge-upgrade, .tc-forge-levelup')).toHaveLength(0);
    expect(screen.textContent).not.toMatch(/rebuild|\bbuild\b/i);
  });

  it('says how much more Scrap is needed when poor, and changes nothing', () => {
    const { saves } = open(withScrap(2));
    const u = upgradeById('tower')!;
    expect(row('tower').getAttribute('aria-disabled')).toBe('true');
    expect(row('tower').hasAttribute('disabled')).toBe(false);
    click(row('tower'));
    expect(saves).toEqual([]);
    expect(status()).toBe(UPGRADE_COPY.needMore(u.cost[0] - 2));
    expect(q(TEST_IDS.upgradeScrap)!.textContent).toContain('2');
  });

  it('never takes Scrap from the other team, and each team keeps its own levels', () => {
    const { saves } = open(withScrap(50, 50));
    click(row('tower'));
    expect(who(saves[0]!, 'FUTURE').scrap).toBe(50);
    click(q(TEST_IDS.upgradeTeam('FUTURE')));
    click(row('forceField'));
    expect(who(saves.at(-1)!, 'FUTURE').loadout.FUTURE.upgrades.forceField).toBe(1);
    expect(who(saves.at(-1)!, 'PAST').loadout.PAST.upgrades.tower).toBe(1);
    click(q(TEST_IDS.upgradeTeam('PAST')));
    expect(stats('tower')).toContain(UPGRADE_COPY.level(1, UPGRADE_MAX_LEVEL));
  });

  it('describes each effect in plain words', () => {
    expect(upgradeEffect('maxHp', 12)).toBe('Base health +12');
    expect(upgradeEffect('shieldHits', 1)).toBe('Blocks 1 hit each match');
    expect(upgradeEffect('shieldHits', 3)).toBe('Blocks 3 hits each match');
    expect(upgradeEffect('repair', 4)).toBe('Heals 4 health each turn');
    expect(upgradeEffect('directBonus', 2)).toBe('Your direct hits +2');
  });
});
