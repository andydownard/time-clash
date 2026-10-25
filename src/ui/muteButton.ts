// A Sound on/off switch for the covers (pass screen, question). It changes sound only, so it
// leaks nothing about the board. The label follows the settings and the button cleans up after itself.
import { BUTTONS } from '../data/copy';
import type { UiCtx } from './ctx';
import { setSwitch, switchChip } from './selector';
import { LOCAL_IDS } from './constants';

export function createCoverMute(ctx: UiCtx): { el: HTMLButtonElement; dispose: () => void } {
  // An on/off setting, so a switch: the words say the state.
  const el = switchChip(ctx.doc, { testId: LOCAL_IDS.coverMute, extraClass: 'tc-cover-mute' });
  const paint = (): void => {
    const muted = ctx.settings().muted;
    setSwitch(el, !muted, muted ? BUTTONS.soundOff : BUTTONS.soundOn);
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
