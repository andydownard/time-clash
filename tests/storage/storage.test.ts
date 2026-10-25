import { describe, expect, it } from 'vitest';
import { clearMyData, createStorage, loadSettings } from '../../src/storage/storage';
import type { BackingStore } from '../../src/storage/types';
import { DEFAULT_SETTINGS } from '../../src/game/config';
import type { Players } from '../../src/game/types';

function fakeBacking(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store = {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
    data,
  };
  return store;
}

const throwing: BackingStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

const players: Players = [
  { name: 'Alex', team: 'PAST', grade: 2, subject: 'reading' },
  { name: 'Sam', team: 'FUTURE', grade: 8, subject: 'math' },
];

describe('storage: players saved with the retired Focus switch', () => {
  it('load without error and drop the old topic field', () => {
    const raw = JSON.stringify([
      { ...players[0], topic: 'multiplication' },
      { ...players[1], topic: 'division' },
    ]);
    const s = createStorage(fakeBacking({ 'timeclash.players': raw }));
    expect(s.get('timeclash.players')).toEqual(players);
  });
  it('drop an unknown saved topic and keep the player', () => {
    const raw = JSON.stringify([{ ...players[0], topic: 'juggling' }, players[1]]);
    const s = createStorage(fakeBacking({ 'timeclash.players': raw }));
    expect(s.get('timeclash.players')).toEqual(players);
  });
});

describe('storage: normal backing store', () => {
  it('round-trips players', () => {
    const s = createStorage(fakeBacking());
    expect(s.set('timeclash.players', players)).toBe(true);
    expect(s.get('timeclash.players')).toEqual(players);
    expect(s.persistent).toBe(true);
  });

  it('returns null for a missing key', () => {
    expect(createStorage(fakeBacking()).get('timeclash.players')).toBeNull();
  });

  it('writes JSON under the timeclash key', () => {
    const b = fakeBacking();
    createStorage(b).set('timeclash.introSeen', true);
    expect(b.data.get('timeclash.introSeen')).toBe('true');
  });

  it('remove deletes the key', () => {
    const b = fakeBacking();
    const s = createStorage(b);
    s.set('timeclash.introSeen', true);
    s.remove('timeclash.introSeen');
    expect(s.get('timeclash.introSeen')).toBeNull();
    expect(b.data.has('timeclash.introSeen')).toBe(false);
  });
});

describe('storage: bad data', () => {
  it.each([
    ['not json', '{oops'],
    ['wrong type', '"hello"'],
    ['null literal', 'null'],
  ])('players: %s gives null', (_n, raw) => {
    const s = createStorage(fakeBacking({ 'timeclash.players': raw }));
    expect(s.get('timeclash.players')).toBeNull();
  });

  it('players: wrong shape (one player) gives null', () => {
    const s = createStorage(fakeBacking({ 'timeclash.players': JSON.stringify([players[0]]) }));
    expect(s.get('timeclash.players')).toBeNull();
  });

  it('players: grade out of range gives null', () => {
    const bad = [{ ...players[0], grade: 99 }, players[1]];
    const s = createStorage(fakeBacking({ 'timeclash.players': JSON.stringify(bad) }));
    expect(s.get('timeclash.players')).toBeNull();
  });

  it('players: team order wrong gives null', () => {
    const bad = [players[1], players[0]];
    const s = createStorage(fakeBacking({ 'timeclash.players': JSON.stringify(bad) }));
    expect(s.get('timeclash.players')).toBeNull();
  });

  it('introSeen: a string is not a boolean', () => {
    const s = createStorage(fakeBacking({ 'timeclash.introSeen': '"yes"' }));
    expect(s.get('timeclash.introSeen')).toBeNull();
  });

  it('history: wrong shape gives null; good shape passes', () => {
    const s = createStorage(
      fakeBacking({
        'timeclash.history': '[1,2]',
      }),
    );
    expect(s.get('timeclash.history')).toBeNull();
    const good = { used: { 'math-3': ['a'] }, lastSubject: { PAST: 'math' as const } };
    expect(s.set('timeclash.history', good)).toBe(true);
    expect(s.get('timeclash.history')).toEqual(good);
  });

  it('history: missed questions (retry) survive a save and a load', () => {
    const s = createStorage(fakeBacking({}));
    const withRetry = {
      used: {},
      lastSubject: {},
      retry: [{ id: 'math-3-0001', picksLeft: 2 }],
    };
    expect(s.set('timeclash.history', withRetry)).toBe(true);
    expect(s.get('timeclash.history')).toEqual(withRetry);
  });

  it('history: a bad retry list is dropped, the rest still loads', () => {
    const s = createStorage(
      fakeBacking({
        'timeclash.history': JSON.stringify({ used: {}, lastSubject: {}, retry: 'nope' }),
      }),
    );
    expect(s.get('timeclash.history')).toEqual({ used: {}, lastSubject: {} });
  });

  it('settings: music is on by default, saved settings without it still load, and it persists', () => {
    const old = createStorage(
      fakeBacking({
        'timeclash.settings': JSON.stringify({
          muted: false,
          volume: 0.5,
          captions: true,
          musicOn: true,
          reducedMotion: 'system',
          hideBonusRing: false,
        }),
      }),
    );
    expect(old.get('timeclash.settings')?.musicOn).toBe(true);
    const s = createStorage(fakeBacking({}));
    s.set('timeclash.settings', {
      muted: false,
      volume: 0.5,
      captions: true,
      musicOn: false,
      reducedMotion: 'system',
      hideBonusRing: false,
    });
    expect(s.get('timeclash.settings')?.musicOn).toBe(false);
  });

  it('settings: fills bad fields with defaults', () => {
    const s = createStorage(
      fakeBacking({
        'timeclash.settings': JSON.stringify({ muted: 'x', volume: 7, captions: false }),
      }),
    );
    expect(s.get('timeclash.settings')).toEqual({
      ...DEFAULT_SETTINGS,
      volume: 1,
      captions: false,
    });
  });
});

describe('storage: localStorage throws (private mode, blocked)', () => {
  it('get returns null and never throws', () => {
    const s = createStorage(throwing);
    expect(() => s.get('timeclash.players')).not.toThrow();
    expect(s.get('timeclash.players')).toBeNull();
  });

  it('set returns false but keeps a memory copy', () => {
    const s = createStorage(throwing);
    expect(s.set('timeclash.introSeen', true)).toBe(false);
    expect(s.get('timeclash.introSeen')).toBe(true);
    expect(s.persistent).toBe(false);
  });

  it('remove never throws and clears the memory copy', () => {
    const s = createStorage(throwing);
    s.set('timeclash.introSeen', true);
    expect(() => s.remove('timeclash.introSeen')).not.toThrow();
    expect(s.get('timeclash.introSeen')).toBeNull();
  });

  it('clearMyData never throws', () => {
    const s = createStorage(throwing);
    s.set('timeclash.introSeen', true);
    expect(() => clearMyData(s)).not.toThrow();
    expect(s.get('timeclash.introSeen')).toBeNull();
  });
});

describe('storage: no backing store (null)', () => {
  it('works from memory', () => {
    const s = createStorage(null);
    expect(s.persistent).toBe(false);
    expect(s.get('timeclash.introSeen')).toBeNull();
    expect(s.set('timeclash.introSeen', true)).toBe(false);
    expect(s.get('timeclash.introSeen')).toBe(true);
  });

  it('a getter that throws on window.localStorage access is survived', () => {
    const g = globalThis as unknown as { localStorage?: unknown };
    const had = Object.getOwnPropertyDescriptor(g, 'localStorage');
    Object.defineProperty(g, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      const s = createStorage();
      expect(s.persistent).toBe(false);
      expect(s.set('timeclash.introSeen', true)).toBe(false);
    } finally {
      if (had) Object.defineProperty(g, 'localStorage', had);
      else delete g.localStorage;
    }
  });
});

describe('storage: Clear my data', () => {
  it('removes every timeclash.* key and leaves other keys alone', () => {
    const b = fakeBacking({ 'other.key': '1', 'timeclash.extra': '2' });
    const s = createStorage(b);
    s.set('timeclash.players', players);
    s.set('timeclash.introSeen', true);
    clearMyData(s);
    expect([...b.data.keys()]).toEqual(['other.key']);
    expect(s.get('timeclash.players')).toBeNull();
    expect(s.get('timeclash.introSeen')).toBeNull();
  });
});

describe('loadSettings', () => {
  it('gives defaults when nothing is saved', () => {
    expect(loadSettings(createStorage(fakeBacking()))).toEqual(DEFAULT_SETTINGS);
  });

  it('returns saved settings', () => {
    const s = createStorage(fakeBacking());
    s.set('timeclash.settings', {
      muted: true,
      volume: 0.2,
      captions: false,
      musicOn: true,
      reducedMotion: 'on',
      hideBonusRing: false,
    });
    expect(loadSettings(s)).toEqual({
      muted: true,
      volume: 0.2,
      captions: false,
      musicOn: true,
      reducedMotion: 'on',
      hideBonusRing: false,
    });
  });

  it('survives a throwing store', () => {
    expect(loadSettings(createStorage(throwing))).toEqual(DEFAULT_SETTINGS);
  });

  it('hides the bonus ring only when told to: off by default, saved, and bad values fall back', () => {
    expect(DEFAULT_SETTINGS.hideBonusRing).toBe(false);
    // Settings saved before this existed still load, with the ring shown.
    const old = createStorage(
      fakeBacking({ 'timeclash.settings': JSON.stringify({ muted: true, reducedMotion: 'on' }) }),
    );
    expect(loadSettings(old).hideBonusRing).toBe(false);
    const b = fakeBacking();
    const s = createStorage(b);
    s.set('timeclash.settings', { ...DEFAULT_SETTINGS, hideBonusRing: true });
    expect(loadSettings(createStorage(b)).hideBonusRing).toBe(true);
    for (const bad of ['true', 1, null, {}]) {
      const t = createStorage(
        fakeBacking({ 'timeclash.settings': JSON.stringify({ hideBonusRing: bad }) }),
      );
      expect(loadSettings(t).hideBonusRing).toBe(false);
    }
  });

  it('rejects a bad reducedMotion value', () => {
    const s = createStorage(
      fakeBacking({ 'timeclash.settings': JSON.stringify({ reducedMotion: 'maybe' }) }),
    );
    expect(loadSettings(s).reducedMotion).toBe('system');
  });
});

describe('saveAudioSettings', () => {
  it('persists mute and volume without touching other settings', async () => {
    const { saveAudioSettings } = await import('../../src/storage/storage');
    const b = fakeBacking();
    const s = createStorage(b);
    s.set('timeclash.settings', {
      muted: false,
      volume: 0.7,
      captions: false,
      musicOn: true,
      reducedMotion: 'on',
      hideBonusRing: false,
    });
    saveAudioSettings(s, { muted: true, volume: 0.25 });
    expect(loadSettings(createStorage(b))).toEqual({
      muted: true,
      volume: 0.25,
      captions: false,
      musicOn: true,
      reducedMotion: 'on',
      hideBonusRing: false,
    });
  });

  it('does not throw when storage is blocked', async () => {
    const { saveAudioSettings } = await import('../../src/storage/storage');
    expect(() =>
      saveAudioSettings(createStorage(throwing), { muted: true, volume: 0.1 }),
    ).not.toThrow();
  });
});
