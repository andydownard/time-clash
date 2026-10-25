// @vitest-environment jsdom
// "My weapons" in Build Base's Weapons mode: the player's own Workshop weapons as their own group
// at the top of the list, with a picture, name and damage. Picking one mounts it for no Scrap.
// With none made, one quiet link opens the Forge Workshop over the builder.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshBases, slotSpots, type BasesState } from '../../src/game/baseBuilder';
import { BUILDER_COPY } from '../../src/data/copy';
import { customMountWeapons } from '../../src/game/customMounts';
import type { CustomWeapon } from '../../src/game/customWeapons';
import { forgeCustomWeapon } from '../../src/game/economy';
import { walletOf, type CampState } from '../../src/game/loadout';
import type { Team } from '../../src/game/types';
import { NAMES, campWith } from '../helpers/camp';
import { click, q, qa, setup } from './helpers';

const css = readFileSync(join(process.cwd(), 'src/styles/baseBuilder.css'), 'utf8');

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});
afterEach(() => {
  document.body.replaceChildren();
});

const BONK = { base: 'royalSword', power: 4, reach: 3, splash: 3 } as const;
const KABOOM = { base: 'ironCannon', power: 5, reach: 1, splash: 4 } as const;
const ZAP = { base: 'plasmaBlade', power: 3, reach: 4, splash: 3 } as const;

function made(scrap = 100): CampState {
  let camp = campWith(scrap + 100, scrap + 100);
  const forge = (team: Team, d: Omit<CustomWeapon, 'id' | 'name'>, name: string) => {
    const out = forgeCustomWeapon(camp, NAMES[team], team, d, name);
    if (!out.ok) throw new Error(out.reason);
    camp = out.camp;
  };
  forge('PAST', BONK, 'Bonk');
  forge('PAST', KABOOM, 'Kaboom');
  forge('FUTURE', ZAP, 'Zap Zap');
  return camp;
}

function open(team: Team, camp: CampState, bases: BasesState = freshBases()) {
  const saved: BasesState[] = [];
  const camps: CampState[] = [];
  void s.overlay.showBaseBuilder({
    team,
    camp,
    names: NAMES,
    bases,
    saveCamp: (c) => camps.push(c),
    saveBases: (b) => saved.push(b),
  });
  return { saved, camps };
}

const pad = (n: number) => document.querySelector<SVGElement>(`.tc-bb-spot[data-spot="${n - 1}"]`)!;
const tap = (el: Element): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};
const choose = (n: number) => {
  click(q('bb-mode-weapons'));
  tap(pad(n));
};

describe('My weapons in the Weapons list', () => {
  it("lists this side's own weapons first, as their own group, with picture, name and damage", () => {
    const camp = made();
    open('PAST', camp);
    choose(2);
    const group = q('bb-mine')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe(BUILDER_COPY.myWeapons);
    expect(group.textContent).toContain(BUILDER_COPY.myWeapons);
    const ids = qa('.tc-bb-weapon[data-weapon]').map((b) => b.getAttribute('data-weapon'));
    expect(ids.slice(0, 2)).toEqual(['custom:P:1', 'custom:P:2']);
    expect(ids).toContain('cannon');
    expect(ids).not.toContain('custom:F:1');
    const [bonk] = customMountWeapons(camp, 'Alex', 'PAST');
    const tile = q('bb-mine-custom:P:1')!;
    expect(tile.textContent).toContain('Bonk');
    expect(tile.textContent).toContain(BUILDER_COPY.myDamage(bonk!.damage));
    expect(tile.querySelector('.tc-bb-myw-icon .tc-bb-myw-star')).not.toBeNull();
    expect(tile.getAttribute('aria-label')).toBe(
      BUILDER_COPY.myWeaponLabel('Bonk', bonk!.damage, false),
    );
    expect(q('bb-make-weapon')).toBeNull();
    expect(q('bb-weapon-panel')!.getAttribute('data-mine')).toBe('some');
  });

  it('Team Future sees only its own', () => {
    open('FUTURE', made());
    choose(1);
    expect(qa('[data-testid^="bb-mine-"]').map((b) => b.getAttribute('data-weapon'))).toEqual([
      'custom:F:1',
    ]);
  });

  it('picking one mounts it for no Scrap, saves a copy, draws it with a star, and marks it', () => {
    const camp = made();
    const before = walletOf(camp, 'Alex').scrap;
    const { saved, camps } = open('PAST', camp);
    choose(3);
    click(q('bb-mine-custom:P:2'));
    expect(q('bb-status')!.textContent).toBe(BUILDER_COPY.weaponPlaced('Kaboom', 3));
    expect(pad(3).getAttribute('data-weapon')).toBe('custom:P:2');
    expect(pad(3).getAttribute('aria-label')).toBe('Spot 3, kaboom, selected');
    expect(pad(3).querySelector('.tc-bb-myw-star')).not.toBeNull();
    expect(q('bb-mine-custom:P:2')!.getAttribute('aria-pressed')).toBe('true');
    expect(q('bb-mine-custom:P:2')!.querySelector('.tc-bb-myw-check')).not.toBeNull();
    expect(camps).toEqual([]);
    expect(walletOf(camp, 'Alex').scrap).toBe(before);
    const spot = slotSpots(saved.at(-1)!, 'Alex', 'PAST', 0)[2];
    expect(spot?.weapon).toBe('custom:P:2');
    expect(spot?.mine?.name).toBe('Kaboom');
    // A catalog weapon replaces it, and Clear spot empties it.
    click(q('bb-weapon-cannon'));
    expect(pad(3).getAttribute('data-weapon')).toBe('cannon');
    click(q('bb-spot-clear'));
    expect(pad(3).getAttribute('data-weapon')).toBe('');
  });

  it('a saved pad keeps its weapon after the weapon is gone from the Forge', () => {
    const camp = made();
    const { saved } = open('PAST', camp);
    choose(1);
    click(q('bb-mine-custom:P:1'));
    document.body.replaceChildren();
    s = setup();
    open('PAST', campWith(0), saved.at(-1)!);
    click(q('bb-mode-weapons'));
    expect(pad(1).getAttribute('data-weapon')).toBe('custom:P:1');
    expect(pad(1).getAttribute('aria-label')).toBe('Spot 1, bonk');
  });

  it('arrow keys move through My weapons and the rest of the list', () => {
    open('PAST', made());
    choose(1);
    const first = q('bb-mine-custom:P:1')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(q('bb-mine-custom:P:2'));
  });

  it('the group is a two-column grid and the list widens while it has some', () => {
    expect(css).toMatch(/\.tc-bb-myw-grid\s*{[^}]*grid-template-columns:\s*repeat\(2/);
    expect(css).toMatch(/\.tc-bb-weapons\[data-mine='some'\]\s*{[^}]*width:/);
    // A clash with the saved-shape tiles (.tc-bb-mine) once painted the group as a tile.
    expect(css).not.toMatch(/\.tc-bb-myw\s*{[^}]*background/);
  });
});

describe('with no weapons of your own', () => {
  it('shows one quiet link to the Forge (a Link control) and no group', () => {
    open('PAST', campWith(50));
    choose(2);
    expect(q('bb-mine')).toBeNull();
    const link = q('bb-make-weapon')!;
    expect(link.tagName).toBe('BUTTON');
    expect(link.classList.contains('tc-link')).toBe(true);
    expect(link.textContent).toBe(BUILDER_COPY.makeInForge);
    expect(q('bb-weapon-panel')!.getAttribute('data-mine')).toBe('none');
    // It is the first thing in the list.
    expect(q('bb-weapon-panel')!.querySelector('.tc-bb-weapons-list')!.firstElementChild).toBe(
      link,
    );
  });

  it('the link opens the Forge Workshop for this side; a forged weapon comes back in My weapons', () => {
    const { camps } = open('FUTURE', campWith(0, 60));
    choose(2);
    click(q('bb-make-weapon'));
    const builder = document.querySelector('[data-screen="builder"]')!;
    expect(builder.hasAttribute('inert')).toBe(true);
    expect(q('workshop-forge')).not.toBeNull();
    click(q('workshop-forge'));
    return Promise.resolve().then(async () => {
      await new Promise((r) => setTimeout(r, 0));
      expect(builder.hasAttribute('inert')).toBe(false);
      expect(camps.length).toBeGreaterThan(0);
      expect(q('bb-mine')).not.toBeNull();
      const tile = q('bb-mine-custom:F:1')!;
      expect(document.activeElement).toBe(tile);
      expect(q('bb-status')!.textContent).toContain('It is in My weapons now.');
      click(tile);
      expect(pad(2).getAttribute('data-weapon')).toBe('custom:F:1');
    });
  });

  it('Back from the Workshop returns to the link', async () => {
    open('PAST', campWith(50));
    choose(1);
    click(q('bb-make-weapon'));
    click(q('workshop-back'));
    await new Promise((r) => setTimeout(r, 0));
    expect(q('bb-mine')).toBeNull();
    expect(document.activeElement).toBe(q('bb-make-weapon'));
  });
});
