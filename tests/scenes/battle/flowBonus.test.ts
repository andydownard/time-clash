// The Power Shot inside the battle loop: a right answer earns one extra shot, a wrong one does not.
import { describe, expect, it } from 'vitest';
import { BONUS } from '../../../src/game/config';
import { findAim, makeWorld, settle } from './flowHarness';

const SEED = 7;

describe('BattleFlow: the Power Shot', () => {
  it('a right answer is followed by a POWER banner and one more flight, then the pass', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss, miss], answers: ['right'] });
    void w.flow.run();
    await settle();
    const order = w.log.filter((l) => /^(pass|banner|fly|reload)/.test(l));
    expect(order.slice(0, 9)).toEqual([
      'pass:PAST',
      'banner:Alex:1',
      'fly:PAST',
      'banner:Alex:2',
      'fly:PAST',
      'reload:PAST',
      'banner:Alex:POWER',
      'fly:PAST',
      'pass:FUTURE',
    ]);
    const snap = w.match.snapshot();
    expect(snap.stats.PAST.shotsFired).toBe(3);
    expect(snap.turn.shotsFired).toBeLessThanOrEqual(2);
  });

  it('the HUD shows the bonus only while the Power Shot is up', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss, miss], answers: ['right'] });
    void w.flow.run();
    await settle();
    const bonusStates = w.hudStates.filter((s) => s.bonus);
    expect(bonusStates.length).toBeGreaterThan(0);
    expect(bonusStates.every((s) => s.activeTeam === 'PAST')).toBe(true);
    expect(bonusStates.some((s) => s.canFire)).toBe(true);
    // Never during the two normal shots.
    const firstBonus = w.hudStates.findIndex((s) => s.bonus);
    expect(w.hudStates.slice(0, firstBonus).every((s) => !s.bonus)).toBe(true);
  });

  it('a wrong answer gets no Power Shot and play goes on to the other team', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss], answers: ['wrong'] });
    void w.flow.run();
    await settle();
    expect(w.log.some((l) => l.endsWith(':POWER'))).toBe(false);
    expect(w.hudStates.some((s) => s.bonus)).toBe(false);
    expect(w.match.snapshot().stats.PAST.shotsFired).toBe(2);
    expect(w.log).toContain('pass:FUTURE');
  });

  it('a Power Shot hit does the boosted damage', async () => {
    const direct = findAim(SEED, 0, 'PAST', 'direct');
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss, direct], answers: ['right'] });
    void w.flow.run();
    await settle();
    expect(w.match.snapshot().baseHp.FUTURE).toBe(100 - Math.round(25 * BONUS.damageMultiplier));
  });
});
