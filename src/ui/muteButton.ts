// A Sound on/off button for the covers (pass screen, question). It changes sound only, so it
// leaks nothing about the board. The label follows the settings and the button cleans up after itself.
import { BUTTONS } from '../data/copy';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { LOCAL_IDS } from './constants';

export function createCoverMute(ctx: UiCtx): { el: HTMLButtonElement; dispose: () => void } {
  const el = h(ctx.doc, 'button', {
    type: 'button',
    class: 'tc-btn tc-btn-neutral tc-cover-mute',
    'data-testid': LOCAL_IDS.coverMute,
  });
  const paint = (): void => {
    const muted = ctx.settings().muted;
    el.textContent = muted ? BUTTONS.soundOff : BUTTONS.soundOn;
    // The speaker icon is drawn by CSS from this, so the label text stays exact.
    el.dataset.muted = String(muted);
  };
  paint();
  el.addEventListener('click', () => {
    const muted = !ctx.settings().muted;
    ctx.audio?.setMuted(muted);
    ctx.patchSettings({ muted });
  });
  const off = ctx.onSettings(paint);
  return { el, dispose: off };
}
