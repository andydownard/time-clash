// @vitest-environment jsdom
// Squads S1 helper bar in the HUD: GO banner, helper pick, dash spots, Fire gating.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SQUAD_COPY, goTurnBanner } from '../../src/data/copy';
import type { HudHandlers, HudSquads, HudState } from '../../src/ui/types';
import { TEST_IDS } from '../../src/ui/types';
import { click, key, q, qa, setup } from './helpers';

vi.setConfig({ testTimeout: 120_000 });

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const squads = (over: Partial<HudSquads> = {}): HudSquads => ({
  goesDone: 0,
  helpers: [
    { id: 'PAST-launcher', name: 'Cannon Crew', kind: 'launcher' },
    { id: 'PAST-dasher', name: 'Chariot Archers', kind: 'dasher' },
  ],
  picked: 'PAST-launcher',
  targets: [],
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
  bonus: false,
  canFire: true,
  selected: 'C',
  units: [],
  ...over,
});
const show = (over: Partial<HudState>): string[] => {
  const calls: string[] = [];
  const h: HudHandlers = {
    onAim: () => {},
    onFire: () => calls.push('fire'),
    onMuteToggle: () => {},
    onSelect: () => {},
    onHelper: (id) => calls.push(`helper:${id}`),
    onDash: (spot) => calls.push(`dash:${spot}`),
  };
  s.overlay.showHud(h);
  s.overlay.updateHud(state(over));
  return calls;
};

describe('flag off (no squads in the state)', () => {
  it('hides the bar and keeps the old shot words', () => {
    show({});
    expect(document.querySelector('.tc-squad-bar')!.hasAttribute('hidden')).toBe(true);
    expect(q(TEST_IDS.turnBanner)!.textContent).toBe('ALEX, YOUR TURN! (SHOT 1 OF 2)');
  });
});

describe('flag on', () => {
  it('says GO 1 OF 2 with two dots, and GO 2 OF 2 after one go', () => {
    show({ squads: squads() });
    expect(q(TEST_IDS.goBanner)!.textContent).toBe('GO 1 OF 2');
    expect(qa('.tc-go-dot')).toHaveLength(2);
    expect(qa('.tc-go-dot[data-used="true"]')).toHaveLength(0);
    s.overlay.updateHud(state({ squads: squads({ goesDone: 1 }), shotsLeft: 1 }));
    expect(q(TEST_IDS.goBanner)!.textContent).toBe('GO 2 OF 2');
    expect(qa('.tc-go-dot[data-used="true"]')).toHaveLength(1);
    expect(q(TEST_IDS.turnBanner)!.textContent).toBe(goTurnBanner('Alex', 2));
  });
  it('shows both helpers by name and marks the picked one in the markup', () => {
    show({ squads: squads() });
    expect(q(TEST_IDS.helper('PAST-launcher'))!.textContent).toContain('Cannon Crew');
    expect(q(TEST_IDS.helper('PAST-launcher'))!.getAttribute('aria-checked')).toBe('true');
    expect(q(TEST_IDS.helper('PAST-dasher'))!.getAttribute('aria-checked')).toBe('false');
  });
  it('picks a helper on click and keeps Fire on for the launcher', () => {
    const calls = show({ squads: squads() });
    click(q(TEST_IDS.helper('PAST-dasher')));
    expect(calls).toEqual(['helper:PAST-dasher']);
    expect((q(TEST_IDS.fireButton) as HTMLButtonElement).disabled).toBe(false);
  });
  it('with the dasher picked: spots show, Fire is off, a spot click dashes', () => {
    const calls = show({ squads: squads({ picked: 'PAST-dasher', targets: ['g2'] }) });
    expect((q(TEST_IDS.fireButton) as HTMLButtonElement).disabled).toBe(true);
    key(document.body, ' ');
    expect(calls).toEqual([]);
    click(q(TEST_IDS.dashSpot('g2')));
    expect(calls).toEqual(['dash:g2']);
    expect(q(TEST_IDS.dashSpot('g2'))!.getAttribute('aria-label')).toBe(SQUAD_COPY.spotAria(3));
  });
  it('says so kindly when no spot is free', () => {
    show({ squads: squads({ picked: 'PAST-dasher', targets: [] }) });
    expect(document.querySelector('.tc-dash-none')!.textContent).toBe(SQUAD_COPY.noSpots);
  });
  it('does nothing while a cover is up or a shot flies (canFire false)', () => {
    const calls = show({
      canFire: false,
      squads: squads({ picked: 'PAST-dasher', targets: ['g2'] }),
    });
    click(q(TEST_IDS.helper('PAST-launcher')));
    click(q(TEST_IDS.dashSpot('g2')));
    expect(calls).toEqual([]);
  });
  it('sets 56px targets and 20px text in the stylesheet', () => {
    const css = readFileSync('src/styles/ui.css', 'utf8');
    const block = css.slice(css.indexOf('.tc-helper,\n.tc-dash-spot'));
    expect(block).toMatch(/min-width:\s*56px/);
    expect(block).toMatch(/min-height:\s*56px/);
    expect(block).toMatch(/font-size:\s*20px/);
  });
});
