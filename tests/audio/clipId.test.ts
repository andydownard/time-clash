import { describe, expect, it } from 'vitest';
import { clipId } from '../../src/audio/clipId';

describe('clipId', () => {
  it.each([
    ['I meant to do that!', 't:8b53121ff423c149'],
    ['What is 7 x 8?', 't:a080310abdfed25d'],
    ['  Welcome  to\nTime Clash! ', 't:8f4dfc255e14fe8f'],
    ['', 't:cbf29ce484222325'],
  ])('%j -> %s', (text, id) => {
    expect(clipId(text)).toBe(id);
  });
  it('ignores extra whitespace and hashes UTF-8 bytes', () => {
    expect(clipId('a   b')).toBe(clipId('a b'));
    expect(clipId('café')).not.toBe(clipId('cafe'));
  });
});
