// Background music as pure data. Original tune, written for this game.
// No WebAudio here: scheduleMusic turns steps into note events, and src/audio/music.ts plays them.
// Tempo and notes live in this file so tests can pin them (see tests/audio/musicData.test.ts).

export type Flavor = 'PAST' | 'FUTURE';
export const FLAVORS: readonly Flavor[] = ['PAST', 'FUTURE'];

export type TrackName = 'bass' | 'chord' | 'lead' | 'arp' | 'kick' | 'snare' | 'clap';

export type MusicEvent = {
  track: TrackName;
  /** Seconds, on the same clock as the start time passed to scheduleMusic. */
  time: number;
  /** Seconds. */
  duration: number;
  /** MIDI note number. Drums have none. */
  midi?: number;
  /** 0 to 1. */
  velocity: number;
  /** Bass only: true for the wobbly synth bass of Team Future. */
  wobble?: boolean;
};

export const MUSIC_TEMPO = { bpm: 130, stepsPerBeat: 4, beatsPerBar: 4, bars: 8 } as const;
const STEPS_PER_BAR = MUSIC_TEMPO.stepsPerBeat * MUSIC_TEMPO.beatsPerBar;
export const STEP_SEC = 60 / MUSIC_TEMPO.bpm / MUSIC_TEMPO.stepsPerBeat;
export const LOOP_STEPS = STEPS_PER_BAR * MUSIC_TEMPO.bars;
export const LOOP_SEC = LOOP_STEPS * STEP_SEC;

/** Mix numbers for the player. Kept beside the notes so the whole sound is in two files. */
export const MUSIC_MIX = {
  /** Peak gain of the music bus before the player's volume. Quiet by default. */
  master: 0.2,
  /** Multiplier while Chrono (or any spoken line) talks. */
  duck: 0.3,
  /** Seconds to slide the level when ducking or changing volume. */
  levelTimeConstant: 0.08,
  /** Seconds for the crossfade between Past and Future. */
  crossfadeSec: 1.2,
  /** Scheduler wakes this often (milliseconds) and plays notes due in the next lookahead. */
  tickMs: 50,
  lookaheadSec: 0.25,
  /** Part of each note that sounds, so neighbours never touch. */
  gate: 0.9,
} as const;

export const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

// ---------- the tune: D minor, eight bars ----------
// Bars:   Dm | Dm | Gm | A | Dm | Bb | Gm | A

type Chord = { root: number; fifth: number; tones: readonly [number, number, number] };
const DM: Chord = { root: 38, fifth: 45, tones: [62, 65, 69] };
const GM: Chord = { root: 43, fifth: 50, tones: [62, 67, 70] };
const A: Chord = { root: 45, fifth: 52, tones: [64, 69, 73] };
const BB: Chord = { root: 46, fifth: 53, tones: [65, 70, 74] };
const BARS: readonly Chord[] = [DM, DM, GM, A, DM, BB, GM, A];

/** [step in bar, MIDI note, length in steps]. Each bar's notes never overlap. */
type LeadNote = readonly [number, number, number];
const LEAD: readonly (readonly LeadNote[])[] = [
  [
    [0, 74, 2],
    [3, 77, 1],
    [4, 81, 2],
    [7, 77, 1],
    [8, 74, 2],
    [11, 72, 1],
    [12, 74, 4],
  ],
  [
    [0, 77, 2],
    [3, 81, 1],
    [4, 84, 2],
    [7, 81, 1],
    [8, 77, 4],
    [12, 74, 2],
    [14, 77, 2],
  ],
  [
    [0, 79, 2],
    [3, 82, 1],
    [4, 86, 2],
    [7, 82, 1],
    [8, 79, 2],
    [11, 77, 1],
    [12, 79, 4],
  ],
  [
    [0, 81, 2],
    [3, 85, 1],
    [4, 88, 2],
    [7, 85, 1],
    [8, 81, 2],
    [10, 79, 2],
    [12, 81, 2],
    [14, 76, 2],
  ],
  [
    [0, 74, 2],
    [3, 77, 1],
    [4, 81, 2],
    [7, 84, 1],
    [8, 81, 2],
    [11, 77, 1],
    [12, 74, 4],
  ],
  [
    [0, 82, 2],
    [3, 81, 1],
    [4, 77, 2],
    [7, 74, 1],
    [8, 77, 4],
    [12, 82, 4],
  ],
  [
    [0, 79, 2],
    [3, 77, 1],
    [4, 74, 2],
    [7, 77, 1],
    [8, 79, 4],
    [12, 82, 2],
    [14, 79, 2],
  ],
  [
    [0, 81, 3],
    [4, 85, 3],
    [8, 88, 2],
    [10, 85, 2],
    [12, 81, 4],
  ],
];

const CLAP_STEPS = [2, 6, 10, 14] as const;
const PAST_KICK_STEPS = [0, 8] as const;
const FUTURE_KICK_STEPS = [0, 4, 8, 12] as const;
const PAST_SNARE_STEPS = [4, 7, 12, 14, 15] as const;
const PAST_CHORD_STEPS = [4, 12] as const;
/** Future bass: [step in bar, length in steps]. Long enough for the wobble to be heard. */
const FUTURE_BASS: readonly (readonly [number, number])[] = [
  [0, 3],
  [3, 3],
  [6, 2],
  [8, 3],
  [11, 3],
  [14, 2],
];
/** Arp order inside a chord: index into tones, with a +12 octave marked as 3. */
const ARP_ORDER = [0, 1, 2, 3, 2, 1] as const;

type Entry = Omit<MusicEvent, 'time'>;

function buildPattern(flavor: Flavor): Entry[][] {
  const steps: Entry[][] = Array.from({ length: LOOP_STEPS }, () => []);
  const add = (step: number, e: Entry): void => {
    steps[step]?.push(e);
  };
  const gate = (n: number): number => n * STEP_SEC * MUSIC_MIX.gate;

  BARS.forEach((chord, bar) => {
    const base = bar * STEPS_PER_BAR;
    const at = (s: number): number => base + s;

    for (const [s, midi, len] of LEAD[bar] ?? []) {
      add(at(s), { track: 'lead', midi, duration: gate(len), velocity: 0.8 });
    }
    for (const s of CLAP_STEPS) {
      add(at(s), { track: 'clap', duration: gate(1), velocity: 0.7 });
    }

    if (flavor === 'PAST') {
      // Oom-pah: root on beat 1 and 3, fifth on beat 2 and 4.
      [0, 4, 8, 12].forEach((s, i) => {
        add(at(s), {
          track: 'bass',
          midi: i % 2 === 0 ? chord.root : chord.fifth,

          duration: gate(3),
          velocity: 0.95,
        });
      });
      for (const s of PAST_CHORD_STEPS) {
        for (const midi of chord.tones) {
          add(at(s), { track: 'chord', midi, duration: gate(2), velocity: 0.55 });
        }
      }
      for (const s of PAST_KICK_STEPS) {
        add(at(s), { track: 'kick', duration: gate(1), velocity: 0.9 });
      }
      for (const s of PAST_SNARE_STEPS) {
        add(at(s), { track: 'snare', duration: gate(1), velocity: 0.7 });
      }
    } else {
      FUTURE_BASS.forEach(([s, len], i) => {
        add(at(s), {
          track: 'bass',
          midi: i % 3 === 2 ? chord.root + 12 : chord.root,

          duration: gate(len),
          velocity: 0.9,
          wobble: true,
        });
      });
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const pick = ARP_ORDER[s % ARP_ORDER.length] ?? 0;
        const midi = pick === 3 ? (chord.tones[0] ?? 62) + 12 : (chord.tones[pick] ?? 62);
        add(at(s), {
          track: 'arp',
          midi: midi + 12,

          duration: gate(1),
          velocity: s % 4 === 0 ? 0.6 : 0.4,
        });
      }
      for (const s of FUTURE_KICK_STEPS) {
        add(at(s), { track: 'kick', duration: gate(1), velocity: 0.9 });
      }
    }
  });
  return steps;
}

const PATTERNS: Record<Flavor, Entry[][]> = {
  PAST: buildPattern('PAST'),
  FUTURE: buildPattern('FUTURE'),
};

/**
 * Note events for steps [fromStep, toStep) of the endless loop, as seconds on the clock where
 * step 0 happens at `startTime`. Pure: same inputs, same output. Bad input gives [].
 */
export function scheduleMusic(
  flavor: Flavor,
  startTime: number,
  fromStep: number,
  toStep: number,
): MusicEvent[] {
  if (![startTime, fromStep, toStep].every(Number.isFinite)) return [];
  const from = Math.floor(fromStep);
  const to = Math.floor(toStep);
  if (from < 0 || to <= from) return [];
  const pattern = PATTERNS[flavor];
  if (!pattern) return [];
  const out: MusicEvent[] = [];
  for (let step = from; step < to; step++) {
    const entries = pattern[step % LOOP_STEPS] ?? [];
    for (const e of entries) {
      out.push({ ...e, time: startTime + step * STEP_SEC });
    }
  }
  return out;
}
