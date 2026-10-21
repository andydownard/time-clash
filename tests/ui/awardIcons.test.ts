// @vitest-environment jsdom
// Each end-of-match award has a small decorative picture and its name in words.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { VICTORY } from '../../src/data/copy';
import { AWARD_IDS } from '../../src/game/awards';
import { awardIcon } from '../../src/ui/awardIcons';
import { parseCssVars, resolveCssVars } from '../../src/ui/contrast';
import type { TeamStats } from '../../src/game/types';
import { TEST_IDS } from '../../src/ui/types';
import { click, q, qa, setup } from './helpers';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

const source = readFileSync(join(process.cwd(), 'src/ui/awardIcons.ts'), 'utf8');
const ui = readFileSync(join(process.cwd(), 'src/styles/ui.css'), 'utf8');
const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const palette = new Set(
  Object.values(resolveCssVars(parseCssVars(tokens)))
    .filter((v) => /^#[0-9a-f]{6}$/i.test(v))
    .map((v) => v.toLowerCase()),
);

describe('award icons', () => {
  it.each(AWARD_IDS)('%s has a picture that parses and is decorative', (id) => {
    const svg = awardIcon(document, id);
    expect(svg.localName).toBe('svg');
    expect(svg.hasAttribute('hidden')).toBe(false);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelectorAll('*').length).toBeGreaterThanOrEqual(1);
  });

  it('has a different picture for every award', () => {
    const shapes = AWARD_IDS.map((id) => awardIcon(document, id).innerHTML);
    expect(new Set(shapes).size).toBe(AWARD_IDS.length);
  });

  it('uses only palette colors, and fetches nothing', () => {
    const used = new Set([...source.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
    expect([...used].filter((c) => !palette.has(c))).toEqual([]);
    expect(source).not.toMatch(
      /<image\b|<script\b|<foreignObject\b|@import|url\(\s*['"]?http|href=/i,
    );
  });
});

describe('badge style', () => {
  it('has a rule for the badge and its parts', () => {
    for (const sel of ['.tc-badge', '.tc-badge-icon', '.tc-badge-art']) expect(ui).toContain(sel);
  });
  it('keeps text at the 20px floor and the old plain pill rule is gone', () => {
    expect(ui).not.toMatch(/\.tc-award-card li \{[^}]*border-radius/);
  });
});

const fakeStats = (): Record<'PAST' | 'FUTURE', TeamStats> => {
  const one = (fast: number | null): TeamStats => ({
    shotsFired: 8,
    directHits: 2,
    nearHits: 1,
    questionsAnswered: 3,
    correctAnswers: 2,
    fastestAnswerMs: fast,
    scrapEarned: 5,
  });
  return { PAST: one(2500), FUTURE: one(null) };
};

describe('Victory badges', () => {
  it('shows each earned award as a badge with a picture and its name', () => {
    const s = setup();
    void s.overlay.showVictory({
      winner: 'PAST',
      names: { PAST: 'Alex', FUTURE: 'Sam' },
      stats: fakeStats(),
    });
    const badges = qa('.tc-badge');
    expect(badges.length).toBeGreaterThanOrEqual(2);
    for (const b of badges) {
      const id = b.getAttribute('data-award') as (typeof AWARD_IDS)[number];
      expect(AWARD_IDS).toContain(id);
      expect(b.querySelector('.tc-badge-icon svg')!.getAttribute('aria-hidden')).toBe('true');
      expect(b.querySelector('.tc-badge-name')!.textContent).toBe(VICTORY.awards[id]);
      // The words are all a screen reader hears.
      expect(b.textContent).toBe(VICTORY.awards[id]);
    }
    expect(q(TEST_IDS.victory)).not.toBeNull();
    click(q(TEST_IDS.rematch));
  });
});
