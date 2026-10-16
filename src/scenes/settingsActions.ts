// The two quick toggles, shared by the tap screen, the settings panel, and the battle HUD.
import type { AudioManager } from '../audio/types';
import { loadSettings, saveAudioSettings } from '../storage/storage';
import type { TypedStorage } from '../storage/types';

export function toggleMute(audio: AudioManager, storage: TypedStorage): boolean {
  audio.setMuted(!audio.muted);
  saveAudioSettings(storage, { muted: audio.muted, volume: audio.volume, musicOn: audio.musicOn });
  return audio.muted;
}

export function toggleCaptions(storage: TypedStorage): boolean {
  const now = loadSettings(storage);
  storage.set('timeclash.settings', { ...now, captions: !now.captions });
  return !now.captions;
}

export function setVolume(audio: AudioManager, storage: TypedStorage, volume: number): void {
  audio.setVolume(volume);
  saveAudioSettings(storage, { muted: audio.muted, volume: audio.volume, musicOn: audio.musicOn });
}

export function toggleMusic(audio: AudioManager, storage: TypedStorage): boolean {
  audio.setMusicOn(!audio.musicOn);
  saveAudioSettings(storage, { muted: audio.muted, volume: audio.volume, musicOn: audio.musicOn });
  return audio.musicOn;
}

/** Sets the motion choice. 'on' means reduce motion. It overrides the system setting. */
export function setReducedMotion(storage: TypedStorage, value: 'on' | 'off'): void {
  storage.set('timeclash.settings', { ...loadSettings(storage), reducedMotion: value });
}
