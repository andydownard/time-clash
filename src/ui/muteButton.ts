// The Sound on/off switch, the same one Settings has. The covers (pass screen, question) and
// How to Play use it. It changes sound only, so it leaks nothing about the board. The label
// follows the settings and the switch cleans up after itself.
import { BUTTONS } from '../data/copy';
import type { UiCtx } from './ctx';
import { setSwitch, switchChip } from './selector';
import { LOCAL_IDS } from './constants';

export type SoundSwitch = { el: HTMLButtonElement; dispose: () => void };

export function createSoundSwitch(
  ctx: UiCtx,
  attrs: { testId: string; extraClass?: string },
): SoundSwitch {
  // An on/off setting, so a switch: the words say the state.
  const el = switchChip(ctx.doc, attrs);
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

export function createCoverMute(ctx: UiCtx): SoundSwitch {
  return createSoundSwitch(ctx, { testId: LOCAL_IDS.coverMute, extraClass: 'tc-cover-mute' });
}
