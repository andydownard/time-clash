// @vitest-environment jsdom
// Escape is Back and H is Hear it, on the screens that have them (Regression 4: one press never
// does two jobs, and Hear it never speaks question text).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HudHandlers, HudSquads, HudState } from '../../src/ui/types';
import { TEST_IDS } from '../../src/ui/types';
import { key, q, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});
afterEach(() => s.overlay.hideHud());

describe('Escape is Back on a screen with a Back button', () => {
  it('leaves Setup (with Back) and saves nothing', async () => {
    let resolved: unknown = 'pending';
    void s.overlay.showSetup(null, { back: true }).then((v) => (resolved = v));
    key(document.body, 'Escape');
    await Promise.resolve();
    expect(resolved).toBeNull();
    expect(q(TEST_IDS.setupBack)).toBeNull();
  });

  it('does nothing on a screen with no Back button (Setup first time)', () => {
    void s.overlay.showSetup(null);
    key(document.body, 'Escape');
    expect(q(TEST_IDS.setupNext)).not.toBeNull();
  });

  it('does not leave while a name box has focus (typing)', () => {
    void s.overlay.showSetup(null, { back: true });
    const name = q<HTMLInputElement>(TEST_IDS.setupName('PAST'))!;
    key(name, 'Escape');
    expect(q(TEST_IDS.setupBack)).not.toBeNull();
  });

  it('ignores a press another handler already used', () => {
    void s.overlay.showSetup(null, { back: true });
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    e.preventDefault();
    document.body.dispatchEvent(e);
    expect(q(TEST_IDS.setupBack)).not.toBeNull();
  });

  it('leaves the Settings panel to close itself first', () => {
    void s.overlay.showSetup(null, { back: true });
    const panel = document.createElement('div');
    panel.setAttribute('data-testid', 'settings-panel');
    document.body.append(panel);
    key(document.body, 'Escape');
    expect(q(TEST_IDS.setupBack)).not.toBeNull();
  });
});

describe('Escape and H with the walking helper picked', () => {
  const squads = (picked: string): HudSquads => ({
    goesDone: 0,
    helpers: [
      { id: 'PAST-launcher', name: 'Cannon Crew', kind: 'launcher' },
      { id: 'PAST-dasher', name: 'Sir Bonk', kind: 'dasher' },
    ],
    picked,
    targets: ['g2'],
  });
  const state = (picked: string): HudState => ({
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
    squads: squads(picked),
  });
  const show = (picked: string): string[] => {
    const calls: string[] = [];
    const h: HudHandlers = {
      onAim: () => {},
      onFire: () => calls.push('fire'),
      onMuteToggle: () => {},
      onSelect: () => {},
      onHelper: (id) => calls.push(`helper:${id}`),
      onDash: () => {},
      onRecall: () => {},
      onHearHelper: () => calls.push('hear'),
    };
    s.overlay.showHud(h);
    s.overlay.updateHud(state(picked));
    return calls;
  };

  it('Escape is Back, and the same press does not reach the pause handler', () => {
    const calls = show('PAST-dasher');
    let reached = false;
    const spy = (): void => void (reached = true);
    document.addEventListener('keydown', spy);
    key(document.body, 'Escape');
    document.removeEventListener('keydown', spy);
    expect(calls).toEqual(['helper:PAST-launcher']);
    expect(reached).toBe(false);
  });

  it('Escape with the launcher picked is left alone (it pauses as before)', () => {
    const calls = show('PAST-launcher');
    let reached = false;
    const spy = (): void => void (reached = true);
    document.addEventListener('keydown', spy);
    key(document.body, 'Escape');
    document.removeEventListener('keydown', spy);
    expect(calls).toEqual([]);
    expect(reached).toBe(true);
  });

  it('H is Hear it, in either pick, in lower or upper case', () => {
    const calls = show('PAST-launcher');
    key(document.body, 'h');
    key(document.body, 'H');
    expect(calls).toEqual(['hear', 'hear']);
  });

  it('H and Escape do nothing while a cover is up or the game is paused', () => {
    const calls = show('PAST-dasher');
    document.body.dataset.paused = '1';
    key(document.body, 'h');
    key(document.body, 'Escape');
    delete document.body.dataset.paused;
    document.body.dataset.cover = 'reload';
    key(document.body, 'h');
    delete document.body.dataset.cover;
    expect(calls).toEqual([]);
  });

  it('H does nothing while typing in a text box', () => {
    const calls = show('PAST-launcher');
    const input = document.createElement('input');
    document.body.append(input);
    key(input, 'h');
    expect(calls).toEqual([]);
  });
});

describe('the HUD frame lets taps through to the picture', () => {
  it('has no inline pointer-events (the CSS keeps it none, so a fighter can be tapped)', () => {
    s.overlay.showHud({
      onAim: () => {},
      onFire: () => {},
      onMuteToggle: () => {},
      onSelect: () => {},
    } as HudHandlers);
    const hud = document.querySelector<HTMLElement>('.tc-hud')!;
    expect(hud.style.pointerEvents).toBe('');
  });
});
