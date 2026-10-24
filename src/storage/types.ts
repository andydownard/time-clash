// Shared contract for the localStorage wrapper. Nothing here ever leaves the device.
import type { BattlePlan } from '../game/battlefield';
import type { BasesState } from '../game/baseBuilder';
import type { CampState } from '../game/loadout';
import type { MatchLength } from '../game/matchLength';
import type { PracticeChoice } from '../game/practice';
import type { Grade, Players, Subject, Team, Topic } from '../game/types';
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
  /** Hide the bonus ring on the reload card. The fast-answer bonus still works. */
  hideBonusRing: boolean;
};

/** What a side picked at Setup last time. No names. */
export type SetupPick = { grade: Grade; subject: Subject; topic?: Topic };
export type SetupPicks = Partial<Record<Team, SetupPick>>;

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
  /** The last Battle Plan: where to fight and where Team Future hid its base. */
  'timeclash.plan': BattlePlan;
  /** Play with another player or the Computer player, and how hard. Only used while the choice is on. */
  'timeclash.practice': PracticeChoice;
  /** Up to three saved bases per player name and side. Saved on this device only. */
  'timeclash.bases': BasesState;
  /** The grade, subject and Focus each side picked last time, so Setup opens with them. */
  'timeclash.setupPicks': SetupPicks;
  /** Short, Normal or Long. Scales how much damage a base can take. Normal when missing. */
  'timeclash.matchLength': MatchLength;
};

export type StorageKey = keyof StorageSchema;

export const STORAGE_KEYS: readonly StorageKey[] = [
  'timeclash.players',
  'timeclash.introSeen',
  'timeclash.settings',
  'timeclash.history',
  'timeclash.camp',
  'timeclash.levels',
  'timeclash.plan',
  'timeclash.practice',
  'timeclash.bases',
  'timeclash.setupPicks',
  'timeclash.matchLength',
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
