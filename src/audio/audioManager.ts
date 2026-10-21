// One AudioManager for the whole app. See src/audio/types.ts for the rules (risk 5):
// no sound before a tap, captions on every line, Mute always works.
import { AUDIO } from '../game/config';
import { CLIP_START_TIMEOUT_MS } from './clipPlayer';
import { createMusicPlayer, type MusicPlayer } from './music';
import type { Flavor } from './musicData';
import { playSynth } from './sfx';
import type {
  AudioEnv,
  AudioManager,
  CreateAudioManager,
  SpeakOptions,
  SpeechEnd,
  SpeechHandle,
  SpeechSource,
  VoiceLine,
} from './types';

/** After the nominal length, a file or voice that never reports "ended" is cut off. */
const STALL_GRACE_MS = 5000;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

type Active = {
  finish: (end: SpeechEnd) => void;
  mute: () => void;
  applyVolume: () => void;
};

/**
 * Same as CreateAudioManager, plus an optional third argument that hears every mute or
 * volume change, so the app can save it (see saveAudioSettings in src/storage/storage.ts).
 */
export type CreateAudioManagerWithSave = (
  ...args: [...Parameters<CreateAudioManager>, onChange?: (state: AudioState) => void]
) => AudioManager;
type AudioState = { muted: boolean; volume: number; musicOn: boolean };
type AudioInitial = { muted: boolean; volume: number; musicOn?: boolean };

export const createAudioManager: CreateAudioManagerWithSave = (
  env: AudioEnv,
  initial: AudioInitial,
  onChange?: (state: AudioState) => void,
): AudioManager => {
  let unlocked = false;
  let muted = Boolean(initial.muted);
  let volume = Number.isFinite(initial.volume) ? clamp01(initial.volume) : AUDIO.defaultVolume;
  let ctx: AudioContext | null = null;
  let active: Active | null = null;
  let player: MusicPlayer | null = null;
  let musicOn = initial.musicOn ?? true;
  let musicTeam: Flavor | null = null;
  let pageHidden = false;
  let primed = false;

  /** Starts, retunes or stops the music so it matches the rules. Never throws. */
  const syncMusic = (): void => {
    try {
      if (!player) return;
      if (unlocked && !muted && !pageHidden && musicOn && musicTeam) {
        player.setLevel(volume);
        player.setDucked(active !== null);
        if (player.running) player.setFlavor(musicTeam);
        else player.start(musicTeam);
      } else {
        player.stop();
      }
    } catch {
      /* music is a bonus. The game never depends on it. */
    }
  };
  const syncDuck = (): void => {
    try {
      player?.setDucked(active !== null);
    } catch {
      /* ignore */
    }
  };

  /** iPad Safari can suspend or interrupt the context (lock screen, a call). Ask it to run again. */
  const ensureRunning = (): void => {
    try {
      if (!ctx || !unlocked || muted || pageHidden || ctx.state === 'running') return;
      void Promise.resolve(ctx.resume()).catch(() => undefined);
    } catch {
      /* sound just stays off; the game still works */
    }
  };

  /** WebKit on iPad only lets speech start from a tap. A silent line inside the tap unlocks it. */
  const primeSpeech = (): void => {
    // A muted visit makes no speech call. Unmuting is a tap, and primes it then.
    if (primed || muted || !unlocked) return;
    primed = true;
    try {
      const synth = env.speechSynthesis;
      const u = env.createUtterance?.('');
      if (!synth || !u) return;
      u.volume = 0;
      synth.speak(u);
    } catch {
      /* speech may be missing; captions still work */
    }
  };

  const notify = (): void => {
    try {
      onChange?.({ muted, volume, musicOn });
    } catch {
      /* a failed save must never stop the game */
    }
  };

  function startSpeech(line: VoiceLine, options: SpeakOptions | undefined): SpeechHandle {
    let source: SpeechSource = 'silent';
    let ended = false;
    let element: HTMLAudioElement | null = null;
    let utterance: SpeechSynthesisUtterance | null = null;
    const timers: unknown[] = [];
    // Caption and end timers. They are rebuilt when a clip reports its real length.
    let timeline: unknown[] = [];
    const startedAt = env.now();
    const sorted = [...line.captions].sort((a, b) => a.startMs - b.startMs);
    let resolveDone: (e: SpeechEnd) => void = () => undefined;
    const done = new Promise<SpeechEnd>((r) => (resolveDone = r));

    const later = (fn: () => void, ms: number): void => {
      timers.push(env.setTimeout(fn, ms));
    };
    const caption = (text: string | null): void => {
      try {
        options?.onCaption?.(text);
      } catch {
        /* a caption handler error must not stop the line */
      }
    };
    const silenceOutput = (): void => {
      if (element) {
        try {
          element.pause();
        } catch {
          /* ignore */
        }
        element.onended = null;
        element.onerror = null;
        element.onplaying = null;
        element.onloadedmetadata = null;
        element = null;
      }
      if (utterance) {
        utterance.onend = null;
        utterance.onerror = null;
        utterance = null;
        try {
          env.speechSynthesis?.cancel();
        } catch {
          /* ignore */
        }
      }
    };
    const shown = new Set<number>();
    const showCaption = (i: number, text: string): void => {
      shown.add(i);
      caption(text);
    };
    const finish = (end: SpeechEnd): void => {
      if (ended) return;
      ended = true;
      timers.splice(0).forEach((id) => env.clearTimeout(id));
      timeline.splice(0).forEach((id) => env.clearTimeout(id));
      // A fast voice can end before the last captions are due. Show them, so none go missing.
      if (end === 'ended') {
        sorted.forEach((c, i) => {
          if (!shown.has(i)) showCaption(i, c.text);
        });
      }
      silenceOutput();
      if (active === me) {
        active = null;
        syncDuck();
      }
      if (end === 'ended') caption(null);
      resolveDone(end);
    };

    const trySynthesis = (): boolean => {
      const synth = env.speechSynthesis;
      if (!synth || !env.createUtterance || muted) return false;
      try {
        const u = env.createUtterance(line.text);
        // Read in English by a voice that stays on the device when one is there.
        u.lang = 'en-US';
        const voice = synth
          .getVoices?.()
          .find((v) => v.localService && v.lang.toLowerCase().startsWith('en'));
        if (voice) u.voice = voice;
        u.rate = AUDIO.speechRate;
        u.volume = volume;
        u.onend = () => finish('ended');
        // A speech error is not fatal: the caption timer ends the line.
        u.onerror = () => {
          if (utterance === u) utterance = null;
          source = 'silent';
        };
        utterance = u;
        synth.speak(u);
        source = 'synthesis';
        return true;
      } catch {
        utterance = null;
        return false;
      }
    };

    const fallBack = (): void => {
      if (ended || muted) return;
      silenceOutput();
      if (!trySynthesis()) source = 'silent';
    };

    const tryFile = (): boolean => {
      // Order: the line's own file, else a clip from the voice service, else speech.
      const clipUrl =
        line.audioSrc || line.noClip ? null : (env.clips?.urlFor(line.text) ?? null);
      const src = line.audioSrc ?? clipUrl;
      if (!src || !env.createAudioElement || muted) return false;
      try {
        const el = env.createAudioElement(src);
        if (!el) return false;
        const missClip = (): void => {
          if (clipUrl) env.clips?.markMissed(line.text);
        };
        el.volume = clamp01(volume * AUDIO.voiceGain);
        el.onended = () => finish('ended');
        el.onerror = () => {
          if (element !== el) return;
          missClip();
          fallBack();
        };
        let started = false;
        if (clipUrl) {
          el.onplaying = () => {
            started = true;
          };
          // The real length is known now, so captions follow the real voice.
          el.onloadedmetadata = () => {
            if (element === el && Number.isFinite(el.duration) && el.duration > 0) {
              schedule(Math.round(el.duration * 1000));
            }
          };
          // A slow clip must never leave a child waiting in silence.
          later(() => {
            if (element !== el || started) return;
            missClip();
            fallBack();
          }, CLIP_START_TIMEOUT_MS);
        }
        element = el;
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            if (element === el) fallBack();
          });
        }
        source = 'file';
        return true;
      } catch {
        element = null;
        return false;
      }
    };

    const me: Active = {
      finish,
      mute: () => {
        silenceOutput();
        source = 'silent';
      },
      applyVolume: () => {
        if (element) element.volume = clamp01(volume * AUDIO.voiceGain);
        if (utterance) utterance.volume = volume;
      },
    };
    active = me;
    syncDuck();

    if (unlocked && !muted) {
      ensureRunning();
      if (!tryFile()) trySynthesis();
    }

    // Captions run on a timeline for every path, so they never depend on sound.
    // A clip that reports its real length re-times the timeline (see tryFile).
    function schedule(length: number): void {
      timeline.splice(0).forEach((id) => env.clearTimeout(id));
      timeline = [];
      const scale = line.durationMs > 0 ? length / line.durationMs : 1;
      const elapsed = env.now() - startedAt;
      sorted.forEach((c, i) => {
        if (shown.has(i)) return;
        const due = c.startMs * scale;
        if (due <= 0) showCaption(i, c.text);
        else
          timeline.push(env.setTimeout(() => showCaption(i, c.text), Math.max(0, due - elapsed)));
      });
      // Silent lines end at their nominal length. A file or voice that never reports
      // "ended" is cut off after a short grace period.
      timeline.push(
        env.setTimeout(
          () => {
            if (source === 'silent') finish('ended');
          },
          Math.max(0, length - elapsed),
        ),
      );
      timeline.push(
        env.setTimeout(() => finish('ended'), Math.max(0, length + STALL_GRACE_MS - elapsed)),
      );
    }
    schedule(Math.max(0, line.durationMs));

    return {
      done,
      get source() {
        return source;
      },
      stop: () => finish('stopped'),
    };
  }

  return {
    async unlock(): Promise<void> {
      if (!unlocked) {
        unlocked = true;
        try {
          ctx = env.createAudioContext?.() ?? null;
        } catch {
          ctx = null;
        }
        player = ctx ? createMusicPlayer(ctx, env) : null;
        if (ctx) ctx.onstatechange = () => ensureRunning();
        primeSpeech();
      }
      try {
        if (ctx && ctx.state !== 'running') await ctx.resume();
      } catch {
        /* sound just stays off; the game still works */
      }
      syncMusic();
    },
    get unlocked() {
      return unlocked;
    },
    get muted() {
      return muted;
    },
    setMuted(next: boolean): void {
      muted = Boolean(next);
      if (muted) active?.mute();
      else primeSpeech();
      syncMusic();
      notify();
    },
    get volume() {
      return volume;
    },
    setVolume(next: number): void {
      if (typeof next !== 'number' || Number.isNaN(next)) return;
      volume = clamp01(next);
      active?.applyVolume();
      try {
        player?.setLevel(volume);
      } catch {
        /* ignore */
      }
      notify();
    },
    playSfx(name): void {
      if (!unlocked || muted || !ctx) return;
      ensureRunning();
      try {
        playSynth(ctx, name, volume * AUDIO.sfxGain);
      } catch {
        /* a failed effect must never stop play */
      }
    },
    setPageHidden(hidden: boolean): void {
      if (!unlocked) return;
      pageHidden = Boolean(hidden);
      try {
        if (pageHidden) {
          player?.stop();
          void Promise.resolve(ctx?.suspend()).catch(() => undefined);
        } else {
          ensureRunning();
          syncMusic();
        }
      } catch {
        /* resting the sound is a bonus. Never stop play */
      }
    },
    get musicOn() {
      return musicOn;
    },
    setMusicOn(on: boolean): void {
      musicOn = Boolean(on);
      syncMusic();
      notify();
    },
    get musicPlaying() {
      return player?.running ?? false;
    },
    setMusicTeam(team): void {
      musicTeam = team;
      syncMusic();
    },
    stopMusic(): void {
      musicTeam = null;
      syncMusic();
    },
    speak(line, options) {
      active?.finish('stopped');
      return startSpeech(line, options);
    },
    stopSpeech(): void {
      active?.finish('stopped');
    },
    get clipsEnabled() {
      return env.clips?.enabled ?? false;
    },
  };
};
