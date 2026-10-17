// Setup uses src/ui/nameBlocklist.ts. The game rules use src/game/names.ts. A name the rules
// refuse must also be refused at Setup, so a child sees the kind message and not a silent fail.
// The game list is private to names.ts, so this test reads its source and also probes it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateName } from '../../src/game/names';
import { isBlockedName } from '../../src/ui/nameBlocklist';
import { validatePlayerName } from '../../src/ui/setupForm';

const source = readFileSync(new URL('../../src/game/names.ts', import.meta.url), 'utf8');
const quoted = (block: RegExp): string[] => {
  const body = block.exec(source)?.[1] ?? '';
  return [...body.matchAll(/'([a-z]+)'/g)].map((m) => m[1] as string);
};
const wholeWords = quoted(/BLOCKED_WORDS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/);
const anywhere = quoted(/BLOCKED_ANYWHERE[^=]*=\s*\[([\s\S]*?)\]/);

describe('Setup name list covers the game rules list', () => {
  it('found the words in names.ts (the parse is not empty)', () => {
    expect(wholeWords.length).toBeGreaterThanOrEqual(20);
    expect(anywhere.length).toBeGreaterThanOrEqual(3);
  });

  it.each(wholeWords)('refuses "%s", as the game rules do', (word) => {
    expect(validateName(word).ok).toBe(false);
    expect(isBlockedName(word)).toBe(true);
    expect(validatePlayerName(word).ok).toBe(false);
  });

  it.each(wholeWords)('refuses "%s" in capitals and with a trailing space', (word) => {
    expect(isBlockedName(` ${word.toUpperCase()} `)).toBe(true);
  });

  it.each(anywhere)('refuses "%s" inside a longer name', (word) => {
    expect(validateName(`x${word}x`).ok).toBe(false);
    expect(isBlockedName(`x${word}x`)).toBe(true);
  });

  it('agrees on the shared leet-speak tricks', () => {
    for (const name of ['p00p', 'f4rt', 'bu77', 'DuMb']) {
      expect(validateName(name).ok, name).toBe(false);
      expect(isBlockedName(name), name).toBe(true);
    }
  });

  it('still lets ordinary names through', () => {
    for (const name of ['Alex', 'Sam', 'Cassie', 'Dieter', 'Buttercup', 'Peeta', 'Hellen']) {
      expect(isBlockedName(name), name).toBe(false);
    }
  });
});
