import { describe, expect, it } from 'vitest';
import { resolveVersion } from '../scripts/version';

describe('resolveVersion', () => {
  it('uses GITHUB_SHA when set', () => {
    expect(resolveVersion({ GITHUB_SHA: 'abc123' })).toBe('abc123');
  });
  it('falls back to "dev" when unset', () => {
    expect(resolveVersion({})).toBe('dev');
  });
  it('falls back to "dev" when blank', () => {
    expect(resolveVersion({ GITHUB_SHA: '   ' })).toBe('dev');
  });
  it('trims whitespace around the sha', () => {
    expect(resolveVersion({ GITHUB_SHA: ' abc \n' })).toBe('abc');
  });
});
