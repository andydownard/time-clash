// @vitest-environment jsdom
// Upgrade Base: spend Scrap on three levels of each upgrade. Every tap that cannot work says why in
// words and changes nothing. Every change is saved at once.
import { beforeEach, describe, expect, it } from 'vitest';
import { UPGRADE_COPY, upgradeEffect } from '../../src/data/copy';
import { freshCamp, type CampState } from '../../src/game/loadout';
import { UPGRADE_MAX_LEVEL, upgradeById } from '../../src/game/upgrades';
import { TEST_IDS } from '../../src/ui/types';
import { click, q, qa, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const withScrap = (past: number, future = 0): CampState => ({
  ...freshCamp(),
  scrap: { PAST: past, FUTURE: future },
});

function open(camp: CampState) {
  const saves: CampState[] = [];
  const done = s.overlay.showUpgrade({ camp, save: (c) => saves.push(c) });
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
      'Rebuild the Tower',
      'Mend the Wall',
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

describe('upgrading', () => {
  it('spends the Scrap for the next level, saves, and says so', () => {
    const { saves } = open(withScrap(30));
    const u = upgradeById('tower')!;
    click(row('tower'));
    expect(saves).toHaveLength(1);
    expect(saves[0]!.scrap.PAST).toBe(30 - u.cost[0]);
    expect(saves[0]!.loadout.PAST.upgrades.tower).toBe(1);
    expect(status()).toBe(UPGRADE_COPY.upgraded('Rebuild the Tower', 1));
    expect(q(TEST_IDS.upgradeScrap)!.textContent).toContain(String(30 - u.cost[0]));
    expect(stats('tower')).toContain(UPGRADE_COPY.level(1, UPGRADE_MAX_LEVEL));
    expect(badge('tower')).toBe(UPGRADE_COPY.cost(u.cost[1]));
  });

  it('goes up one level at a time to the top, each at its own price, then stops', () => {
    const { saves } = open(withScrap(200));
    const u = upgradeById('wall')!;
    for (let level = 1; level <= UPGRADE_MAX_LEVEL; level++) click(row('wall'));
    expect(saves).toHaveLength(3);
    expect(saves.at(-1)!.loadout.PAST.upgrades.wall).toBe(3);
    expect(saves.at(-1)!.scrap.PAST).toBe(200 - u.cost[0] - u.cost[1] - u.cost[2]);
    expect(badge('wall')).toBe(UPGRADE_COPY.topLevel);
    expect(row('wall').getAttribute('data-state')).toBe('max');
    click(row('wall'));
    expect(saves).toHaveLength(3);
    expect(status()).toBe(UPGRADE_COPY.atTop);
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
    expect(saves[0]!.scrap.FUTURE).toBe(50);
    click(q(TEST_IDS.upgradeTeam('FUTURE')));
    click(row('forceField'));
    expect(saves.at(-1)!.loadout.FUTURE.upgrades.forceField).toBe(1);
    expect(saves.at(-1)!.loadout.PAST.upgrades.tower).toBe(1);
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
