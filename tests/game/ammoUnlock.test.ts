// Unlocking special ammo with Scrap at the Camp, and taking it into a match.
import { describe, expect, it } from 'vitest';
import { ammoCost } from '../../src/game/ammo';
import { addScrap, unlockAmmo } from '../../src/game/economy';
import { freshCamp, matchAmmoFor, walletOf, type CampState } from '../../src/game/loadout';

const rich = (scrap: number): CampState => addScrap(freshCamp(), 'Alex', scrap);

describe('unlockAmmo', () => {
  it('pays the cost once and owns the kind for that side only', () => {
    const out = unlockAmmo(rich(30), 'Alex', 'PAST', 'confetti');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const w = walletOf(out.camp, 'alex');
    expect(w.scrap).toBe(30 - ammoCost('confetti'));
    expect(w.loadout.PAST.ammo).toEqual(['confetti']);
    expect(w.loadout.FUTURE.ammo ?? []).toEqual([]);
  });

  it('refuses a second unlock of the same kind (no double charge)', () => {
    const first = unlockAmmo(rich(30), 'Alex', 'PAST', 'confetti');
    if (!first.ok) throw new Error('first unlock failed');
    const again = unlockAmmo(first.camp, 'Alex', 'PAST', 'confetti');
    expect(again).toEqual({ ok: false, reason: 'already_owned' });
    expect(walletOf(first.camp, 'Alex').scrap).toBe(30 - ammoCost('confetti'));
  });

  it('refuses when there is not enough Scrap, and changes nothing', () => {
    const camp = rich(ammoCost('bowling') - 1);
    expect(unlockAmmo(camp, 'Alex', 'FUTURE', 'bowling')).toEqual({
      ok: false,
      reason: 'not_enough_scrap',
    });
  });

  it('refuses Standard, junk ids, bad teams and empty names', () => {
    const camp = rich(100);
    expect(unlockAmmo(camp, 'Alex', 'PAST', 'standard')).toEqual({ ok: false, reason: 'unknown' });
    expect(unlockAmmo(camp, 'Alex', 'PAST', 'nope' as never)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(unlockAmmo(camp, 'Alex', 'MIDDLE' as never, 'plasma')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(unlockAmmo(camp, '  ', 'PAST', 'plasma')).toEqual({ ok: false, reason: 'unknown' });
  });

  it('never changes the camp it is given', () => {
    const camp = rich(50);
    const before = JSON.stringify(camp);
    unlockAmmo(camp, 'Alex', 'PAST', 'plasma');
    expect(JSON.stringify(camp)).toBe(before);
  });
});

describe('matchAmmoFor', () => {
  it('takes each player’s owned kinds for the side they play', () => {
    let camp = addScrap(rich(100), 'Sam', 100);
    const a = unlockAmmo(camp, 'Alex', 'PAST', 'plasma');
    if (!a.ok) throw new Error('unlock failed');
    camp = a.camp;
    const b = unlockAmmo(camp, 'Sam', 'FUTURE', 'bowling');
    if (!b.ok) throw new Error('unlock failed');
    camp = b.camp;
    expect(matchAmmoFor(camp, { PAST: 'Alex', FUTURE: 'Sam' })).toEqual({
      PAST: ['plasma'],
      FUTURE: ['bowling'],
    });
    // Alex's Future kit has nothing.
    expect(matchAmmoFor(camp, { PAST: 'Sam', FUTURE: 'Alex' })).toEqual({ PAST: [], FUTURE: [] });
  });
});
