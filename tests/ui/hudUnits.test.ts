// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { HUD } from '../../src/data/copy';
import { unitsOf, type UnitId } from '../../src/game/units';
import type { HudHandlers, HudState } from '../../src/ui/types';
import { TEST_IDS } from '../../src/ui/types';
import { click, key, q, qa, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const roster = (team: 'PAST' | 'FUTURE') => unitsOf(team).map((u) => ({ id: u.id, name: u.name }));

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
  units: roster('PAST'),
  ...over,
});

const handlers = () => {
  const picks: UnitId[] = [];
  const h: HudHandlers = {
    onAim: () => {},
    onFire: () => {},
    onMuteToggle: () => {},
    onSelect: (id) => picks.push(id),
  };
  return { h, picks };
};

const show = (over: Partial<HudState> = {}) => {
  const hs = handlers();
  s.overlay.showHud(hs.h);
  s.overlay.updateHud(state(over));
  return hs;
};
const tokens = () => qa('.tc-unit');

describe('fighter selector: markup', () => {
  it('has a labelled radio group inside the bottom bar, before the aim panel', () => {
    show();
    const group = document.querySelector('.tc-units')!;
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe(HUD.pickOne);
    expect(group.closest('.tc-hud-bottom')).not.toBeNull();
    expect(group.compareDocumentPosition(document.querySelector('.tc-aim')!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(group.textContent).toContain('Pick one');
  });

  it('shows letters A to E for Team Past with names for screen readers', () => {
    show();
    expect(tokens().map((t) => t.textContent)).toEqual(['A', 'B', 'C', 'D', 'E']);
    const c = q('unit-C')!;
    expect(c.getAttribute('role')).toBe('radio');
    expect(c.getAttribute('type')).toBe('button');
    expect(c.getAttribute('aria-label')).toBe('Cannon Knight C');
    expect(c.dataset.unit).toBe('C');
  });

  it('shows numbers 1 to 5 for Team Future', () => {
    show({ activeTeam: 'FUTURE', selected: '1', units: roster('FUTURE') });
    expect(tokens().map((t) => t.textContent)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('marks only the selected fighter and shows its name', () => {
    show({ selected: 'D' });
    expect(tokens().filter((t) => t.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    expect(q('unit-D')!.getAttribute('aria-checked')).toBe('true');
    expect(q('unit-C')!.getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('.tc-unit-name')!.textContent).toBe('Catapult');
  });

  it('has no tokens when no team is up', () => {
    show({ activeTeam: null, units: [] });
    expect(tokens()).toHaveLength(0);
    expect(document.querySelector('.tc-unit-name')!.textContent).toBe('');
  });
});

describe('fighter selector: taps', () => {
  it('a tap calls onSelect with the id', () => {
    const { picks } = show();
    click(q('unit-B'));
    expect(picks).toEqual(['B']);
  });

  it('is disabled and ignores taps when the player cannot fire', () => {
    const { picks } = show({ canFire: false });
    expect(q('unit-B')!.getAttribute('aria-disabled')).toBe('true');
    click(q('unit-B'));
    expect(picks).toEqual([]);
  });

  it('is enabled when the player can fire', () => {
    show();
    expect(q('unit-B')!.getAttribute('aria-disabled')).toBe('false');
  });
});

describe('fighter selector: keyboard', () => {
  it('a letter key selects that fighter, any case', () => {
    const { picks } = show();
    key(document.body, 'a');
    key(document.body, 'D');
    expect(picks).toEqual(['A', 'D']);
  });

  it('a number key selects for Team Future', () => {
    const { picks } = show({ activeTeam: 'FUTURE', selected: '1', units: roster('FUTURE') });
    key(document.body, '3');
    expect(picks).toEqual(['3']);
  });

  it('keys for the other team do nothing', () => {
    const { picks } = show();
    key(document.body, '2');
    key(document.body, 'z');
    expect(picks).toEqual([]);
  });

  it('is ignored when the player cannot fire', () => {
    const { picks } = show({ canFire: false });
    key(document.body, 'a');
    expect(picks).toEqual([]);
  });

  it('is ignored with Ctrl, Meta or Alt', () => {
    const { picks } = show();
    key(document.body, 'a', { ctrlKey: true });
    key(document.body, 'a', { metaKey: true });
    key(document.body, 'a', { altKey: true });
    expect(picks).toEqual([]);
  });

  it('is ignored while typing in a text field', () => {
    const { picks } = show();
    const input = document.createElement('input');
    input.type = 'text';
    document.body.append(input);
    key(input, 'a');
    expect(picks).toEqual([]);
  });

  it('works from a fighter token that has focus', () => {
    const { picks } = show();
    key(q('unit-C')!, 'e');
    expect(picks).toEqual(['E']);
  });

  it('is ignored while the game is paused', () => {
    const { picks } = show();
    document.body.dataset.paused = '1';
    key(document.body, 'a');
    expect(picks).toEqual([]);
  });

  it('the screen reader help mentions the fighter keys', () => {
    show();
    expect(document.querySelector('.tc-hint')!.textContent).toContain(HUD.keyboardHint);
    expect(HUD.keyboardHint).toMatch(/letter|number/i);
  });

  it('keeps the tests wired to the shared id list', () => {
    expect(TEST_IDS.unit('C')).toBe('unit-C');
  });
});
