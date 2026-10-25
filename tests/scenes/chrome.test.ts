// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BUTTONS, UI_EXTRA } from '../../src/data/copy';
import { INTRO_SCRIPT } from '../../src/data/introScript';
import { UI } from '../../src/game/config';
import { CHROME } from '../../src/scenes/copy';
import { CHROME_IDS, createHowToPlay, mountChrome } from '../../src/scenes/chrome';
import { loadSettings } from '../../src/storage/storage';
import { TEST_IDS } from '../../src/ui/types';
import { click, flush, key, q } from '../ui/helpers';
import { makeServices } from './fakes';

let t: ReturnType<typeof makeServices>;
beforeEach(() => {
  t = makeServices();
});

const mount = () => {
  const howTo = createHowToPlay({
    overlay: t.overlay,
    audio: t.audio,
    env: t.clock,
  });
  const chrome = mountChrome(document, {
    howTo,
    overlay: t.overlay,
    audio: t.audio,
    storage: t.storage,
  });
  return { howTo, chrome };
};

describe('createHowToPlay', () => {
  it('opens the five-card intro and resolves when it is skipped', async () => {
    const { howTo } = mount();
    const p = howTo.open();
    await flush();
    expect(howTo.isOpen).toBe(true);
    expect(q(TEST_IDS.introCard)).not.toBeNull();
    click(q(TEST_IDS.introSkip));
    await p;
    expect(howTo.isOpen).toBe(false);
    expect(q(TEST_IDS.introCard)).toBeNull();
  });
  it('a second open while one is up joins the first instead of stacking', async () => {
    const { howTo } = mount();
    const a = howTo.open();
    const b = howTo.open();
    await flush();
    expect(document.querySelectorAll('[data-screen="intro"]').length).toBe(1);
    click(q(TEST_IDS.introSkip));
    await Promise.all([a, b]);
  });
  it('can be opened again after it closes', async () => {
    const { howTo } = mount();
    for (let i = 0; i < 2; i++) {
      const p = howTo.open();
      await flush();
      click(q(TEST_IDS.introSkip));
      await p;
    }
    expect(howTo.isOpen).toBe(false);
  });
  it('remembers the intro was seen once skipped', async () => {
    const { howTo } = mount();
    const p = howTo.open();
    await flush();
    click(q(TEST_IDS.introSkip));
    await p;
    expect(t.storage.get('timeclash.introSeen')).toBe(true);
  });
  it('clears the caption bar afterwards', async () => {
    const { howTo } = mount();
    const p = howTo.open();
    await flush();
    click(q(TEST_IDS.introSkip));
    await p;
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
  });
  it('plays nothing before the tap: audio is locked, so the intro runs silent', async () => {
    const { howTo } = mount();
    expect(t.audio.unlocked).toBe(false);
    const p = howTo.open();
    await flush();
    expect(t.audio.unlocked).toBe(false);
    click(q(TEST_IDS.introSkip));
    await p;
    expect(INTRO_SCRIPT.length).toBe(5);
  });
});

describe('floating buttons', () => {
  it('puts a How to Play ? and a Settings button on the page', () => {
    mount();
    const how = q(TEST_IDS.howToPlay)!;
    expect(how.tagName).toBe('BUTTON');
    expect(how.getAttribute('aria-label')).toBe(BUTTONS.howToPlay);
    expect(how.textContent).toBe(BUTTONS.howToPlayIcon);
    expect(q(CHROME_IDS.settingsButton)!.getAttribute('aria-label')).toBe(CHROME.settingsLabel);
  });
  it('both are real buttons with 56px targets', () => {
    mount();
    for (const id of [TEST_IDS.howToPlay, CHROME_IDS.settingsButton]) {
      const b = q(id)!;
      expect(b.classList.contains('tc-icon-btn')).toBe(true);
      expect(b.getAttribute('type')).toBe('button');
    }
    expect(UI.tapTargetMinPx).toBe(56);
  });
  it('the ? opens How to Play', async () => {
    const { howTo } = mount();
    click(q(TEST_IDS.howToPlay));
    await flush();
    expect(howTo.isOpen).toBe(true);
    click(q(TEST_IDS.introSkip));
    await flush();
  });
  it('hides while a pass screen or question cover is up, so nothing leaks', async () => {
    mount();
    const host = q(TEST_IDS.howToPlay)!.closest<HTMLElement>('[data-tc-chrome]')!;
    expect(host.hidden).toBe(false);
    void t.overlay.showPassScreen({ nextName: 'Alex', nextTeam: 'PAST' });
    await flush();
    expect(document.body.dataset.cover).toBe('pass');
    await flush();
    expect(host.hidden).toBe(true);
  });
  it('mounting twice does not duplicate the buttons', () => {
    mount();
    mount();
    expect(document.querySelectorAll(`[data-testid="${TEST_IDS.howToPlay}"]`).length).toBe(1);
  });
  it('destroy removes them', () => {
    const { chrome } = mount();
    chrome.destroy();
    expect(q(TEST_IDS.howToPlay)).toBeNull();
  });
});

describe('settings panel', () => {
  const open = () => {
    mount();
    click(q(CHROME_IDS.settingsButton));
  };
  it('opens as a dialog with sound, captions, Clear my data, and Done', () => {
    open();
    const panel = q(CHROME_IDS.panel)!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(q(CHROME_IDS.mute)).not.toBeNull();
    expect(q(CHROME_IDS.captions)).not.toBeNull();
    expect(q(CHROME_IDS.clear)!.textContent).toBe(UI_EXTRA.clearData);
    expect(q(CHROME_IDS.close)!.textContent).toBe(CHROME.close);
  });
  it('mute flips the audio and is saved', () => {
    open();
    click(q(CHROME_IDS.mute));
    expect(t.audio.muted).toBe(true);
    expect(loadSettings(t.storage).muted).toBe(true);
    expect(q(CHROME_IDS.mute)!.textContent).toBe(BUTTONS.soundOff);
    click(q(CHROME_IDS.mute));
    expect(t.audio.muted).toBe(false);
    expect(q(CHROME_IDS.mute)!.textContent).toBe(BUTTONS.soundOn);
  });
  it('has a volume slider that sets the volume and saves it', () => {
    open();
    const slider = q<HTMLInputElement>(CHROME_IDS.volume)!;
    expect(slider.type).toBe('range');
    expect(slider.classList.contains('tc-range')).toBe(true);
    expect(Number(slider.value)).toBe(Math.round(t.audio.volume * 100));
    slider.value = '30';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(t.audio.volume).toBeCloseTo(0.3);
    expect(loadSettings(t.storage).volume).toBeCloseTo(0.3);
    expect(q(CHROME_IDS.volumeValue)!.textContent).toContain('30');
  });
  it('has a Music button that turns only the music off, and saves it', () => {
    open();
    const b = q(CHROME_IDS.music)!;
    expect(b.textContent).toBe(BUTTONS.musicOn);
    click(b);
    expect(t.audio.musicOn).toBe(false);
    expect(t.audio.muted).toBe(false);
    expect(loadSettings(t.storage).musicOn).toBe(false);
    expect(b.textContent).toBe(BUTTONS.musicOff);
    click(b);
    expect(t.audio.musicOn).toBe(true);
    expect(loadSettings(t.storage).musicOn).toBe(true);
  });
  it('has a Motion button, so a shared iPad does not depend on the system setting', () => {
    open();
    const b = q(CHROME_IDS.motion)!;
    expect(b.textContent).toBe(BUTTONS.motionOn);
    click(b);
    expect(loadSettings(t.storage).reducedMotion).toBe('on');
    expect(b.textContent).toBe(BUTTONS.motionOff);
    expect(document.querySelector('[data-tc-root]')!.getAttribute('data-motion')).toBe('reduced');
    click(b);
    expect(loadSettings(t.storage).reducedMotion).toBe('off');
    expect(b.textContent).toBe(BUTTONS.motionOn);
    expect(document.querySelector('[data-tc-root]')!.getAttribute('data-motion')).toBe('full');
  });
  it('has a Bonus ring switch: shown by default, saved when hidden, and 56px or more', () => {
    open();
    const b = q(CHROME_IDS.bonusRing)!;
    expect(b.textContent).toBe(BUTTONS.bonusRingShown);
    expect(loadSettings(t.storage).hideBonusRing).toBe(false);
    click(b);
    expect(loadSettings(t.storage).hideBonusRing).toBe(true);
    expect(b.textContent).toBe(BUTTONS.bonusRingHidden);
    click(b);
    expect(loadSettings(t.storage).hideBonusRing).toBe(false);
    expect(b.textContent).toBe(BUTTONS.bonusRingShown);
    expect(b.getAttribute('aria-checked')).toBe('true');
    expect(b.classList.contains('tc-chip')).toBe(true);
  });
  it('the Bonus ring choice does not change the other settings', () => {
    open();
    click(q(CHROME_IDS.captions));
    click(q(CHROME_IDS.bonusRing));
    const s = loadSettings(t.storage);
    expect(s.captions).toBe(false);
    expect(s.hideBonusRing).toBe(true);
  });
  it('Clear my data brings the ring back', () => {
    t.storage.set('timeclash.settings', { ...loadSettings(t.storage), hideBonusRing: true });
    open();
    expect(q(CHROME_IDS.bonusRing)!.textContent).toBe(BUTTONS.bonusRingHidden);
    click(q(CHROME_IDS.clear));
    click(q(CHROME_IDS.clearYes));
    expect(loadSettings(t.storage).hideBonusRing).toBe(false);
    expect(q(CHROME_IDS.bonusRing)!.textContent).toBe(BUTTONS.bonusRingShown);
  });
  it('the chrome host carries data-motion and follows the Motion setting', () => {
    const host = (): Element => document.querySelector('[data-tc-chrome]')!;
    open();
    expect(host().getAttribute('data-motion')).toBe('full');
    click(q(CHROME_IDS.motion)!);
    expect(host().getAttribute('data-motion')).toBe('reduced');
    click(q(CHROME_IDS.motion)!);
    expect(host().getAttribute('data-motion')).toBe('full');
  });
  it('the chrome host starts reduced when the saved setting says so', () => {
    t.storage.set('timeclash.settings', {
      muted: false,
      volume: 0.5,
      captions: true,
      musicOn: true,
      reducedMotion: 'on',
      hideBonusRing: false,
    });
    mount();
    expect(document.querySelector('[data-tc-chrome]')!.getAttribute('data-motion')).toBe('reduced');
  });
  it('captions flip, are saved, and hide the caption bar', () => {
    open();
    t.overlay.setCaption('hello');
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(false);
    click(q(CHROME_IDS.captions));
    expect(loadSettings(t.storage).captions).toBe(false);
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
    expect(q(CHROME_IDS.captions)!.textContent).toBe(BUTTONS.captionsOff);
  });
  it('Clear my data asks first, and No keeps everything', () => {
    t.storage.set('timeclash.introSeen', true);
    open();
    click(q(CHROME_IDS.clear));
    expect(document.body.textContent).toContain(UI_EXTRA.clearDataAsk);
    click(q(CHROME_IDS.clearNo));
    expect(t.storage.get('timeclash.introSeen')).toBe(true);
    expect(q(CHROME_IDS.clearYes)).toBeNull();
  });
  it('Yes clears players, intro flag, history and settings, and says so', () => {
    t.storage.set('timeclash.introSeen', true);
    t.storage.set('timeclash.players', [
      { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
      { name: 'Sam', team: 'FUTURE', grade: 5, subject: 'reading' },
    ]);
    t.storage.set('timeclash.history', { used: { 'math-3': ['x'] }, lastSubject: {} });
    t.storage.set('timeclash.settings', {
      muted: true,
      volume: 0.2,
      captions: false,
      musicOn: false,
      reducedMotion: 'on',
      hideBonusRing: false,
    });
    t.audio.setMuted(true);
    t.audio.setMusicOn(false);
    open();
    click(q(CHROME_IDS.clear));
    click(q(CHROME_IDS.clearYes));
    expect(t.storage.get('timeclash.settings')).toBeNull();
    expect(t.storage.get('timeclash.introSeen')).toBeNull();
    expect(t.storage.get('timeclash.players')).toBeNull();
    expect(t.storage.get('timeclash.history')).toBeNull();
    expect(t.audio.muted).toBe(false);
    expect(t.audio.musicOn).toBe(true);
    expect(q(CHROME_IDS.panel)!.textContent).toContain(UI_EXTRA.clearDataDone);
  });
  it('Done and Escape close it and put focus back on the gear', () => {
    open();
    click(q(CHROME_IDS.close));
    expect(q(CHROME_IDS.panel)).toBeNull();
    expect(document.activeElement).toBe(q(CHROME_IDS.settingsButton));
    click(q(CHROME_IDS.settingsButton));
    key(q(CHROME_IDS.panel)!, 'Escape');
    expect(q(CHROME_IDS.panel)).toBeNull();
  });
  it('one Escape closes Settings and goes no further (it must not also pause the game)', () => {
    open();
    let reached = false;
    document.addEventListener('keydown', () => (reached = true), { once: true });
    key(q(CHROME_IDS.panel)!, 'Escape');
    expect(q(CHROME_IDS.panel)).toBeNull();
    expect(reached).toBe(false);
  });
  it('opening twice shows one panel', () => {
    open();
    click(q(CHROME_IDS.settingsButton));
    expect(document.querySelectorAll(`[data-testid="${CHROME_IDS.panel}"]`).length).toBe(1);
  });
});
