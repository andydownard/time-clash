// Rooms: who is in which room, the two seats, secrets, grace periods, replays and limits.
// Transport-free. server.ts connects real sockets to this. Tests connect fake ones.
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { validateName } from '../../src/game/names';
import type { QuestionBank } from '../../src/questions/types';
import { LIMITS, ROOM } from './config';
import {
  MatchDriver,
  type Outbound,
  type Seat,
  type SeatProfile,
  type ServerMessage,
} from './driver';
import { parseClientMessage, type ClientMessage, type ErrorCode } from './protocol';
import { createBucket, createKeyedLimiter, type Bucket } from './rateLimit';
import { generateRoomCode } from './roomCode';

/** One connected client. The server wraps a real socket; tests wrap a recorder. */
export type Conn = {
  /** Salted hash of the network address (memory only), or any stable id. Used for limits. */
  addr: string;
  send(text: string): void;
  close(): void;
};

type Replay = { hash: string; replies: string[] };

type SeatState = {
  index: Seat;
  secretHash: Buffer;
  conn: Conn | null;
  disconnectedAt: number | null;
  profile: SeatProfile | null;
  lastSeq: number;
  replay: Map<number, Replay>;
  lastEmoteAt: number;
  wantsRematch: boolean;
};

type Room = {
  code: string;
  seats: [SeatState | null, SeatState | null];
  driver: MatchDriver | null;
  lastActive: number;
  bucket: Bucket;
};

type ConnState = {
  bucket: Bucket;
  strikes: number;
  violations: number;
  bound: { code: string; seat: Seat } | null;
};

export type ManagerOptions = {
  bank: QuestionBank;
  now?: () => number;
  /** Log one line: the room code and an event type. Nothing else may be logged. */
  log?: (room: string, event: string) => void;
  /** Source of match and question seeds. Default: crypto random. */
  seeds?: () => number;
  /** Source of room code randomness. Default: crypto random. */
  randomIndex?: (n: number) => number;
};

const hashSecret = (s: string): Buffer => createHash('sha256').update(s).digest();
const v1 = (t: string, fields: Record<string, unknown> = {}): ServerMessage => ({
  v: 1,
  t,
  ...fields,
});

export function createRoomManager(options: ManagerOptions) {
  const now = options.now ?? Date.now;
  const log = options.log ?? ((): void => undefined);
  const seeds = options.seeds ?? ((): number => randomInt(0, 2 ** 32));
  const rooms = new Map<string, Room>();
  const conns = new WeakMap<Conn, ConnState>();
  const bucketOpts = (b: { capacity: number; refillPerSec: number }) => ({ ...b, now });
  const keyed = (b: { capacity: number; refillPerSec: number }) =>
    createKeyedLimiter({ ...bucketOpts(b), ttlMs: LIMITS.addressTtlMs });
  const failedJoinByAddr = keyed(LIMITS.failedJoinPerAddress);
  const roomsByAddr = keyed(LIMITS.roomsPerAddress);
  const failedJoinGlobal = createBucket(bucketOpts(LIMITS.failedJoinGlobal));

  const sendTo = (conn: Conn | null, m: ServerMessage): string => {
    const text = JSON.stringify(m);
    conn?.send(text);
    return text;
  };
  const fail = (conn: Conn, code: ErrorCode, seq?: number): void => {
    sendTo(conn, v1('error', seq === undefined ? { code } : { code, seq }));
  };

  const lobby = (room: Room): ServerMessage =>
    v1('lobby', {
      seats: room.seats.map((s) =>
        s
          ? {
              present: s.conn !== null,
              team: s.profile?.team ?? null,
              grade: s.profile?.grade ?? null,
              subject: s.profile?.subject ?? null,
              name: s.profile?.name ?? null,
              ready: s.profile !== null,
            }
          : { present: false, team: null, grade: null, subject: null, name: null, ready: false },
      ),
    });

  const deliver = (room: Room, out: Outbound[]): void => {
    for (const o of out) {
      for (const i of o.to === 'both' ? [0, 1] : [o.to]) {
        sendTo(room.seats[i]?.conn ?? null, o.msg);
      }
    }
  };

  const closeRoom = (room: Room, reason: 'left' | 'gone' | 'idle'): void => {
    rooms.delete(room.code);
    for (const s of room.seats) {
      if (!s?.conn) continue;
      sendTo(s.conn, v1('room_closed', { reason }));
      const st = conns.get(s.conn);
      if (st) st.bound = null;
      s.conn.close();
    }
    log(room.code, `close:${reason}`);
  };

  const newSecret = (): { secret: string; hash: Buffer } => {
    const secret = randomBytes(32).toString('base64url');
    return { secret, hash: hashSecret(secret) };
  };
  const newSeat = (index: Seat, conn: Conn, hash: Buffer): SeatState => ({
    index,
    secretHash: hash,
    conn,
    disconnectedAt: null,
    profile: null,
    lastSeq: -1,
    replay: new Map(),
    lastEmoteAt: -Infinity,
    wantsRematch: false,
  });

  const noteViolation = (conn: Conn, st: ConnState): void => {
    st.violations += 1;
    if (st.violations >= LIMITS.maxViolations) conn.close();
  };
  const reject = (conn: Conn, st: ConnState, code: ErrorCode, seq?: number, room = '-'): void => {
    fail(conn, code, seq);
    log(room, `error:${code}`);
    if (code !== 'slow_down') noteViolation(conn, st);
  };

  /** A failed room lookup or secret check. Spends from the per-address and global budgets. */
  const failedGuess = (conn: Conn): void => {
    failedJoinByAddr.take(conn.addr);
    failedJoinGlobal.take();
  };
  const guessAllowed = (conn: Conn): boolean =>
    failedJoinByAddr.has(conn.addr) && failedJoinGlobal.has();

  const replayKey = (m: ClientMessage): string => {
    const { v: _v, ...rest } = m as Record<string, unknown>;
    void _v;
    return JSON.stringify(
      Object.keys(rest)
        .sort()
        .map((k) => [k, rest[k]]),
    );
  };

  /** Runs a keyed (match-changing) message once. A repeat with the same key is a replay. */
  const runKeyed = (
    conn: Conn,
    st: ConnState,
    room: Room,
    seat: SeatState,
    m: Extract<ClientMessage, { seq: number }>,
    exec: () => { ok: true; out: Outbound[] } | { ok: false; code: ErrorCode },
  ): void => {
    const hash = replayKey(m);
    const cached = seat.replay.get(m.seq);
    if (cached) {
      if (cached.hash !== hash) return reject(conn, st, 'key_reused', m.seq, room.code);
      for (const text of cached.replies) conn.send(text);
      log(room.code, 'replay');
      return;
    }
    if (m.seq <= seat.lastSeq) return reject(conn, st, 'stale_seq', m.seq, room.code);
    const res = exec();
    if (!res.ok) return reject(conn, st, res.code, m.seq, room.code);
    seat.lastSeq = m.seq;
    const replies: string[] = [];
    for (const o of res.out) {
      if (o.to === 'both' || o.to === seat.index) replies.push(JSON.stringify(o.msg));
    }
    seat.replay.set(m.seq, { hash, replies });
    if (seat.replay.size > ROOM.replayCache) seat.replay.delete(seat.replay.keys().next().value!);
    deliver(room, res.out);
    log(room.code, m.t);
  };

  const startMatch = (room: Room, previous?: ReturnType<MatchDriver['rematch']>): Outbound[] => {
    const profiles = [room.seats[0]!.profile!, room.seats[1]!.profile!] as const;
    room.driver = new MatchDriver({
      bank: options.bank,
      profiles,
      seeds,
      now,
      ...(previous ? { previous } : {}),
    });
    for (const s of room.seats) if (s) s.wantsRematch = false;
    return [
      { to: 0, msg: room.driver.state(0) },
      { to: 1, msg: room.driver.state(1) },
    ];
  };

  function onConnect(conn: Conn): void {
    conns.set(conn, {
      bucket: createBucket(bucketOpts(LIMITS.connection)),
      strikes: 0,
      violations: 0,
      bound: null,
    });
  }

  function onMessage(conn: Conn, raw: string): void {
    const st = conns.get(conn);
    if (!st) return;
    if (!st.bucket.take()) {
      st.strikes += 1;
      fail(conn, 'slow_down');
      if (st.strikes >= LIMITS.maxStrikes) conn.close();
      return;
    }
    st.strikes = 0;
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return reject(conn, st, parsed.code);
    const m = parsed.msg;

    if (m.t === 'ping') {
      sendTo(conn, v1('pong'));
      return;
    }

    if (m.t === 'create_room') return createRoom(conn, st);
    if (m.t === 'join_room') return joinRoom(conn, st, m.code);
    if (m.t === 'rejoin') return rejoin(conn, st, m);

    const room = st.bound ? rooms.get(st.bound.code) : undefined;
    const seat = room && st.bound ? room.seats[st.bound.seat] : null;
    if (!room || !seat || seat.conn !== conn) return reject(conn, st, 'not_in_room');
    if (!room.bucket.take()) return reject(conn, st, 'slow_down', undefined, room.code);
    room.lastActive = now();
    const other = room.seats[seat.index === 0 ? 1 : 0];

    switch (m.t) {
      case 'leave':
        log(room.code, 'leave');
        return closeRoom(room, 'left');
      case 'emote': {
        if (now() - seat.lastEmoteAt < LIMITS.emoteGapMs) {
          return reject(conn, st, 'slow_down', undefined, room.code);
        }
        seat.lastEmoteAt = now();
        sendTo(other?.conn ?? null, v1('emote', { emote: m.emote }));
        log(room.code, 'emote');
        return;
      }
      case 'setup':
        return runKeyed(conn, st, room, seat, m, () => {
          if (room.driver) return { ok: false, code: 'wrong_phase' };
          let name: string | undefined;
          if (m.name !== undefined) {
            const checked = validateName(m.name);
            if (!checked.ok) return { ok: false, code: 'bad_name' };
            name = checked.name;
          }
          if (other?.profile?.team === m.team) return { ok: false, code: 'team_taken' };
          seat.profile = {
            team: m.team,
            grade: m.grade,
            subject: m.subject,
            ...(name !== undefined ? { name } : {}),
          };
          const out: Outbound[] = [{ to: 'both', msg: lobby(room) }];
          if (room.seats[0]?.profile && room.seats[1]?.profile) out.push(...startMatch(room));
          return { ok: true, out };
        });
      case 'fire':
        return runKeyed(conn, st, room, seat, m, () =>
          room.driver
            ? room.driver.fire(seat.index, m.turn, {
                angleDeg: m.angleDeg,
                power: m.power,
                ...(m.unit !== undefined ? { unit: m.unit } : {}),
              })
            : { ok: false, code: 'wrong_phase' },
        );
      case 'answer':
        return runKeyed(conn, st, room, seat, m, () =>
          room.driver
            ? room.driver.answer(seat.index, m.turn, m.choice)
            : { ok: false, code: 'wrong_phase' },
        );
      case 'rematch':
        return runKeyed(conn, st, room, seat, m, () => {
          if (!room.driver?.over) return { ok: false, code: 'wrong_phase' };
          seat.wantsRematch = true;
          const out: Outbound[] = [{ to: 'both', msg: v1('rematch_vote', { seat: seat.index }) }];
          if (room.seats.every((s) => s?.wantsRematch))
            out.push(...startMatch(room, room.driver.rematch()));
          return { ok: true, out };
        });
    }
  }

  function createRoom(conn: Conn, st: ConnState): void {
    if (st.bound) return reject(conn, st, 'already_in_room');
    if (!roomsByAddr.take(conn.addr)) return reject(conn, st, 'slow_down');
    if (rooms.size >= ROOM.maxRooms) return reject(conn, st, 'busy');
    const code = generateRoomCode((c) => rooms.has(c), options.randomIndex);
    const { secret, hash } = newSecret();
    const room: Room = {
      code,
      seats: [newSeat(0, conn, hash), null],
      driver: null,
      lastActive: now(),
      bucket: createBucket(bucketOpts(LIMITS.room)),
    };
    rooms.set(code, room);
    st.bound = { code, seat: 0 };
    sendTo(conn, v1('room_created', { code, seat: 0, secret }));
    sendTo(conn, lobby(room));
    log(code, 'create_room');
  }

  function joinRoom(conn: Conn, st: ConnState, code: string): void {
    if (st.bound) return reject(conn, st, 'already_in_room');
    if (!guessAllowed(conn)) return reject(conn, st, 'slow_down');
    const room = rooms.get(code);
    if (!room) {
      failedGuess(conn);
      return reject(conn, st, 'no_such_room');
    }
    if (room.seats[1]) {
      failedGuess(conn);
      return reject(conn, st, 'room_full');
    }
    const { secret, hash } = newSecret();
    room.seats[1] = newSeat(1, conn, hash);
    room.lastActive = now();
    st.bound = { code, seat: 1 };
    sendTo(conn, v1('room_joined', { code, seat: 1, secret }));
    deliver(room, [{ to: 'both', msg: lobby(room) }]);
    log(code, 'join_room');
  }

  function rejoin(conn: Conn, st: ConnState, m: Extract<ClientMessage, { t: 'rejoin' }>): void {
    if (st.bound) return reject(conn, st, 'already_in_room');
    if (!guessAllowed(conn)) return reject(conn, st, 'slow_down');
    const room = rooms.get(m.code);
    const seat = room?.seats[m.seat];
    const secretOk =
      seat !== undefined && seat !== null && timingSafeEqual(seat.secretHash, hashSecret(m.secret));
    const inGrace =
      seat && (seat.disconnectedAt === null || now() - seat.disconnectedAt <= ROOM.graceMs);
    if (!room || !seat || !secretOk || !inGrace) {
      failedGuess(conn);
      return reject(conn, st, 'rejoin_failed');
    }
    const old = seat.conn;
    seat.conn = conn;
    seat.disconnectedAt = null;
    room.lastActive = now();
    st.bound = { code: room.code, seat: seat.index };
    if (old && old !== conn) {
      const oldState = conns.get(old);
      if (oldState) oldState.bound = null;
      old.close();
    }
    if (room.driver) for (const msg of room.driver.sync(seat.index)) sendTo(conn, msg);
    else sendTo(conn, lobby(room));
    const other = room.seats[seat.index === 0 ? 1 : 0];
    sendTo(other?.conn ?? null, v1('peer', { event: 'back' }));
    log(room.code, 'rejoin');
  }

  function onClose(conn: Conn): void {
    const st = conns.get(conn);
    if (!st?.bound) return;
    const room = rooms.get(st.bound.code);
    const seat = room?.seats[st.bound.seat];
    st.bound = null;
    if (!room || !seat || seat.conn !== conn) return;
    seat.conn = null;
    seat.disconnectedAt = now();
    const other = room.seats[seat.index === 0 ? 1 : 0];
    sendTo(other?.conn ?? null, v1('peer', { event: 'left', graceMs: ROOM.graceMs }));
    log(room.code, 'disconnect');
  }

  /** Closes idle rooms and rooms whose grace ran out. Call every few seconds. */
  function sweep(): void {
    const t = now();
    for (const room of [...rooms.values()]) {
      if (t - room.lastActive > ROOM.idleMs) {
        closeRoom(room, 'idle');
      } else if (
        room.seats.some(
          (s) => s && s.disconnectedAt !== null && t - s.disconnectedAt > ROOM.graceMs,
        )
      ) {
        closeRoom(room, 'gone');
      }
    }
    failedJoinByAddr.sweep();
    roomsByAddr.sweep();
  }

  return {
    onConnect,
    onMessage,
    onClose,
    sweep,
    roomCount: (): number => rooms.size,
  };
}

export type RoomManager = ReturnType<typeof createRoomManager>;
