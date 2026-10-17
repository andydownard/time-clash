// Typed, never-throwing wrapper around localStorage. Nothing here leaves the device.
import { DEFAULT_SETTINGS, GRADE } from '../game/config';
import {
  freshCamp,
  freshLoadout,
  freshWallet,
  walletKey,
  type CampState,
  type TeamLoadout,
  type Wallet,
} from '../game/loadout';
import type { Grade, Player, Players, Subject, Team } from '../game/types';
import { FORGE, WEAPONS, type WeaponId } from '../game/weapons';
import { UPGRADES, UPGRADE_MAX_LEVEL, type UpgradeId } from '../game/upgrades';
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

/** The most scrap we keep. A bad or edited value is capped, so the Camp never shows a silly number. */
const SCRAP_CAP = 99999;
/** Lifetime Scrap can climb higher than what is in hand. */
const EARNED_CAP = 9_999_999;

const wholeBetween = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

/** One team's loadout, cleaned. Anything wrong is dropped, and the starter is always owned. */
function parseLoadout(v: unknown, team: Team): TeamLoadout {
  const fresh = freshLoadout(team);
  if (!isObject(v)) return fresh;
  const owned: Partial<Record<WeaponId, number>> = { ...fresh.owned };
  if (isObject(v.owned)) {
    for (const w of WEAPONS.filter((x) => x.team === team)) {
      const level = wholeBetween(v.owned[w.id], 1, FORGE.maxLevel);
      if (level !== null) owned[w.id] = level;
    }
  }
  const wanted = WEAPONS.find((w) => w.id === v.weapon && w.team === team);
  const weapon = wanted && owned[wanted.id] ? wanted.id : fresh.weapon;
  const upgrades: Partial<Record<UpgradeId, number>> = {};
  if (isObject(v.upgrades)) {
    for (const u of UPGRADES.filter((x) => x.team === team)) {
      const level = wholeBetween(v.upgrades[u.id], 1, UPGRADE_MAX_LEVEL);
      if (level !== null) upgrades[u.id] = level;
    }
  }
  return { weapon, owned, upgrades };
}

/** One wallet, cleaned. Bad numbers become 0 and the starter weapons are always owned. */
function parseWallet(v: unknown, fallbackName: string): Wallet | null {
  if (!isObject(v)) return null;
  const name = typeof v.name === 'string' && v.name.trim() !== '' ? v.name.trim() : fallbackName;
  if (walletKey(name) === '') return null;
  const loadout = isObject(v.loadout) ? v.loadout : {};
  const scrap = wholeBetween(v.scrap, 0, SCRAP_CAP) ?? 0;
  return {
    name,
    scrap,
    // Lifetime earned can never be less than what is in hand.
    earned: Math.max(scrap, wholeBetween(v.earned, 0, EARNED_CAP) ?? 0),
    loadout: {
      PAST: parseLoadout(loadout.PAST, 'PAST'),
      FUTURE: parseLoadout(loadout.FUTURE, 'FUTURE'),
    },
  };
}

/** The old save kept one pile of Scrap per team. Those are held under these keys until a name is known. */
export const LEGACY_KEY: Record<Team, string> = { PAST: '\u0000past', FUTURE: '\u0000future' };

function parseCamp(v: unknown): CampState | null {
  if (!isObject(v)) return null;
  const seed = v.creditedSeed;
  const creditedSeed = typeof seed === 'number' && Number.isFinite(seed) ? seed : null;
  const wallets: Record<string, Wallet> = {};
  if (isObject(v.wallets)) {
    for (const [key, raw] of Object.entries(v.wallets)) {
      const wallet = parseWallet(raw, key);
      // The key is always rebuilt from the name, so a hand-edited key cannot make a second pile.
      if (wallet) wallets[walletKey(wallet.name)] = wallet;
    }
    return { wallets, creditedSeed };
  }
  // The old shape: { scrap: {PAST, FUTURE}, loadout: {PAST, FUTURE} }.
  if (isObject(v.scrap) && isObject(v.loadout)) {
    const old = v.loadout;
    for (const team of TEAM_ORDER) {
      const scrap = wholeBetween((v.scrap as Record<string, unknown>)[team], 0, SCRAP_CAP) ?? 0;
      const wallet = freshWallet('');
      const loadout = parseLoadout(old[team], team);
      wallets[LEGACY_KEY[team]] = {
        ...wallet,
        scrap,
        earned: scrap,
        loadout: { ...wallet.loadout, [team]: loadout },
      };
    }
    return { wallets, creditedSeed };
  }
  return null;
}

/**
 * Moves anything saved the old way (one pile per team) onto the two players' names, so no Scrap or
 * purchase is lost. Does nothing until the names are known.
 */
export function adoptLegacy(camp: CampState, players: Players | null): CampState {
  if (!players) return camp;
  const wallets = { ...camp.wallets };
  let changed = false;
  for (const team of TEAM_ORDER) {
    const legacy = wallets[LEGACY_KEY[team]];
    if (!legacy) continue;
    changed = true;
    delete wallets[LEGACY_KEY[team]];
    const name = players.find((p) => p.team === team)?.name ?? '';
    if (walletKey(name) === '') continue;
    const target = wallets[walletKey(name)] ?? freshWallet(name);
    wallets[walletKey(name)] = {
      ...target,
      scrap: target.scrap + legacy.scrap,
      earned: target.earned + legacy.earned,
      loadout: { ...target.loadout, [team]: legacy.loadout[team] },
    };
  }
  return changed ? { ...camp, wallets } : camp;
}

/** The saved camp, or a fresh one. Never throws and never returns null. */
export function loadCamp(storage: TypedStorage): CampState {
  const saved = storage.get('timeclash.camp') ?? freshCamp();
  const adopted = adoptLegacy(saved, storage.get('timeclash.players'));
  // Save the move at once. Otherwise a player who changes their name before the next save would
  // carry the old Scrap onto the new name.
  if (adopted !== saved) storage.set('timeclash.camp', adopted);
  return adopted;
}

/** Each key has a shape guard. It returns the clean value, or null if the shape is wrong. */
const GUARDS: { [K in StorageKey]: (v: unknown) => StorageSchema[K] | null } = {
  'timeclash.players': parsePlayers,
  'timeclash.introSeen': (v) => (typeof v === 'boolean' ? v : null),
  'timeclash.settings': parseSettings,
  'timeclash.history': parseHistory,
  'timeclash.camp': parseCamp,
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
