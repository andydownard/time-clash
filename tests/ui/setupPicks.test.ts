// @vitest-environment jsdom
// Setup opens with the grades and Focus the family picked last time.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Players } from '../../src/game/types';
import { TEST_IDS } from '../../src/ui/types';
import { click, flush, q, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const checked = (id: string) => q(id)!.getAttribute('aria-checked');
const topic = () => q(TEST_IDS.setupTopic('PAST', 'multiplication'))!;
const SAVED_PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 2, subject: 'reading' },
  { name: 'Sam', team: 'FUTURE', grade: 8, subject: 'math' },
];

describe('Setup remembers the last picks', () => {
  it('starts at the first-run grade when nothing is saved', () => {
    void s.overlay.showSetup(null);
    expect(checked(TEST_IDS.setupGrade('PAST', 2))).toBe('true');
    expect(checked(TEST_IDS.setupGrade('FUTURE', 2))).toBe('true');
    expect(checked(TEST_IDS.setupTopic('PAST', 'multiplication'))).toBe('false');
  });

  it('opens with saved grades, subjects and Focus when no players are given', () => {
    s.storage.set('timeclash.setupPicks', {
      PAST: { grade: 5, subject: 'math', topic: 'multiplication' },
      FUTURE: { grade: 0, subject: 'reading' },
    });
    void s.overlay.showSetup(null);
    expect(checked(TEST_IDS.setupGrade('PAST', 5))).toBe('true');
    expect(checked(TEST_IDS.setupGrade('FUTURE', 0))).toBe('true');
    expect(checked(TEST_IDS.setupSubject('PAST', 'math'))).toBe('true');
    expect(checked(TEST_IDS.setupSubject('FUTURE', 'reading'))).toBe('true');
    expect(topic().getAttribute('aria-checked')).toBe('true');
  });

  it('keeps names at the defaults: no name is remembered here', () => {
    s.storage.set('timeclash.setupPicks', { PAST: { grade: 5, subject: 'math' } });
    void s.overlay.showSetup(null);
    expect(JSON.stringify(s.storage.get('timeclash.setupPicks'))).not.toMatch(/name/i);
  });

  it('players already saved win over the remembered picks', () => {
    s.storage.set('timeclash.setupPicks', { PAST: { grade: 5, subject: 'math' } });
    void s.overlay.showSetup(SAVED_PLAYERS);
    expect(checked(TEST_IDS.setupGrade('PAST', 2))).toBe('true');
    expect(checked(TEST_IDS.setupGrade('FUTURE', 8))).toBe('true');
  });

  it('falls back to defaults for junk picks', () => {
    s.storage.set('timeclash.setupPicks', { PAST: { grade: 99, subject: 'math' } } as never);
    void s.overlay.showSetup(null);
    expect(checked(TEST_IDS.setupGrade('PAST', 2))).toBe('true');
  });

  it('saves both sides on Let\'s clash, and the next Setup opens with them', async () => {
    const p = s.overlay.showSetup(null);
    click(q(TEST_IDS.setupGrade('PAST', 4)));
    click(q(TEST_IDS.setupGrade('FUTURE', 9)));
    click(q(TEST_IDS.setupSubject('FUTURE', 'math')));
    click(topic());
    click(q(TEST_IDS.setupNext));
    await p;
    expect(s.storage.get('timeclash.setupPicks')).toEqual({
      PAST: { grade: 4, subject: 'both', topic: 'multiplication' },
      FUTURE: { grade: 9, subject: 'math' },
    });
    // The saved picks reopen Setup (see the test above that loads them).
    void s.overlay.showSetup(null);
    await flush();
    expect(checked(TEST_IDS.setupGrade('FUTURE', 9))).toBe('true');
  });

  it('saves nothing when Setup is left with an error', () => {
    void s.overlay.showSetup(null);
    const name = q<HTMLInputElement>(TEST_IDS.setupName('PAST'))!;
    name.value = '';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    click(q(TEST_IDS.setupGrade('PAST', 6)));
    click(q(TEST_IDS.setupNext));
    expect(s.storage.get('timeclash.setupPicks')).toBeNull();
  });

  it('Clear my data forgets the picks and resets the chips', () => {
    s.storage.set('timeclash.setupPicks', {
      PAST: { grade: 5, subject: 'math', topic: 'multiplication' },
    });
    void s.overlay.showSetup(null);
    click(q('clear-data'));
    click(q('clear-data-yes'));
    expect(s.storage.get('timeclash.setupPicks')).toBeNull();
    expect(checked(TEST_IDS.setupGrade('PAST', 2))).toBe('true');
    expect(topic().getAttribute('aria-checked')).toBe('false');
  });
});
