import { describe, expect, it } from 'vitest';
import { validateName } from '../../src/game/names';

describe('validateName', () => {
  it('accepts and trims a normal name', () => {
    expect(validateName('  Alex ')).toEqual({ ok: true, name: 'Alex' });
    expect(validateName('Sam')).toEqual({ ok: true, name: 'Sam' });
  });
  it('rejects empty and whitespace-only', () => {
    expect(validateName('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateName('    ')).toEqual({ ok: false, reason: 'empty' });
  });
  it('accepts exactly 12 characters, rejects 13', () => {
    expect(validateName('abcdefghijkl')).toEqual({ ok: true, name: 'abcdefghijkl' });
    expect(validateName('abcdefghijklm')).toEqual({ ok: false, reason: 'too_long' });
  });
  it('measures length after trimming', () => {
    expect(validateName('   abcdefghijkl   ')).toEqual({ ok: true, name: 'abcdefghijkl' });
  });
  it('accepts a single character', () => {
    expect(validateName('A')).toEqual({ ok: true, name: 'A' });
  });
  it('blocks rude and scary words, any case', () => {
    for (const bad of ['Butt Head', 'KILLER', 'Blood', 'dead guy', 'sh1t']) {
      expect(validateName(bad)).toEqual({ ok: false, reason: 'blocked' });
    }
  });
  it('does not block innocent names that contain short blocked letters (Scunthorpe)', () => {
    for (const ok of ['Cassie', 'Hellen', 'Dieter', 'Skylar', 'Classy']) {
      expect(validateName(ok).ok).toBe(true);
    }
  });
  it('rejects non-strings gracefully as empty', () => {
    expect(validateName(undefined as unknown as string)).toEqual({ ok: false, reason: 'empty' });
  });
});
