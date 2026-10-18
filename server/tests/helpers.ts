import { createRoomManager, type Conn, type RoomManager } from '../src/rooms';
import { loadBank } from '../src/bank';

export const BANK = loadBank();

export type Frame = Record<string, unknown> & { t: string };

export class FakeConn implements Conn {
  readonly raw: string[] = [];
  closed = false;
  constructor(readonly addr = 'addr-1') {}
  send(text: string): void {
    this.raw.push(text);
  }
  close(): void {
    this.closed = true;
  }
  get frames(): Frame[] {
    return this.raw.map((r) => JSON.parse(r) as Frame);
  }
  of(t: string): Frame[] {
    return this.frames.filter((f) => f.t === t);
  }
  last(t: string): Frame {
    const all = this.of(t);
    const f = all[all.length - 1];
    if (!f) throw new Error(`no ${t} frame; got ${this.frames.map((x) => x.t).join(',')}`);
    return f;
  }
}

export type Harness = ReturnType<typeof makeHarness>;

export function makeHarness(opts: { seeds?: () => number } = {}) {
  let clock = 1_000_000;
  const logs: Array<[string, string]> = [];
  const manager: RoomManager = createRoomManager({
    bank: BANK,
    now: () => clock,
    log: (room, event) => logs.push([room, event]),
    seeds: opts.seeds ?? (() => 4242),
  });
  const connect = (addr?: string): FakeConn => {
    const c = new FakeConn(addr);
    manager.onConnect(c);
    return c;
  };
  /** Sends one message, then moves the clock 300 ms so the per-connection budget refills. */
  const send = (c: FakeConn, m: Record<string, unknown>): void => {
    manager.onMessage(c, JSON.stringify({ v: 1, ...m }));
    clock += 300;
  };
  const advance = (ms: number): void => {
    clock += ms;
  };
  return { manager, connect, send, advance, logs, now: () => clock };
}

/** Host (Team Past) and guest (Team Future) in a room with the match started. */
export function startedMatch(h: Harness) {
  const host = h.connect('host-addr');
  const guest = h.connect('guest-addr');
  h.send(host, { t: 'create_room' });
  const created = host.last('room_created');
  const code = created.code as string;
  h.send(guest, { t: 'join_room', code });
  h.send(host, { t: 'setup', turn: 0, seq: 1, team: 'PAST', grade: 3, subject: 'math', name: 'Ana' });
  h.send(guest, { t: 'setup', turn: 0, seq: 1, team: 'FUTURE', grade: 2, subject: 'math' });
  return { host, guest, code, hostSecret: created.secret as string, guestSecret: guest.last('room_joined').secret as string };
}

export const shot = (seq: number, turn: number, extra: Record<string, unknown> = {}) => ({
  t: 'fire',
  turn,
  seq,
  angleDeg: 45,
  power: 60,
  ...extra,
});
