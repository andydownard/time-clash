// @vitest-environment jsdom
// Pins the gap-check fixes from docs/DESIGN_GUIDANCE.md: the Setup title and line, the turn tag
// on the reload card (the Waiting tag was cut on 2026-10-25), the story label, and Orbitron for reading words only (never digits).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { RELOAD, SETUP } from '../../src/data/copy';
import { TEST_IDS } from '../../src/ui/types';
import { mainIdeaQ, mathQ, q, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const css = readFileSync(join(import.meta.dirname, '../../src/styles/ui.css'), 'utf8');

describe('Setup board gap', () => {
  it('asks who is fighting, with no second line that repeats the field labels', () => {
    void s.overlay.showSetup(null);
    expect(SETUP.heading).toBe('Who is fighting?');
    expect(document.querySelector('.tc-setup-sub')).toBeNull();
    expect(document.body.textContent).not.toContain('Pick your grade and subject');
  });
});

describe('Reload board gap', () => {
  const open = (question = mathQ) =>
    s.overlay.showReloadModal({
      question,
      team: 'PAST',
      playerName: 'Alex',
    });

  it('shows one chip, whose turn it is, in words and a shape: no Waiting chip', () => {
    void open();
    const chips = [...q(TEST_IDS.reloadModal)!.querySelectorAll('.tc-reload-head .tc-turn-chip')];
    expect(chips).toHaveLength(1);
    expect(chips[0]!.getAttribute('data-state')).toBe('turn');
    expect(chips[0]!.textContent).toContain('Alex');
    expect(chips[0]!.querySelector('.tc-turn-icon')).not.toBeNull();
    expect(q(TEST_IDS.reloadModal)!.querySelector('[data-state="waiting"]')).toBeNull();
    expect(q(TEST_IDS.reloadModal)!.textContent).not.toContain('Waiting');
  });

  it('says "Answer to reload your launcher." only when told it is the first reload', () => {
    void s.overlay.showReloadModal({
      question: mathQ,
      team: 'PAST',
      playerName: 'Alex',
      firstReload: true,
    });
    expect(q(TEST_IDS.reloadModal)!.querySelector('.tc-instructions')!.textContent).toBe(
      RELOAD.instructions,
    );
  });

  it('a later reload has no "Answer to reload" line (the timer still shows)', () => {
    void s.overlay.showReloadModal({ question: mathQ, team: 'PAST', playerName: 'Alex' });
    const card = q(TEST_IDS.reloadModal)!;
    expect(card.querySelector('.tc-instructions')).toBeNull();
    expect(card.textContent).not.toContain(RELOAD.instructions);
    expect(card.querySelector('[data-testid="reload-timer"]')).not.toBeNull();
  });

  it('a story is labelled', () => {
    void open(mainIdeaQ);
    const p = q(TEST_IDS.reloadModal)!.querySelector('.tc-passage')!;
    expect(p.getAttribute('data-label')).toBe(RELOAD.readStory);
  });

  it('the cover that hides the board is still up', () => {
    void open();
    expect(s.overlay.cover).toBe('reload');
  });
});

describe('Orbitron for reading, plain numerals for math (regression 12)', () => {
  /** Every block for a selector, joined, so a later rule can add to an earlier one. */
  const rule = (sel: string): string => {
    const blocks: string[] = [];
    let i = css.indexOf(`${sel} {`);
    while (i > -1) {
      blocks.push(css.slice(i, css.indexOf('}', i)));
      i = css.indexOf(`${sel} {`, i + 1);
    }
    expect(blocks.length, `${sel} rule exists`).toBeGreaterThan(0);
    return blocks.join('\n');
  };

  it('older reading cards draw the story, question and answers in the voice font', () => {
    expect(rule(".tc-reload[data-layout='reading'] .tc-prompt")).toContain('--tc-font-voice-new');
    expect(rule(".tc-reload[data-layout='reading'] .tc-passage")).toContain('--tc-font-voice-new');
    expect(rule(".tc-reload[data-layout='reading'] .tc-choice")).toContain('--tc-font-voice-new');
  });

  it('math and young readers keep the open letter and numeral face', () => {
    expect(rule(".tc-reload[data-layout='math'] .tc-choice")).toContain('var(--tc-font)');
    expect(rule(".tc-reload[data-layout='math'] .tc-prompt")).toContain('var(--tc-font)');
    expect(rule(".tc-reload[data-layout='reading-young'] .tc-prompt")).not.toContain('voice-new');
  });

  it('no reading question has a digit, so Orbitron never draws a bar for 1', () => {
    const dir = join(import.meta.dirname, '../../src/questions/bank');
    for (const f of readdirSync(dir).filter((x) => x.startsWith('reading'))) {
      const qs = JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
        prompt: string;
        passage?: string;
        choices: string[];
      }[];
      for (const x of qs) {
        expect(`${x.prompt} ${x.passage ?? ''} ${x.choices.join(' ')}`, f).not.toMatch(/\d/);
      }
    }
  });
});
