// Guard: the unit test run must never make sound. These tests fail if the silent setup is
// missing, or if any code under test starts real speech or audio.
import { describe, expect, it } from 'vitest';
import { assertSilent, silentLog } from './silent';

describe('silent test mode', () => {
  it('replaces speechSynthesis.speak with a recorder', () => {
    const synth = (globalThis as { speechSynthesis?: { speak(u: unknown): void } }).speechSynthesis;
    expect(synth).toBeDefined();
    synth!.speak({ text: 'Welcome' });
    expect(silentLog.take()).toEqual([{ api: 'speechSynthesis.speak' }]);
  });

  it('replaces AudioContext with a recorder that has no output', () => {
    const Ctor = (globalThis as { AudioContext?: new () => { destination: unknown } }).AudioContext;
    expect(Ctor).toBeDefined();
    const ctx = new Ctor!();
    expect(ctx.destination).toBeDefined();
    expect(silentLog.take()).toEqual([{ api: 'AudioContext' }]);
  });

  it('replaces the Audio element with a recorder', () => {
    const A = (globalThis as { Audio?: new (src?: string) => { play(): Promise<void> } }).Audio;
    expect(A).toBeDefined();
    const el = new A!('x.mp3');
    void el.play();
    expect(silentLog.take().map((c) => c.api)).toEqual(['Audio', 'Audio.play']);
  });

  it('assertSilent throws when something started, and passes when nothing did', () => {
    expect(() => assertSilent()).not.toThrow();
    const synth = (globalThis as { speechSynthesis?: { speak(u: unknown): void } }).speechSynthesis;
    synth!.speak({});
    expect(() => assertSilent()).toThrow(/speechSynthesis\.speak/);
    expect(silentLog.take()).toEqual([]); // assertSilent cleared it
  });
});
