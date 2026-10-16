import { describe, expect, it } from 'vitest';
import {
  FLAVORS,
  LOOP_SEC,
  LOOP_STEPS,
  MUSIC_TEMPO,
  STEP_SEC,
  scheduleMusic,
  midiToHz,
  type Flavor,
  type MusicEvent,
} from '../../src/audio/musicData';

const loop = (f: Flavor, start = 0): MusicEvent[] => scheduleMusic(f, start, 0, LOOP_STEPS);

describe('music tempo and loop length', () => {
  it('runs at about 130 BPM with 16th-note steps', () => {
    expect(MUSIC_TEMPO.bpm).toBe(130);
    expect(STEP_SEC).toBeCloseTo(60 / 130 / 4, 10);
  });
  it('loops eight bars of sixteen steps', () => {
    expect(LOOP_STEPS).toBe(128);
    expect(LOOP_SEC).toBeCloseTo(128 * STEP_SEC, 10);
    expect(LOOP_SEC).toBeGreaterThan(12);
    expect(LOOP_SEC).toBeLessThan(18);
  });
});

describe.each(FLAVORS)('schedule for %s', (flavor) => {
  it('is deterministic', () => {
    expect(loop(flavor, 3.5)).toEqual(loop(flavor, 3.5));
  });

  it('shifts every time by the start time', () => {
    const a = loop(flavor, 0);
    const b = loop(flavor, 10);
    expect(b).toHaveLength(a.length);
    a.forEach((e, i) => expect(b[i]!.time).toBeCloseTo(e.time + 10, 9));
  });

  it('repeats exactly one loop later', () => {
    const first = scheduleMusic(flavor, 0, 0, LOOP_STEPS);
    const second = scheduleMusic(flavor, 0, LOOP_STEPS, LOOP_STEPS * 2);
    expect(second).toHaveLength(first.length);
    first.forEach((e, i) => {
      expect(second[i]!.time).toBeCloseTo(e.time + LOOP_SEC, 9);
      expect(second[i]!.track).toBe(e.track);
      expect(second[i]!.midi).toBe(e.midi);
    });
  });

  it('gives the same events whether asked at once or in chunks', () => {
    const whole = scheduleMusic(flavor, 1, 0, 200);
    const parts = [
      ...scheduleMusic(flavor, 1, 0, 37),
      ...scheduleMusic(flavor, 1, 37, 90),
      ...scheduleMusic(flavor, 1, 90, 200),
    ];
    expect(parts).toEqual(whole);
  });

  it('returns events in time order, inside the loop window', () => {
    const ev = loop(flavor);
    for (let i = 1; i < ev.length; i++) expect(ev[i]!.time).toBeGreaterThanOrEqual(ev[i - 1]!.time);
    for (const e of ev) {
      expect(e.time).toBeGreaterThanOrEqual(0);
      expect(e.time).toBeLessThan(LOOP_SEC);
      expect(e.time + e.duration).toBeLessThanOrEqual(LOOP_SEC + 1e-9);
    }
  });

  it('keeps every note in range with a sane length and velocity', () => {
    for (const e of loop(flavor)) {
      expect(e.duration).toBeGreaterThan(0);
      expect(e.velocity).toBeGreaterThan(0);
      expect(e.velocity).toBeLessThanOrEqual(1);
      if (e.midi !== undefined) {
        expect(Number.isInteger(e.midi)).toBe(true);
        expect(e.midi).toBeGreaterThanOrEqual(28);
        expect(e.midi).toBeLessThanOrEqual(96);
        expect(midiToHz(e.midi)).toBeGreaterThan(40);
        expect(midiToHz(e.midi)).toBeLessThan(2100);
      } else {
        expect(['kick', 'snare', 'clap']).toContain(e.track);
      }
    }
  });

  it('never overlaps notes on the one-voice tracks', () => {
    for (const track of ['bass', 'lead'] as const) {
      const notes = loop(flavor).filter((e) => e.track === track);
      expect(notes.length).toBeGreaterThan(8);
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i]!.time).toBeGreaterThanOrEqual(
          notes[i - 1]!.time + notes[i - 1]!.duration - 1e-9,
        );
      }
    }
  });

  it('puts the claps on the off-beats', () => {
    const claps = loop(flavor).filter((e) => e.track === 'clap');
    expect(claps).toHaveLength(32);
    for (const c of claps) {
      const step = Math.round(c.time / STEP_SEC);
      expect(step % 4).toBe(2);
    }
  });

  it('starts on the downbeat with a bass note', () => {
    const first = loop(flavor).find((e) => e.track === 'bass');
    expect(first?.time).toBe(0);
  });
});

describe('flavors', () => {
  const tracks = (f: Flavor) => new Set(loop(f).map((e) => e.track));
  it('Past has tuba bass, chord stabs and a marching snare', () => {
    const t = tracks('PAST');
    expect(t.has('snare')).toBe(true);
    expect(t.has('chord')).toBe(true);
    expect(t.has('arp')).toBe(false);
  });
  it('Future has a synth arp and wobbly bass, no snare', () => {
    const t = tracks('FUTURE');
    expect(t.has('arp')).toBe(true);
    expect(t.has('snare')).toBe(false);
    expect(loop('FUTURE').some((e) => e.track === 'bass' && e.wobble === true)).toBe(true);
    expect(loop('PAST').some((e) => e.wobble === true)).toBe(false);
  });
  it('bass plays oom-pah: root on the beat, fifth on the next', () => {
    const bass = loop('PAST')
      .filter((e) => e.track === 'bass')
      .slice(0, 2);
    expect(bass[0]!.midi).toBe(38);
    expect(bass[1]!.midi).toBe(45);
    expect(bass[1]!.time).toBeCloseTo(4 * STEP_SEC, 9);
  });
});

describe('bad input', () => {
  it('returns nothing for an empty or backwards range', () => {
    expect(scheduleMusic('PAST', 0, 10, 10)).toEqual([]);
    expect(scheduleMusic('PAST', 0, 20, 10)).toEqual([]);
  });
  it('returns nothing for NaN or infinite input', () => {
    expect(scheduleMusic('PAST', NaN, 0, 10)).toEqual([]);
    expect(scheduleMusic('PAST', 0, NaN, 10)).toEqual([]);
    expect(scheduleMusic('PAST', 0, 0, Infinity)).toEqual([]);
  });
  it('returns nothing for a negative step', () => {
    expect(scheduleMusic('PAST', 0, -4, 0)).toEqual([]);
  });
});
