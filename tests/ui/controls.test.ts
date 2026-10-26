// @vitest-environment jsdom
// One rule set for controls (docs/DESIGN_SYSTEM.md, "Controls"):
// a Button starts an action, a Selector picks a value, a Link is a quiet rare action.
// Each screen is opened and every control is checked against the rule. The Base Builder screen
// is left out on purpose: it is being laid out again and will adopt these classes.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { INTRO_SCRIPT } from '../../src/data/introScript';
import { DEFAULT_PLAN } from '../../src/game/config';
import type { TeamStats } from '../../src/game/types';
import { CHROME_IDS, createHowToPlay, mountChrome } from '../../src/scenes/chrome';
import { NAMES, campWith } from '../helpers/camp';
import { makeServices } from '../scenes/fakes';
import { click, mathQ, q, qa, setup } from './helpers';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const css = read('../../src/styles/ui.css');
function bodyOf(selector: string): string {
  const out: string[] = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const sels = (m[1] as string).split(',').map((x) => x.trim());
    if (sels.includes(selector)) out.push(m[2] as string);
  }
  return out.join(';');
}

const stats = (): Record<'PAST' | 'FUTURE', TeamStats> => {
  const one: TeamStats = {
    shotsFired: 8,
    directHits: 2,
    nearHits: 1,
    questionsAnswered: 3,
    correctAnswers: 2,
    fastestAnswerMs: 2500,
    scrapEarned: 5,
  };
  return { PAST: one, FUTURE: { ...one } };
};

/** The control rule, checked on whatever is in the document now. */
function checkControls(where: string): void {
  // Selectors: every radio is a .tc-chip inside a radiogroup. Every switch is a .tc-chip.tc-toggle.
  for (const el of qa('[role="radio"]')) {
    expect(el.classList.contains('tc-chip'), `${where}: radio ${el.outerHTML}`).toBe(true);
    expect(el.closest('[role="radiogroup"]'), `${where}: radio outside a group`).not.toBeNull();
  }
  for (const el of qa('[role="switch"]')) {
    expect(el.classList.contains('tc-toggle'), `${where}: switch ${el.outerHTML}`).toBe(true);
    expect(['true', 'false']).toContain(el.getAttribute('aria-checked'));
  }
  // The selector look is only for selectors, and a button never pretends to be one.
  for (const el of qa('.tc-chip')) {
    expect(['radio', 'switch'], `${where}: chip ${el.outerHTML}`).toContain(
      el.getAttribute('role'),
    );
  }
  for (const el of qa('.tc-btn')) {
    expect(el.getAttribute('role'), `${where}: button ${el.outerHTML}`).toBeNull();
    expect(el.classList.contains('tc-chip'), `${where}: button ${el.outerHTML}`).toBe(false);
  }
  // A link is never also a button or a selector.
  for (const el of qa('.tc-link')) {
    expect(el.classList.contains('tc-btn') || el.classList.contains('tc-chip')).toBe(false);
  }
  // One filled primary per screen or panel at most.
  expect(qa('.tc-screen .tc-btn-primary').length, `${where}: primaries`).toBeLessThanOrEqual(1);
  // No check mark in any selector's words: the solid fill already says "picked" (owner,
  // 2026-10-25), and a mark that comes and goes makes the strip change size (Regression 24).
  for (const el of qa('[role="radio"], [role="switch"], [aria-pressed]')) {
    expect(el.textContent ?? '', `${where}: check in ${el.outerHTML}`).not.toMatch(/[✓✔]/);
  }
}

describe('controls follow one rule on every screen', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it('Tap to Play: Sound and Captions are switches, Tap to Play is the one primary', () => {
    void s.overlay.showTapToStart({ onMuteToggle: () => {}, onCaptionsToggle: () => {} });
    checkControls('tap');
    expect(q('mute-toggle')!.getAttribute('role')).toBe('switch');
    expect(q('captions-toggle')!.getAttribute('role')).toBe('switch');
    expect(q('tap-to-play')!.classList.contains('tc-btn-primary')).toBe(true);
  });

  it('How to Play', () => {
    void s.overlay.showIntro(INTRO_SCRIPT, () => Promise.resolve());
    checkControls('intro');
  });

  it('Setup with the Computer player choice: selectors, a dropdown and a link', () => {
    void s.overlay.showSetup(null, { computer: true });
    checkControls('setup');
    expect(q('clear-data')!.className).toBe('tc-link');
    expect(q('setup-grade-PAST')!.tagName).toBe('SELECT');
    // Subject, match length, Play with and How hard are all selectors.
    for (const id of ['setup-subject-PAST-math', 'setup-length-short', 'play-with-computer']) {
      expect(q(id)!.getAttribute('role'), id).toBe('radio');
    }
    click(q('clear-data'));
    // Wiping data is never the primary button.
    expect(q('clear-data-yes')!.classList.contains('tc-btn-primary')).toBe(false);
    expect(q('clear-data-yes')!.classList.contains('tc-btn')).toBe(true);
  });

  it('Camp', () => {
    void s.overlay.showCamp();
    checkControls('camp');
  });

  it('Battle Plan: place cards are selectors', () => {
    void s.overlay.showPlan({
      plan: DEFAULT_PLAN,
      camp: campWith(0),
      names: NAMES,
      save: () => {},
    });
    checkControls('plan');
    expect(qa('[role="radio"]').length).toBeGreaterThanOrEqual(6);
  });

  it('Forge and the old Build Base shop: the team picker is a selector', () => {
    void s.overlay.showForge({ camp: campWith(0), names: NAMES, save: () => {} });
    checkControls('forge');
    expect(q('forge-team-PAST')!.getAttribute('role')).toBe('radio');
    s = setup();
    void s.overlay.showUpgrade({ camp: campWith(0), names: NAMES, save: () => {} });
    checkControls('upgrade');
  });

  it('Pass screen and reload card: Sound is a switch', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    checkControls('pass');
    expect(q('cover-mute')!.getAttribute('role')).toBe('switch');
    s = setup();
    void s.overlay.showReloadModal({ question: mathQ, team: 'PAST', playerName: 'Alex' });
    checkControls('reload');
  });

  it('Victory', () => {
    void s.overlay.showVictory({
      winner: 'PAST',
      names: { PAST: 'Alex', FUTURE: 'Sam' },
      stats: stats(),
    });
    checkControls('victory');
  });
});

describe('Settings follows the same rule', () => {
  it('switches for on/off settings, a link for Clear my data, one primary Done', () => {
    const t = makeServices();
    const howTo = createHowToPlay({ overlay: t.overlay, audio: t.audio, env: t.clock });
    mountChrome(document, { howTo, overlay: t.overlay, audio: t.audio, storage: t.storage });
    click(q(CHROME_IDS.settingsButton));
    checkControls('settings');
    expect(qa('[role="switch"]').length).toBe(5);
    expect(qa(`[data-testid="${CHROME_IDS.panel}"] .tc-btn-primary`)).toHaveLength(1);
    expect(q(CHROME_IDS.clear)!.className).toBe('tc-link');
  });
});

describe('the stylesheet keeps the three looks apart', () => {
  it('a button stands on an edge and presses down onto it', () => {
    expect(bodyOf('.tc-btn')).toMatch(/box-shadow:\s*var\(--tc-btn-edge\)/);
    expect(bodyOf(".tc-btn:active:not(:disabled):not([aria-disabled='true'])")).toMatch(
      /transform:\s*translateY\(var\(--tc-btn-press\)\)/,
    );
  });
  it('a selector is flat: no edge, and it never moves when pressed', () => {
    expect(bodyOf('.tc-chip')).not.toMatch(/box-shadow/);
    expect(bodyOf('.tc-chip')).toMatch(/background:\s*transparent/);
    expect(css).not.toMatch(/\.tc-chip:active/);
    expect(css).not.toMatch(/\.tc-chip:hover/);
    // The pick is a solid Ember fill against an outline. A switch also moves its drawn knob.
    expect(bodyOf(".tc-chip[aria-checked='true']")).toMatch(
      /background:\s*var\(--tc-chip-picked-bg\)/,
    );
    expect(bodyOf(".tc-toggle[aria-checked='true']::after")).toContain('calc(100% - 11px)');
  });
  it('a picked selector option has no check mark and keeps its size (Regression 24)', () => {
    const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // No check glyph anywhere on a selector: not as content, not in a pseudo-element.
    expect(bodyOf(".tc-chip[aria-checked='true']::before")).toBe('');
    for (const m of plain.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const sel = m[1] as string;
      if (!/aria-checked|aria-pressed|tc-chip|tc-unit|tc-helper|tc-ws-style/.test(sel)) continue;
      expect(m[2], sel).not.toMatch(/\\2713|\\2714|✓|✔/);
    }
    // Picked and not picked draw the same box: no change of border width, padding, font weight,
    // font size or letter spacing.
    const sizeKeys =
      /(^|;)\s*(border(-width)?|padding[\w-]*|font-weight|font-size|letter-spacing|min-width|width)\s*:/;
    for (const sel of [
      ".tc-chip[aria-checked='true']",
      ".tc-unit[aria-checked='true']",
      ".tc-helper[aria-checked='true']",
      ".tc-ws-style[aria-checked='true']",
      ".tc-workshop[data-team='FUTURE'] .tc-ws-style[aria-checked='true']",
    ]) {
      expect(bodyOf(sel), sel).not.toMatch(sizeKeys);
    }
    // A strip gives every option the same width, so the strip never shifts.
    expect(bodyOf('.tc-chips')).toMatch(
      /grid-auto-columns:\s*minmax\(0,\s*1fr\)|grid-auto-columns:\s*1fr/,
    );
  });
  it('options in a strip share one edge', () => {
    // One row: the options sit side by side in columns and never wrap.
    expect(bodyOf('.tc-chips')).toMatch(/grid-auto-flow:\s*column/);
    expect(css).toMatch(/> \.tc-chip \+ \.tc-chip \{\s*margin-left: -3px;/);
  });
  it('a link is underlined text with no box, and still a 56px tap', () => {
    const link = bodyOf('.tc-link');
    expect(link).toMatch(/text-decoration:\s*underline/);
    expect(link).toMatch(/border:\s*0/);
    expect(link).toMatch(/background:\s*none/);
    expect(link).toMatch(/min-height:\s*var\(--tc-tap\)/);
    expect(link).toMatch(/font-size:\s*var\(--tc-fs-label\)/);
  });
  it('a dropdown is 56px tall with 24px plain numerals', () => {
    expect(bodyOf('.tc-select')).toMatch(/min-height:\s*var\(--tc-tap\)/);
    expect(bodyOf('.tc-select')).toMatch(/font-family:\s*var\(--tc-font\)/);
  });
});
