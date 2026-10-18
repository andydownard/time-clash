import { describe, expect, it } from 'vitest';
import { ROOM } from '../src/config';
import { BANK, makeHarness, shot, startedMatch } from './helpers';

describe('room flow', () => {
  it('creates a room, joins it, and starts when both set up', () => {
    const h = makeHarness();
    const { host, guest, code } = startedMatch(h);
    expect(code).toMatch(/^[2-9A-Z]{6}$/);
    expect(host.last('room_created').seat).toBe(0);
    expect(guest.last('room_joined').seat).toBe(1);
    const s = host.last('state');
    expect(s.phase).toBe('AIMING');
    expect(s.activeSeat).toBe(0);
    expect(s.you).toEqual({ seat: 0, team: 'PAST' });
    expect(guest.last('state').you).toEqual({ seat: 1, team: 'FUTURE' });
    expect((s.names as Record<string, string>).PAST).toBe('Ana');
    expect((s.names as Record<string, string>).FUTURE).toBe('Rocket');
  });

  it('never sends a seed in any frame', () => {
    const h = makeHarness({ seeds: () => 987654321 });
    const { host, guest } = startedMatch(h);
    for (const c of [host, guest]) {
      for (const raw of c.raw) {
        expect(raw).not.toMatch(/seed/i);
        expect(raw).not.toContain('987654321');
      }
    }
  });

  it('locks a room to two seats', () => {
    const h = makeHarness();
    const { code } = startedMatch(h);
    const third = h.connect('third-addr');
    h.send(third, { t: 'join_room', code });
    expect(third.last('error').code).toBe('room_full');
  });

  it('says no_such_room for an unknown code', () => {
    const h = makeHarness();
    const c = h.connect();
    h.send(c, { t: 'join_room', code: 'BCDFGH' });
    expect(c.last('error').code).toBe('no_such_room');
  });

  it('refuses game messages from a connection that is not in a room', () => {
    const h = makeHarness();
    const c = h.connect();
    h.send(c, shot(1, 0));
    expect(c.last('error').code).toBe('not_in_room');
  });

  it('rejects the same team for both seats and a rude name', () => {
    const h = makeHarness();
    const host = h.connect('a');
    const guest = h.connect('b');
    h.send(host, { t: 'create_room' });
    h.send(guest, { t: 'join_room', code: host.last('room_created').code });
    h.send(host, { t: 'setup', turn: 0, seq: 1, team: 'PAST', grade: 1, subject: 'math' });
    h.send(guest, { t: 'setup', turn: 0, seq: 1, team: 'PAST', grade: 1, subject: 'math' });
    expect(guest.last('error').code).toBe('team_taken');
    h.send(guest, { t: 'setup', turn: 0, seq: 2, team: 'FUTURE', grade: 1, subject: 'math', name: 'shit' });
    expect(guest.last('error').code).toBe('bad_name');
    expect(host.of('state')).toHaveLength(0);
  });

  it('relays only fixed emotes, and not faster than one every 2 seconds', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(host, { t: 'emote', emote: 'wave' });
    expect(guest.last('emote').emote).toBe('wave');
    h.send(host, { t: 'emote', emote: 'cheer' });
    expect(host.last('error').code).toBe('slow_down');
    h.advance(2100);
    h.send(host, { t: 'emote', emote: 'cheer' });
    expect(guest.of('emote')).toHaveLength(2);
  });

  it('leave closes the room for both', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(host, { t: 'leave' });
    expect(guest.last('room_closed').reason).toBe('left');
    expect(host.closed && guest.closed).toBe(true);
    expect(h.manager.roomCount()).toBe(0);
  });
});

describe('turn authority', () => {
  it('rejects a shot from the player whose turn it is not, and changes nothing', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(guest, shot(2, 0));
    expect(guest.last('error').code).toBe('not_your_turn');
    expect(host.of('shot')).toHaveLength(0);
    expect(host.last('state').shotsFired).toBe(0);
  });

  it('rejects a shot for an old turn', () => {
    const h = makeHarness();
    const { host } = startedMatch(h);
    h.send(host, shot(2, 7));
    expect(host.last('error').code).toBe('stale_turn');
  });

  it('allows exactly two shots, then moves to the reload', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.send(host, shot(3, 0));
    expect(host.last('state').phase).toBe('RELOAD');
    h.send(host, shot(4, 0));
    expect(host.last('error').code).toBe('wrong_phase');
    expect(guest.of('shot')).toHaveLength(2);
  });

  it('rejects an answer when no question is open', () => {
    const h = makeHarness();
    const { host } = startedMatch(h);
    h.send(host, { t: 'answer', turn: 0, seq: 2, choice: 0 });
    expect(host.last('error').code).toBe('wrong_phase');
  });

  it('rejects an answer from the other player during a reload', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.send(host, shot(3, 0));
    h.send(guest, { t: 'answer', turn: 0, seq: 2, choice: 0 });
    expect(guest.last('error').code).toBe('not_your_turn');
    expect(host.last('state').phase).toBe('RELOAD');
  });

  it('rejects a fighter from the other team', () => {
    const h = makeHarness();
    const { host } = startedMatch(h);
    h.send(host, shot(2, 0, { unit: '1' }));
    expect(host.last('error').code).toBe('bad_message');
  });

  it('passes the turn to the other player after a wrong answer', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.send(host, shot(3, 0));
    const q = host.last('question');
    const right = BANK.questions.find((x) => x.prompt === q.prompt)!.answer;
    const wrong = (q.choices as string[]).findIndex((c) => c !== right);
    h.send(host, { t: 'answer', turn: 0, seq: 4, choice: wrong });
    expect(host.last('reload').correct).toBe(false);
    const s = guest.last('state');
    expect(s.activeSeat).toBe(1);
    expect(s.turnNumber).toBe(1);
    expect(s.phase).toBe('AIMING');
  });

  it('gives a Power Shot after a right answer', () => {
    const h = makeHarness();
    const { host } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.send(host, shot(3, 0));
    const q = host.last('question');
    const right = BANK.questions.find((x) => x.prompt === q.prompt)!.answer;
    h.send(host, { t: 'answer', turn: 0, seq: 4, choice: (q.choices as string[]).indexOf(right) });
    expect(host.last('reload').bonus).toBe(true);
    expect(host.last('state').phase).toBe('BONUS_AIMING');
    h.send(host, shot(5, 0));
    expect(host.last('state').activeSeat).toBe(1);
  });
});

describe('idempotency', () => {
  it('treats a repeated key as a replay, not a second shot', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(host, shot(2, 0));
    const first = host.of('shot')[0]!;
    const before = host.raw.length;
    h.send(host, shot(2, 0));
    expect(host.raw.length).toBeGreaterThan(before);
    expect(host.of('shot')[1]).toEqual(first);
    expect(guest.of('shot')).toHaveLength(1); // the peer is told nothing new
    expect(host.last('state').shotsFired).toBe(1);
    expect(h.logs.some(([, e]) => e === 'replay')).toBe(true);
  });

  it('rejects the same seq with different fields', () => {
    const h = makeHarness();
    const { host } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.send(host, shot(2, 0, { power: 99 }));
    expect(host.last('error').code).toBe('key_reused');
    expect(host.last('state').shotsFired).toBe(1);
  });

  it('rejects an old seq (out of order)', () => {
    const h = makeHarness();
    const { host } = startedMatch(h);
    h.send(host, shot(5, 0));
    h.send(host, shot(3, 0));
    expect(host.last('error').code).toBe('stale_seq');
  });

  it('does not use up a seq on a rejected action', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(guest, shot(2, 0)); // out of turn
    h.send(guest, { t: 'emote', emote: 'wave' });
    expect(guest.of('error')).toHaveLength(1);
    expect(host.of('emote')).toHaveLength(1);
    h.send(host, shot(2, 0));
    expect(host.of('shot')).toHaveLength(1);
  });
});

describe('hidden reload question', () => {
  it('never shows the other player the question, choices or answer', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.send(host, shot(3, 0));
    const q = host.last('question');
    const truth = BANK.questions.find((x) => x.prompt === q.prompt)!;

    // The active player gets the question without any answer or id.
    expect(Object.keys(q).sort()).not.toContain('answer');
    expect(Object.keys(q).sort()).not.toContain('id');
    expect(Object.keys(q).sort()).not.toContain('hint');
    expect(host.raw.filter((r) => r.includes('"question"'))).toHaveLength(1);

    // Wrong answer: only the answerer sees the hint.
    const wrong = (q.choices as string[]).findIndex((c) => c !== truth.answer);
    h.send(host, { t: 'answer', turn: 0, seq: 4, choice: wrong });
    if (truth.hint) {
      expect(host.last('reload').hint).toBe(truth.hint);
      expect(guest.last('reload')).not.toHaveProperty('hint');
    }

    // The other player's raw frames hold none of it.
    const all = guest.raw.join('\n');
    expect(guest.of('question')).toHaveLength(0);
    expect(all).not.toContain(truth.prompt);
    expect(all).not.toContain(JSON.stringify(q.choices));
    expect(all).not.toContain(truth.id);
    expect(all).not.toMatch(/"(answer|choices|prompt|passage|audioWord)"/);
    if (truth.hint) expect(all).not.toContain(truth.hint);
  });

  it('resends the open question to the right player after a reconnect', () => {
    const h = makeHarness();
    const { host, guest, code, hostSecret } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.send(host, shot(3, 0));
    const q = host.last('question');
    h.manager.onClose(host);
    const back = h.connect('host-addr');
    h.send(back, { t: 'rejoin', code, seat: 0, secret: hostSecret });
    expect(back.last('question')).toEqual(q);
    expect(guest.of('question')).toHaveLength(0);
  });
});

describe('reconnect', () => {
  it('restores the seat inside the grace period', () => {
    const h = makeHarness();
    const { host, guest, code, hostSecret } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.manager.onClose(host);
    expect(guest.last('peer')).toMatchObject({ event: 'left', graceMs: ROOM.graceMs });
    h.advance(ROOM.graceMs - 5000);
    const back = h.connect('host-addr');
    h.send(back, { t: 'rejoin', code, seat: 0, secret: hostSecret });
    expect(back.last('state').shotsFired).toBe(1);
    expect(guest.last('peer').event).toBe('back');
    h.send(back, shot(3, 0));
    expect(back.last('state').phase).toBe('RELOAD');
  });

  it('refuses a rejoin after the grace period', () => {
    const h = makeHarness();
    const { host, code, hostSecret } = startedMatch(h);
    h.manager.onClose(host);
    h.advance(ROOM.graceMs + 1000);
    const back = h.connect('host-addr');
    h.send(back, { t: 'rejoin', code, seat: 0, secret: hostSecret });
    expect(back.last('error').code).toBe('rejoin_failed');
  });

  it('refuses a wrong secret and a wrong seat the same way', () => {
    const h = makeHarness();
    const { host, code, hostSecret } = startedMatch(h);
    h.manager.onClose(host);
    const evil = h.connect('evil');
    h.send(evil, { t: 'rejoin', code, seat: 0, secret: 'A'.repeat(43) });
    h.send(evil, { t: 'rejoin', code, seat: 1, secret: hostSecret });
    expect(evil.of('error').map((e) => e.code)).toEqual(['rejoin_failed', 'rejoin_failed']);
  });

  it('closes the room for the other player when the grace ends', () => {
    const h = makeHarness();
    const { host, guest } = startedMatch(h);
    h.manager.onClose(host);
    h.advance(ROOM.graceMs - 1000);
    h.manager.sweep();
    expect(h.manager.roomCount()).toBe(1);
    h.advance(2000);
    h.manager.sweep();
    expect(guest.last('room_closed').reason).toBe('gone');
    expect(h.manager.roomCount()).toBe(0);
  });

  it('lets a new socket replace a live one when the secret matches', () => {
    const h = makeHarness();
    const { host, code, hostSecret } = startedMatch(h);
    const fresh = h.connect('host-addr');
    h.send(fresh, { t: 'rejoin', code, seat: 0, secret: hostSecret });
    expect(host.closed).toBe(true);
    expect(fresh.last('state').you).toEqual({ seat: 0, team: 'PAST' });
  });
});

describe('expiry', () => {
  it('closes a room after 2 hours idle', () => {
    const h = makeHarness();
    const { guest } = startedMatch(h);
    h.advance(ROOM.idleMs - 1000);
    h.manager.sweep();
    expect(h.manager.roomCount()).toBe(1);
    h.advance(2000);
    h.manager.sweep();
    expect(guest.last('room_closed').reason).toBe('idle');
    expect(h.manager.roomCount()).toBe(0);
  });

  it('counts a valid message as activity', () => {
    const h = makeHarness();
    const { host } = startedMatch(h);
    h.advance(ROOM.idleMs - 1000);
    h.send(host, shot(2, 0));
    h.advance(ROOM.idleMs - 1000);
    h.manager.sweep();
    expect(h.manager.roomCount()).toBe(1);
  });

  it('frees the code after expiry', () => {
    const h = makeHarness();
    const { code } = startedMatch(h);
    h.advance(ROOM.idleMs + 1000);
    h.manager.sweep();
    const late = h.connect('late');
    h.send(late, { t: 'join_room', code });
    expect(late.last('error').code).toBe('no_such_room');
  });
});

describe('limits and abuse', () => {
  it('slows a flood and closes the socket after repeated strikes', () => {
    const h = makeHarness();
    const c = h.connect();
    for (let i = 0; i < 40; i++) h.manager.onMessage(c, JSON.stringify({ v: 1, t: 'ping' }));
    expect(c.of('error').some((e) => e.code === 'slow_down')).toBe(true);
    expect(c.closed).toBe(true);
  });

  it('allows a normal burst', () => {
    const h = makeHarness();
    const c = h.connect();
    for (let i = 0; i < 8; i++) h.manager.onMessage(c, JSON.stringify({ v: 1, t: 'ping' }));
    expect(c.of('error')).toHaveLength(0);
  });

  it('blocks an address after 10 failed joins', () => {
    const h = makeHarness();
    const c = h.connect('guesser');
    for (let i = 0; i < 10; i++) h.send(c, { t: 'join_room', code: 'BCDFGH' });
    expect(c.of('error').filter((e) => e.code === 'no_such_room')).toHaveLength(10);
    const other = h.connect('guesser'); // a new socket, same address
    const real = h.connect('host');
    h.send(real, { t: 'create_room' });
    h.send(other, { t: 'join_room', code: real.last('room_created').code });
    expect(other.last('error').code).toBe('slow_down');
    h.advance(11 * 60 * 1000);
    h.send(other, { t: 'join_room', code: real.last('room_created').code });
    expect(other.last('room_joined').seat).toBe(1);
  });

  it('limits new rooms per address', () => {
    const h = makeHarness();
    for (let i = 0; i < 10; i++) h.send(h.connect('maker'), { t: 'create_room' });
    const c = h.connect('maker');
    h.send(c, { t: 'create_room' });
    expect(c.last('error').code).toBe('slow_down');
  });

  it('closes a connection that keeps breaking rules', () => {
    const h = makeHarness();
    const { guest } = startedMatch(h);
    for (let i = 0; i < 14; i++) h.send(guest, shot(2, 0));
    expect(guest.closed).toBe(true);
  });

  it('answers garbage with an error, never a crash', () => {
    const h = makeHarness();
    const c = h.connect();
    for (const raw of ['', '{', '[]', 'null', '{"v":1,"t":"nope"}', 'x'.repeat(5000)]) {
      h.manager.onMessage(c, raw);
    }
    expect(c.of('error').length).toBe(6);
  });
});

describe('logs', () => {
  it('hold only a room code and an event type, never names, secrets or questions', () => {
    const h = makeHarness();
    const { host, guest, code, hostSecret, guestSecret } = startedMatch(h);
    h.send(host, shot(2, 0));
    h.send(host, shot(2, 0));
    h.send(guest, shot(3, 0));
    h.send(host, shot(3, 0));
    h.manager.onClose(host);
    expect(h.logs.length).toBeGreaterThan(5);
    for (const [room, event] of h.logs) {
      expect(room === '-' || room === code).toBe(true);
      expect(event).toMatch(/^[a-z_]+(:[a-z_]+)?$/);
    }
    const text = JSON.stringify(h.logs);
    for (const secret of [hostSecret, guestSecret, 'Ana', 'host-addr', 'guest-addr']) {
      expect(text).not.toContain(secret);
    }
  });
});
