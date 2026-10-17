// @vitest-environment jsdom
// The Settings panel is a card with a header strip, and the ? and gear buttons stay in view.
import { beforeEach, describe, expect, it } from 'vitest';
import { CHROME } from '../../src/scenes/copy';
import { CHROME_IDS, createHowToPlay, mountChrome } from '../../src/scenes/chrome';
import { TEST_IDS } from '../../src/ui/types';
import { click, q } from '../ui/helpers';
import { makeServices } from './fakes';

let t: ReturnType<typeof makeServices>;
beforeEach(() => {
  t = makeServices();
  const howTo = createHowToPlay({ overlay: t.overlay, audio: t.audio, env: t.clock });
  mountChrome(document, { howTo, overlay: t.overlay, audio: t.audio, storage: t.storage });
});

describe('Settings panel look', () => {
  it('is a labelled dialog card: header strip with the title, then the controls', () => {
    click(q(CHROME_IDS.settingsButton));
    const panel = q(CHROME_IDS.panel)!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    const card = panel.querySelector('.tc-panel')!;
    const head = card.querySelector('.tc-panel-head h1')!;
    expect(head.id).toBe('tc-settings-title');
    expect(head.textContent).toBe(CHROME.settingsTitle);
    expect(panel.getAttribute('aria-labelledby')).toBe(head.id);
    const body = card.querySelector('.tc-panel-body')!;
    for (const id of [
      CHROME_IDS.mute,
      CHROME_IDS.captions,
      CHROME_IDS.music,
      CHROME_IDS.motion,
      CHROME_IDS.volume,
      CHROME_IDS.clear,
      CHROME_IDS.close,
    ]) {
      expect(body.contains(q(id)), id).toBe(true);
    }
  });

  it('keeps the ? and gear row above the panel, so both stay visible and tappable', () => {
    click(q(CHROME_IDS.settingsButton));
    const row = q(TEST_IDS.howToPlay)!.parentElement as HTMLElement;
    expect(Number(row.style.zIndex)).toBeGreaterThan(0);
    expect(row.style.position).toBe('absolute');
  });

  it('the neutral buttons and the one primary Done button are real sized buttons', () => {
    click(q(CHROME_IDS.settingsButton));
    expect(q(CHROME_IDS.close)!.classList.contains('tc-btn-primary')).toBe(true);
    for (const id of [CHROME_IDS.mute, CHROME_IDS.captions, CHROME_IDS.music, CHROME_IDS.motion]) {
      expect(q(id)!.classList.contains('tc-btn-neutral')).toBe(true);
    }
  });

  it('Done closes the panel and puts focus back on the gear', () => {
    click(q(CHROME_IDS.settingsButton));
    click(q(CHROME_IDS.close));
    expect(q(CHROME_IDS.panel)).toBeNull();
    expect(document.activeElement).toBe(q(CHROME_IDS.settingsButton));
  });
});
