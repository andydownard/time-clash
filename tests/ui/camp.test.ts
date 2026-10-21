// @vitest-environment jsdom
// The Camp hub: one big button that starts the match, two closed buttons that say so, and rules
// that must hold on every look (real buttons, a name for assistive tech, no color-only meaning).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMP, GAME_TAGLINE, GAME_TITLE } from '../../src/data/copy';
import { TEST_IDS } from '../../src/ui/types';
import { click, q, qa, setup } from './helpers';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

describe('Camp screen', () => {
  it('shows the name as the logo and says it to a screen reader in an h1', () => {
    void s.overlay.showCamp();
    const screen = document.querySelector('[data-screen="camp"]')!;
    const h1 = screen.querySelector('h1')!;
    expect(h1.textContent).toBe(`${GAME_TITLE} ${CAMP.heading}`);
    expect(h1.classList.contains('tc-sr-only')).toBe(true);
    const logo = screen.querySelector('.tc-camp-logo')!;
    expect(logo.getAttribute('aria-hidden')).toBe('true');
    expect(logo.textContent).toBe('Time Clash');
  });

  it('draws the picture as a decorative SVG behind the buttons', () => {
    void s.overlay.showCamp();
    const art = qa('.tc-camp-art')[0]!;
    expect(art.localName).toBe('svg');
    expect(art.getAttribute('aria-hidden')).toBe('true');
    expect(art.querySelector('[id^="tcCamp"]')).not.toBeNull();
  });

  it('has four real buttons with the right words', () => {
    void s.overlay.showCamp();
    const buttons = qa('[data-screen="camp"] button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      CAMP.start,
      CAMP.forge,
      CAMP.upgrade,
      CAMP.players,
    ]);
    for (const b of buttons) expect(b.getAttribute('type')).toBe('button');
  });

  it('puts the slogan on the big button and never makes it the name', () => {
    expect(GAME_TAGLINE).toBe('Time to Clash!');
    expect(GAME_TITLE).toBe('Time Clash');
    expect(CAMP.start).toBe(GAME_TAGLINE);
    void s.overlay.showCamp();
    expect(q(TEST_IDS.campStart)!.textContent).toBe('Time to Clash!');
    expect(document.querySelector('[data-screen="camp"] h1')!.textContent).not.toBe(GAME_TAGLINE);
  });

  it('focuses the big button first, so Enter starts the match', () => {
    void s.overlay.showCamp();
    expect(document.activeElement).toBe(q(TEST_IDS.campStart));
  });

  it('resolves with battle and closes when the big button is tapped', async () => {
    const p = s.overlay.showCamp();
    click(q(TEST_IDS.campStart));
    await expect(p).resolves.toBe('battle');
    expect(q(TEST_IDS.campStart)).toBeNull();
  });
});

describe('Camp Change players', () => {
  it('resolves with players and closes, so Setup can open', async () => {
    const p = s.overlay.showCamp();
    click(q(TEST_IDS.campPlayers));
    await expect(p).resolves.toBe('players');
    expect(q(TEST_IDS.campStart)).toBeNull();
  });
  it('is a real, 56px-class neutral button that Tab can reach', () => {
    void s.overlay.showCamp();
    const b = q<HTMLButtonElement>(TEST_IDS.campPlayers)!;
    expect(b.classList.contains('tc-btn')).toBe(true);
    expect(b.disabled).toBe(false);
    b.focus();
    expect(document.activeElement).toBe(b);
  });
});

describe('Camp side buttons', () => {
  it.each([
    [TEST_IDS.campForge, 'forge'],
    [TEST_IDS.campUpgrade, 'upgrade'],
  ] as const)('%s is a working button that opens its own screen', async (id, choice) => {
    const p = s.overlay.showCamp();
    const button = q<HTMLButtonElement>(id)!;
    expect(button.getAttribute('aria-disabled')).toBeNull();
    click(button);
    await expect(p).resolves.toBe(choice);
    expect(q(TEST_IDS.campStart)).toBeNull();
  });

  it('has no Coming soon text anywhere now that both screens exist', () => {
    void s.overlay.showCamp();
    expect(document.body.textContent).not.toMatch(/coming soon/i);
    expect(document.querySelector('.tc-camp-soon')).toBeNull();
  });

  it('puts Forge Weapon on the Past side and Upgrade Base on the Future side', () => {
    void s.overlay.showCamp();
    expect(q(TEST_IDS.campForge)!.parentElement!.getAttribute('data-kind')).toBe('past');
    expect(q(TEST_IDS.campUpgrade)!.parentElement!.getAttribute('data-kind')).toBe('future');
  });
});
