// Relay settings in one place. Docs: docs/PHASE4_RELAY.md.

/** Protocol version every message carries. */
export const PROTOCOL_VERSION = 1;
/** A frame bigger than this (in bytes) is rejected. */
export const MAX_MESSAGE_BYTES = 1024;

export const ROOM = {
  /** A room with no valid message for this long closes. */
  idleMs: 2 * 60 * 60 * 1000,
  /** How long a dropped seat stays held. */
  graceMs: 60 * 1000,
  /** Open rooms on the whole server. */
  maxRooms: 2000,
  /** Replay cache size per seat. */
  replayCache: 32,
} as const;

export const LIMITS = {
  connection: { capacity: 10, refillPerSec: 5 },
  /** Strikes in a row (a rejected flood message each) before the socket is closed. */
  maxStrikes: 5,
  room: { capacity: 40, refillPerSec: 10 },
  /** Rule violations (wrong turn, bad phase, bad name) before the socket is closed. */
  maxViolations: 12,
  /** Failed joins per address: 10 per 10 minutes. */
  failedJoinPerAddress: { capacity: 10, refillPerSec: 10 / 600 },
  failedJoinGlobal: { capacity: 200, refillPerSec: 5 },
  roomsPerAddress: { capacity: 10, refillPerSec: 10 / 600 },
  socketsPerAddress: { capacity: 30, refillPerSec: 0.5 },
  maxOpenSocketsPerAddress: 20,
  emoteGapMs: 2000,
  /** An address entry is forgotten this long after its last use. */
  addressTtlMs: 10 * 60 * 1000,
} as const;

/** WebSocket ping every this many ms. A socket that misses one is closed. */
export const HEARTBEAT_MS = 25_000;
/** How often the server looks for idle rooms and ended grace periods. */
export const SWEEP_MS = 5_000;
