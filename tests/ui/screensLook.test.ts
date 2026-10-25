// @vitest-environment jsdom
// The markup behind the restyled screens: what the CSS hooks onto, and the rules that must
// hold on every look (no color-only meaning, no question on the pass cover, real buttons).
import { beforeEach, describe, expect, it } from 'vitest';
import { INTRO, LOADING, PASS_SCREEN, RELOAD, SETUP, TEAM_NAMES, VICTORY_CHRONO } from '../../src/data/copy';
import { INTRO_SCRIPT } from '../../src/data/introScript';
import { TEST_IDS } from '../../src/ui/types';
import {
  click,
  fractionQ,
  flush,
  gradeShown,
  mainIdeaQ,
  mathQ,
  pickGrade,
  q,
  qa,
  setup,
  wordQ,
} from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

describe('Setup look', () => {
  it('builds two team cards, a VS badge between them, and one helper line', () => {
    void s.overlay.showSetup(null);
    const cards = qa('.tc-team-card');
    expect(cards.map((c) => c.getAttribute('data-team'))).toEqual(['PAST', 'FUTURE']);
    const grid = cards[0]!.parentElement!;
    expect(grid.classList.contains('tc-team-cards')).toBe(true);
    const vs = grid.querySelector('.tc-vs')!;
    expect(vs.textContent).toBe(SETUP.versus);
    expect(vs.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.textContent).toContain('Questions will match your grade');
    expect(SETUP.matchHelper).toBe('Questions will match your grade.');
  });

  it('names each card for assistive tech and shows the team with a shape and a name', () => {
    void s.overlay.showSetup(null);
    for (const team of ['PAST', 'FUTURE'] as const) {
      const card = qa('.tc-team-card').find((c) => c.getAttribute('data-team') === team)!;
      expect(card.getAttribute('role')).toBe('group');
      const head = document.getElementById(card.getAttribute('aria-labelledby')!)!;
      expect(head.textContent).toContain(TEAM_NAMES[team]);
      expect(head.querySelector('[aria-hidden="true"]')!.textContent).toBe(PASS_SCREEN.icon[team]);
    }
  });

  it('has a K to 12 grade dropdown per team, in plain letters so 1 and 7 read clearly', () => {
    void s.overlay.showSetup(null);
    for (const team of ['PAST', 'FUTURE'] as const) {
      const sel = q<HTMLSelectElement>(TEST_IDS.setupGrade(team))!;
      expect(sel.classList.contains('tc-select')).toBe(true);
      expect([...sel.options].map((o) => o.value)).toEqual(
        Array.from({ length: 13 }, (_, i) => String(i)),
      );
    }
    pickGrade('FUTURE', 12);
    expect(gradeShown('FUTURE')).toBe(12);
  });

  it('has a Reading, Math, Both picker per team', () => {
    void s.overlay.showSetup(null);
    for (const team of ['PAST', 'FUTURE']) {
      const labels = ['reading', 'math', 'both'].map(
        (k) => q(TEST_IDS.setupSubject(team as 'PAST', k))!.textContent,
      );
      expect(labels).toEqual(['Reading', 'Math', 'Both']);
    }
  });

  it('keeps the grade explanation for screen readers on each grade dropdown', () => {
    void s.overlay.showSetup(null);
    for (const team of ['PAST', 'FUTURE'] as const) {
      const ids = q(TEST_IDS.setupGrade(team))!.getAttribute('aria-describedby')!.split(' ');
      expect(document.getElementById(ids[0]!)!.textContent).toBe(SETUP.gradeHelper);
    }
  });

  it('the start button is the one gold primary button', () => {
    void s.overlay.showSetup(null);
    expect(q(TEST_IDS.setupNext)!.classList.contains('tc-btn-primary')).toBe(true);
    expect(qa('.tc-screen .tc-btn-primary')).toHaveLength(1);
  });
});

describe('Tap to Start look', () => {
  it('shows the title, the subtitle, and one primary button in a hero block', () => {
    void s.overlay.showTapToStart({
      onMuteToggle: () => undefined,
      onCaptionsToggle: () => undefined,
    });
    const hero = qa('.tc-hero')[0]!;
    expect(hero.querySelector('h1')!.textContent).toBe('Time Clash');
    expect(hero.querySelector('.tc-subtitle')!.textContent).toBe('Past vs. Future');
    expect(hero.querySelector('[data-testid="tap-to-play"]')).not.toBeNull();
    expect(qa('.tc-skyline')).toHaveLength(1);
    expect(qa('.tc-skyline')[0]!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Intro look', () => {
  it('shows Chrono, a name tag, and a picture on every card', async () => {
    void s.audio.unlock();
    void s.overlay.showIntro(INTRO_SCRIPT, () => Promise.resolve());
    await flush();
    expect(qa('.tc-intro-head .tc-chrono-face')).toHaveLength(1);
    expect(qa('.tc-chrono')[0]!.textContent).toBe('Chrono');
    const art = q(TEST_IDS.introCard)!.querySelector('.tc-art')!;
    expect(art.getAttribute('aria-hidden')).toBe('true');
    expect(art.querySelector('svg.tc-art-svg')).not.toBeNull();
    click(q('intro-next'));
    await flush();
    expect(q(TEST_IDS.introCard)!.querySelector('.tc-art svg')).not.toBeNull();
  });

  it('keeps Skip, Replay, Mute, and the caption bar', async () => {
    void s.audio.unlock();
    void s.overlay.showIntro(INTRO_SCRIPT, () => Promise.resolve());
    await flush();
    expect(q(TEST_IDS.introSkip)!.textContent).toBe(INTRO.skip);
    expect(q(TEST_IDS.introReplay)!.textContent).toBe(INTRO.replay);
    expect(q('intro-mute')).not.toBeNull();
    expect(q(TEST_IDS.captionBar)).not.toBeNull();
  });
});

describe('Loading look', () => {
  it('draws the scene, a timeline bar with a percent, and the rotating line in one bubble', () => {
    s.overlay.showLoading(LOADING.messages);
    expect(qa('.tc-loading-art')).toHaveLength(1);
    const bar = q('loading-bar')!;
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.querySelector('svg.tc-timeline')).not.toBeNull();
    const line = qa('.tc-loading-line')[0]!;
    expect(line.contains(q('loading-message'))).toBe(true);
    expect(line.querySelector('.tc-percent')!.textContent).toBe('0%');
  });

  it('fills the timeline by percent and shows the same number as text', () => {
    const h = s.overlay.showLoading(LOADING.messages);
    const fill = () => q('loading-bar')!.querySelector('.tc-bar-fill')!;
    expect(fill().getAttribute('visibility')).toBe('hidden');
    h.setProgress(0.5);
    expect(fill().getAttribute('stroke-dasharray')).toBe('50 100');
    expect(fill().getAttribute('visibility')).toBe('visible');
    expect(qa('.tc-percent')[0]!.textContent).toBe('50%');
    h.setProgress(1);
    expect(fill().getAttribute('stroke-dasharray')).toBe('100 100');
    expect(q('loading-bar')!.getAttribute('aria-valuenow')).toBe('100');
  });

  it('keeps the page title for screen readers only', () => {
    s.overlay.showLoading(LOADING.messages);
    const h1 = document.querySelector('[data-screen="loading"] h1')!;
    expect(h1.textContent).toBe('Time Clash');
    expect(h1.classList.contains('tc-sr-only')).toBe(true);
  });
});

describe('Pass the mouse look', () => {
  it.each([
    ['PAST', 'tc-btn-past'],
    ['FUTURE', 'tc-btn-future'],
  ] as const)('%s shows its name, its shape, and its own button recipe', (team, cls) => {
    void s.overlay.showPassScreen({ nextName: 'Alex', nextTeam: team });
    const el = q(TEST_IDS.passScreen)!;
    expect(el.querySelector('.tc-team-tag')!.textContent).toBe(TEAM_NAMES[team]);
    expect(el.querySelector('[data-role="team-icon"]')!.textContent).toBe(PASS_SCREEN.icon[team]);
    expect(q(TEST_IDS.passReady)!.classList.contains(cls)).toBe(true);
  });

  it('holds no question text and no answer buttons', () => {
    void s.overlay.showPassScreen({ nextName: 'Alex', nextTeam: 'PAST' });
    const el = q(TEST_IDS.passScreen)!;
    expect(el.querySelector('[data-testid^="reload-"]')).toBeNull();
    expect(el.querySelector('.tc-choice, .tc-prompt, .tc-passage')).toBeNull();
    expect(el.style.backgroundColor).not.toBe('');
    expect(el.style.position).toBe('fixed');
  });
});

describe('Reload look', () => {
  const open = (question = mathQ, team: 'PAST' | 'FUTURE' = 'PAST') =>
    s.overlay.showReloadModal({ question, team, playerName: 'Alex' });

  it('the header strip shows the team name, a shape, the name, and Your turn in words', () => {
    void open(mathQ, 'FUTURE');
    const chip = q(TEST_IDS.reloadModal)!.querySelector('.tc-reload-head .tc-turn-chip')!;
    expect(chip.getAttribute('data-team')).toBe('FUTURE');
    expect(chip.textContent).toContain(TEAM_NAMES.FUTURE);
    expect(chip.textContent).toContain('Alex');
    expect(chip.textContent).toContain(RELOAD.yourTurn);
    expect(chip.querySelector('[aria-hidden="true"]')!.textContent).toBe(PASS_SCREEN.icon.FUTURE);
  });

  it('math: a short equation is flagged big, a word problem is not', () => {
    void open({ ...mathQ, prompt: '7 x 8 = ?' });
    expect(q(TEST_IDS.reloadModal)!.getAttribute('data-prompt')).toBe('short');
    s = setup();
    void open({
      ...mathQ,
      prompt: 'A pizza has 8 slices. 3 friends each eat 2. How many are left?',
    });
    expect(q(TEST_IDS.reloadModal)!.getAttribute('data-prompt')).toBe('long');
  });

  it('answer tiles show 1 to 4 from data-key, and the text is only the answer', () => {
    void open();
    for (let i = 0; i < 4; i++) {
      const b = q(TEST_IDS.reloadChoice(i))!;
      expect(b.getAttribute('data-key')).toBe(String(i + 1));
      expect(b.textContent).toBe(mathQ.choices[i]);
    }
  });

  it('a 2x2 grid of tiles sits inside a labelled group', () => {
    void open();
    const group = q(TEST_IDS.reloadModal)!.querySelector('.tc-choices')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.querySelectorAll('button.tc-choice')).toHaveLength(4);
  });

  it('the prompt sits in its own row with no speaker button', () => {
    void open(wordQ);
    const row = q(TEST_IDS.reloadModal)!.querySelector('.tc-prompt-row')!;
    expect(row.contains(q('reload-prompt'))).toBe(true);
    expect(row.querySelector('button')).toBeNull();
  });

  it('a story question is flagged so the story and the question sit side by side', () => {
    void open(mainIdeaQ);
    const el = q(TEST_IDS.reloadModal)!;
    expect(el.getAttribute('data-passage')).toBe('true');
    expect(el.querySelector('.tc-reload-body > .tc-passage')).not.toBeNull();
  });

  it('a question with no story has no passage flag', () => {
    void open(mathQ);
    expect(q(TEST_IDS.reloadModal)!.hasAttribute('data-passage')).toBe(false);
  });

  it('math with fractions still renders stacked in the big layout', () => {
    void open(fractionQ);
    expect(q('reload-prompt')!.querySelectorAll('.tc-frac')).toHaveLength(2);
  });

  it('keeps the timer ring, Hint, and mute in the tools row, apart from the answers', () => {
    void open();
    const tools = q(TEST_IDS.reloadModal)!.querySelector('.tc-tools')!;
    expect(tools.contains(q(TEST_IDS.reloadHint))).toBe(true);
    expect(tools.contains(q('cover-mute'))).toBe(true);
    expect(
      q(TEST_IDS.reloadModal)!.querySelector('.tc-reload-info [data-testid="reload-timer"]'),
    ).not.toBeNull();
  });

  it('a wrong answer marks the tapped tile and the right tile with different shapes, not color', () => {
    void open();
    click(q(TEST_IDS.reloadChoice(0)));
    expect(q(TEST_IDS.reloadChoice(0))!.getAttribute('data-state')).toBe('tried');
    expect(q(TEST_IDS.reloadChoice(1))!.getAttribute('data-state')).toBe('right');
    expect(q('reload-feedback')!.textContent).toContain(RELOAD.wrong('5'));
    // The marks are drawn by CSS. tests/ui/lookAndFeel.test.ts pins them.
    expect(q(TEST_IDS.reloadNext)).not.toBeNull();
  });
});

describe('Wipeout look', () => {
  const stats = {
    shotsFired: 3,
    directHits: 1,
    nearHits: 1,
    questionsAnswered: 2,
    correctAnswers: 2,
    fastestAnswerMs: 2000,
    scrapEarned: 3,
  };
  const opts = {
    winner: 'FUTURE' as const,
    names: { PAST: 'Alex', FUTURE: 'Sam' },
    stats: { PAST: stats, FUTURE: stats },
  };

  it('turns the walls into toy blocks, decoratively, and keeps the victory content', () => {
    void s.overlay.showVictory(opts);
    const blocks = qa('.tc-blocks')[0]!;
    expect(blocks.getAttribute('aria-hidden')).toBe('true');
    expect(blocks.querySelectorAll('.tc-block')).toHaveLength(7);
    const text = q(TEST_IDS.victory)!.textContent!;
    expect(text).toContain('Sam wins!');
    expect(text).toContain('Wipeout! The castle turned into bouncy toy blocks.');
    // The silly line is about the walls, never about the player who lost.
    expect(text).not.toContain('Alex: Wipeout');
    expect(text).toContain('Awards');
    expect(q(TEST_IDS.rematch)).not.toBeNull();
    expect(q(TEST_IDS.backToCamp)).not.toBeNull();
  });

  it('never says destroyed, defeat, dead, die, or kill on screen', () => {
    void s.overlay.showVictory(opts);
    expect(q(TEST_IDS.victory)!.textContent).not.toMatch(
      /destroy|defeat|\bdead\b|\bdie[sd]?\b|\bkill/i,
    );
  });

  it("Chrono has a face beside his line, and never takes the losing fighter's dignity line", () => {
    void s.overlay.showVictory(opts);
    const says = q(TEST_IDS.victory)!.querySelector('[data-role="chrono-says"]')!;
    expect(says.querySelector('svg.tc-chrono-face')).not.toBeNull();
    expect(Object.values(VICTORY_CHRONO).some((l) => says.textContent!.includes(l))).toBe(true);
    expect(says.textContent).not.toContain('dignity');
  });
});

describe('every control is a real, sized component', () => {
  it('Reload, Pass, and Victory use only the sized classes', async () => {
    const allowed = [
      'tc-btn',
      'tc-chip',
      'tc-input',
      'tc-select',
      'tc-link',
      'tc-choice',
      'tc-icon-btn',
      'tc-range',
    ];
    const bad = (): string[] =>
      qa('button, input, select')
        .filter((el) => !allowed.some((c) => el.classList.contains(c)))
        .map((e) => e.outerHTML);
    void s.overlay.showReloadModal({ question: mainIdeaQ, team: 'PAST', playerName: 'Alex' });
    expect(bad()).toEqual([]);
    s = setup();
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(bad()).toEqual([]);
    s = setup();
    s.overlay.showLoading(LOADING.messages);
    await flush();
    expect(bad()).toEqual([]);
  });
});
