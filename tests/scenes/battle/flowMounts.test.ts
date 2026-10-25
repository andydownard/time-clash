// Weapons on the base pads in the battle flow (docs/GAME_SPEC.md "Weapons on the pads"). The HUD
// lists the active team's weapons, a pick reaches the rules, the guide, the wind-up and the shell
// start at the pad, the pad flashes when it fires, a volley flies 3 shells, and the Computer
// player's weapon pick is used.
import { describe, expect, it } from 'vitest';
import { withComputer } from '../../../src/game/practice';
import type { MatchOptions } from '../../../src/game/types';
import { BattleFlow } from '../../../src/scenes/battle/flow';
import { TYPICAL, armed } from '../../helpers/builtBases';
import { PLAYERS, makeWorld, settle } from './flowHarness';

const SEED = 7;
const BASES = {
  PAST: armed(TYPICAL('PAST'), ['cannon', null, 'catapult', 'archerPost']),
  FUTURE: armed(TYPICAL('FUTURE'), ['laser', 'shieldGen', 'turret', 'missilePod']),
};
const OPTS: Partial<MatchOptions> = {
  characterHealth: false,
  baseInBattle: true,
  squads: false,
  bases: BASES,
};
const SHORT = { angleDeg: 60, power: 25 };

describe('BattleFlow with weapons on the pads', () => {
  it('the HUD lists the active team’s weapons that can fire, and the pick', async () => {
    const w = makeWorld({ seed: SEED, script: [], matchOptions: OPTS });
    void w.flow.run();
    await settle();
    const live = w.hudStates.filter((h) => h.canFire).at(-1)!;
    expect(live.activeTeam).toBe('PAST');
    expect(live.mounts?.map((m) => [m.id, m.spot, m.name, m.art, m.mine])).toEqual([
      ['mount:0', 0, 'Cannon', 'cannon', false],
      ['mount:2', 2, 'Catapult', 'catapult', false],
      ['mount:3', 3, 'Archer post', 'archerPost', false],
    ]);
    expect(live.selectedMount).toBeNull();
    w.handlers()!.onSelect('mount:2');
    const after = w.hudStates.at(-1)!;
    expect(after.selectedMount).toBe('mount:2');
    // The angle guide moves to the pad.
    const pad = w.match.snapshot().mounts!.PAST.find((m) => m.id === 'mount:2')!;
    expect(w.statuses.at(-1)!.firingOrigin).toEqual(pad.origin);
    expect(w.mountSelections.at(-1)).toEqual({ team: 'PAST', id: 'mount:2' });
    // Back to a fighter: the view hears it too.
    w.handlers()!.onSelect('B');
    expect(w.hudStates.at(-1)!.selectedMount).toBeNull();
    expect(w.mountSelections.at(-1)).toEqual({ team: 'PAST', id: null });
    w.flow.destroy();
  });

  it('a weapon go winds up and starts at the pad, and the pad flashes', async () => {
    const w = makeWorld({
      seed: SEED,
      script: [{ ...SHORT, pick: 'mount:2' }, SHORT],
      matchOptions: OPTS,
    });
    void w.flow.run();
    await settle();
    const pad = w.match.snapshot().mounts!.PAST.find((m) => m.id === 'mount:2')!;
    expect(w.charges[0]!.from).toEqual(pad.origin);
    expect(w.shots[0]!.start).toEqual(pad.origin);
    expect(w.padFlashes[0]).toEqual({ team: 'PAST', spot: 2 });
    // The flash comes with the shot: after the wind-up, before the flight.
    const i = w.log.indexOf('pad:PAST:2');
    expect(w.log.lastIndexOf('charge:PAST', i)).toBeGreaterThan(-1);
    expect(w.log.indexOf('fly:PAST', i)).toBeGreaterThan(i);
    // The second go kept the weapon (the pick stays until changed).
    expect(w.padFlashes).toHaveLength(2);
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });

  it('a fighter go does not flash a pad', async () => {
    const w = makeWorld({ seed: SEED, script: [SHORT, SHORT], matchOptions: OPTS });
    void w.flow.run();
    await settle();
    expect(w.shots.length).toBeGreaterThan(0);
    expect(w.padFlashes).toEqual([]);
    w.flow.destroy();
  });

  it('a volley flies 3 shells from the pad', async () => {
    const w = makeWorld({
      seed: SEED,
      script: [{ ...SHORT, pick: 'mount:3' }],
      matchOptions: OPTS,
    });
    void w.flow.run();
    await settle();
    const pad = w.match.snapshot().mounts!.PAST.find((m) => m.id === 'mount:3')!;
    const first = w.shots.filter((s) => s.team === 'PAST').slice(0, 3);
    expect(first).toHaveLength(3);
    for (const s of first) expect(s.start).toEqual(pad.origin);
    w.flow.destroy();
  });

  it("the Computer player's weapon pick is used", async () => {
    const w = makeWorld({
      seed: SEED,
      players: withComputer(PLAYERS, 'FUTURE'),
      script: Array.from({ length: 40 }, () => SHORT),
      answers: Array.from({ length: 40 }, () => 'wrong' as const),
      matchOptions: OPTS,
    });
    const flow = new BattleFlow({ ...w.deps, practice: { team: 'FUTURE', level: 'medium' } });
    const run = flow.run();
    for (let i = 0; i < 20 && !w.padFlashes.some((p) => p.team === 'FUTURE'); i++) await settle();
    flow.destroy();
    await run;
    const futurePad = w.padFlashes.find((p) => p.team === 'FUTURE');
    expect(futurePad).toBeDefined();
    // Never the Shield generator (spot 1): it does not fire.
    expect(w.padFlashes.filter((p) => p.team === 'FUTURE').map((p) => p.spot)).not.toContain(1);
  });
});
