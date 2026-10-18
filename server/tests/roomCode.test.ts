import { describe, expect, it } from 'vitest';
import {
  ALPHABET,
  CODE_BITS,
  CODE_LENGTH,
  generateRoomCode,
  isRude,
  isValidCode,
  SYMBOLS,
} from '../src/roomCode';

describe('room code space', () => {
  it('has 32 symbols, 6 long, at least 30 bits', () => {
    expect(SYMBOLS).toHaveLength(32);
    expect(new Set(ALPHABET).size).toBe(32);
    expect(new Set(SYMBOLS.map((s) => s.animal)).size).toBe(32);
    expect(CODE_LENGTH).toBe(6);
    expect(CODE_BITS).toBeGreaterThanOrEqual(30);
  });
  it('leaves out look-alike characters', () => {
    for (const c of ['0', 'O', '1', 'I']) expect(ALPHABET.includes(c)).toBe(false);
  });
});

describe('generateRoomCode', () => {
  it('makes valid codes', () => {
    for (let i = 0; i < 200; i++) expect(isValidCode(generateRoomCode(() => false))).toBe(true);
  });
  it('is unique across many draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateRoomCode((c) => seen.has(c)));
    expect(seen.size).toBe(5000);
  });
  it('skips a code that is taken', () => {
    let calls = 0;
    const idx = (): number => (calls++ < CODE_LENGTH ? 0 : 1);
    const first = ALPHABET[0]!.repeat(CODE_LENGTH);
    const code = generateRoomCode((c) => c === first, idx);
    expect(code).not.toBe(first);
  });
  it('skips a rude draw and tries again', () => {
    const rude = [...'BUTT2A'].map((c) => ALPHABET.indexOf(c));
    let calls = 0;
    const idx = (): number => (calls < rude.length ? rude[calls++]! : 0);
    const code = generateRoomCode(() => false, idx);
    expect(code).toBe(ALPHABET[0]!.repeat(CODE_LENGTH));
  });
  it('catches digit tricks', () => {
    expect(isRude('BUTT2A')).toBe(true);
    expect(isRude('K3LLBC')).toBe(false);
    expect(isRude('DE4DBC')).toBe(true); // dead
    expect(isRude('BCDFGH')).toBe(false);
  });
  it('throws if it cannot find a free code', () => {
    expect(() => generateRoomCode(() => true)).toThrow();
  });
});

describe('isValidCode', () => {
  it('checks length and alphabet', () => {
    expect(isValidCode('BCDFGH')).toBe(true);
    expect(isValidCode('BCDFG')).toBe(false);
    expect(isValidCode('BCDFGHJ')).toBe(false);
    expect(isValidCode('BCDFG0')).toBe(false);
    expect(isValidCode('bcdfgh')).toBe(false);
  });
});
