// Built bases in the battle flow: after the blast, the view redraws the hit side's bricks and
// plays the crumble of the ones that fell. Never under a cover. A side with no built base never
// gets a brick call.
import { describe, expect, it } from 'vitest';
import { createMatch } from '../../../src/game/match';
import type { AimInput, MatchOptions } from '../../../src/game/types';
import { HUGE, TYPICAL, baseOf, brick } from '../../helpers/builtBases';
import { PLAYERS, QUICK_END, findAim, makeWorld, settle } from './flowHarness';

const SEED = 7;

const opts = (bases: MatchOptions['bases']): Partial<MatchOptions> => ({
  characterHealth: false,
  baseInBattle: true,
  squads: false,
  bases,
});

/** An aim for Team Past's first shot that lands on a Future brick (and what it did). */
function brickAim(bases: MatchOptions['bases'], fall: boolean): AimInput {
  for (let power = 100; power >= 20; power -= 2) {
    for (let angleDeg = 5; angleDeg <= 85; angleDeg += 1) {
      const m = createMatch({ players: PLAYERS, seed: SEED, disturbances: false, ...opts(bases) });
      m.ready();
      m.setAim({ angleDeg, power });
      m.fire();
      const out = m.shotLanded();
      const hits = out.built?.brickHits.length ?? 0;
      const fell = out.built?.bricksFell.length ?? 0;
      if (hits > 0 && (fall ? fell > 0 : fell === 0)) return { angleDeg, power };
    }
  }
  throw new Error('no brick aim');
}

describe('BattleFlow with a built base', () => {
  it('a hit brick is redrawn after the blast, with no crumble when nothing fell', async () => {
    const bases = { FUTURE: HUGE('FUTURE') };
    const hit = brickAim(bases, false);
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [hit, miss], matchOptions: opts(bases) });
    void w.flow.run();
    await settle();
    expect(w.brickPlays[0]).toMatchObject({ team: 'FUTURE', fell: [] });
    const i = w.log.indexOf('bricks:FUTURE:0');
    expect(w.log.lastIndexOf('impact:direct', i)).toBeGreaterThan(-1);
    expect(w.coverViolations).toEqual([]);
    // The HUD number is the brick total the rules keep.
    const last = w.hudStates[w.hudStates.length - 1]!;
    expect(last.baseHp.FUTURE).toBe(w.match.snapshot().baseHp.FUTURE);
    expect(last.maxBaseHp?.FUTURE).toBe(w.match.snapshot().maxBaseHp.FUTURE);
    w.flow.destroy();
  });

  it('a brick that falls is handed to the view in the rules order, with what it held up', async () => {
    // One glass-thin brick in front holding one on top: a Short match makes one hit enough.
    const bases = {
      FUTURE: baseOf([
        brick('panel', 16, 10, 20),
        brick('panel', 16, 9, 20),
        brick('beam', 4, 10, 50),
      ]),
    };
    const o = { ...opts(bases), matchLength: 'short' as const };
    let aim: AimInput | null = null;
    for (let power = 100; power >= 20 && !aim; power -= 2) {
      for (let angleDeg = 5; angleDeg <= 85 && !aim; angleDeg += 1) {
        const m = createMatch({ players: PLAYERS, seed: SEED, disturbances: false, ...o });
        m.ready();
        m.setAim({ angleDeg, power });
        m.fire();
        if ((m.shotLanded().built?.bricksFell.length ?? 0) > 0) aim = { angleDeg, power };
      }
    }
    // A small top brick falls when hit; any fall is enough to check the hand-off.
    if (!aim) aim = brickAim(bases, true);
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [aim, miss], matchOptions: o });
    void w.flow.run();
    await settle();
    const play = w.brickPlays.find((p) => p.fell.length > 0)!;
    expect(play.team).toBe('FUTURE');
    const snap = w.match.snapshot();
    for (const id of play.fell) expect(snap.bricks![id as `FUTURE:${number}`]!.alive).toBe(false);
    w.flow.destroy();
  });

  it('the result names each side whose built base lost bricks, for the Victory line', async () => {
    // A built base takes many turns to wear down, so the match ends on quick health and the
    // snapshot at the end carries one knocked-out Future brick (crumbledTeams reads real rules
    // in tests/game/crumbled.test.ts).
    const direct = findAim(SEED, 0, 'PAST', 'direct');
    const w = makeWorld({
      seed: SEED,
      script: Array(12).fill(direct),
      answers: Array(6).fill('right'),
      matchOptions: QUICK_END,
    });
    const real = w.match.snapshot.bind(w.match);
    const fallen = {
      team: 'FUTURE' as const,
      piece: 'panel',
      hp: 0,
      maxHp: 20,
      box: { x: 0, y: 0, w: 1, h: 1 },
      alive: false,
    };
    w.match.snapshot = () => {
      const m = real();
      return m.status === 'OVER' ? { ...m, bricks: { 'FUTURE:0': fallen } } : m;
    };
    void w.flow.run();
    await settle();
    expect(w.results).toHaveLength(1);
    expect(w.results[0]!.winner).toBe('PAST');
    expect(w.results[0]!.crumbled).toEqual(['FUTURE']);
    w.flow.destroy();
  });

  it('a match with no built base finishes with nothing crumbled', async () => {
    const direct = findAim(SEED, 0, 'PAST', 'direct');
    const w = makeWorld({
      seed: SEED,
      script: Array(12).fill(direct),
      answers: Array(6).fill('right'),
      matchOptions: QUICK_END,
    });
    void w.flow.run();
    await settle();
    expect(w.results).toHaveLength(1);
    expect(w.results[0]!.crumbled).toEqual([]);
    w.flow.destroy();
  });

  it('no built base: the view never gets a brick call', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const direct = findAim(SEED, 0, 'PAST', 'direct');
    const w = makeWorld({ seed: SEED, script: [direct, miss] });
    void w.flow.run();
    await settle();
    expect(w.brickPlays).toEqual([]);
    w.flow.destroy();
  });

  it('a typical base on both sides plays a whole turn without stalling', async () => {
    const bases = { PAST: TYPICAL('PAST'), FUTURE: TYPICAL('FUTURE') };
    const hit = brickAim(bases, false);
    const w = makeWorld({
      seed: SEED,
      script: [hit, hit],
      answers: ['wrong'],
      matchOptions: opts(bases),
    });
    void w.flow.run();
    await settle();
    expect(w.log).toContain('reload:PAST');
    expect(w.log).toContain('pass:FUTURE');
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });
});
