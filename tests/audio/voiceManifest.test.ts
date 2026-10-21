import { describe, expect, it } from 'vitest';
import { clipId } from '../../src/audio/clipId';
import { spokenText } from '../../src/questions/spoken';
import { ALL_BARKS, buildManifest, loadQuestions, parseGrades } from '../../scripts/voice-manifest';

const qs = loadQuestions(0, 4);
const manifest = buildManifest(qs, ALL_BARKS);

describe('voice manifest (grades K to 4)', () => {
  it('has stable counts', () => {
    expect(qs.length).toBeGreaterThan(300);
    expect(manifest.filter((e) => e.kind === 'bark')).toHaveLength(30);
    expect(manifest.filter((e) => e.kind === 'question').length).toBeGreaterThan(300);
    expect(new Set(manifest.map((e) => e.id)).size).toBe(manifest.length);
  });
  it('has no empty text, and every id matches its text', () => {
    for (const e of manifest) {
      expect(e.text.trim()).not.toBe('');
      expect(e.spoken.trim()).not.toBe('');
      expect(e.id).toBe(clipId(e.text));
    }
  });
  it('holds the exact text the reload card speaks for every question', () => {
    const ids = new Set(manifest.map((e) => e.id));
    for (const q of qs) expect(ids.has(clipId(spokenText(q)))).toBe(true);
  });
  it('holds every wipeout line', () => {
    const ids = new Set(manifest.map((e) => e.id));
    for (const l of ALL_BARKS) expect(ids.has(clipId(l))).toBe(true);
  });
  it('fails loudly on an id collision', () => {
    const q = qs[0]!;
    expect(() => buildManifest([q], [''])).toThrow(/empty/);
  });
  it('parses grade ranges', () => {
    expect(parseGrades('0-4')).toEqual([0, 4]);
    expect(parseGrades('5-12')).toEqual([5, 12]);
    expect(parseGrades('all')).toEqual([0, 12]);
    expect(() => parseGrades('9-3')).toThrow();
  });
});
