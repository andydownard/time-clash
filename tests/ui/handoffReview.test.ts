// @vitest-environment jsdom
// Pins the fixes from the look-and-feel review: the HUD wears the handoff look, one wind readout,
// reload pips, plain numerals for kids, chip colors, setup read-back, fair awards, and focus rings.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { HUD, SETUP, VICTORY } from '../../src/data/copy';
import { INTRO_SCRIPT } from '../../src/data/introScript';
import { parseCssVars, resolveCssVars } from '../../src/ui/contrast';
import type { HudHandlers, HudState } from '../../src/ui/types';
import { TEST_IDS } from '../../src/ui/types';
import { click, mathQ, pickGrade, q, qa, setup } from './helpers';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const css = read('../../src/styles/ui.css').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = read('../../src/styles/tokens.css');
const vars = resolveCssVars(parseCssVars(tokens));

/** All declarations for a selector, joined. Splits grouped selectors. */
function bodyOf(selector: string): string {
  const out: string[] = [];
  for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const sels = (m[1] as string).split(',').map((x) => x.trim());
    if (sels.includes(selector)) out.push(m[2] as string);
  }
  return out.join(';');
}

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const state = (over: Partial<HudState> = {}): HudState => ({
  activeTeam: 'PAST',
  names: { PAST: 'Alex', FUTURE: 'Sam' },
  baseHp: { PAST: 100, FUTURE: 75 },
  scrap: { PAST: 3, FUTURE: 0 },
  wind: -12,
  angleDeg: 45,
  power: 60,
  shotsLeft: 2,
  bonus: false,
  canFire: true,
  selected: 'C',
  units: [],
  ...over,
});
const handlers = (): HudHandlers => ({ onAim: () => {}, onFire: () => {}, onMuteToggle: () => {},
  onSelect: () => {},
});

describe('team accents are in the palette', () => {
  it('Past is Purple and Future is Pulse, never the old red or cyan', () => {
    expect(vars['--tc-past-accent']).toBe(vars['--tc-purple-500']);
    expect(vars['--tc-future-accent']).toBe(vars['--tc-pulse']);
  });
});

describe('HUD team cards', () => {
  it('use the team card tokens, not the old white card or red edge', () => {
    const base = bodyOf('.tc-team-panel');
    expect(base).toContain('--tc-card-past-bg');
    expect(base).toContain('--tc-on-dark');
    expect(base).toMatch(/font-family:\s*var\(--tc-font-voice-new\)/);
    expect(base).not.toMatch(/var\(--tc-card\)/);
    const future = bodyOf(".tc-team-panel[data-team='FUTURE']");
    expect(future).toContain('--tc-card-future-bg');
    expect(future).toContain('--tc-card-future-edge');
    expect(bodyOf(".tc-team-panel[data-team='FUTURE'][data-active='true']")).toContain(
      '--tc-glow-neon',
    );
    expect(css).not.toMatch(/\.tc-team-panel[^{]*\{[^}]*banner-red/);
  });
  it('the inactive card keeps full text contrast (no opacity)', () => {
    expect(css).not.toMatch(/\.tc-team-panel\[data-active='false'\]/);
    expect(bodyOf('.tc-team-panel')).not.toMatch(/opacity/);
  });
  it('the health meter uses the progress recipe and the counters never wrap', () => {
    expect(bodyOf('.tc-hp-meter')).toContain('--tc-bar-track');
    expect(bodyOf('.tc-hp-fill')).toContain('--tc-bar-fill');
    expect(bodyOf('.tc-team-panel')).toMatch(/white-space:\s*nowrap/);
  });
  it('the turn mark stays, so the active team is not shown by color alone', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    const mark = q(TEST_IDS.baseHp('PAST'))!
      .closest('[data-team]')!
      .querySelector('.tc-active-mark');
    expect(mark?.textContent).toBe('▶');
    expect(bodyOf(".tc-team-panel[data-active='true'] .tc-active-mark")).toContain('visible');
  });
  it('labels health once and keeps the value beside the meter', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    const hp = q(TEST_IDS.baseHp('FUTURE'))!;
    expect(hp.querySelector('.tc-hp-label')!.textContent).toBe(HUD.baseHealth);
    expect(hp.querySelector('.tc-hp-row .tc-hp-meter')).not.toBeNull();
    expect(hp.querySelector('.tc-hp-row .tc-hp-text')!.textContent).toBe(HUD.hpValue(75));
  });
});

describe('HUD readouts', () => {
  it('draws wind once for sighted players: the DOM copy is screen-reader only', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    expect(q(TEST_IDS.wind)!.classList.contains('tc-sr-only')).toBe(true);
    expect(q(TEST_IDS.wind)!.textContent).toContain('Wind');
  });
  it('shows two shot pips and a reload pip, and crosses off spent shots', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state({ shotsLeft: 2 }));
    const pips = () => qa('.tc-pips .tc-pip');
    expect(pips()).toHaveLength(3);
    expect(pips().map((p) => p.getAttribute('data-used'))).toEqual(['false', 'false', null]);
    expect(pips()[2]!.textContent).toBe(HUD.reloadPip);
    s.overlay.updateHud(state({ shotsLeft: 1 }));
    expect(pips().map((p) => p.getAttribute('data-used'))).toEqual(['false', 'true', null]);
    s.overlay.updateHud(state({ shotsLeft: 0 }));
    expect(pips().map((p) => p.getAttribute('data-used'))).toEqual(['true', 'true', null]);
    // The pips are decoration. The text line still says it for assistive tech.
    expect(q(TEST_IDS.shotsLeft)!.textContent).toContain(HUD.shotsValue(0));
    expect(qa('.tc-pips')[0]!.getAttribute('aria-hidden')).toBe('true');
  });
  it('the aim bar wears the Ink look with an Ember edge, like the Battle board', () => {
    expect(bodyOf('.tc-aim')).toContain('--tc-ink-deep');
    expect(bodyOf('.tc-aim')).toMatch(/border:\s*4px solid var\(--tc-ember\)/);
    expect(bodyOf('.tc-aim')).toMatch(/font-family:\s*var\(--tc-font-voice-new\)/);
    expect(bodyOf('.tc-aim .tc-range')).toContain('--tc-pulse');
    expect(bodyOf('.tc-aim #tc-aim-power')).toContain('--tc-ember');
    expect(bodyOf('.tc-hint')).toContain('--tc-surface-dark');
  });
  it('has no separate shots panel: the bar header holds the turn name and the pips', () => {
    expect(css).not.toContain('.tc-hud-center');
  });
  it('Sound sits top left under the ? and gear, and uses the shared button font', () => {
    const corner = bodyOf('.tc-hud-corner');
    expect(corner).toMatch(/top:/);
    expect(corner).not.toMatch(/bottom:/);
    expect(corner).toMatch(/left:/);
    expect(bodyOf('.tc-hud-corner .tc-btn')).not.toMatch(/font-family/);
  });
  it('portrait lays the HUD out as a grid with cards side by side', () => {
    expect(css).toMatch(/grid-template-areas:\s*'past future';/);
  });
});

describe('the page behind the picture', () => {
  it('is Ink, so a letterboxed canvas never shows white', () => {
    expect(bodyOf('html')).toContain('--tc-ink-deep');
    expect(bodyOf('body')).toMatch(/margin:\s*0/);
  });
});

describe('focus rings on the ? and gear buttons', () => {
  it('use the Ember ring (Blue 700 on Ink is only about 2:1)', () => {
    expect(bodyOf('[data-tc-chrome] :focus-visible')).toContain('--tc-focus-on-dark');
    // It comes before the parchment panel rule, so Settings buttons keep the dark ring.
    expect(css.indexOf('[data-tc-chrome] :focus-visible')).toBeLessThan(
      css.indexOf('.tc-panel :focus-visible'),
    );
  });
});

describe('light surfaces never carry Steel, Ember or Pulse lines', () => {
  it('the bonus ring uses Oak on parchment, not Steel (2.0:1)', () => {
    expect(bodyOf('.tc-timer-ring')).toContain('--tc-oak');
    expect(bodyOf('.tc-timer-ring')).not.toContain('--tc-steel-blue');
  });
});

describe('plain numerals for young readers', () => {
  it('the grade dropdown, math prompt and answer tiles do not use Orbitron', () => {
    for (const sel of [
      '.tc-select',
      ".tc-reload[data-layout='math'] .tc-prompt",
      ".tc-reload[data-layout='math'] .tc-choice",
    ]) {
      expect(bodyOf(sel), sel).toMatch(/font-family:\s*var\(--tc-font\);/);
    }
  });
  it('the reading prompt and the math prompt share one base style', () => {
    expect(bodyOf('.tc-prompt')).toMatch(/font-family:\s*var\(--tc-font\)/);
  });
  it('a math question draws a real minus sign', () => {
    void s.overlay.showReloadModal({
      question: { ...mathQ, prompt: 'What is 17 - 9?', choices: ['6', '7', '8', '9'], answer: '8' },
      team: 'PAST',
      playerName: 'Alex',
    });
    const text = q('reload-prompt')?.textContent ?? document.body.textContent!;
    expect(text).toContain('17 − 9');
    expect(text).not.toContain('17 - 9');
  });
});

describe('Setup', () => {
  it('picked chips are Ember with Ink text and a check, see-through chips take the team edge', () => {
    expect(vars['--tc-chip-picked-bg']).toBe(vars['--tc-ember']);
    expect(vars['--tc-chip-picked-text']).toBe(vars['--tc-ink-deep']);
    expect(vars['--tc-chip-past-edge']).toBe(vars['--tc-purple-300']);
    expect(vars['--tc-chip-future-edge']).toBe(vars['--tc-blue-300']);
    expect(bodyOf(".tc-team-card .tc-chip[aria-checked='true']")).toContain('--tc-chip-picked-bg');
    expect(bodyOf('.tc-team-card .tc-chip')).toMatch(/background:\s*transparent/);
    expect(bodyOf(".tc-chip[aria-checked='true']::before")).toContain('margin-right');
  });
  it('the grade is a dropdown in plain letters, at least 56px tall and 20px text', () => {
    expect(bodyOf('.tc-select')).toMatch(/min-height:\s*var\(--tc-tap\)/);
    expect(bodyOf('.tc-select')).toMatch(/font-family:\s*var\(--tc-font\)/);
    expect(bodyOf('.tc-select')).toMatch(/font-size:\s*var\(--tc-fs-button\)/);
  });
  it('the heading shares the ? and gear row, so the Clear button fits on screen', () => {
    expect(bodyOf('[data-tc-root] .tc-setup-title')).toMatch(/min-height:\s*var\(--tc-tap\)/);
  });
  it('says the picks in words and keeps them current', () => {
    void s.overlay.showSetup(null);
    const line = q('setup-read-back')!;
    expect(line.textContent).toBe('Team Past: Grade 2, Both. Team Future: Grade 2, Both');
    pickGrade('FUTURE', 0);
    click(q(TEST_IDS.setupSubject('PAST', 'math')));
    expect(line.textContent).toBe('Team Past: Grade 2, Math. Team Future: Kindergarten, Both');
  });
  it('tells a parent that names stay on the device', () => {
    void s.overlay.showSetup(null);
    expect(document.body.textContent).toContain(SETUP.namesStay);
    expect(SETUP.namesStay).toBe('Names stay on this device. Nothing is sent anywhere.');
  });
});

describe('How to Play', () => {
  it('Next is the gold primary button and Skip is a plain neutral one that still works', () => {
    void s.overlay.showIntro(INTRO_SCRIPT, () => Promise.resolve());
    expect(q(TEST_IDS.introSkip)!.classList.contains('tc-btn-primary')).toBe(false);
    expect(q('intro-next')!.classList.contains('tc-btn-primary')).toBe(true);
    expect(qa('.tc-screen .tc-btn-primary')).toHaveLength(1);
  });
});

describe('Reload card', () => {
  it('Sound gets a speaker icon from CSS, and there is no Hear It button', () => {
    void s.overlay.showReloadModal({ question: mathQ, team: 'PAST', playerName: 'Alex' });
    expect(q('reload-speak')).toBeNull();
    expect(q('cover-mute')!.getAttribute('data-muted')).toBe('false');
    expect(bodyOf('.tc-cover-mute::before')).toContain('content');
  });
  it('the timer line is one idea and leads with Bonus', () => {
    void s.overlay.showReloadModal({ question: mathQ, team: 'PAST', playerName: 'Alex' });
    expect(document.body.textContent).toContain('Bonus scrap if you answer fast. No rush!');
    expect(document.body.textContent).not.toContain('Take your time');
  });
  it('empty live regions reserve no gap, so there is no dead band under the buttons', () => {
    expect(bodyOf('.tc-reload-body > :empty')).toMatch(/margin-top:\s*calc\(-1/);
  });
});

describe('Wipeout screen', () => {
  const st = (correct: number, asked: number) => ({
    shotsFired: 3,
    directHits: 1,
    nearHits: 1,
    questionsAnswered: asked,
    correctAnswers: correct,
    fastestAnswerMs: 2000,
    scrapEarned: 3,
  });
  const opts = {
    winner: 'PAST' as const,
    names: { PAST: 'Alex', FUTURE: 'Sam' },
    stats: { PAST: st(4, 4), FUTURE: st(1, 3) },
  };
  it('names the winning team, never labels the player who lost, and shows brain stats', () => {
    void s.overlay.showVictory(opts);
    const v = q(TEST_IDS.victory)!;
    expect(v.querySelector('[data-role="winner-team"]')!.textContent).toBe('Team Past');
    expect(v.textContent).not.toContain('Sam: Wipeout');
    expect(v.textContent).toContain(VICTORY.wipeoutLine('Secret Base'));
    const stats = qa('[data-role="brain-stats"]').map((e) => e.textContent);
    expect(stats).toEqual([
      `Brain stats: ${VICTORY.brainStatsValue(4, 4)}`,
      `Brain stats: ${VICTORY.brainStatsValue(1, 3)}`,
    ]);
  });
  it('both cards get Good Sport and the same size, each in its team look', () => {
    void s.overlay.showVictory(opts);
    for (const t of ['PAST', 'FUTURE']) {
      const items = qa(`[data-award-team="${t}"] li`).map((li) => li.textContent);
      expect(items).toContain(VICTORY.awards.goodSport);
    }
    expect(bodyOf('.tc-awards > .tc-row')).toMatch(/align-items:\s*stretch/);
    expect(bodyOf(".tc-award-card[data-team='FUTURE']")).toContain('--tc-pulse');
    expect(bodyOf(".tc-award-card[data-team='PAST']")).toContain('--tc-purple-700');
  });
  it('the toy blocks are bigger than before (48px) and still decoration only', () => {
    expect(parseInt(/width:\s*(\d+)px/.exec(bodyOf('.tc-block'))![1]!, 10)).toBeGreaterThanOrEqual(
      56,
    );
  });
});

describe('speech bubble', () => {
  it('is one size larger than the lead text and may be 360px wide', () => {
    expect(bodyOf('.tc-bubble')).toContain('--tc-fs-button-lg');
    expect(bodyOf('.tc-bubble')).toMatch(/max-width:\s*min\(360px/);
  });
});
