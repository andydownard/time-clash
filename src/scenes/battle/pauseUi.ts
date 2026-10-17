// The Pause corner button and its panel. Plain DOM, like every button in the game.
// Pausing freezes the scene (tweens and timers) and the flow waits until Keep playing.
import { BUTTONS, PAUSE } from '../../data/copy';
import { UI } from '../../game/config';
import { h, trapTab } from '../../ui/dom';

export type PauseHandlers = { onPause: () => void; onResume: () => void; onLeave?: () => void };
export type PauseControl = {
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  destroy(): void;
};

const PAUSE_Z = 12;
const PANEL_Z = 40;

export function createPauseControl(doc: Document, handlers: PauseHandlers): PauseControl {
  let paused = false;
  let panel: HTMLElement | null = null;

  const style = h(doc, 'style');
  // A cover (pass screen, reload) sits above this button. Hiding it keeps Tab from reaching it.
  style.textContent = 'body[data-cover] [data-tc-pause] { display: none !important; }';

  const button = h(doc, 'button', {
    type: 'button',
    class: 'tc-btn tc-btn-neutral',
    'data-tc-pause': '',
    'data-testid': 'pause',
    text: BUTTONS.pause,
  });
  const bs = button.style;
  bs.position = 'fixed';
  bs.right = '16px';
  // Top right, under the team card, so the band under the picture holds only the controls.
  bs.top = 'var(--tc-pause-top)';
  bs.zIndex = String(PAUSE_Z);
  bs.minHeight = `${UI.tapTargetMinPx}px`;
  bs.minWidth = `${UI.tapTargetMinPx}px`;

  // Keeps Tab and taps from reaching Fire or the sliders behind the panel.
  const setHudInert = (on: boolean): void => {
    for (const el of doc.querySelectorAll('[data-layer="hud"]')) {
      if (on) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    }
  };

  const resumeButton = (): HTMLButtonElement => {
    const b = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': 'pause-resume',
      text: BUTTONS.resume,
    });
    b.style.minHeight = `${UI.tapTargetMinPx}px`;
    b.addEventListener('click', () => api.resume());
    return b;
  };

  const leaveButton = (): HTMLButtonElement => {
    const b = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': 'pause-leave',
      text: BUTTONS.leaveGame,
    });
    b.style.minHeight = `${UI.tapTargetMinPx}px`;
    return b;
  };

  /** The card shows the pause choices, or the "Leave this game?" question. */
  const showChoices = (card: HTMLElement): void => {
    const resume = resumeButton();
    const leave = leaveButton();
    leave.addEventListener('click', () => showConfirm(card));
    card.replaceChildren(h(doc, 'h2', { id: 'tc-pause-heading', text: BUTTONS.pause }), resume);
    if (handlers.onLeave) card.append(leave);
    resume.focus();
  };

  const showConfirm = (card: HTMLElement): void => {
    const stay = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': 'pause-stay',
      text: BUTTONS.stay,
    });
    stay.style.minHeight = `${UI.tapTargetMinPx}px`;
    stay.addEventListener('click', () => showChoices(card));
    const leave = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': 'pause-leave-yes',
      text: BUTTONS.leaveGame,
    });
    leave.style.minHeight = `${UI.tapTargetMinPx}px`;
    leave.addEventListener('click', () => handlers.onLeave?.());
    card.replaceChildren(
      h(doc, 'h2', { id: 'tc-pause-heading', text: PAUSE.leaveTitle }),
      h(doc, 'p', { text: PAUSE.leaveBody }),
      stay,
      leave,
    );
    // The safe choice gets focus, so a stray key never ends a game.
    stay.focus();
  };

  const api: PauseControl = {
    pause() {
      if (paused) return;
      paused = true;
      panel = h(
        doc,
        'section',
        {
          'data-tc-pause': '',
          'data-testid': 'pause-panel',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'tc-pause-heading',
        },
        h(doc, 'div', { class: 'tc-cover-card' }),
      );
      const ps = panel.style;
      ps.position = 'fixed';
      ps.top = '0';
      ps.right = '0';
      ps.bottom = '0';
      ps.left = '0';
      ps.zIndex = String(PANEL_Z);
      ps.display = 'flex';
      ps.alignItems = 'center';
      ps.justifyContent = 'center';
      ps.backgroundColor = 'rgba(14, 26, 51, 0.82)';
      trapTab(panel);
      doc.body.dataset.paused = 'true';
      setHudInert(true);
      doc.body.append(panel);
      showChoices(panel.querySelector('.tc-cover-card') as HTMLElement);
      handlers.onPause();
    },
    resume() {
      if (!paused) return;
      paused = false;
      panel?.remove();
      panel = null;
      delete doc.body.dataset.paused;
      setHudInert(false);
      button.focus();
      handlers.onResume();
    },
    isPaused: () => paused,
    destroy() {
      doc.removeEventListener('keydown', onKey);
      panel?.remove();
      panel = null;
      button.remove();
      style.remove();
      paused = false;
      delete doc.body.dataset.paused;
      setHudInert(false);
    },
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (doc.body.dataset.cover) return;
    // The Settings panel handles its own Escape. One press must not also pause the game.
    if (doc.querySelector('[data-testid="settings-panel"]')) return;
    if (paused) api.resume();
    else api.pause();
  };

  doc.head.append(style);
  doc.body.append(button);
  button.addEventListener('click', () => api.pause());
  doc.addEventListener('keydown', onKey);
  return api;
}
