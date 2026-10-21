// Squads S1 rules: a launcher and one dasher per side, dash on the ground spots.
import { describe, expect, it } from 'vitest';
import {
  IllegalCommandError,
  dashTargets,
  doorstepOf,
  goLabel,
  groundSpotIds,
  helperId,
  planDash,
  startingCrew,
  type Crew,
} from '../../src/game/crew';
import { SQUADS } from '../../src/game/config';

const bubble = () => 7;
const reason = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (e) {
    if (e instanceof IllegalCommandError) return e.reason;
    throw e;
  }
  return null;
};
/** A crew with the two dashers moved to chosen spots. */
const crewAt = (past: string, future: string): Crew => {
  const c = startingCrew();
  return dashing({
    ...c,
    helpers: c.helpers.map((h) =>
      h.id === 'PAST-dasher'
        ? { ...h, spot: past }
        : h.id === 'FUTURE-dasher'
          ? { ...h, spot: future }
          : h,
    ),
  });
};
/** The same crew with both sides' dashers picked. */
const dashing = (c: Crew): Crew => ({
  ...c,
  picked: { PAST: 'PAST-dasher', FUTURE: 'FUTURE-dasher' },
});
const spotOf = (c: Crew, id: string): string | null =>
  c.helpers.find((h) => h.id === id)?.spot ?? null;

describe('the starting crew', () => {
  it('gives each side a launcher and one dasher, and no more', () => {
    const c = startingCrew();
    expect(c.helpers.map((h) => h.id)).toEqual([
      'PAST-launcher',
      'PAST-dasher',
      'FUTURE-launcher',
      'FUTURE-dasher',
    ]);
    expect(c.helpers.filter((h) => h.kind === 'launcher').every((h) => h.spot === null)).toBe(true);
  });
  it('starts the dashers at home and picks the launcher', () => {
    const c = startingCrew();
    expect(spotOf(c, 'PAST-dasher')).toBe('g1');
    expect(spotOf(c, 'FUTURE-dasher')).toBe('g3');
    expect(c.picked).toEqual({ PAST: 'PAST-launcher', FUTURE: 'FUTURE-launcher' });
  });
  it('has five ground spots with a doorstep at each end', () => {
    expect(groundSpotIds()).toEqual(['g0', 'g1', 'g2', 'g3', 'g4']);
    expect(groundSpotIds()).toHaveLength(SQUADS.groundSpots);
    expect(doorstepOf('g0')).toBe('PAST');
    expect(doorstepOf('g4')).toBe('FUTURE');
    expect(doorstepOf('g2')).toBeNull();
  });
  it('is a fresh copy every time', () => {
    expect(startingCrew()).not.toBe(startingCrew());
  });
});

describe('dash targets', () => {
  it('lists free spots within range, never the own doorstep', () => {
    // Past dasher on g1 reaches g0..g3. g0 is its own doorstep. g3 holds the Future dasher.
    expect(dashTargets(dashing(startingCrew()), 'PAST')).toEqual(['g2']);
  });
  it('lets a dasher reach the enemy doorstep when it is in range', () => {
    expect(dashTargets(crewAt('g2', 'g3'), 'PAST')).toEqual(['g1', 'g4']);
  });
  it('is empty for a launcher (fire needs no spot)', () => {
    expect(dashTargets(startingCrew(), 'PAST', 'PAST-launcher')).toEqual([]);
  });
});

describe('planDash', () => {
  it('moves the dasher and bonks nothing when no enemy is next door', () => {
    const r = planDash(crewAt('g1', 'g4'), 'PAST', 'g2', bubble);
    expect(r.outcome.bonk).toBeNull();
    expect(r.outcome.from).toBe('g1');
    expect(r.outcome.to).toBe('g2');
    expect(spotOf(r.crew, 'PAST-dasher')).toBe('g2');
  });
  it('bonks an enemy helper next door and sends it home with a tumble line', () => {
    // The Future dasher stands on g1, away from its home g3. Past rolls in next to it on g2.
    const r = planDash(crewAt('g3', 'g1'), 'PAST', 'g2', bubble);
    expect(r.outcome.bonk).toEqual({
      kind: 'helper',
      helper: 'FUTURE-dasher',
      from: 'g1',
      to: 'g3',
      bubbleIndex: 7,
    });
    expect(spotOf(r.crew, 'FUTURE-dasher')).toBe('g3');
  });
  it('leaves a bonked helper where it is when its home is taken', () => {
    const r = planDash(crewAt('g1', 'g2'), 'PAST', 'g3', bubble);
    const bonk = r.outcome.bonk;
    expect(bonk?.kind).toBe('helper');
    expect(bonk?.kind === 'helper' && bonk.to).toBe('g2');
    expect(spotOf(r.crew, 'FUTURE-dasher')).toBe('g2');
  });
  it('takes base health when it lands on the enemy doorstep', () => {
    const r = planDash(crewAt('g2', 'g3'), 'PAST', 'g4', bubble);
    expect(r.outcome.bonk).toEqual({
      kind: 'base',
      target: 'FUTURE',
      damage: SQUADS.dashBonkDamage,
    });
  });
  it('works the same for Team Future, mirrored', () => {
    const r = planDash(crewAt('g1', 'g2'), 'FUTURE', 'g0', bubble);
    expect(r.outcome.bonk).toEqual({ kind: 'base', target: 'PAST', damage: SQUADS.dashBonkDamage });
  });
  it('does not change the crew it was given', () => {
    const c = dashing(startingCrew());
    const before = JSON.stringify(c);
    planDash(c, 'PAST', 'g2', bubble);
    expect(JSON.stringify(c)).toBe(before);
  });
  it('asks the bubble bag only when a helper tumbles', () => {
    let calls = 0;
    const count = () => ++calls;
    planDash(crewAt('g1', 'g4'), 'PAST', 'g2', count);
    expect(calls).toBe(0);
    planDash(crewAt('g3', 'g1'), 'PAST', 'g2', count);
    expect(calls).toBe(1);
  });
});

describe('illegal dashes', () => {
  it('refuses a spot that is out of range', () => {
    expect(reason(() => planDash(crewAt('g1', 'g3'), 'PAST', 'g4', bubble))).toBe('out_of_range');
  });
  it('refuses a spot that is not on the ground', () => {
    expect(reason(() => planDash(dashing(startingCrew()), 'PAST', 'g9', bubble))).toBe(
      'out_of_range',
    );
    expect(reason(() => planDash(dashing(startingCrew()), 'PAST', 's1', bubble))).toBe(
      'out_of_range',
    );
  });
  it('refuses a spot someone stands on', () => {
    expect(reason(() => planDash(dashing(startingCrew()), 'PAST', 'g3', bubble))).toBe(
      'spot_taken',
    );
  });
  it('refuses the own doorstep', () => {
    expect(reason(() => planDash(dashing(startingCrew()), 'PAST', 'g0', bubble))).toBe(
      'own_doorstep',
    );
    expect(reason(() => planDash(crewAt('g3', 'g2'), 'FUTURE', 'g4', bubble))).toBe('own_doorstep');
  });
  it('refuses to dash where it already stands', () => {
    expect(reason(() => planDash(dashing(startingCrew()), 'PAST', 'g1', bubble))).toBe(
      'spot_taken',
    );
  });
  it('refuses a launcher (wrong unit)', () => {
    expect(
      reason(() => planDash(dashing(startingCrew()), 'PAST', 'g2', bubble, 'PAST-launcher')),
    ).toBe('wrong_command');
  });
  it("refuses the other side's dasher (wrong unit)", () => {
    expect(
      reason(() => planDash(dashing(startingCrew()), 'PAST', 'g2', bubble, 'FUTURE-dasher')),
    ).toBe('not_your_helper');
  });
});

describe('helperId and goLabel', () => {
  it('builds ids from team and kind', () => {
    expect(helperId('FUTURE', 'dasher')).toBe('FUTURE-dasher');
  });
  it('counts goes from 1 and never past the limit', () => {
    expect(goLabel(0)).toBe('GO 1 OF 2');
    expect(goLabel(1)).toBe('GO 2 OF 2');
    expect(goLabel(2)).toBe('GO 2 OF 2');
  });
});
