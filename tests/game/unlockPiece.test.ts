// Unlocking a base-builder piece spends Scrap through the same rules as every other purchase.
import { describe, expect, it } from 'vitest';
import { unlockPiece } from '../../src/game/economy';
import { walletOf } from '../../src/game/loadout';
import { BASE_BUILDER as B } from '../../src/game/config';
import { campWith } from '../helpers/camp';

describe('unlockPiece', () => {
  it('spends the Scrap and keeps the piece', () => {
    const out = unlockPiece(campWith(10), 'Alex', 'PAST', 'arch');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const w = walletOf(out.camp, 'Alex');
    expect(w.scrap).toBe(10 - (B.pieceScrap.arch as number));
    expect(w.loadout.PAST.pieces).toEqual(['arch']);
    expect(w.loadout.FUTURE.pieces).toBeUndefined();
    expect(walletOf(out.camp, 'Sam').scrap).toBe(0);
  });
  it('is idempotent: a second try pays nothing and keeps one copy', () => {
    const first = unlockPiece(campWith(30), 'Alex', 'PAST', 'arch');
    if (!first.ok) throw new Error('first');
    expect(unlockPiece(first.camp, 'Alex', 'PAST', 'arch')).toEqual({
      ok: false,
      reason: 'already_owned',
    });
    expect(walletOf(first.camp, 'Alex').loadout.PAST.pieces).toEqual(['arch']);
  });
  it('never goes below zero Scrap and changes nothing when short', () => {
    const camp = campWith(5);
    expect(unlockPiece(camp, 'Alex', 'PAST', 'arch')).toEqual({
      ok: false,
      reason: 'not_enough_scrap',
    });
    expect(walletOf(camp, 'Alex').scrap).toBe(5);
    const exact = unlockPiece(campWith(B.pieceScrap.flag as number), 'Alex', 'PAST', 'flag');
    expect(exact.ok && walletOf(exact.camp, 'Alex').scrap).toBe(0);
  });
  it('refuses free pieces, the other team, unknown ids, and bad names', () => {
    const camp = campWith(100, 100);
    expect(unlockPiece(camp, 'Alex', 'PAST', 'stone')).toEqual({
      ok: false,
      reason: 'already_owned',
    });
    expect(unlockPiece(camp, 'Alex', 'PAST', 'laserBase')).toEqual({
      ok: false,
      reason: 'wrong_team',
    });
    expect(unlockPiece(camp, 'Alex', 'PAST', 'nope')).toEqual({ ok: false, reason: 'unknown' });
    expect(unlockPiece(camp, '   ', 'PAST', 'arch')).toEqual({ ok: false, reason: 'unknown' });
    expect(unlockPiece(camp, 'Alex', 'NOPE' as never, 'arch')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(walletOf(camp, 'Alex').scrap).toBe(100);
  });
  it('each side keeps its own unlocked pieces', () => {
    const a = unlockPiece(campWith(50, 50), 'Sam', 'FUTURE', 'powerCore');
    if (!a.ok) throw new Error('a');
    expect(walletOf(a.camp, 'Sam').loadout.FUTURE.pieces).toEqual(['powerCore']);
    expect(walletOf(a.camp, 'Sam').loadout.PAST.pieces).toBeUndefined();
  });
});
