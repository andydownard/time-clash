// @vitest-environment jsdom
// The Camp hub: one big button that starts the match, two closed buttons that say so, and rules
// that must hold on every look (real buttons, a name for assistive tech, no color-only meaning).
import { beforeEach, describe, expect, it } from 'vitest';
import { CAMP, GAME_TAGLINE, GAME_TITLE } from '../../src/data/copy';
import { LOCAL_IDS } from '../../src/ui/constants';
import { TEST_IDS } from '../../src/ui/types';
import { click, flush, q, qa, setup } from './helpers';

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

  it('has three real buttons with the right words', () => {
    void s.overlay.showCamp();
    const buttons = qa('[data-screen="camp"] button');
    expect(buttons.map((b) => b.textContent)).toEqual([CAMP.start, CAMP.forge, CAMP.upgrade]);
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

describe('Camp closed buttons', () => {
  it('show a Coming soon ribbon in words, not only by dimming', () => {
    void s.overlay.showCamp();
    const slots = qa('.tc-camp-slot');
    expect(slots).toHaveLength(2);
    for (const slot of slots) {
      expect(slot.querySelector('.tc-camp-soon')!.textContent).toBe(CAMP.soon);
      const button = slot.querySelector('button')!;
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.hasAttribute('disabled')).toBe(false);
    }
  });

  it('stay on the Camp when tapped, and say why in a polite status line', async () => {
    let done = false;
    void s.overlay.showCamp().then(() => (done = true));
    const status = q(LOCAL_IDS.campStatus)!;
    expect(status.getAttribute('role')).toBe('status');
    click(q(TEST_IDS.campForge));
    expect(status.textContent).toBe(CAMP.forgeSoon);
    click(q(TEST_IDS.campUpgrade));
    expect(status.textContent).toBe(CAMP.upgradeSoon);
    await flush();
    expect(done).toBe(false);
    expect(q(TEST_IDS.campStart)).not.toBeNull();
  });

  it('wiggle the ribbon on a tap, so a child can see something heard them', () => {
    void s.overlay.showCamp();
    const ribbon = q(TEST_IDS.campForge)!.parentElement!.querySelector('.tc-camp-soon')!;
    expect(ribbon.hasAttribute('data-nudge')).toBe(false);
    click(q(TEST_IDS.campForge));
    expect(ribbon.hasAttribute('data-nudge')).toBe(true);
  });

  it('can be reached with the keyboard (aria-disabled, not disabled)', () => {
    void s.overlay.showCamp();
    for (const id of [TEST_IDS.campForge, TEST_IDS.campUpgrade]) {
      const b = q<HTMLButtonElement>(id)!;
      b.focus();
      expect(document.activeElement).toBe(b);
    }
  });
});
