import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { classifyBlast } from '../../src/game/damage';
import { simulateShot } from '../../src/game/ballistics';
import { PHASE1_LAYOUT, TEAM_FACING } from '../../src/game/config';
import { DEFAULT_EFFECTS } from '../../src/game/loadout';
import { DEFAULT_UNIT, unitById } from '../../src/game/units';
import { otherTeam, type Team } from '../../src/game/types';
import { createRelay, type Relay } from '../src/server';
import { BANK, type Frame } from './helpers';

/** Shared fake clock: every message sent moves it 300 ms so the rate limits never trip. */
let clock = 1_000_000;

class Client {
  frames: Frame[] = [];
  sent: Array<Record<string, unknown>> = [];
  private ws!: WebSocket;
  private waiters: Array<() => void> = [];
  async open(url: string, origin?: string): Promise<this> {
    this.ws = new WebSocket(url, origin ? { origin } : {});
    this.ws.on('message', (d) => {
      this.frames.push(JSON.parse(d.toString()) as Frame);
      for (const w of this.waiters.splice(0)) w();
    });
    await new Promise<void>((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
      this.ws.once('unexpected-response', (_req, res) =>
        reject(new Error(`HTTP ${res.statusCode}`)),
      );
    });
    return this;
  }
  send(m: Record<string, unknown>): void {
    clock += 300;
    const full = { v: 1, ...m };
    this.sent.push(full);
    this.ws.send(JSON.stringify(full));
  }
  async until<T>(find: () => T | undefined): Promise<T> {
    for (let i = 0; i < 200; i++) {
      const hit = find();
      if (hit !== undefined) return hit;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 50);
        this.waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
    throw new Error(
      `timed out; frames: ${this.frames.map((f) => f.t).join(',')} errors: ${JSON.stringify(this.frames.filter((f) => f.t === 'error'))}`,
    );
  }
  waitFor(t: string, from = 0): Promise<Frame> {
    return this.until(() => this.frames.slice(from).find((f) => f.t === t));
  }
  close(): void {
    this.ws.close();
  }
  get state(): Frame {
    return [...this.frames].reverse().find((f) => f.t === 'state')!;
  }
}

/** A scripted shooter: searches for a direct hit using the same pure rules, from public state. */
function findShot(team: Team, wind: number): { angleDeg: number; power: number } {
  const unit = unitById(DEFAULT_UNIT[team])!;
  let best = { angleDeg: 45, power: 60, rank: -1 };
  for (let angleDeg = 10; angleDeg <= 85; angleDeg += 1) {
    for (let power = 20; power <= 100; power += 2) {
      const r = simulateShot({
        angleDeg,
        power,
        origin: PHASE1_LAYOUT.launchOrigins[team],
        facing: TEAM_FACING[team],
        wind,
        layout: PHASE1_LAYOUT,
        speedScale: DEFAULT_EFFECTS[team].speedScale * unit.speedScale,
      });
      const blast = classifyBlast(r.landing, PHASE1_LAYOUT.bases[otherTeam(team)]);
      const rank = blast === 'direct' ? 2 : blast === 'near' ? 1 : 0;
      if (rank > best.rank) best = { angleDeg, power, rank };
      if (rank === 2) break;
    }
    if (best.rank === 2) break;
  }
  return { angleDeg: best.angleDeg, power: best.power };
}

let relay: Relay;
let base: string;
const logs: Array<[string, string]> = [];

beforeEach(async () => {
  logs.length = 0;
  clock = 1_000_000;
  let seed = 100;
  relay = createRelay({
    bank: BANK,
    build: 'test-sha',
    now: () => clock,
    seeds: () => seed++,
    allowedOrigins: ['https://timeclash.rallytasks.com'],
    log: (room, event) => logs.push([room, event]),
  });
  const port = await relay.listen(0, '127.0.0.1');
  base = `127.0.0.1:${port}`;
});
afterEach(async () => {
  await relay.close();
});

const ORIGIN = 'https://timeclash.rallytasks.com';

describe('http edge', () => {
  it('answers /health with the build id', async () => {
    const res = await fetch(`http://${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, build: 'test-sha' });
  });
  it('404s anything else', async () => {
    expect((await fetch(`http://${base}/`)).status).toBe(404);
  });
  it('refuses a WebSocket from the wrong Origin and from no Origin', async () => {
    await expect(new Client().open(`ws://${base}/ws`, 'https://evil.example')).rejects.toThrow(
      '403',
    );
    await expect(new Client().open(`ws://${base}/ws`)).rejects.toThrow('403');
  });
  it('refuses a WebSocket on another path', async () => {
    await expect(new Client().open(`ws://${base}/other`, ORIGIN)).rejects.toThrow('404');
  });
});

describe('two real clients play a seeded match to Victory', () => {
  it('plays, wins, rematches, and leaves', async () => {
    const host = await new Client().open(`ws://${base}/ws`, ORIGIN);
    const guest = await new Client().open(`ws://${base}/ws`, ORIGIN);
    host.send({ t: 'create_room' });
    const { code } = await host.waitFor('room_created');
    guest.send({ t: 'join_room', code });
    await guest.waitFor('room_joined');
    host.send({ t: 'setup', turn: 0, seq: 1, team: 'PAST', grade: 3, subject: 'math' });
    guest.send({ t: 'setup', turn: 0, seq: 1, team: 'FUTURE', grade: 3, subject: 'both' });
    await host.waitFor('state');
    await guest.waitFor('state');

    const seqs = [1, 1];
    const clients = [host, guest];
    const answers = [0, 0];
    for (let guard = 0; guard < 200 && host.state.status !== 'OVER'; guard++) {
      const s = host.state;
      const seat = s.activeSeat as 0 | 1;
      const c = clients[seat]!;
      const activeTeam: Team = seat === 0 ? 'PAST' : 'FUTURE';
      const seen = host.frames.length;
      if (s.phase === 'RELOAD') {
        await c.until(
          () => c.frames.filter((f) => f.t === 'question').length > answers[seat]! || undefined,
        );
        answers[seat]! += 1;
        c.send({ t: 'answer', turn: s.turnNumber, seq: ++seqs[seat]!, choice: 0 });
      } else {
        const aim = findShot(activeTeam, s.wind as number);
        c.send({ t: 'fire', turn: s.turnNumber, seq: ++seqs[seat]!, ...aim });
      }
      await host.until(() => host.frames.slice(seen).find((f) => f.t === 'state'));
    }

    const end = host.state;
    expect(end.status).toBe('OVER');
    const winner = end.winner as Team;
    expect(['PAST', 'FUTURE']).toContain(winner);
    expect((end.baseHp as Record<Team, number>)[otherTeam(winner)]).toBe(0);
    await guest.until(() => (guest.state.status === 'OVER' ? true : undefined));
    expect(guest.state.winner).toBe(winner);

    // Each player saw exactly one question per reload they answered, and never the other's.
    for (const [i, c] of clients.entries()) {
      expect(c.frames.filter((f) => f.t === 'question')).toHaveLength(answers[i]!);
    }
    expect(answers[0]! + answers[1]!).toBeGreaterThan(0);
    for (const c of clients) {
      expect(c.frames.map((f) => JSON.stringify(f)).join('\n')).not.toMatch(/"answer":|seed/i);
    }

    // Rematch: both vote, the other team starts, a fresh match begins.
    const marks = [host.frames.length, guest.frames.length];
    host.send({ t: 'rematch', turn: end.turnNumber, seq: ++seqs[0]! });
    guest.send({ t: 'rematch', turn: end.turnNumber, seq: ++seqs[1]! });
    const fresh = await host.until(() => host.frames.slice(marks[0]).find((f) => f.t === 'state'));
    expect(fresh.status).toBe('PLAYING');
    expect(fresh.turnNumber).toBe(0);
    expect(fresh.activeSeat).toBe(1); // the other team goes first

    guest.send({ t: 'leave' });
    expect((await host.waitFor('room_closed')).reason).toBe('left');
    host.close();
    guest.close();
    for (const [room, event] of logs) {
      expect(room === '-' || room === code).toBe(true);
      expect(event).toMatch(/^[a-z_]+(:[a-z_0-9]+)?$/);
    }
  }, 60_000);
});

describe('reconnect over a real socket', () => {
  it('rejoins with the secret in the message body', async () => {
    const host = await new Client().open(`ws://${base}/ws`, ORIGIN);
    host.send({ t: 'create_room' });
    const created = await host.waitFor('room_created');
    host.close();
    await new Promise((r) => setTimeout(r, 100));
    const again = await new Client().open(`ws://${base}/ws`, ORIGIN);
    again.send({ t: 'rejoin', code: created.code, seat: 0, secret: created.secret });
    expect((await again.waitFor('lobby')).seats).toBeTruthy();
    again.close();
  });
});
