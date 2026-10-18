import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, parseClientMessage } from '../src/protocol';

const j = (o: unknown): string => JSON.stringify(o);
const fire = { v: 1, t: 'fire', turn: 0, seq: 1, angleDeg: 45, power: 60 };

describe('parseClientMessage: valid messages', () => {
  it('accepts create_room and ping with no fields', () => {
    expect(parseClientMessage(j({ v: 1, t: 'create_room' }))).toEqual({
      ok: true,
      msg: { v: 1, t: 'create_room' },
    });
    expect(parseClientMessage(j({ v: 1, t: 'ping' })).ok).toBe(true);
  });
  it('accepts join_room with a good code', () => {
    expect(parseClientMessage(j({ v: 1, t: 'join_room', code: 'BCDFGH' })).ok).toBe(true);
  });
  it('accepts fire with and without a unit', () => {
    expect(parseClientMessage(j(fire)).ok).toBe(true);
    expect(parseClientMessage(j({ ...fire, unit: 'C' })).ok).toBe(true);
  });
  it('accepts setup with an optional name', () => {
    const setup = { v: 1, t: 'setup', turn: 0, seq: 1, team: 'PAST', grade: 3, subject: 'math' };
    expect(parseClientMessage(j(setup)).ok).toBe(true);
    expect(parseClientMessage(j({ ...setup, name: 'Ana' })).ok).toBe(true);
  });
  it('accepts answer, rematch, emote, leave and rejoin', () => {
    expect(parseClientMessage(j({ v: 1, t: 'answer', turn: 2, seq: 3, choice: 3 })).ok).toBe(true);
    expect(parseClientMessage(j({ v: 1, t: 'rematch', turn: 9, seq: 4 })).ok).toBe(true);
    expect(parseClientMessage(j({ v: 1, t: 'emote', emote: 'wave' })).ok).toBe(true);
    expect(parseClientMessage(j({ v: 1, t: 'leave' })).ok).toBe(true);
    const secret = 'A'.repeat(43);
    expect(parseClientMessage(j({ v: 1, t: 'rejoin', code: 'BCDFGH', seat: 1, secret })).ok).toBe(
      true,
    );
  });
});

describe('parseClientMessage: rejects bad input', () => {
  const bad = (raw: string): string => {
    const r = parseClientMessage(raw);
    return r.ok ? 'ok' : r.code;
  };
  it('rejects non-JSON, arrays, null and primitives', () => {
    for (const raw of ['', '{', 'nope', '[]', 'null', '7', '"x"']) {
      expect(bad(raw)).toBe('bad_message');
    }
  });
  it('rejects a wrong or missing version', () => {
    expect(bad(j({ t: 'ping' }))).toBe('bad_message');
    expect(bad(j({ v: 2, t: 'ping' }))).toBe('bad_message');
    expect(bad(j({ v: '1', t: 'ping' }))).toBe('bad_message');
  });
  it('rejects an oversize frame before parsing', () => {
    const big = j({ v: 1, t: 'ping', pad: 'x'.repeat(MAX_MESSAGE_BYTES) });
    expect(bad(big)).toBe('too_big');
  });
  it('counts bytes, not characters', () => {
    const wide = j({ v: 1, t: 'setup', name: '€'.repeat(400) });
    expect(bad(wide)).toBe('too_big');
  });
  it('rejects an unknown type', () => {
    expect(bad(j({ v: 1, t: 'drop_table' }))).toBe('unknown_type');
    expect(bad(j({ v: 1, t: 5 }))).toBe('bad_message');
    expect(bad(j({ v: 1, t: 'toString' }))).toBe('unknown_type');
  });
  it('rejects unknown fields, including __proto__', () => {
    expect(bad(j({ ...fire, extra: 1 }))).toBe('bad_message');
    expect(bad('{"v":1,"t":"ping","__proto__":{"x":1}}')).toBe('bad_message');
  });
  it('rejects missing and wrongly typed fields', () => {
    expect(bad(j({ v: 1, t: 'fire', turn: 0, seq: 1, angleDeg: 45 }))).toBe('bad_message');
    expect(bad(j({ ...fire, power: '60' }))).toBe('bad_message');
    expect(bad(j({ ...fire, seq: 1.5 }))).toBe('bad_message');
    expect(bad(j({ ...fire, seq: -1 }))).toBe('bad_message');
    expect(bad(j({ ...fire, unit: 'Z' }))).toBe('bad_message');
  });
  it('rejects non-finite and huge numbers', () => {
    expect(bad('{"v":1,"t":"fire","turn":0,"seq":1,"angleDeg":1e999,"power":1}')).toBe(
      'bad_message',
    );
    expect(bad(j({ ...fire, power: 1e9 }))).toBe('bad_message');
    expect(bad(j({ ...fire, seq: 2 ** 40 }))).toBe('bad_message');
  });
  it('rejects bad codes, seats, choices, grades, teams and emotes', () => {
    expect(bad(j({ v: 1, t: 'join_room', code: 'ABC' }))).toBe('bad_message');
    expect(bad(j({ v: 1, t: 'join_room', code: 'bcdfgh' }))).toBe('bad_message');
    expect(bad(j({ v: 1, t: 'join_room', code: 'IIIIII' }))).toBe('bad_message');
    expect(bad(j({ v: 1, t: 'answer', turn: 0, seq: 1, choice: 4 }))).toBe('bad_message');
    expect(bad(j({ v: 1, t: 'answer', turn: 0, seq: 1, choice: '1' }))).toBe('bad_message');
    expect(
      bad(j({ v: 1, t: 'setup', turn: 0, seq: 1, team: 'PAST', grade: 13, subject: 'math' })),
    ).toBe('bad_message');
    expect(
      bad(j({ v: 1, t: 'setup', turn: 0, seq: 1, team: 'RED', grade: 1, subject: 'math' })),
    ).toBe('bad_message');
    expect(bad(j({ v: 1, t: 'emote', emote: 'hello friend' }))).toBe('bad_message');
    expect(bad(j({ v: 1, t: 'rejoin', code: 'BCDFGH', seat: 2, secret: 'A'.repeat(43) }))).toBe(
      'bad_message',
    );
  });
  it('rejects a name that is too long or not a string', () => {
    const setup = { v: 1, t: 'setup', turn: 0, seq: 1, team: 'PAST', grade: 3, subject: 'math' };
    expect(bad(j({ ...setup, name: 'x'.repeat(13) }))).toBe('bad_message');
    expect(bad(j({ ...setup, name: 5 }))).toBe('bad_message');
  });
});
