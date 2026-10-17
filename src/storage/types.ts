// Shared contract for the localStorage wrapper. Nothing here ever leaves the device.
import type { CampState } from '../game/loadout';
import type { Players } from '../game/types';
import type { Levels } from '../questions/calibration';
import type { PickHistory } from '../questions/types';

export type Settings = {
  muted: boolean;
  /** 0 to 1. */
  volume: number;
  captions: boolean;
  /** Background music on or off. Sound effects and voice follow `muted`, not this. */
  musicOn: boolean;
  /** 'system' follows prefers-reduced-motion. */
  reducedMotion: 'system' | 'on' | 'off';
};

/** Keys from ARCHITECTURE.md. Do not add keys without updating that file. */
export type StorageSchema = {
  'timeclash.players': Players;
  'timeclash.introSeen': boolean;
  'timeclash.settings': Settings;
  'timeclash.history': PickHistory;
  /** Scrap, weapons and upgrades for both teams. Saved on this device only. */
  'timeclash.camp': CampState;
  /** Quiet level nudges per player name and subject. Never shown to a child. */
  'timeclash.levels': Levels;
};

export type StorageKey = keyof StorageSchema;

export const STORAGE_KEYS: readonly StorageKey[] = [
  'timeclash.players',
  'timeclash.introSeen',
  'timeclash.settings',
  'timeclash.history',
  'timeclash.camp',
  'timeclash.levels',
];

/** The subset of window.localStorage we use. Inject a fake in tests. */
export type BackingStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Typed, never-throwing storage.
 * - get: returns null when the key is missing, the JSON is bad, the shape check
 *   fails, or localStorage throws. Each key has a shape guard inside the module.
 * - set: returns false if the write failed. The value is still kept in memory,
 *   so the rest of this session works (private mode, full disk, blocked storage).
 */
export interface TypedStorage {
  get<K extends StorageKey>(key: K): StorageSchema[K] | null;
  set<K extends StorageKey>(key: K, value: StorageSchema[K]): boolean;
  remove(key: StorageKey): void;
  /** True if writes reach a real backing store, false if memory only. */
  readonly persistent: boolean;
}

/**
 * Pass a backing store in tests. With no argument, it tries window.localStorage
 * inside try/catch and falls back to memory.
 */
export type CreateStorage = (backing?: BackingStore | null) => TypedStorage;

/** settings with every missing or bad field filled from DEFAULT_SETTINGS. */
export type LoadSettings = (storage: TypedStorage) => Settings;
