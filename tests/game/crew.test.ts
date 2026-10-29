// Squads S1 rules: a launcher and one walking dasher per side. The dasher walks out over any
// obstacle, stops next to the first enemy thing in front, and waits. Bonk! is a go the player
// chooses (owner, 2026-10-28): nothing bonks by itself.
import { describe, expect, it } from 'vitest';
import {
  IllegalCommandError,
  attackSpotOf,
  dashTargets,
  dasherBox,
  dasherHomePoint,
  dasherOf,
  doorstepOf,
  goLabel,
  groundSpotIds,
  groundSpotPoint,
  helperId,
  hitDasher,
  planDash,
  planRecall,
  planBonk,
  planWalkOn,
  bonkTargets,
  startingCrew,
  wakeDashers,
  type Crew,
  type Helper,
} from '../../src/game/crew';
import { CHARACTER_HEALTH, PHASE1_LAYOUT, SQUADS } from '../../src/game/config';
import { buildLayout } from '../../src/game/battlefield';
import type { Team } from '../../src/game/types';

const HP = CHARACTER_HEALTH.hp;
const bubble = () => 7;
const REST = { PAST: 10, FUTURE: 20 } as Record<Team, number>;
const reason = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (e) {
    if (e instanceof IllegalCommandError) return e.reason;
    throw e;
  }
  return null;
};
/** Change one side's dasher. */
const withDasher = (c: Crew, team: Team, patch: Partial<Helper>): Crew => ({
  ...c,
  helpers: c.helpers.map((h) => (h.id === `${team}-dasher` ? { ...h, ...patch } : h)),
});
/** Both dashers out on chosen spots (null leaves that side home). Both sides pick the dasher. */
const crewAt = (past: string | null, future: string | null, hp = HP): Crew => {
  let c = startingCrew(hp);
  if (past) c = withDasher(c, 'PAST', { spot: past, state: 'out' });
  if (future) c = withDasher(c, 'FUTURE', { spot: future, state: 'out' });
  return { ...c, picked: { PAST: 'PAST-dasher', FUTURE: 'FUTURE-dasher' } };
};
const dasher = (c: Crew, team: Team): Helper => dasherOf(c, team);
const picking = (c: Crew): Crew => ({
  ...c,
  picked: { PAST: 'PAST-dasher', FUTURE: 'FUTURE-dasher' },
});

describe('the starting crew', () => {
  it('gives each side a launcher and one dasher, and no more', () => {
    const c = startingCrew();
    expect(c.helpers.map((h) => h.id)).toEqual([
      'PAST-launcher',
      'PAST-dasher',
      'FUTURE-launcher',
      'FUTURE-dasher',
    ]);
    expect(c.helpers.every((h) => h.spot === null)).toBe(true);
  });
  it('starts the dashers at home with full health and picks the launcher', () => {
    const c = startingCrew();
    expect(dasher(c, 'PAST')).toMatchObject({ state: 'home', hp: HP, spot: null });
    expect(dasher(c, 'FUTURE')).toMatchObject({ state: 'home', hp: HP, spot: null });
    expect(c.picked).toEqual({ PAST: 'PAST-launcher', FUTURE: 'FUTURE-launcher' });
  });
  it('takes a full health for longer matches', () => {
    expect(dasher(startingCrew(6), 'PAST').hp).toBe(6);
  });
  it('has five ground spots with a doorstep at each end and an attack spot beside each', () => {
    expect(groundSpotIds()).toEqual(['g0', 'g1', 'g2', 'g3', 'g4']);
    expect(groundSpotIds()).toHaveLength(SQUADS.groundSpots);
    expect(doorstepOf('g0')).toBe('PAST');
    expect(doorstepOf('g4')).toBe('FUTURE');
    expect(doorstepOf('g2')).toBeNull();
    expect(attackSpotOf('PAST')).toBe('g3');
    expect(attackSpotOf('FUTURE')).toBe('g1');
  });
  it('is a fresh copy every time', () => {
    expect(startingCrew()).not.toBe(startingCrew());
  });
});

describe('where the spots are on the field', () => {
  it('runs left to right along the ground, between the two bases', () => {
    const xs = groundSpotIds().map((s) => groundSpotPoint(s, PHASE1_LAYOUT).x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const past = PHASE1_LAYOUT.bases.PAST;
    const future = PHASE1_LAYOUT.bases.FUTURE;
    expect(xs[0]).toBe(past.x + past.w + SQUADS.spotInset.door);
    expect(xs[1]).toBe(past.x + past.w + SQUADS.spotInset.attack);
    expect(xs[3]).toBe(future.x - SQUADS.spotInset.attack);
    expect(xs[4]).toBe(future.x - SQUADS.spotInset.door);
    for (const s of groundSpotIds())
      expect(groundSpotPoint(s, PHASE1_LAYOUT).y).toBe(PHASE1_LAYOUT.terrain.ground[0]!.y);
  });
  it('stays on the ground line even when a base sits high on a tower or rock', () => {
    const high = buildLayout({ biome: 'temple', spot: 'skyscraper', fort: 'hillFort' });
    const ground = high.terrain.ground[0]!.y;
    for (const s of groundSpotIds()) expect(groundSpotPoint(s, high).y).toBe(ground);
    expect(dasherHomePoint('FUTURE', high).y).toBe(ground);
  });
  it('puts each home inside its own base, behind its doorstep', () => {
    expect(dasherHomePoint('PAST', PHASE1_LAYOUT).x).toBeLessThan(
      groundSpotPoint('g0', PHASE1_LAYOUT).x,
    );
    expect(dasherHomePoint('FUTURE', PHASE1_LAYOUT).x).toBeGreaterThan(
      groundSpotPoint('g4', PHASE1_LAYOUT).x,
    );
  });
  it('gives a dasher the fighter hit box, standing on the ground at his spot', () => {
    const box = dasherBox('g3', PHASE1_LAYOUT);
    const at = groundSpotPoint('g3', PHASE1_LAYOUT);
    expect(box.w).toBe(CHARACTER_HEALTH.box.w);
    expect(box.h).toBe(CHARACTER_HEALTH.box.h);
    expect(box.x + box.w / 2).toBe(at.x);
    expect(box.y + box.h).toBe(at.y);
  });
});

describe('walking out (dash targets)', () => {
  it('walks all the way to the attack spot when the enemy dasher is home', () => {
    expect(dashTargets(picking(startingCrew()), 'PAST')).toEqual(['g3']);
    expect(dashTargets(picking(startingCrew()), 'FUTURE')).toEqual(['g1']);
  });
  it('the middle obstacle never blocks the walk: the stop does not depend on the field', () => {
    // The walk is a ground line. The hill, mound or pillar is only drawn over.
    expect(dashTargets(picking(startingCrew()), 'PAST')).toEqual([attackSpotOf('PAST')]);
  });
  it('stops on the spot just before an enemy dasher who is out', () => {
    expect(dashTargets(crewAt(null, 'g1'), 'PAST')).toEqual(['g0']);
    expect(dashTargets(crewAt(null, 'g2'), 'PAST')).toEqual(['g1']);
    expect(dashTargets(crewAt('g3', null), 'FUTURE')).toEqual(['g4']);
  });
  it('is empty for a launcher, for a dasher already out, and for a resting dasher', () => {
    expect(dashTargets(startingCrew(), 'PAST', 'PAST-launcher')).toEqual([]);
    expect(dashTargets(crewAt('g3', null), 'PAST')).toEqual([]);
    const resting = withDasher(picking(startingCrew()), 'PAST', { state: 'resting', readyAt: 3 });
    expect(dashTargets(resting, 'PAST')).toEqual([]);
  });
});

describe('planDash', () => {
  it('sends the dasher out to his stop with full health', () => {
    const start = withDasher(picking(startingCrew()), 'PAST', { hp: 1 });
    const r = planDash(start, 'PAST', 'g3', HP);
    expect(r.outcome).toEqual({ helper: 'PAST-dasher', to: 'g3' });
    expect(dasher(r.crew, 'PAST')).toMatchObject({ state: 'out', spot: 'g3', hp: HP });
  });
  it('bonks nothing when he arrives: bonks come at the start of each turn', () => {
    const r = planDash(picking(startingCrew()), 'PAST', 'g3', HP);
    expect(dasher(r.crew, 'FUTURE')).toMatchObject({ state: 'home', hp: HP });
  });
  it('does not change the crew it was given', () => {
    const c = picking(startingCrew());
    const before = JSON.stringify(c);
    planDash(c, 'PAST', 'g3', HP);
    expect(JSON.stringify(c)).toBe(before);
  });
});

describe('illegal dashes', () => {
  it('refuses any spot but the stop', () => {
    expect(reason(() => planDash(picking(startingCrew()), 'PAST', 'g2', HP))).toBe('out_of_range');
    expect(reason(() => planDash(picking(startingCrew()), 'PAST', 'g9', HP))).toBe('out_of_range');
    expect(reason(() => planDash(picking(startingCrew()), 'PAST', 's1', HP))).toBe('out_of_range');
  });
  it('refuses when there is no free spot in front (an enemy stands on the own doorstep)', () => {
    // Play never makes this board (a dasher never steps on the enemy doorstep). The rules still refuse it.
    const c = crewAt(null, 'g0');
    expect(dashTargets(c, 'PAST')).toEqual([]);
    expect(reason(() => planDash(c, 'PAST', 'g0', HP))).toBe('no_free_spot');
  });
  it('refuses a dasher who is already out, or resting', () => {
    expect(reason(() => planDash(crewAt('g3', null), 'PAST', 'g3', HP))).toBe('already_out');
    const resting = withDasher(picking(startingCrew()), 'PAST', { state: 'resting', readyAt: 3 });
    expect(reason(() => planDash(resting, 'PAST', 'g3', HP))).toBe('resting');
  });
  it('refuses a launcher (wrong unit)', () => {
    expect(reason(() => planDash(startingCrew(), 'PAST', 'g3', HP, 'PAST-launcher'))).toBe(
      'wrong_command',
    );
  });
  it("refuses the other side's dasher (wrong unit)", () => {
    expect(reason(() => planDash(picking(startingCrew()), 'PAST', 'g3', HP, 'FUTURE-dasher'))).toBe(
      'not_your_helper',
    );
  });
});

describe('planRecall (Come back)', () => {
  it('walks an out dasher home; he is ready again on the given own turn', () => {
    const r = planRecall(crewAt('g3', null), 'PAST', 4);
    expect(r.outcome).toEqual({ helper: 'PAST-dasher', from: 'g3' });
    expect(dasher(r.crew, 'PAST')).toMatchObject({ state: 'resting', spot: null, readyAt: 4 });
  });
  it('refuses a dasher who is not out', () => {
    expect(reason(() => planRecall(picking(startingCrew()), 'PAST', 4))).toBe('not_out');
  });
  it('refuses a launcher pick and the other side', () => {
    const c = { ...crewAt('g3', null), picked: { PAST: 'PAST-launcher', FUTURE: 'FUTURE-dasher' } };
    expect(reason(() => planRecall(c as Crew, 'PAST', 4))).toBe('wrong_command');
    expect(reason(() => planRecall(crewAt('g3', null), 'PAST', 4, 'FUTURE-dasher'))).toBe(
      'not_your_helper',
    );
  });
});

describe('wakeDashers', () => {
  it('brings a resting dasher home once his own turn count reaches readyAt', () => {
    const c = withDasher(startingCrew(), 'PAST', { state: 'resting', readyAt: 3, hp: 0 });
    expect(dasher(wakeDashers(c, 'PAST', 2, HP), 'PAST').state).toBe('resting');
    expect(dasher(wakeDashers(c, 'PAST', 3, HP), 'PAST')).toMatchObject({ state: 'home', hp: HP });
  });
  it('only wakes the team whose turn starts', () => {
    const c = withDasher(startingCrew(), 'FUTURE', { state: 'resting', readyAt: 1 });
    expect(dasher(wakeDashers(c, 'PAST', 5, HP), 'FUTURE').state).toBe('resting');
  });
});

describe('planWalkOn: the start of a turn walks and never bonks', () => {
  it('a dasher at the enemy base stays put and nothing happens', () => {
    const r = planWalkOn(crewAt('g3', null), 'FUTURE');
    expect(r.walks).toEqual([]);
    expect(r.crew).toEqual(crewAt('g3', null));
  });
  it('two dashers side by side do not bonk each other by themselves', () => {
    const r = planWalkOn(crewAt('g3', 'g4'), 'PAST');
    expect(r.walks).toEqual([]);
    expect(dasher(r.crew, 'PAST').hp).toBe(HP);
    expect(dasher(r.crew, 'FUTURE').hp).toBe(HP);
  });
  it('with nothing next to him he walks on to the next thing in front, and does not bonk it', () => {
    // His foe tumbled home last turn, so he walks on from g1 to the attack spot.
    const r = planWalkOn(crewAt('g1', null), 'PAST');
    expect(r.walks).toEqual([{ helper: 'PAST-dasher', team: 'PAST', from: 'g1', to: 'g3' }]);
    expect(dasher(r.crew, 'PAST').spot).toBe('g3');
  });
  it('the team whose turn starts walks first and stops in front of the other helper', () => {
    const r = planWalkOn(crewAt('g1', 'g4'), 'FUTURE');
    expect(r.walks).toEqual([{ helper: 'FUTURE-dasher', team: 'FUTURE', from: 'g4', to: 'g2' }]);
  });
  it('does nothing when no dasher is out', () => {
    const r = planWalkOn(startingCrew(), 'PAST');
    expect(r.walks).toEqual([]);
  });
});

describe('bonkTargets: what a Bonk! may hit', () => {
  it('the base from the attack spot, and nothing else when the foe is far', () => {
    expect(bonkTargets(crewAt('g3', null), 'PAST')).toEqual(['base']);
    expect(bonkTargets(crewAt(null, 'g1'), 'FUTURE')).toEqual(['base']);
  });
  it('the helper next to him, and the base too at the attack spot', () => {
    expect(bonkTargets(crewAt('g2', 'g3'), 'PAST')).toEqual(['helper']);
    expect(bonkTargets(crewAt('g3', 'g4'), 'PAST')).toEqual(['helper', 'base']);
  });
  it('nothing in the middle of the field, at home, resting, or for a launcher', () => {
    expect(bonkTargets(crewAt('g1', null), 'PAST')).toEqual([]);
    expect(bonkTargets(startingCrew(), 'PAST', 'PAST-dasher')).toEqual([]);
    const resting = withDasher(crewAt('g3', null), 'PAST', {
      state: 'resting',
      spot: null,
      hp: 0,
      readyAt: 5,
    });
    expect(bonkTargets(resting, 'PAST')).toEqual([]);
    expect(bonkTargets(crewAt('g3', null), 'PAST', 'PAST-launcher')).toEqual([]);
  });
});

describe('planBonk: one Bonk! go', () => {
  it('bonks the base for standBonkDamage and changes nobody on the field', () => {
    const r = planBonk(crewAt('g3', null), 'PAST', 'base', REST.FUTURE, bubble);
    expect(r.beat).toEqual({
      helper: 'PAST-dasher',
      team: 'PAST',
      at: 'g3',
      target: { kind: 'base', team: 'FUTURE', damage: SQUADS.standBonkDamage },
    });
    expect(r.crew).toEqual(crewAt('g3', null));
  });
  it('bonks the helper next to him for duelBonkHp and the bonker loses nothing', () => {
    const r = planBonk(crewAt('g3', 'g4'), 'PAST', 'helper', REST.FUTURE, bubble);
    expect(r.beat.target).toEqual({
      kind: 'helper',
      helper: 'FUTURE-dasher',
      hp: HP - SQUADS.duelBonkHp,
      tumbled: false,
      bubbleIndex: null,
    });
    expect(dasher(r.crew, 'FUTURE').hp).toBe(HP - SQUADS.duelBonkHp);
    expect(dasher(r.crew, 'PAST').hp).toBe(HP);
  });
  it('a helper bonked to 0 tumbles, walks home and rests until his restAt turn', () => {
    const c = withDasher(crewAt('g3', 'g4'), 'FUTURE', { hp: SQUADS.duelBonkHp });
    const r = planBonk(c, 'PAST', 'helper', REST.FUTURE, bubble);
    expect(r.beat.target).toEqual({
      kind: 'helper',
      helper: 'FUTURE-dasher',
      hp: 0,
      tumbled: true,
      bubbleIndex: 7,
    });
    expect(dasher(r.crew, 'FUTURE')).toMatchObject({
      state: 'resting',
      spot: null,
      hp: 0,
      readyAt: REST.FUTURE,
    });
  });
  it('draws a funny line only when somebody tumbles', () => {
    let calls = 0;
    planBonk(crewAt('g3', 'g4'), 'PAST', 'helper', 9, () => ++calls);
    planBonk(crewAt('g3', null), 'PAST', 'base', 9, () => ++calls);
    expect(calls).toBe(0);
  });
  it('refuses a Bonk! when nothing of that kind is next to him', () => {
    expect(reason(() => planBonk(crewAt('g1', null), 'PAST', 'base', 9, bubble))).toBe(
      'nothing_to_bonk',
    );
    expect(reason(() => planBonk(crewAt('g3', null), 'PAST', 'helper', 9, bubble))).toBe(
      'nothing_to_bonk',
    );
    expect(reason(() => planBonk(crewAt('g1', 'g3'), 'FUTURE', 'base', 9, bubble))).toBe(
      'nothing_to_bonk',
    );
  });
  it('refuses a Bonk! from a dasher at home, a dizzy dasher, or a launcher', () => {
    expect(reason(() => planBonk(startingCrew(), 'PAST', 'base', 9, bubble, 'PAST-dasher'))).toBe(
      'not_out',
    );
    const dizzy = withDasher(crewAt('g3', null), 'PAST', {
      state: 'resting',
      spot: null,
      hp: 0,
      readyAt: 9,
    });
    expect(reason(() => planBonk(dizzy, 'PAST', 'base', 9, bubble))).toBe('resting');
    expect(
      reason(() => planBonk(crewAt('g3', null), 'PAST', 'base', 9, bubble, 'PAST-launcher')),
    ).toBe('wrong_command');
    expect(
      reason(() => planBonk(crewAt('g3', 'g4'), 'PAST', 'base', 9, bubble, 'FUTURE-dasher')),
    ).toBe('not_your_helper');
  });
});

describe('hitDasher: a shell near a dasher', () => {
  const at = (spot: string) => {
    const p = groundSpotPoint(spot, PHASE1_LAYOUT);
    return { x: p.x, y: p.y - 10 };
  };
  it('a direct hit costs directHit health, a Power Shot costs powerHit', () => {
    const c = crewAt('g3', null);
    const one = hitDasher(c, 'PAST', at('g3'), PHASE1_LAYOUT, false, 9, bubble);
    expect(one.hit).toMatchObject({
      helper: 'PAST-dasher',
      result: 'direct',
      damage: CHARACTER_HEALTH.directHit,
      hp: HP - CHARACTER_HEALTH.directHit,
      tumbled: false,
    });
    const two = hitDasher(c, 'PAST', at('g3'), PHASE1_LAYOUT, true, 9, bubble);
    expect(two.hit?.damage).toBe(CHARACTER_HEALTH.powerHit);
  });
  it('a near miss costs nothing, but he wobbles', () => {
    const c = crewAt('g3', null);
    const p = groundSpotPoint('g3', PHASE1_LAYOUT);
    const near = { x: p.x + CHARACTER_HEALTH.box.w / 2 + 60, y: p.y };
    const r = hitDasher(c, 'PAST', near, PHASE1_LAYOUT, false, 9, bubble);
    expect(r.hit).toMatchObject({ result: 'near', damage: 0, hp: HP, tumbled: false });
    expect(dasher(r.crew, 'PAST').hp).toBe(HP);
  });
  it('far away misses him', () => {
    const r = hitDasher(crewAt('g3', null), 'PAST', at('g0'), PHASE1_LAYOUT, false, 9, bubble);
    expect(r.hit).toBeNull();
  });
  it('at 0 he tumbles with a line from the bag and rests until readyAt', () => {
    const c = withDasher(crewAt('g3', null), 'PAST', { hp: CHARACTER_HEALTH.directHit });
    const r = hitDasher(c, 'PAST', at('g3'), PHASE1_LAYOUT, false, 9, bubble);
    expect(r.hit).toMatchObject({ hp: 0, tumbled: true, bubbleIndex: 7, at: 'g3' });
    expect(dasher(r.crew, 'PAST')).toMatchObject({ state: 'resting', spot: null, readyAt: 9 });
  });
  it('a dasher walking home (resting) or at home cannot be hit', () => {
    const resting = withDasher(startingCrew(), 'PAST', { state: 'resting', readyAt: 3 });
    const home = dasherHomePoint('PAST', PHASE1_LAYOUT);
    expect(hitDasher(resting, 'PAST', home, PHASE1_LAYOUT, false, 9, bubble).hit).toBeNull();
    expect(hitDasher(startingCrew(), 'PAST', home, PHASE1_LAYOUT, false, 9, bubble).hit).toBeNull();
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
