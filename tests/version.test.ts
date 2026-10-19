import { describe, expect, it } from 'vitest';
import { resolveVersion } from '../scripts/version';

describe('resolveVersion', () => {
  it('uses GITHUB_SHA when set', () => {
    expect(resolveVersion({ GITHUB_SHA: 'abc123' })).toBe('abc123');
  });
  it('uses the Railway commit when GITHUB_SHA is not set', () => {
    expect(resolveVersion({ RAILWAY_GIT_COMMIT_SHA: 'def456' })).toBe('def456');
    expect(resolveVersion({ GITHUB_SHA: 'abc', RAILWAY_GIT_COMMIT_SHA: 'def' })).toBe('abc');
    expect(resolveVersion({ GITHUB_SHA: ' ', RAILWAY_GIT_COMMIT_SHA: 'def' })).toBe('def');
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
