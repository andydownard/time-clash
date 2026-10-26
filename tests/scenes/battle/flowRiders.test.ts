// Fighters on a built base in the battle flow (owner, 2026-10-25): when the brick under a fighter
// falls, the view plays its fall with the crumble, then the fighter says a funny line (a bubble,
// the caption bar, and the voice when it is set up). Its next shot leaves from the lower spot.
// Nobody is hurt: no health changes for a fall.
import { describe, expect, it } from 'vitest';
import { baseFallPool } from '../../../src/data/copy';
import { createMatch } from '../../../src/game/match';
import { riderBricks, riderDrops, riderOrigin } from '../../../src/game/riders';
import type { AimInput, MatchOptions } from '../../../src/game/types';
import { TYPICAL, baseOf, brick } from '../../helpers/builtBases';
import { PLAYERS, findAim, makeWorld, settle } from './flowHarness';

const SEED = 7;

/** Team Future: a foundation, and one thin antenna on it right under the Tank's feet. */
const SHAKY = (): MatchOptions['bases'] => ({
  FUTURE: baseOf([
    ...[6, 8, 10, 12, 14, 16].map((x) => brick('panel', x, 10, 20)),
    brick('antenna', 13, 7, 10),
  ]),
});

const opts = (bases: MatchOptions['bases']): Partial<MatchOptions> => ({
  characterHealth: false,
  baseInBattle: true,
  squads: false,
  matchLength: 'short',
  bases,
});

/** A Team Past first-shot aim that makes a Team Future fighter fall (found by trying, seeded). */
function fallAim(bases: MatchOptions['bases']): AimInput {
  for (let power = 100; power >= 20; power -= 2) {
    for (let angleDeg = 5; angleDeg <= 85; angleDeg += 1) {
      const m = createMatch({ players: PLAYERS, seed: SEED, disturbances: false, ...opts(bases) });
      const before = riderDrops(m.snapshot(), m.layout);
      m.ready();
      m.setAim({ angleDeg, power });
      m.fire();
      m.shotLanded();
      const after = riderDrops(m.snapshot(), m.layout);
      if ((['1', '5'] as const).some((id) => (after[id] ?? 0) > (before[id] ?? 0))) {
        return { angleDeg, power };
      }
    }
  }
  throw new Error('no aim that knocks a fighter down');
}

describe('BattleFlow: a fighter whose brick falls', () => {
  const bases = SHAKY();
  const aim = fallAim(bases);
  const miss = findAim(SEED, 0, 'PAST', 'miss');

  it('falls with the crumble, then says a funny line in a bubble and the caption bar', async () => {
    const w = makeWorld({ seed: SEED, script: [aim, miss], matchOptions: opts(bases) });
    void w.flow.run();
    await settle();
    const fall = w.riderFalls[0]!;
    expect(fall.team).toBe('FUTURE');
    for (const f of fall.falls) expect(f.toDy).toBeGreaterThan(f.fromDy);
    // The fall plays in the same beat as the crumble, after the blast.
    const i = w.log.findIndex((l) => l.startsWith('riderFall:FUTURE'));
    expect(w.log[i - 1]).toMatch(/^bricks:FUTURE:[1-9]/);
    expect(w.log.lastIndexOf('impact:direct', i)).toBeGreaterThan(-1);
    // Then the line: a bubble from Team Future, the same words in the caption bar.
    const bubble = w.log.indexOf('bubble:FUTURE', i);
    expect(bubble).toBeGreaterThan(i);
    const said = w.bubbles.find((b) => b.team === 'FUTURE')!.text;
    expect(baseFallPool('FUTURE')).toContain(said);
    expect(w.captions).toContain(said);
    expect(w.sfx).toContain('boing');
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });

  it('the line leaves the caption bar before the reload card or the pass screen comes up', async () => {
    // A slow scene clock: the bubble's hold never ends before the cover.
    const w = makeWorld({ seed: SEED, script: [aim, miss], matchOptions: opts(bases) });
    w.deps.wait = (ms) => (ms >= 3000 ? new Promise<void>(() => {}) : Promise.resolve());
    void w.flow.run();
    await settle();
    expect(w.log).toContain('reload:PAST');
    expect(w.captionAtCover.length).toBeGreaterThan(0);
    for (const c of w.captionAtCover) expect(baseFallPool('FUTURE')).not.toContain(c);
    w.flow.destroy();
  });

  it('nobody is hurt: the fall changes no health but the bricks’', async () => {
    const w = makeWorld({ seed: SEED, script: [aim, miss], matchOptions: opts(bases) });
    void w.flow.run();
    await settle();
    const s = w.match.snapshot();
    expect(Object.values(s.unitHp).every((hp) => hp === s.maxUnitHp)).toBe(true);
    w.flow.destroy();
  });

  it('its next shot (and the angle guide) leaves from the lower spot', async () => {
    const w = makeWorld({
      seed: SEED,
      script: [aim, miss],
      answers: ['wrong'],
      matchOptions: opts(bases),
    });
    void w.flow.run();
    await settle();
    const s = w.match.snapshot();
    const want = riderOrigin('FUTURE', '1', w.match.layout, riderBricks(s, 'FUTURE'));
    const futureStatus = w.statuses.filter((x) => x.activeTeam === 'FUTURE').at(-1);
    const tank = w.riderFalls[0]!.falls.find((f) => f.id === '1')!;
    expect(tank.toDy).toBeGreaterThan(tank.fromDy);
    expect(futureStatus?.firingOrigin).toEqual(want);
    expect(want.y).toBe(w.match.layout.launchOrigins.FUTURE.y + tank.toDy);
    w.flow.destroy();
  });

  it('says the line out loud when the voice is set up, with a caption', async () => {
    const w = makeWorld({
      seed: SEED,
      script: [aim, miss],
      matchOptions: opts(bases),
      clips: true,
    });
    void w.flow.run();
    await settle();
    const line = w.spoken.find((l) => l.id === 'base-fall-line')!;
    expect(baseFallPool('FUTURE')).toContain(line.text);
    expect(line.captions[0]!.text).toBe(line.text);
    w.flow.destroy();
  });

  it('the same seed says the same line (seeded, no randomness of its own)', async () => {
    const said = async (): Promise<string> => {
      const w = makeWorld({ seed: SEED, script: [aim, miss], matchOptions: opts(bases) });
      void w.flow.run();
      await settle();
      w.flow.destroy();
      return w.bubbles.find((b) => b.team === 'FUTURE')!.text;
    };
    expect(await said()).toBe(await said());
  });

  it('with reduced motion the fall and the line still happen', async () => {
    const w = makeWorld({
      seed: SEED,
      script: [aim, miss],
      matchOptions: opts(bases),
      reduced: true,
    });
    void w.flow.run();
    await settle();
    expect(w.riderFalls).toHaveLength(1);
    expect(w.bubbles.some((b) => b.team === 'FUTURE')).toBe(true);
    w.flow.destroy();
  });
});

describe('BattleFlow: no fall without a reason', () => {
  it('a brick hit that leaves the riders’ bricks standing plays no fall', async () => {
    const bases = { PAST: TYPICAL('PAST'), FUTURE: TYPICAL('FUTURE') };
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({
      seed: SEED,
      script: [miss, miss],
      matchOptions: { ...opts(bases), matchLength: 'normal' },
    });
    void w.flow.run();
    await settle();
    expect(w.riderFalls).toEqual([]);
    w.flow.destroy();
  });

  it('no built base: never a fall', async () => {
    const direct = findAim(SEED, 0, 'PAST', 'direct');
    const w = makeWorld({ seed: SEED, script: [direct, direct] });
    void w.flow.run();
    await settle();
    expect(w.riderFalls).toEqual([]);
    expect(w.spoken.some((l) => l.id === 'base-fall-line')).toBe(false);
    w.flow.destroy();
  });
});
