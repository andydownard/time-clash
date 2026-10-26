import { describe, expect, it } from 'vitest';
import { clipId } from '../../src/audio/clipId';
import { ALL_BARKS, buildManifest, parseGrades } from '../../scripts/voice-manifest';

const manifest = buildManifest(ALL_BARKS);

describe('voice manifest (Chrono wipeout lines only)', () => {
  it('has stable counts and only wipeout lines', () => {
    // 42 wipeout lines and 24 base fall lines.
    expect(manifest.filter((e) => e.kind === 'bark')).toHaveLength(66);
    expect(manifest).toHaveLength(66);
    expect(new Set(manifest.map((e) => e.id)).size).toBe(manifest.length);
  });
  it('has no empty text, and every id matches its text', () => {
    for (const e of manifest) {
      expect(e.text.trim()).not.toBe('');
      expect(e.spoken.trim()).not.toBe('');
      expect(e.id).toBe(clipId(e.text));
    }
  });
  it('holds every wipeout line', () => {
    const ids = new Set(manifest.map((e) => e.id));
    for (const l of ALL_BARKS) expect(ids.has(clipId(l))).toBe(true);
  });
  it('fails loudly on an empty line', () => {
    expect(() => buildManifest([''])).toThrow(/empty/);
  });
  it('parses grade ranges', () => {
    expect(parseGrades('0-4')).toEqual([0, 4]);
    expect(parseGrades('5-12')).toEqual([5, 12]);
    expect(parseGrades('all')).toEqual([0, 12]);
    expect(() => parseGrades('9-3')).toThrow();
  });
});
