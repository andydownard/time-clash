// @vitest-environment jsdom
// The two Phase 2 gear buttons in the battle bar: ammo and the evasion ability.
import { beforeEach, describe, expect, it } from 'vitest';
import { GEAR_COPY } from '../../src/data/copy';
import type { AmmoId } from '../../src/game/ammo';
import { nextAmmo } from '../../src/ui/hudGear';
import type { HudGear, HudHandlers, HudState } from '../../src/ui/types';
import { TEST_IDS } from '../../src/ui/types';
import { click, q, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const gear = (over: Partial<HudGear> = {}): HudGear => ({
  ammo: 'standard',
  ammoLeft: {},
  evasion: { id: 'barricade', phase: 'ready', turnsLeft: 0, usesLeft: 1 },
  ...over,
});

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
  units: [],
  gear: gear(),
  ...over,
});

function show(over: Partial<HudState> = {}) {
  const ammo: AmmoId[] = [];
  let evasions = 0;
  const h: HudHandlers = {
    onAim: () => {},
    onFire: () => {},
    onSelect: () => {},
    onMuteToggle: () => {},
    onAmmo: (id) => void ammo.push(id),
    onEvasion: () => void evasions++,
  };
  s.overlay.showHud(h);
  s.overlay.updateHud(state(over));
  return { ammo, evasions: () => evasions };
}

const ammoBtn = () => q<HTMLButtonElement>(TEST_IDS.gearAmmo)!;
const evasionBtn = () => q<HTMLButtonElement>(TEST_IDS.gearEvasion)!;

describe('nextAmmo', () => {
  it('cycles Standard, then each kind with shots left, then back to Standard', () => {
    const left = { confetti: 2, plasma: 0, bowling: 1 };
    expect(nextAmmo('standard', left)).toBe('confetti');
    expect(nextAmmo('confetti', left)).toBe('bowling');
    expect(nextAmmo('bowling', left)).toBe('standard');
    expect(nextAmmo('standard', {})).toBe('standard');
  });
});

describe('ammo button', () => {
  it('is hidden when the team has no special ammo', () => {
    show();
    expect(ammoBtn().hidden).toBe(true);
  });

  it('shows the loaded kind and shots left in words for a screen reader', () => {
    show({ gear: gear({ ammo: 'confetti', ammoLeft: { confetti: 2 } }) });
    expect(ammoBtn().hidden).toBe(false);
    expect(ammoBtn().getAttribute('aria-label')).toBe(
      GEAR_COPY.ammoButton('Confetti', GEAR_COPY.shotsLeft(2)),
    );
    expect(ammoBtn().textContent).toContain('2');
  });

  it('a tap asks for the next kind', () => {
    const r = show({ gear: gear({ ammoLeft: { bowling: 2 } }) });
    click(ammoBtn());
    expect(r.ammo).toEqual(['bowling']);
  });

  it('does nothing while Fire is off', () => {
    const r = show({ canFire: false, gear: gear({ ammoLeft: { bowling: 2 } }) });
    expect(ammoBtn().disabled).toBe(true);
    click(ammoBtn());
    expect(r.ammo).toEqual([]);
  });
});

describe('evasion button', () => {
  it('names the ability and its state in words', () => {
    show();
    expect(evasionBtn().getAttribute('aria-label')).toBe(GEAR_COPY.ready('Stone Wall'));
    expect(evasionBtn().getAttribute('aria-pressed')).toBe('false');
    expect(evasionBtn().textContent).toContain(GEAR_COPY.abilities.barricade.short);
  });

  it('a tap asks to arm, and an armed ability shows pressed', () => {
    const r = show();
    click(evasionBtn());
    expect(r.evasions()).toBe(1);
    s.overlay.updateHud(
      state({
        gear: gear({ evasion: { id: 'barricade', phase: 'armed', turnsLeft: 0, usesLeft: 0 } }),
      }),
    );
    expect(evasionBtn().getAttribute('aria-pressed')).toBe('true');
    expect(evasionBtn().getAttribute('aria-label')).toBe(GEAR_COPY.armed('Stone Wall'));
    // Armed keeps the same words as ready (no check mark), so the button does not change size.
    // The Ember ring and aria-pressed carry the state (Regression 24).
    expect(evasionBtn().textContent).not.toMatch(/[✓✔]/);
    expect(evasionBtn().textContent).toContain(GEAR_COPY.abilities.barricade.short);
  });

  it('is off while recharging or used up, and says why', () => {
    const r = show({
      gear: gear({
        evasion: { id: 'dodge', phase: 'recharging', turnsLeft: 1, usesLeft: Infinity },
      }),
    });
    expect(evasionBtn().disabled).toBe(true);
    expect(evasionBtn().getAttribute('aria-label')).toBe(
      GEAR_COPY.recharging('Hoverboard Dodge', 1),
    );
    click(evasionBtn());
    s.overlay.updateHud(
      state({
        gear: gear({ evasion: { id: 'barricade', phase: 'used', turnsLeft: 0, usesLeft: 0 } }),
      }),
    );
    expect(evasionBtn().disabled).toBe(true);
    expect(evasionBtn().getAttribute('aria-label')).toBe(GEAR_COPY.used('Stone Wall'));
    click(evasionBtn());
    expect(r.evasions()).toBe(0);
  });

  it('is off while Fire is off', () => {
    const r = show({ canFire: false });
    expect(evasionBtn().disabled).toBe(true);
    click(evasionBtn());
    expect(r.evasions()).toBe(0);
  });

  it('the whole gear group hides when the state has no gear', () => {
    show({ gear: undefined });
    expect(document.querySelector<HTMLElement>('.tc-gear')!.hidden).toBe(true);
  });
});
