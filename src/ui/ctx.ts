// Shared context handed to each UI module. It holds the layers, settings, and timers,
// so the modules stay small and testable.
import type { AudioManager, SfxName } from '../audio/types';
import type { Settings, TypedStorage } from '../storage/types';
import type { LoadingEnv } from './loadingLogic';
import type { CoverKind } from './types';

export type LayerName = 'hud' | 'bubble' | 'banner' | 'caption' | 'screen' | 'cover';

export type UiCtx = {
  doc: Document;
  env: LoadingEnv;
  audio: AudioManager | undefined;
  storage: TypedStorage;
  layer: Record<LayerName, HTMLElement>;
  settings(): Settings;
  /** Merges into the current settings and refreshes labels and captions. */
  patchSettings(patch: Partial<Settings>): void;
  onSettings(fn: () => void): () => void;
  reduced(): boolean;
  motion(): 'reduced' | 'full';
  sfx(name: SfxName): void;
  setCaption(text: string | null): void;
  /** Puts `el` on the cover layer, hides the board, and returns a function that undoes it. */
  openCover(kind: CoverKind, el: HTMLElement): () => void;
  /** Puts `el` on the screen layer and returns a function that removes it. */
  openScreen(el: HTMLElement): () => void;
  coverKind(): CoverKind | null;
};
