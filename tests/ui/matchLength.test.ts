// @vitest-environment jsdom
// Setup: a parent picks Short, Normal or Long. Normal unless they touch it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_IDS } from '../../src/ui/types';
import { click, q, setup } from './helpers';

vi.setConfig({ testTimeout: 120_000 });

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const checked = (len: string) => q(TEST_IDS.setupMatchLength(len))!.getAttribute('aria-checked');
const key = (len: string, k: string) =>
  q(TEST_IDS.setupMatchLength(len))!.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true }),
  );

describe('Setup match length', () => {
  it('starts on Normal and offers exactly three choices', () => {
    void s.overlay.showSetup(null);
    expect(checked('normal')).toBe('true');
    expect(checked('short')).toBe('false');
    expect(checked('long')).toBe('false');
    expect(document.querySelectorAll('.tc-length [role="radio"]')).toHaveLength(3);
  });

  it('opens on the saved length, and junk means Normal', () => {
    s.storage.set('timeclash.matchLength', 'long');
    void s.overlay.showSetup(null);
    expect(checked('long')).toBe('true');
  });

  it('saves the pick on Let us clash and not before', async () => {
    const p = s.overlay.showSetup(null);
    click(q(TEST_IDS.setupMatchLength('short')));
    expect(checked('short')).toBe('true');
    expect(s.storage.get('timeclash.matchLength')).toBeNull();
    click(q(TEST_IDS.setupNext));
    await p;
    expect(s.storage.get('timeclash.matchLength')).toBe('short');
  });

  it('arrow keys move through the choices and stop at the ends', () => {
    void s.overlay.showSetup(null);
    key('normal', 'ArrowRight');
    expect(checked('long')).toBe('true');
    key('long', 'ArrowRight');
    expect(checked('long')).toBe('true');
    key('long', 'ArrowLeft');
    expect(checked('normal')).toBe('true');
  });

  it('is one Tab stop and has a word label, not only a color', () => {
    void s.overlay.showSetup(null);
    expect(q(TEST_IDS.setupMatchLength('normal'))!.tabIndex).toBe(0);
    expect(q(TEST_IDS.setupMatchLength('short'))!.tabIndex).toBe(-1);
    expect(q(TEST_IDS.setupMatchLength('short'))!.textContent).toMatch(/Short/);
    expect(document.querySelector('[role="radiogroup"][aria-label="Match length"]')).not.toBeNull();
  });

  it('Clear my data puts it back to Normal', () => {
    s.storage.set('timeclash.matchLength', 'long');
    void s.overlay.showSetup(null);
    click(q('clear-data'));
    click(q('clear-data-yes'));
    expect(s.storage.get('timeclash.matchLength')).toBeNull();
    expect(checked('normal')).toBe('true');
  });
});
