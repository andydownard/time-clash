// @vitest-environment jsdom
// The Weapon Workshop (Make my own weapon) and the Forge's My weapons section. A tap that cannot
// work says why in words and changes nothing. A typed name that is not okay is never used.
import { beforeEach, describe, expect, it } from 'vitest';
import { FORGE_COPY, WORKSHOP_COPY } from '../../src/data/copy';
import { WORKSHOP } from '../../src/game/config';
import { customCost, customWeaponId, presetFor } from '../../src/game/customWeapons';
import { forgeCustomWeapon } from '../../src/game/economy';
import { walletOf, type CampState } from '../../src/game/loadout';
import { customWeaponIcon } from '../../src/ui/forgeArt';
import { TEST_IDS } from '../../src/ui/types';
import { NAMES, campWith } from '../helpers/camp';
import { click, flush, q, qa, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

function openForge(camp: CampState) {
  const saves: CampState[] = [];
  const done = s.overlay.showForge({ camp, names: NAMES, save: (c) => saves.push(c) });
  return { saves, done };
}
const ws = () => document.querySelector<HTMLElement>('[data-screen="workshop"]');
const status = () => q(TEST_IDS.workshopStatus)!.textContent;
const value = (stat: string) => Number(q(TEST_IDS.workshopStat(stat))!.textContent);
const typeName = (text: string) => {
  const input = q<HTMLInputElement>(TEST_IDS.workshopTyped)!;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const previewName = () => q(TEST_IDS.workshopPreview)!.querySelector('.tc-forge-name')!.textContent;

/** A camp where Alex already made `n` weapons for Team Past. */
function campWithMine(n: number, scrap = 200): CampState {
  let camp = campWith(scrap);
  for (let i = 0; i < n; i++) {
    const out = forgeCustomWeapon(
      camp,
      'Alex',
      'PAST',
      { base: 'royalSword', ...presetFor('royalSword') },
      `Bonk ${i}`,
    );
    if (out.ok) camp = out.camp;
  }
  return camp;
}

describe('Make my own weapon (the Forge button)', () => {
  it('sits under the list, at least tap size in words, and opens the Workshop', () => {
    openForge(campWith(0));
    const make = q(TEST_IDS.forgeMake)!;
    expect(make.textContent).toContain(FORGE_COPY.makeOwn);
    expect(make.closest('.tc-forge-foot')).not.toBeNull();
    click(make);
    expect(ws()).not.toBeNull();
    expect(ws()!.querySelector('h1')!.textContent).toBe(WORKSHOP_COPY.title);
    expect(ws()!.getAttribute('data-team')).toBe('PAST');
    // The Forge underneath cannot be reached while the Workshop is open.
    expect(document.querySelector('[data-screen="forge"]')!.hasAttribute('inert')).toBe(true);
  });

  it('opens for the side picked in the Forge', () => {
    openForge(campWith(0, 0));
    click(q(TEST_IDS.forgeTeam('FUTURE')));
    click(q(TEST_IDS.forgeMake));
    expect(ws()!.getAttribute('data-team')).toBe('FUTURE');
    expect(qa('.tc-ws-style-name').map((n) => n.textContent)).toEqual([
      'Blade',
      'Rifle',
      'Rail Cannon',
    ]);
    expect(q(TEST_IDS.workshopScrap)!.textContent).toContain('Sam');
  });

  it('hides My weapons until there is one, then shows the count', () => {
    openForge(campWith(0));
    expect(q(TEST_IDS.forgeMine)).toBeNull();
    s = setup();
    openForge(campWithMine(2));
    // One of them is in use, so the Forge opens on My weapons; the toggle leads back.
    expect(q(TEST_IDS.forgeMine)!.textContent).toContain(FORGE_COPY.allWeapons);
    click(q(TEST_IDS.forgeMine));
    expect(q(TEST_IDS.forgeMine)!.textContent).toContain(FORGE_COPY.myWeapons(2));
  });

  it(`says there is no more room at ${WORKSHOP.maxPerTeam} and does not open`, () => {
    openForge(campWithMine(WORKSHOP.maxPerTeam));
    const make = q(TEST_IDS.forgeMake)!;
    expect(make.getAttribute('aria-disabled')).toBe('true');
    click(make);
    expect(ws()).toBeNull();
    expect(q(TEST_IDS.forgeStatus)!.textContent).toBe(FORGE_COPY.full(WORKSHOP.maxPerTeam));
  });
});

describe('the Workshop pad', () => {
  it('starts on the starter style with its preset, and shows points left', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    const p = presetFor('royalSword');
    expect(q(TEST_IDS.workshopStyle('royalSword'))!.getAttribute('aria-checked')).toBe('true');
    expect(value('power')).toBe(p.power);
    expect(q(TEST_IDS.workshopPoints)!.textContent).toBe(
      WORKSHOP_COPY.pointsLeft(WORKSHOP.budget - p.power - p.reach - p.splash),
    );
    expect(document.activeElement).toBe(q(TEST_IDS.workshopStyle('royalSword')));
  });

  it('a new style loads its own preset', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    click(q(TEST_IDS.workshopStyle('elderLongbow')));
    expect(value('reach')).toBe(presetFor('elderLongbow').reach);
    expect(q(TEST_IDS.workshopStyle('elderLongbow'))!.getAttribute('aria-checked')).toBe('true');
  });

  it('plus and minus move points and update the words next to them', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    click(q(TEST_IDS.workshopMore('power')));
    expect(value('power')).toBe(4);
    const row = document.querySelector('.tc-ws-stat[data-stat="power"]')!;
    expect(row.querySelector('.tc-ws-effect')!.textContent).toBe(WORKSHOP_COPY.power(28));
    click(q(TEST_IDS.workshopLess('power')));
    expect(value('power')).toBe(3);
    expect(q(TEST_IDS.workshopLess('power'))!.getAttribute('aria-label')).toBe('Less Power');
  });

  it('never goes over the budget, over the max, or under the min, and says why', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    for (let i = 0; i < 10; i++) click(q(TEST_IDS.workshopMore('power')));
    expect(value('power')).toBe(WORKSHOP.maxPoints);
    expect(status()).toBe(WORKSHOP_COPY.atMost('Power'));
    for (let i = 0; i < 10; i++) click(q(TEST_IDS.workshopMore('splash')));
    expect(value('splash')).toBe(4);
    expect(status()).toBe(WORKSHOP_COPY.noPoints);
    expect(q(TEST_IDS.workshopPoints)!.textContent).toBe(WORKSHOP_COPY.pointsLeft(0));
    expect(q(TEST_IDS.workshopMore('reach'))!.getAttribute('aria-disabled')).toBe('true');
    for (let i = 0; i < 10; i++) click(q(TEST_IDS.workshopLess('reach')));
    expect(value('reach')).toBe(WORKSHOP.minPoints);
    expect(status()).toBe(WORKSHOP_COPY.atLeast('Reach'));
  });

  it('shows the Scrap cost on the Forge it button, from the rules', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    expect(q(TEST_IDS.workshopForge)!.textContent).toBe(
      WORKSHOP_COPY.forge(customCost(presetFor('royalSword'))),
    );
    expect(q(TEST_IDS.workshopForge)!.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('naming it', () => {
  it('uses the two picked words by default and when they change', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    expect(previewName()).toBe('Wobbly Thunder');
    const w1 = q<HTMLSelectElement>(TEST_IDS.workshopWord1)!;
    w1.value = String(WORKSHOP_COPY.adjectives.indexOf('Zippy'));
    w1.dispatchEvent(new Event('change', { bubbles: true }));
    expect(previewName()).toBe('Zippy Thunder');
  });

  it('a typed name that is fine replaces the picked words', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    typeName('  Big   Bonk ');
    expect(previewName()).toBe('Big Bonk');
    expect(status()).toBe('');
  });

  it.each([
    ['kill zone', WORKSHOP_COPY.nameProblem.blocked],
    ['Alex Zapper', WORKSHOP_COPY.nameProblem.private],
    ['Zap 5551234', WORKSHOP_COPY.nameProblem.digits],
    ['Zap!', WORKSHOP_COPY.nameProblem.letters],
  ])('a typed name like "%s" is not used: it says why and keeps the picked words', (text, why) => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    typeName(text);
    expect(previewName()).toBe('Wobbly Thunder');
    expect(status()).toBe(`${why} ${WORKSHOP_COPY.keepPicked('Wobbly Thunder')}`);
  });

  it('also refuses a word on the Setup name list', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    // A word only the Setup list holds (ROT13 here, like src/ui/nameBlocklist.ts), in leet.
    const rot13 = (t: string) =>
      t.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
    typeName(`Big ${rot13('cbea').replace('o', '0')}`);
    expect(previewName()).toBe('Wobbly Thunder');
  });

  it('limits typing to the max length', () => {
    openForge(campWith(0));
    click(q(TEST_IDS.forgeMake));
    expect(q(TEST_IDS.workshopTyped)!.getAttribute('maxlength')).toBe(
      String(WORKSHOP.typedNameMax),
    );
  });
});

describe('forging it', () => {
  it('not enough Scrap: says how much more, saves nothing, stays open', () => {
    const { saves } = openForge(campWith(2));
    click(q(TEST_IDS.forgeMake));
    click(q(TEST_IDS.workshopForge));
    expect(saves).toEqual([]);
    expect(status()).toBe(WORKSHOP_COPY.needMore(customCost(presetFor('royalSword')) - 2));
    expect(ws()).not.toBeNull();
  });

  it('with enough Scrap: saves, closes, shows My weapons with it equipped, says so', async () => {
    const { saves } = openForge(campWith(50));
    click(q(TEST_IDS.forgeMake));
    typeName('Big Bonk');
    click(q(TEST_IDS.workshopForge));
    await flush();
    expect(ws()).toBeNull();
    expect(saves).toHaveLength(1);
    const kit = walletOf(saves[0]!, 'Alex').loadout.PAST;
    expect(kit.custom![0]!.name).toBe('Big Bonk');
    expect(kit.weapon).toBe(customWeaponId('PAST', 1));
    const forge = document.querySelector('[data-screen="forge"]')!;
    expect(forge.hasAttribute('inert')).toBe(false);
    expect(forge.getAttribute('data-view')).toBe('mine');
    const card = q(TEST_IDS.forgeWeapon('custom:P:1'))!;
    expect(card.getAttribute('aria-pressed')).toBe('true');
    expect(card.textContent).toContain('Big Bonk');
    expect(card.textContent).toContain(FORGE_COPY.equipped);
    expect(q(TEST_IDS.forgeStatus)!.textContent).toBe(WORKSHOP_COPY.forged('Big Bonk'));
    expect(document.activeElement).toBe(card);
    // Level up for it sits under the grid.
    expect(q(TEST_IDS.forgeUpgrade)!.closest('.tc-forge-foot')).not.toBeNull();
    expect(q(TEST_IDS.forgeScrap)!.textContent).toContain(
      String(50 - customCost(presetFor('royalSword'))),
    );
  });

  it('Back closes the Workshop with nothing saved and focus on the button', async () => {
    const { saves } = openForge(campWith(50));
    click(q(TEST_IDS.forgeMake));
    click(q(TEST_IDS.workshopBack));
    await flush();
    expect(ws()).toBeNull();
    expect(saves).toEqual([]);
    expect(document.activeElement).toBe(q(TEST_IDS.forgeMake));
  });
});

describe('My weapons in the Forge', () => {
  it('opens on My weapons when one of yours is in use, and toggles back to all', () => {
    openForge(campWithMine(2));
    expect(qa('.tc-forge-card')).toHaveLength(2);
    click(q(TEST_IDS.forgeMine));
    expect(qa('.tc-forge-card')).toHaveLength(0);
    expect(q(TEST_IDS.forgeWeapon('royalSword'))).not.toBeNull();
    expect(q(TEST_IDS.forgeMine)!.textContent).toContain(FORGE_COPY.myWeapons(2));
  });

  it('equips one of yours, and levels up the one in use', () => {
    const { saves } = openForge(campWithMine(2));
    click(q(TEST_IDS.forgeWeapon('custom:P:1')));
    expect(walletOf(saves[0]!, 'Alex').loadout.PAST.weapon).toBe('custom:P:1');
    click(q(TEST_IDS.forgeUpgrade));
    expect(walletOf(saves[1]!, 'Alex').loadout.PAST.owned['custom:P:1']).toBe(2);
    expect(q(TEST_IDS.forgeWeapon('custom:P:1'))!.textContent).toContain(`${FORGE_COPY.level} 2`);
  });

  it('draws each one with its style picture, a team glow and a star, all decorative', () => {
    openForge(campWithMine(1));
    const icon = q(TEST_IDS.forgeWeapon('custom:P:1'))!.querySelector('svg')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('class')).toContain('tc-weapon-icon-mine');
    const past = customWeaponIcon(document, 'royalSword', 'PAST').innerHTML;
    const future = customWeaponIcon(document, 'plasmaBlade', 'FUTURE').innerHTML;
    expect(past).toContain('#8247e8');
    expect(future).toContain('#4fd8ff');
    expect(past).not.toBe(customWeaponIcon(document, 'ironCannon', 'PAST').innerHTML);
  });

  it('switching teams shows that side, with no cards from the other', () => {
    openForge(campWithMine(2));
    click(q(TEST_IDS.forgeTeam('FUTURE')));
    expect(qa('.tc-forge-card')).toHaveLength(0);
    expect(q(TEST_IDS.forgeMine)).toBeNull();
  });
});
