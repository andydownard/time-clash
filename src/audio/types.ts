import type { ClipPlayer } from './clipPlayer';

// Shared contract for sound. Risk 5 in AGENTS.md: no sound before a tap, captions on
// every spoken line, Skip/Replay/Mute always work.

/**
 * Sound effects are synthesized in code with WebAudio (oscillators and noise),
 * so every sound is original and there are no SFX files to license.
 */
export type SfxName =
  | 'launch' // slide whistle up
  | 'cannonBoom' // Team Past fires: low boom, rumble, tiny creak
  | 'laserPew' // Team Future fires: three falling zaps
  | 'boing' // tumble spring
  | 'horn' // turn banner
  | 'clunk' // reload done
  | 'thud' // shot hits ground or base (soft, toy-like)
  | 'click' // button press
  | 'cheer'; // victory

export const SFX_NAMES: readonly SfxName[] = [
  'launch',
  'cannonBoom',
  'laserPew',
  'boing',
  'horn',
  'clunk',
  'thud',
  'click',
  'cheer',
];

export type Caption = { text: string; startMs: number };

/** One spoken line. src/data/introScript.ts cards map onto this. */
export type VoiceLine = {
  id: string;
  /** e.g. "/audio/voice/intro-02-aim.mp3". Optional: no file means speech synthesis. */
  audioSrc?: string;
  /** Full text, read by speechSynthesis when the file is missing or fails. */
  text: string;
  /** Shown in the caption bar on the audio timeline. At least one entry. */
  captions: Caption[];
  /** Used to time captions when neither audio nor speechSynthesis works. */
  durationMs: number;
};

export type SpeechEnd = 'ended' | 'stopped';
export type SpeechSource = 'file' | 'synthesis' | 'silent';

export type SpeechHandle = {
  /** Resolves once, when the line ends or stop() is called. Never rejects. */
  readonly done: Promise<SpeechEnd>;
  /** Which path is playing. 'silent' means captions run on a timer only (muted or no voice). */
  readonly source: SpeechSource;
  /** Stops audio now and resolves done with 'stopped'. Safe to call twice. */
  stop(): void;
};

export type SpeakOptions = {
  /** Called with each caption as it comes due, and with null at the end. */
  onCaption?: (text: string | null) => void;
};

/**
 * One instance for the whole app.
 * - Nothing makes sound until unlock() has run inside a user tap/click/key handler.
 *   Before that, playSfx is a no-op and speak returns a 'silent' handle that still
 *   shows captions.
 * - Muted: playSfx is a no-op; speak runs 'silent' (captions still show).
 * - Only one voice line at a time. A new speak() stops the old one.
 * - Missing or failing audio file: fall back to speechSynthesis, then to 'silent'.
 * - Order for a line: its own audioSrc file, else a clip from the voice service (when set up),
 *   else speechSynthesis. A clip that errors, 404s or is slow to start falls back at once and
 *   is not asked for again this session.
 */
export interface AudioManager {
  /** Call from the first user gesture. Idempotent. Resolves even if WebAudio is missing. */
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  /** 0 to 1. Clamped. */
  readonly volume: number;
  setVolume(volume: number): void;
  playSfx(name: SfxName): void;
  /**
   * Background music (src/audio/music.ts). Same rules as sound: nothing before unlock(),
   * nothing while muted, quiet by default, and it ducks under spoken lines.
   */
  /** True when the player wants music (the on/off switch). Default true. */
  readonly musicOn: boolean;
  setMusicOn(on: boolean): void;
  /** True while the loop is actually running. */
  readonly musicPlaying: boolean;
  /** Starts the loop in this team's flavor, or crossfades to it if already playing. */
  setMusicTeam(team: 'PAST' | 'FUTURE'): void;
  /** Fades out and forgets the team. A later setMusicTeam starts it again. */
  stopMusic(): void;
  /**
   * Call with true when the page is hidden (tab switch, lock screen) and false when it is back.
   * Hidden: the music stops and the context rests. Does nothing before unlock().
   */
  setPageHidden(hidden: boolean): void;
  speak(line: VoiceLine, options?: SpeakOptions): SpeechHandle;
  stopSpeech(): void;
  /** True when spoken clips come from the voice service (VITE_VOICE_URL is set). */
  readonly clipsEnabled: boolean;
}

/** Browser pieces the manager needs. Inject fakes in tests (Vitest runs in node). */
export type AudioEnv = {
  createAudioContext?: () => AudioContext | null;
  createAudioElement?: (src: string) => HTMLAudioElement | null;
  /** Spoken clips from the voice service. Missing or disabled: lines use files or speech only. */
  clips?: ClipPlayer;
  speechSynthesis?: SpeechSynthesis | null;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  now: () => number;
};

export type CreateAudioManager = (
  env: AudioEnv,
  initial: { muted: boolean; volume: number; musicOn?: boolean },
) => AudioManager;
