// Typed, never-throwing wrapper around localStorage. Nothing here leaves the device.
import { DEFAULT_SETTINGS, GRADE } from '../game/config';
import type { Grade, Player, Players, Subject, Team } from '../game/types';
import type { PickHistory, QuestionSubject } from '../questions/types';
import {
  STORAGE_KEYS,
  type BackingStore,
  type CreateStorage,
  type LoadSettings,
  type Settings,
  type StorageKey,
  type StorageSchema,
  type TypedStorage,
} from './types';

/** TypedStorage plus the "Clear my data" sweep. */
export interface ClearableStorage extends TypedStorage {
  /** Removes every `timeclash.*` key from the backing store and from memory. */
  clearAll(): void;
}

const PREFIX = 'timeclash.';
const SUBJECTS: readonly Subject[] = ['reading', 'math', 'both'];
const TEAM_ORDER: readonly Team[] = ['PAST', 'FUTURE'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function parsePlayer(v: unknown, team: Team): Player | null {
  if (!isObject(v)) return null;
  const { name, grade, subject } = v;
  if (typeof name !== 'string' || v.team !== team) return null;
  if (typeof grade !== 'number' || !Number.isInteger(grade)) return null;
  if (grade < GRADE.min || grade > GRADE.max) return null;
  if (typeof subject !== 'string' || !SUBJECTS.includes(subject as Subject)) return null;
  return { name, team, grade: grade as Grade, subject: subject as Subject };
}

function parsePlayers(v: unknown): Players | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = parsePlayer(v[0], TEAM_ORDER[0] as Team);
  const b = parsePlayer(v[1], TEAM_ORDER[1] as Team);
  return a && b ? [a, b] : null;
}

function parseSettings(v: unknown): Settings | null {
  if (!isObject(v)) return null;
  const d = DEFAULT_SETTINGS;
  const volume = typeof v.volume === 'number' && Number.isFinite(v.volume) ? v.volume : d.volume;
  const rm = v.reducedMotion;
  return {
    muted: typeof v.muted === 'boolean' ? v.muted : d.muted,
    volume: Math.min(1, Math.max(0, volume)),
    captions: typeof v.captions === 'boolean' ? v.captions : d.captions,
    musicOn: typeof v.musicOn === 'boolean' ? v.musicOn : d.musicOn,
    reducedMotion: rm === 'on' || rm === 'off' || rm === 'system' ? rm : d.reducedMotion,
  };
}

function parseHistory(v: unknown): PickHistory | null {
  if (!isObject(v) || !isObject(v.used) || !isObject(v.lastSubject)) return null;
  const used: PickHistory['used'] = {};
  for (const [k, ids] of Object.entries(v.used)) {
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return null;
    used[k as keyof PickHistory['used']] = ids as string[];
  }
  const lastSubject: PickHistory['lastSubject'] = {};
  for (const [k, s] of Object.entries(v.lastSubject)) {
    if (s !== 'reading' && s !== 'math') return null;
    lastSubject[k] = s as QuestionSubject;
  }
  const retry: NonNullable<PickHistory['retry']> = [];
  if (Array.isArray(v.retry)) {
    for (const e of v.retry) {
      if (
        isObject(e) &&
        typeof e.id === 'string' &&
        Number.isInteger(e.picksLeft) &&
        (e.picksLeft as number) >= 0
      )
        retry.push({ id: e.id, picksLeft: e.picksLeft as number });
    }
  }
  return retry.length > 0 ? { used, lastSubject, retry } : { used, lastSubject };
}

/** Each key has a shape guard. It returns the clean value, or null if the shape is wrong. */
const GUARDS: { [K in StorageKey]: (v: unknown) => StorageSchema[K] | null } = {
  'timeclash.players': parsePlayers,
  'timeclash.introSeen': (v) => (typeof v === 'boolean' ? v : null),
  'timeclash.settings': parseSettings,
  'timeclash.history': parseHistory,
};

function defaultBacking(): BackingStore | null {
  try {
    const ls = globalThis.localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

export const createStorage: CreateStorage = (backing?: BackingStore | null): ClearableStorage => {
  const store: BackingStore | null = backing === undefined ? defaultBacking() : backing;
  const memory = new Map<string, unknown>();
  let persistent = store !== null;

  const readRaw = (key: StorageKey): unknown => {
    if (!store) return undefined;
    try {
      const raw = store.getItem(key);
      if (raw === null || raw === undefined) return undefined;
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  };

  return {
    get persistent() {
      return persistent;
    },
    get<K extends StorageKey>(key: K): StorageSchema[K] | null {
      if (memory.has(key)) {
        const m = GUARDS[key](memory.get(key));
        if (m !== null) return m;
      }
      const raw = readRaw(key);
      if (raw === undefined) return null;
      return GUARDS[key](raw);
    },
    set<K extends StorageKey>(key: K, value: StorageSchema[K]): boolean {
      memory.set(key, value);
      if (!store) return false;
      try {
        store.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        persistent = false;
        return false;
      }
    },
    remove(key: StorageKey): void {
      memory.delete(key);
      try {
        store?.removeItem(key);
      } catch {
        /* storage is blocked; the memory copy is already gone */
      }
    },
    clearAll(): void {
      memory.clear();
      if (!store) return;
      try {
        const s = store as Partial<Storage>;
        const names: string[] = [...STORAGE_KEYS];
        if (typeof s.length === 'number' && typeof s.key === 'function') {
          for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (k && k.startsWith(PREFIX)) names.push(k);
          }
        }
        for (const k of new Set(names)) store.removeItem(k);
      } catch {
        /* storage is blocked; nothing more to clear */
      }
    },
  };
};

/** "Clear my data": wipes every `timeclash.*` key. Never throws. */
export function clearMyData(storage: TypedStorage): void {
  const c = storage as Partial<ClearableStorage>;
  if (typeof c.clearAll === 'function') {
    c.clearAll();
    return;
  }
  for (const k of STORAGE_KEYS) storage.remove(k);
}

export const loadSettings: LoadSettings = (storage) =>
  storage.get('timeclash.settings') ?? { ...DEFAULT_SETTINGS };

/** Saves mute and volume, keeping the other settings as they are. Never throws. */
export function saveAudioSettings(
  storage: TypedStorage,
  audio: { muted: boolean; volume: number; musicOn?: boolean },
): void {
  storage.set('timeclash.settings', { ...loadSettings(storage), ...audio });
}
