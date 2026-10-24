// @vitest-environment jsdom
// The length a parent saved at Setup reaches the match. Nothing saved means today's balance.
import { describe, expect, it } from 'vitest';
import { buildBattleData } from '../../src/scenes/battleData';
import { makeServices, players, tinyBank } from './fakes';

const start = (saved?: unknown, own?: 'short' | 'long') => {
  const t = makeServices();
  if (saved !== undefined) t.storage.set('timeclash.matchLength', saved as never);
  const data = buildBattleData(t.services, { players, seed: 3, matchLength: own }, tinyBank);
  return data.match.snapshot().maxBaseHp.PAST;
};

describe('match length reaches the match', () => {
  it('Normal when nothing is saved', () => expect(start()).toBe(100));
  it('uses the saved Short and Long', () => {
    expect(start('short')).toBe(50);
    expect(start('long')).toBe(150);
  });
  it('treats a junk saved value as Normal', () => expect(start('epic')).toBe(100));
  it('a setup that names its own length wins', () => expect(start('long', 'short')).toBe(50));
});
