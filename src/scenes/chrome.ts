// The two small buttons that are reachable from every scene: How to Play (?) and Settings.
// Plain DOM, outside the game canvas. They hide while a pass screen or question cover is up,
// so the other player never sees anything they should not.
import { BUTTONS, UI_EXTRA } from '../data/copy';
import { INTRO_SCRIPT } from '../data/introScript';
import { DEFAULT_SETTINGS } from '../game/config';
import { clearMyData, loadSettings } from '../storage/storage';
import type { AudioManager } from '../audio/types';
import type { TypedStorage } from '../storage/types';
import { h, trapTab } from '../ui/dom';
import type { LoadingEnv } from '../ui/loadingLogic';
import { TEST_IDS, Z, type Overlay } from '../ui/types';
import { CHROME } from './copy';
import type { HowToPlay } from './registry';
import { isReducedMotion } from '../ui/motion';
import {
  setHideBonusRing,
  setReducedMotion,
  setVolume,
  toggleCaptions,
  toggleMusic,
  toggleMute,
} from './settingsActions';

export const CHROME_IDS = {
  settingsButton: 'settings-button',
  panel: 'settings-panel',
  mute: 'settings-mute',
  captions: 'settings-captions',
  volume: 'settings-volume',
  volumeValue: 'settings-volume-value',
  music: 'settings-music',
  motion: 'settings-motion',
  bonusRing: 'settings-bonus-ring',
  clear: 'settings-clear',
  clearYes: 'settings-clear-yes',
  clearNo: 'settings-clear-no',
  close: 'settings-close',
  note: 'settings-note',
} as const;

/** Above the screens (50) and captions, below the covers (100). */
const CHROME_Z = Z.screen + 10;

export function createHowToPlay(deps: {
  overlay: Overlay;
  audio: AudioManager;
  env: LoadingEnv;
}): HowToPlay {
  const { overlay, audio, env } = deps;
  let current: Promise<void> | null = null;
  // Only used when no AudioManager speaks the line. Keeps a card up for its nominal length.
  const play = (index: number): Promise<void> =>
    new Promise((resolve) => env.setTimeout(resolve, INTRO_SCRIPT[index]?.durationMs ?? 0));
  return {
    get isOpen() {
      return current !== null;
    },
    open() {
      if (current) return current;
      current = (async () => {
        try {
          await overlay.showIntro(INTRO_SCRIPT, play);
        } finally {
          audio.stopSpeech();
          overlay.setCaption(null);
          current = null;
        }
      })();
      return current;
    },
  };
}

export type ChromeDeps = {
  howTo: HowToPlay;
  overlay: Overlay;
  audio: AudioManager;
  storage: TypedStorage;
};

export type Chrome = { destroy(): void };

export function mountChrome(doc: Document, deps: ChromeDeps): Chrome {
  const { howTo, overlay, audio, storage } = deps;
  doc.querySelector('[data-tc-chrome]')?.remove();

  const how = h(doc, 'button', {
    type: 'button',
    class: 'tc-icon-btn',
    'data-testid': TEST_IDS.howToPlay,
    'aria-label': CHROME.howToPlayLabel,
    text: BUTTONS.howToPlayIcon,
  });
  const gear = h(doc, 'button', {
    type: 'button',
    class: 'tc-icon-btn',
    'data-testid': CHROME_IDS.settingsButton,
    'aria-label': CHROME.settingsLabel,
    text: CHROME.settingsIcon,
  });
  how.style.fontSize = '28px';
  gear.style.fontSize = '30px';
  const row = h(doc, 'div', { class: 'tc-row' }, how, gear);
  Object.assign(row.style, {
    position: 'absolute',
    top: '12px',
    left: '12px',
    // Above the Settings panel, so the ? and gear stay in view while it is open.
    zIndex: '2',
    pointerEvents: 'auto',
  });
  const host = h(doc, 'div', { 'data-tc-root': '', 'data-tc-chrome': '' }, row);
  Object.assign(host.style, {
    position: 'fixed',
    inset: '0',
    zIndex: String(CHROME_Z),
    pointerEvents: 'none',
  });
  doc.body.append(host);

  how.addEventListener('click', () => void howTo.open());

  let panel: HTMLElement | null = null;
  const closePanel = (): void => {
    panel?.remove();
    panel = null;
    gear.focus();
  };

  const openPanel = (): void => {
    if (panel) return;
    const mute = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': CHROME_IDS.mute,
    });
    const captions = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': CHROME_IDS.captions,
    });
    const music = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': CHROME_IDS.music,
    });
    const motion = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': CHROME_IDS.motion,
    });
    const bonusRing = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': CHROME_IDS.bonusRing,
    });
    const volume = h(doc, 'input', {
      type: 'range',
      class: 'tc-range',
      id: 'tc-settings-volume',
      min: 0,
      max: 100,
      step: 10,
      'data-testid': CHROME_IDS.volume,
    });
    const volumeValue = h(doc, 'output', {
      class: 'tc-readout',
      for: 'tc-settings-volume',
      'data-testid': CHROME_IDS.volumeValue,
    });
    const note = h(doc, 'p', { 'data-testid': CHROME_IDS.note, role: 'status' });
    const clear = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': CHROME_IDS.clear,
      text: UI_EXTRA.clearData,
    });
    const confirm = h(doc, 'div', { class: 'tc-row' });
    const close = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-primary',
      'data-testid': CHROME_IDS.close,
      text: CHROME.close,
    });

    const paint = (): void => {
      mute.textContent = audio.muted ? BUTTONS.soundOff : BUTTONS.soundOn;
      captions.textContent = loadSettings(storage).captions
        ? BUTTONS.captionsOn
        : BUTTONS.captionsOff;
      music.textContent = audio.musicOn ? BUTTONS.musicOn : BUTTONS.musicOff;
      const reduced = isReducedMotion(loadSettings(storage).reducedMotion, doc.defaultView);
      motion.textContent = reduced ? BUTTONS.motionOff : BUTTONS.motionOn;
      bonusRing.textContent = loadSettings(storage).hideBonusRing
        ? BUTTONS.bonusRingHidden
        : BUTTONS.bonusRingShown;
      volume.value = String(Math.round(audio.volume * 100));
      volumeValue.textContent = `${volume.value}%`;
    };
    paint();

    mute.addEventListener('click', () => {
      toggleMute(audio, storage);
      overlay.applySettings(loadSettings(storage));
      paint();
    });
    volume.addEventListener('input', () => {
      setVolume(audio, storage, Number(volume.value) / 100);
      volumeValue.textContent = `${volume.value}%`;
    });
    music.addEventListener('click', () => {
      toggleMusic(audio, storage);
      paint();
    });
    motion.addEventListener('click', () => {
      const reduced = isReducedMotion(loadSettings(storage).reducedMotion, doc.defaultView);
      // Motion shows what a tap will do: when motion is reduced, the tap turns it back on.
      setReducedMotion(storage, reduced ? 'off' : 'on');
      overlay.applySettings(loadSettings(storage));
      paint();
    });
    bonusRing.addEventListener('click', () => {
      setHideBonusRing(storage, !loadSettings(storage).hideBonusRing);
      overlay.applySettings(loadSettings(storage));
      paint();
    });
    captions.addEventListener('click', () => {
      toggleCaptions(storage);
      overlay.applySettings(loadSettings(storage));
      paint();
    });
    clear.addEventListener('click', () => {
      const yes = h(doc, 'button', {
        type: 'button',
        class: 'tc-btn tc-btn-primary',
        'data-testid': CHROME_IDS.clearYes,
        text: UI_EXTRA.clearDataYes,
      });
      const no = h(doc, 'button', {
        type: 'button',
        class: 'tc-btn tc-btn-neutral',
        'data-testid': CHROME_IDS.clearNo,
        text: UI_EXTRA.clearDataNo,
      });
      confirm.replaceChildren(h(doc, 'p', { text: UI_EXTRA.clearDataAsk }), yes, no);
      yes.addEventListener('click', () => {
        // Reset sound first, then wipe, so nothing is written back after the wipe.
        audio.setMuted(DEFAULT_SETTINGS.muted);
        audio.setVolume(DEFAULT_SETTINGS.volume);
        audio.setMusicOn(DEFAULT_SETTINGS.musicOn);
        clearMyData(storage);
        overlay.applySettings({ ...DEFAULT_SETTINGS });
        confirm.replaceChildren();
        note.textContent = UI_EXTRA.clearDataDone;
        paint();
      });
      no.addEventListener('click', () => confirm.replaceChildren());
      no.focus();
    });
    close.addEventListener('click', closePanel);

    panel = h(
      doc,
      'section',
      {
        class: 'tc-screen tc-settings',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'tc-settings-title',
        'data-testid': CHROME_IDS.panel,
      },
      h(
        doc,
        'div',
        { class: 'tc-panel' },
        h(
          doc,
          'header',
          { class: 'tc-panel-head' },
          h(doc, 'h1', { id: 'tc-settings-title', text: CHROME.settingsTitle }),
        ),
        h(
          doc,
          'div',
          { class: 'tc-panel-body' },
          h(doc, 'div', { class: 'tc-row' }, mute, captions),
          h(doc, 'div', { class: 'tc-row' }, music, motion),
          h(doc, 'div', { class: 'tc-row' }, bonusRing),
          h(
            doc,
            'div',
            { class: 'tc-slider-row' },
            h(doc, 'label', { for: 'tc-settings-volume', text: BUTTONS.volume }),
            volume,
            volumeValue,
          ),
          clear,
          confirm,
          note,
          close,
        ),
      ),
    );
    panel.style.pointerEvents = 'auto';
    panel.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // Stop here, so the same press does not also pause the game behind the panel.
      e.stopPropagation();
      closePanel();
    });
    trapTab(panel);
    host.append(panel);
    close.focus();
  };
  gear.addEventListener('click', openPanel);

  // Hide while a cover is up. Nothing here should be visible, focusable, or readable then.
  const syncCover = (): void => {
    const covered = Boolean(doc.body.dataset.cover);
    host.hidden = covered;
    if (covered) host.setAttribute('inert', '');
    else host.removeAttribute('inert');
  };
  const MO = doc.defaultView?.MutationObserver;
  const observer = MO ? new MO(syncCover) : null;
  observer?.observe(doc.body, { attributes: true, attributeFilter: ['data-cover'] });
  syncCover();

  return {
    destroy() {
      observer?.disconnect();
      host.remove();
    },
  };
}
