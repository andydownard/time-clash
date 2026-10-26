// @vitest-environment jsdom
// Weapons on the pads in the "Pick one" selector (docs/GAME_SPEC.md "Weapons on the pads"). One
// Base weapons token after the fighters switches the selector to the base's weapons and picks
// the first; a Fighters token (a person and the word) switches back. The tokens on show always hold
// what Fire will shoot, and the selector is never wider than five fighters plus one token.
import { beforeEach, describe, expect, it } from 'vitest';
import { HUD } from '../../src/data/copy';
import type { ShooterId } from '../../src/game/types';
import { unitsOf } from '../../src/game/units';
import type { HudHandlers, HudMount, HudState } from '../../src/ui/types';
import { TEST_IDS } from '../../src/ui/types';
import { click, key, q, qa, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const MOUNTS: HudMount[] = [
  { id: 'mount:0', spot: 0, name: 'Cannon', art: 'cannon', mine: false },
  { id: 'mount:2', spot: 2, name: 'Catapult', art: 'catapult', mine: false },
  { id: 'mount:3', spot: 3, name: 'Bonk', art: 'cannon', mine: true },
];

const state = (over: Partial<HudState> = {}): HudState => ({
  activeTeam: 'PAST',
  names: { PAST: 'Alex', FUTURE: 'Sam' },
  baseHp: { PAST: 100, FUTURE: 100 },
  scrap: { PAST: 0, FUTURE: 0 },
  wind: 0,
  angleDeg: 45,
  power: 60,
  shotsLeft: 2,
  canFire: true,
  bonus: false,
  selected: 'C',
  units: unitsOf('PAST').map((u) => ({ id: u.id, name: u.name })),
  mounts: MOUNTS,
  selectedMount: null,
  ...over,
});

const show = (over: Partial<HudState> = {}) => {
  const picks: ShooterId[] = [];
  const h: HudHandlers = {
    onAim: () => {},
    onFire: () => {},
    onMuteToggle: () => {},
    onSelect: (id) => picks.push(id),
  };
  s.overlay.showHud(h);
  s.overlay.updateHud(state(over));
  return { picks, update: (o: Partial<HudState>) => s.overlay.updateHud(state(o)) };
};
const tokens = () => qa('.tc-unit');
const name = () => document.querySelector('.tc-unit-name')!.textContent;

describe('the Base weapons token', () => {
  it('shows after the five fighters only when the team has a weapon that can fire', () => {
    show();
    expect(tokens()).toHaveLength(6);
    const swap = q(TEST_IDS.unitWeapons)!;
    expect(tokens()[5]).toBe(swap);
    expect(swap.getAttribute('role')).toBe('radio');
    expect(swap.getAttribute('aria-checked')).toBe('false');
    expect(swap.getAttribute('aria-label')).toBe(HUD.baseWeapons);
    // A picture, not color alone: the first weapon's icon.
    expect(swap.querySelector('svg')).not.toBeNull();
  });

  it('is not there with no weapons (the bar is as before)', () => {
    show({ mounts: [] });
    expect(tokens()).toHaveLength(5);
    expect(q(TEST_IDS.unitWeapons)).toBeNull();
    show({ mounts: undefined });
    expect(tokens()).toHaveLength(5);
  });

  it('a tap picks the first weapon', () => {
    const { picks } = show();
    click(q(TEST_IDS.unitWeapons));
    expect(picks).toEqual(['mount:0']);
  });

  it('ignores taps when the player cannot fire', () => {
    const { picks } = show({ canFire: false });
    click(q(TEST_IDS.unitWeapons));
    expect(picks).toEqual([]);
  });
});

describe('the weapons view', () => {
  it('lists each weapon with its picture and spot number, then the fighter token', () => {
    show({ selectedMount: 'mount:2' });
    const t = tokens();
    expect(t.map((x) => x.dataset.testid)).toEqual([
      TEST_IDS.unit('mount:0'),
      TEST_IDS.unit('mount:2'),
      TEST_IDS.unit('mount:3'),
      TEST_IDS.unitFighters,
    ]);
    for (const m of t.slice(0, 3)) expect(m.querySelector('svg')).not.toBeNull();
    expect(q(TEST_IDS.unit('mount:2'))!.textContent).toContain('3');
    expect(q(TEST_IDS.unit('mount:2'))!.getAttribute('aria-label')).toBe(
      HUD.mountLabel(3, 'Catapult'),
    );
    // A weapon of your own wears the Forge star.
    expect(q(TEST_IDS.unit('mount:3'))!.querySelector('.tc-bb-myw-star')).not.toBeNull();
  });

  it('marks only the picked weapon and names it', () => {
    show({ selectedMount: 'mount:2' });
    const on = tokens().filter((x) => x.getAttribute('aria-checked') === 'true');
    expect(on).toHaveLength(1);
    expect(on[0]!.dataset.testid).toBe(TEST_IDS.unit('mount:2'));
    expect(name()).toBe('Catapult');
  });

  it('the Fighters token says "Fighters" with a person picture, and switches back to the picked fighter', () => {
    const { picks } = show({ selectedMount: 'mount:0', selected: 'D' });
    const back = q(TEST_IDS.unitFighters)!;
    expect(back.tagName).toBe('BUTTON');
    expect(back.textContent).toBe(HUD.fighters);
    expect(HUD.fighters).toBe('Fighters');
    expect(back.querySelector('.tc-unit-back-label')!.textContent).toBe(HUD.fighters);
    // A picture as well as words, so a pre-reader can find it.
    const icon = back.querySelector('svg[data-icon="fighter"]')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(back.classList.contains('tc-unit-back')).toBe(true);
    // A screen reader still hears which fighter it goes back to.
    expect(back.getAttribute('aria-label')).toBe(HUD.fightersLabel('Catapult', 'D'));
    click(back);
    expect(picks).toEqual(['D']);
  });

  it('the Fighters token is reachable by Tab (it is a real button, never disabled while aiming)', () => {
    show({ selectedMount: 'mount:0' });
    const back = q<HTMLButtonElement>(TEST_IDS.unitFighters)!;
    expect(back.disabled).toBe(false);
    expect(back.tabIndex).toBeGreaterThanOrEqual(0);
    back.focus();
    expect(document.activeElement).toBe(back);
  });

  it('a weapon token picks that weapon', () => {
    const { picks } = show({ selectedMount: 'mount:0' });
    click(q(TEST_IDS.unit('mount:3')));
    expect(picks).toEqual(['mount:3']);
  });

  it("a fighter's letter key still picks that fighter", () => {
    const { picks } = show({ selectedMount: 'mount:0' });
    key(document.body, 'b');
    expect(picks).toEqual(['B']);
  });

  it('goes back to the fighters view when the pick is a fighter again', () => {
    const { update } = show({ selectedMount: 'mount:0' });
    update({ selectedMount: null });
    expect(tokens()).toHaveLength(6);
    expect(q(TEST_IDS.unit('C'))!.getAttribute('aria-checked')).toBe('true');
    expect(name()).toBe('Cannon Knight');
  });

  it('never shows more tokens than five fighters plus one', () => {
    const four: HudMount[] = [0, 1, 2, 3].map((i) => ({
      id: `mount:${i}` as HudMount['id'],
      spot: i,
      name: 'Cannon',
      art: 'cannon',
      mine: false,
    }));
    show({ mounts: four, selectedMount: 'mount:1' });
    expect(tokens().length).toBeLessThanOrEqual(6);
  });
});
