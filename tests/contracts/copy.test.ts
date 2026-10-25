import { describe, expect, it } from 'vitest';
import * as COPY from '../../src/data/copy';

/** Every string reachable from the copy module, including template outputs. */
function allStrings(): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      const fn = v as (...args: unknown[]) => unknown;
      visit(fn('Alex', 1, 'Sam'));
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(COPY);
  return out;
}

const BANNED = ['kill', 'die', 'dead', 'blood', 'gore', 'defeat', 'buy', 'price', 'upgrade to pro'];
// Vocabulary table, "NEVER say in UI" column (AGENTS.md).
const VOCAB_BANNED = [
  'p1',
  'p2',
  'bot',
  'ai',
  'assistant',
  'narrator',
  'currency',
  'coins',
  'money',
  'lobby',
  'menu',
  'death',
  'lives',
  'retry',
  'play again',
  'tutorial',
  'quiz',
  'test',
  'exam',
];

describe('copy: banned words', () => {
  const strings = allStrings();

  it('has a lot of strings to check', () => {
    expect(strings.length).toBeGreaterThan(60);
  });

  it.each([...BANNED, ...VOCAB_BANNED])('never says "%s" as a word', (word) => {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    const hits = strings.filter((s) => re.test(s));
    expect(hits).toEqual([]);
  });

  it('avoids banned words even inside other words (skill, deadline, diet)', () => {
    const hits = strings.filter((s) =>
      ['kill', 'dead', 'blood', 'gore', 'defeat'].some((w) => s.toLowerCase().includes(w)),
    );
    expect(hits).toEqual([]);
  });
});

describe('copy: content', () => {
  it('has the 12 tumble bubble lines', () => {
    expect(COPY.TUMBLE_LINES).toHaveLength(12);
    expect(new Set(COPY.TUMBLE_LINES).size).toBe(12);
    expect(COPY.TUMBLE_LINES).toContain('Just checking the lawn for four-leaf clovers!');
  });

  it('has the 6 loading messages from DESIGN_BRIEF.md', () => {
    expect(COPY.LOADING.messages).toHaveLength(6);
    expect(COPY.LOADING.messages).toContain('Teaching the catapult how to do long division...');
  });

  it('builds the turn banner in caps with the shot number', () => {
    expect(COPY.turnBanner('Alex', 1)).toBe('ALEX, YOUR TURN! (SHOT 1 OF 2)');
    expect(COPY.turnBanner('alex', 2)).toBe('ALEX, YOUR TURN! (SHOT 2 OF 2)');
  });

  it('labels grades K to 12', () => {
    expect(COPY.gradeChipLabel(0)).toBe('Kindergarten');
    expect(COPY.gradeChipLabel(2)).toBe('Grade 2');
  });

  it('shows the right answer kindly on a wrong answer', () => {
    expect(COPY.RELOAD.wrong('7')).toContain('7');
  });

  it('describes wind with words and arrows, not color only', () => {
    expect(COPY.windLabel(0)).toBe('Wind: calm');
    expect(COPY.windLabel(5)).toBe('Wind: calm');
    expect(COPY.windLabel(12)).toBe('Wind: breezy → (12)');
    expect(COPY.windLabel(35)).toBe('Wind: windy →→ (35)');
    expect(COPY.windLabel(76)).toBe('Wind: super windy →→→ (76)');
    expect(COPY.windLabel(-12)).toBe('Wind: ← breezy (12)');
    expect(COPY.windLabel(-76)).toBe('Wind: ←←← super windy (76)');
    expect(COPY.windWord(35)).toBe('Windy');
  });

  it('uses the team names from the vocabulary table', () => {
    expect(COPY.TEAM_NAMES.PAST).toBe('Team Past');
    expect(COPY.TEAM_NAMES.FUTURE).toBe('Team Future');
  });
});
