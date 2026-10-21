// @vitest-environment jsdom
// Chrono's lines: miss, near miss, wrong answer, the reload quip, and the Victory line.
// Cheeky and warm, never mean. A wrong answer never shames the child.
import { describe, expect, it } from 'vitest';
import {
  HIT_LINES,
  RELOAD,
  RELOAD_QUIPS,
  UI_EXTRA,
  VICTORY,
  VICTORY_CHRONO,
} from '../../src/data/copy';
import { createShuffleBag } from '../../src/game/bag';
import { createRng } from '../../src/game/rng';
import type { TeamStats } from '../../src/game/types';
import { TEST_IDS } from '../../src/ui/types';
import { victoryMood } from '../../src/ui/victoryMood';
import { click, mathQ, q, setup } from './helpers';

/** Words that point at the child, not the shot. None of them may appear in a miss or wrong line. */
const SHAMING =
  /\b(wrong|bad|fail|failed|silly you|dumb|stupid|loser|lose|lost|oops you|you missed|terrible|awful|worst)\b/i;

describe('miss and near-miss lines', () => {
  it.each(['near', 'miss'] as const)('has at least 5 different %s lines', (k) => {
    expect(new Set(HIT_LINES[k]).size).toBeGreaterThanOrEqual(5);
  });
  it.each(['near', 'miss'] as const)('%s lines tease the shot, never the player', (k) => {
    for (const line of HIT_LINES[k]) expect(line).not.toMatch(SHAMING);
  });
  it('every miss line has a sound word or a picture, not just "missed"', () => {
    const extra = HIT_LINES.miss.filter((l) => l !== 'Whoosh! Missed.');
    for (const line of extra) expect(line.split(/\s+/).length).toBeGreaterThanOrEqual(3);
  });
});

describe('wrong-answer lines', () => {
  it('the card line is kind and still gives the answer', () => {
    expect(RELOAD.wrong('7')).toContain('7');
    expect(RELOAD.wrong('7')).not.toMatch(SHAMING);
  });
  it('Chrono takes the joke on himself, never on the child', () => {
    for (const line of RELOAD_QUIPS.wrong) expect(line).not.toMatch(SHAMING);
    expect(RELOAD_QUIPS.wrong.some((l) => /\b(I|my|me|Chrono)\b/.test(l))).toBe(true);
  });
  it('the no-repeat bag never gives the same wrong line twice in a row (Regression #9)', () => {
    const bag = createShuffleBag(createRng(7), RELOAD_QUIPS.wrong.length);
    let last = -1;
    for (let i = 0; i < 60; i++) {
      const n = bag.next();
      expect(n).not.toBe(last);
      last = n;
    }
  });
});

describe('the reload card names Chrono beside his quip', () => {
  it('shows a Chrono face, his name, and the line after an answer', () => {
    const s = setup();
    void s.overlay.showReloadModal({
      question: mathQ,
      team: 'PAST',
      playerName: 'Alex',
      quip: () => 'Zoom!',
    });
    click(q(TEST_IDS.reloadChoice(0)));
    const says = q('reload-feedback')!.querySelector('[data-role="chrono-quip"]')!;
    expect(says).not.toBeNull();
    expect(says.querySelector('.tc-chrono-face')!.getAttribute('aria-hidden')).toBe('true');
    expect(says.querySelector('.tc-quip')!.textContent).toBe(`${UI_EXTRA.chronoName}: Zoom!`);
  });

  it('shows nothing for Chrono when there is no line', () => {
    const s = setup();
    void s.overlay.showReloadModal({ question: mathQ, team: 'PAST', playerName: 'Alex' });
    click(q(TEST_IDS.reloadChoice(1)));
    expect(q('reload-feedback')!.querySelector('[data-role="chrono-quip"]')).toBeNull();
  });
});

const stats = (over: Partial<TeamStats> = {}): TeamStats => ({
  shotsFired: 8,
  directHits: 3,
  nearHits: 1,
  questionsAnswered: 4,
  correctAnswers: 3,
  fastestAnswerMs: 3000,
  scrapEarned: 5,
  ...over,
});

describe('the Victory line fits the match', () => {
  it('a close match gets a close-match line', () => {
    const m = victoryMood('PAST', { PAST: stats(), FUTURE: stats({ directHits: 2, nearHits: 2 }) });
    expect(m).toBe('close');
  });
  it('a side that landed nothing gets a gentle "next time" line', () => {
    const m = victoryMood('FUTURE', {
      PAST: stats({ directHits: 0, nearHits: 0 }),
      FUTURE: stats(),
    });
    expect(m).toBe('shutout');
  });
  it('anything else is a plain good match', () => {
    const m = victoryMood('PAST', {
      PAST: stats({ directHits: 6 }),
      FUTURE: stats({ directHits: 1, nearHits: 0 }),
    });
    expect(m).toBe('solid');
  });
  it('bad numbers never throw and fall back to a plain good match', () => {
    const broken = stats({ directHits: Number.NaN, nearHits: -1 });
    expect(victoryMood('PAST', { PAST: broken, FUTURE: broken })).toBe('solid');
  });
  it("Chrono never claims the dignity line: that is the loser fighter's line", () => {
    for (const line of Object.values(VICTORY_CHRONO)) {
      expect(line).not.toContain('dignity');
      expect(line).not.toMatch(SHAMING);
    }
  });

  it('the Victory screen shows the Chrono line for the mood, not the dignity line', () => {
    const s = setup();
    void s.overlay.showVictory({
      winner: 'FUTURE',
      names: { PAST: 'Alex', FUTURE: 'Sam' },
      stats: { PAST: stats({ directHits: 0, nearHits: 0 }), FUTURE: stats() },
    });
    const bubble = q(TEST_IDS.victory)!.querySelector('[data-role="chrono-says"]')!;
    expect(bubble.textContent).toContain(UI_EXTRA.chronoName);
    expect(bubble.textContent).toContain(VICTORY_CHRONO.shutout);
    expect(bubble.textContent).not.toContain(VICTORY.goodSport);
  });
});
