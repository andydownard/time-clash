// @vitest-environment jsdom
// Victory counts get a picture row (stars for brain stats, dots for Scrap) for pre-readers.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VICTORY } from '../../src/data/copy';
import { parseCssVars, resolveCssVars } from '../../src/ui/contrast';
import { COUNT_CAP, countRow } from '../../src/ui/countPictures';
import type { TeamStats } from '../../src/game/types';
import { q, qa, setup } from './helpers';
import { TEST_IDS } from '../../src/ui/types';

const source = readFileSync(join(process.cwd(), 'src/ui/countPictures.ts'), 'utf8');
const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const palette = new Set(
  Object.values(resolveCssVars(parseCssVars(tokens)))
    .filter((v) => /^#[0-9a-f]{6}$/i.test(v))
    .map((v) => v.toLowerCase()),
);

describe('countRow', () => {
  it('draws one star per answer and fills the right ones', () => {
    const row = countRow(document, 'star', 2, 3, 'two of three');
    expect(row.querySelectorAll('svg')).toHaveLength(3);
    expect(row.querySelectorAll('[data-filled="true"]')).toHaveLength(2);
    expect(row.querySelectorAll('[data-filled="false"]')).toHaveLength(1);
  });

  it('is one labeled picture, so a screen reader hears the label once', () => {
    const row = countRow(document, 'dot', 4, 4, '4 Scrap');
    expect(row.getAttribute('role')).toBe('img');
    expect(row.getAttribute('aria-label')).toBe('4 Scrap');
    row.querySelectorAll('svg').forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'));
  });

  it('caps at ten and adds a plus cue past the cap', () => {
    const row = countRow(document, 'dot', 37, 37, 'x');
    expect(row.querySelectorAll('svg')).toHaveLength(COUNT_CAP);
    expect(row.querySelector('[data-role="more"]')?.textContent).toBe('+');
    const exact = countRow(document, 'dot', COUNT_CAP, COUNT_CAP, 'x');
    expect(exact.querySelector('[data-role="more"]')).toBeNull();
  });

  it('draws nothing for zero, negative or bad numbers', () => {
    expect(countRow(document, 'star', 0, 0, 'none').querySelectorAll('svg')).toHaveLength(0);
    expect(countRow(document, 'dot', -3, -3, 'x').querySelectorAll('svg')).toHaveLength(0);
    expect(countRow(document, 'dot', Number.NaN, Number.NaN, 'x').querySelectorAll('svg')).toHaveLength(0);
  });

  it('keeps filled and empty stars apart by shape, not color alone', () => {
    const row = countRow(document, 'star', 1, 2, 'x');
    const [on, off] = Array.from(row.querySelectorAll('path'));
    expect(on!.getAttribute('fill')).not.toBe('none');
    expect(off!.getAttribute('fill')).toBe('none');
  });

  it('uses palette colors only and adds no fonts', () => {
    const hexes = source.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    expect(hexes.length).toBeGreaterThan(0);
    hexes.forEach((c) => expect(palette.has(c.toLowerCase())).toBe(true));
    expect(source).not.toMatch(/font-family/);
  });
});

describe('Victory count pictures', () => {
  const stats = (right: number, total: number, scrap: number): TeamStats => ({
    shotsFired: 4,
    directHits: 1,
    nearHits: 0,
    questionsAnswered: total,
    correctAnswers: right,
    fastestAnswerMs: null,
    scrapEarned: scrap,
  });

  it('shows stars and Scrap dots for both teams, with the words kept', () => {
    const s = setup();
    void s.overlay.showVictory({
      winner: 'PAST',
      names: { PAST: 'Alex', FUTURE: 'Sam' },
      stats: { PAST: stats(3, 3, 14), FUTURE: stats(0, 2, 0) },
    });
    const v = q(TEST_IDS.victory)!;
    const past = v.querySelector<HTMLElement>('[data-award-team="PAST"]')!;
    const future = v.querySelector<HTMLElement>('[data-award-team="FUTURE"]')!;
    expect(past.querySelectorAll('[data-role="brain-stars"] svg')).toHaveLength(3);
    expect(past.querySelectorAll('[data-role="scrap-dots"] svg')).toHaveLength(COUNT_CAP);
    expect(past.querySelector('[data-role="scrap-dots"] [data-role="more"]')).not.toBeNull();
    // The loser sees friendly counts too: hollow stars and a plain zero, never a blank.
    expect(future.querySelectorAll('[data-role="brain-stars"] [data-filled="false"]')).toHaveLength(2);
    expect(future.querySelector('[data-role="scrap-line"]')?.textContent).toContain(
      VICTORY.scrapValue(0),
    );
    expect(past.textContent).toContain(VICTORY.brainStatsValue(3, 3));
    expect(past.textContent).toContain(VICTORY.scrapValue(14));
    // The words are hidden from screen readers where the picture row carries the same label.
    expect(qa('[data-role="brain-stars"]').length).toBe(2);
  });
});
