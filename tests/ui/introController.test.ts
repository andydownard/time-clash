import { describe, expect, it } from 'vitest';
import { createAudioManager } from '../../src/audio/audioManager';
import { INTRO_SCRIPT } from '../../src/data/introScript';
import { createStorage } from '../../src/storage/storage';
import { createIntroController } from '../../src/ui/introController';
import { createHarness } from '../audio/fakes';

function memoryStorage() {
  return createStorage(null);
}

function setup(opts: Parameters<typeof createHarness>[0] = {}, unlock = true) {
  const h = createHarness(opts);
  const audio = createAudioManager(h.env, { muted: false, volume: 0.7 });
  const storage = memoryStorage();
  const cards: number[] = [];
  const captions: Array<string | null> = [];
  const ctl = createIntroController({
    script: INTRO_SCRIPT,
    speak: (line, o) => audio.speak(line, o),
    stop: () => audio.stopSpeech(),
    storage,
    onCard: (i) => cards.push(i),
    onCaption: (t) => captions.push(t),
  });
  if (unlock) void audio.unlock();
  return { h, audio, storage, cards, captions, ctl };
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** Plays the current card to the end by advancing the clock past its nominal length. */
async function playCard(s: ReturnType<typeof setup>, index: number) {
  s.h.clock.advance(INTRO_SCRIPT[index]!.durationMs + 6000);
  await flush();
}

describe('intro: before a tap', () => {
  it('does not call play() or speechSynthesis while locked, but still shows captions', async () => {
    const s = setup({}, false);
    void s.ctl.start();
    expect(s.h.elements).toHaveLength(0);
    expect(s.h.speech.spoken).toHaveLength(0);
    expect(s.captions[0]).toBe('Welcome to Time Clash!');
  });
});

describe('intro: card order and captions', () => {
  it('plays 5 cards in order and finishes', async () => {
    const s = setup();
    const result = s.ctl.start();
    expect(s.cards).toEqual([0]);
    for (let i = 0; i < 5; i++) {
      await playCard(s, i);
    }
    await expect(result).resolves.toBe('finished');
    expect(s.cards).toEqual([0, 1, 2, 3, 4]);
  });

  it('captions follow the timing within a card', async () => {
    const s = setup();
    void s.ctl.start();
    const card = INTRO_SCRIPT[0]!;
    expect(s.captions).toEqual([card.captions[0]!.text]);
    s.h.clock.advance(card.captions[1]!.startMs - 1);
    expect(s.captions).toHaveLength(1);
    s.h.clock.advance(1);
    expect(s.captions.at(-1)).toBe(card.captions[1]!.text);
  });

  it('the file ending moves to the next card', async () => {
    const s = setup();
    void s.ctl.start();
    s.h.elements[0]!.onended?.();
    await flush();
    expect(s.cards).toEqual([0, 1]);
    expect(s.h.elements[1]!.src).toBe(INTRO_SCRIPT[1]!.audio);
  });

  it('sets introSeen when the last card finishes', async () => {
    const s = setup();
    const result = s.ctl.start();
    expect(s.storage.get('timeclash.introSeen')).toBeNull();
    for (let i = 0; i < 5; i++) await playCard(s, i);
    await result;
    expect(s.storage.get('timeclash.introSeen')).toBe(true);
  });
});

describe('intro: Skip', () => {
  it('stops audio, resolves skipped, and remembers it', async () => {
    const s = setup();
    const result = s.ctl.start();
    s.ctl.skip();
    await expect(result).resolves.toBe('skipped');
    expect(s.h.elements[0]!.paused).toBe(true);
    expect(s.storage.get('timeclash.introSeen')).toBe(true);
  });

  it('works at any moment, even on the last card', async () => {
    const s = setup();
    const result = s.ctl.start();
    for (let i = 0; i < 4; i++) await playCard(s, i);
    s.ctl.skip();
    await expect(result).resolves.toBe('skipped');
  });

  it('works before any sound is unlocked', async () => {
    const s = setup({}, false);
    const result = s.ctl.start();
    s.ctl.skip();
    await expect(result).resolves.toBe('skipped');
    expect(s.storage.get('timeclash.introSeen')).toBe(true);
  });

  it('after skip, timers do not advance cards or captions', async () => {
    const s = setup();
    const result = s.ctl.start();
    s.ctl.skip();
    await result;
    const count = s.cards.length;
    const caps = s.captions.length;
    s.h.clock.advance(100000);
    await flush();
    expect(s.cards).toHaveLength(count);
    expect(s.captions.slice(caps).filter((c) => c !== null)).toEqual([]);
  });

  it('a second skip is harmless and the result stays skipped', async () => {
    const s = setup();
    const result = s.ctl.start();
    s.ctl.skip();
    s.ctl.skip();
    await expect(result).resolves.toBe('skipped');
  });

  it('clears the caption bar', async () => {
    const s = setup();
    const result = s.ctl.start();
    s.ctl.skip();
    await result;
    expect(s.captions.at(-1)).toBeNull();
  });
});

describe('intro: Replay', () => {
  it('restarts at card 1 from the middle', async () => {
    const s = setup();
    void s.ctl.start();
    await playCard(s, 0);
    await playCard(s, 1);
    expect(s.cards.at(-1)).toBe(2);
    s.ctl.replay();
    await flush();
    expect(s.cards.at(-1)).toBe(0);
    expect(s.ctl.index).toBe(0);
    expect(s.captions.at(-1)).toBe('Welcome to Time Clash!');
  });

  it('stops the old voice so two voices never overlap', async () => {
    const s = setup();
    void s.ctl.start();
    const first = s.h.elements[0]!;
    s.ctl.replay();
    expect(first.paused).toBe(true);
  });

  it('the stopped line does not advance the card', async () => {
    const s = setup();
    void s.ctl.start();
    s.ctl.replay();
    await flush();
    expect(s.cards).toEqual([0, 0]);
  });

  it('still finishes after a replay', async () => {
    const s = setup();
    const result = s.ctl.start();
    await playCard(s, 0);
    s.ctl.replay();
    for (let i = 0; i < 5; i++) await playCard(s, i);
    await expect(result).resolves.toBe('finished');
  });
});

describe('intro: next card', () => {
  it('jumps to the next card and stops the voice', async () => {
    const s = setup();
    void s.ctl.start();
    s.ctl.next();
    await flush();
    expect(s.cards).toEqual([0, 1]);
    expect(s.h.elements[0]!.paused).toBe(true);
  });

  it('next on the last card finishes', async () => {
    const s = setup();
    const result = s.ctl.start();
    for (let i = 0; i < 4; i++) s.ctl.next();
    await flush();
    s.ctl.next();
    await expect(result).resolves.toBe('finished');
  });
});

describe('intro: missing audio falls back', () => {
  it('uses speechSynthesis and keeps captions', async () => {
    const s = setup();
    void s.ctl.start();
    s.h.elements[0]!.onerror?.();
    expect(s.h.speech.spoken[0]!.text).toBe(INTRO_SCRIPT[0]!.fallbackText);
    s.h.clock.advance(INTRO_SCRIPT[0]!.captions[1]!.startMs);
    expect(s.captions).toContain(INTRO_SCRIPT[0]!.captions[1]!.text);
  });

  it('with no audio and no speech, captions alone carry the whole intro', async () => {
    const s = setup({ noElement: true, noSpeech: true });
    const result = s.ctl.start();
    for (let i = 0; i < 5; i++) {
      s.h.clock.advance(INTRO_SCRIPT[i]!.durationMs);
      await flush();
    }
    await expect(result).resolves.toBe('finished');
    const shown = s.captions.filter((c): c is string => c !== null);
    const expected = INTRO_SCRIPT.flatMap((c) => c.captions.map((x) => x.text));
    expect(shown).toEqual(expected);
  });
});

describe('intro: muted', () => {
  it('runs on a timer with captions, no sound', async () => {
    const s = setup();
    s.audio.setMuted(true);
    const result = s.ctl.start();
    expect(s.h.elements).toHaveLength(0);
    for (let i = 0; i < 5; i++) {
      s.h.clock.advance(INTRO_SCRIPT[i]!.durationMs);
      await flush();
    }
    await expect(result).resolves.toBe('finished');
  });
});

describe('intro: storage trouble', () => {
  it('finishes even when the save fails', async () => {
    const throwing = createStorage({
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
      removeItem: () => {
        throw new Error('x');
      },
    });
    const h = createHarness({ noElement: true, noSpeech: true });
    const audio = createAudioManager(h.env, { muted: false, volume: 0.7 });
    const ctl = createIntroController({
      script: INTRO_SCRIPT,
      speak: (l, o) => audio.speak(l, o),
      stop: () => audio.stopSpeech(),
      storage: throwing,
      onCard: () => undefined,
      onCaption: () => undefined,
    });
    const result = ctl.start();
    ctl.skip();
    await expect(result).resolves.toBe('skipped');
  });
});
