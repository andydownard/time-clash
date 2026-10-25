// Character health: every fighter has CHARACTER_HEALTH.hp health and it REPLACES base health for the win.
// The flag is off by default. These tests turn it on through MatchOptions, never the constant.
import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import { chooseShot } from '../../src/game/bot';
import { playBotMatch } from '../../src/game/botPlay';
import {
  BONUS,
  CHARACTER_HEALTH,
  DAMAGE,
  PHASE1_LAYOUT,
  PRACTICE_BOT,
  TEAM_FACING,
} from '../../src/game/config';
import {
  aliveUnitIds,
  freshUnitHp,
  resolveUnitBlast,
  teamKnockedOut,
  unitDamage,
  winnerOf,
  winnerOfMatch,
  winnerOfUnits,
} from '../../src/game/damage';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import {
  MatchOverError,
  otherTeam,
  type AimInput,
  type BlastOutcome,
  type Match,
  type MatchController,
  type Players,
  type Team,
} from '../../src/game/types';
import { UNIT_IDS, UNITS, firingOrigin, unitBox, unitsOf, type UnitId } from '../../src/game/units';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'math' },
];
const RIGHT = { correct: true, elapsedMs: 1000 };
/** Health each fighter starts with, and the base health that stays untouched with the flag on. */
const HP = CHARACTER_HEALTH.hp;
const FULL_BASE = { PAST: DAMAGE.startingBaseHp, FUTURE: DAMAGE.startingBaseHp };
const WRONG = { correct: false, elapsedMs: 1000 };

const mk = (characterHealth: boolean, seed = 5): MatchController =>
  createMatch({ players: PLAYERS, seed, characterHealth });

type Want = { direct?: UnitId; near?: boolean };

/** Search every aim for one that makes the current shot do what the test needs. */
function findAim(c: MatchController, want: Want): AimInput {
  const snap = c.snapshot();
  const team = snap.turn.team;
  const foe = otherTeam(team);
  const unit = snap.selected[team];
  for (let power = 100; power >= 10; power -= 2) {
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += 1) {
      const r = simulateShot({
        angleDeg,
        power,
        wind: snap.wind,
        origin: firingOrigin(team, unit, c.layout),
        facing: TEAM_FACING[team],
        layout: c.layout,
        speedScale: unitsOf(team).find((u) => u.id === unit)!.speedScale,
      });
      const { hits } = resolveUnitBlast(r.path, r.landing, foe, snap.unitHp, c.layout);
      const direct = hits.find((h) => h.result === 'direct');
      if (want.direct && direct?.unit === want.direct) return { angleDeg, power };
      if (want.near && !direct && hits.length > 0) return { angleDeg, power };
    }
  }
  throw new Error(`no aim found for ${JSON.stringify(want)}`);
}

const shoot = (c: MatchController, want: Want): BlastOutcome => {
  c.setAim(findAim(c, want));
  c.fire();
  return c.shotLanded();
};

/** One harmless shot: it lands near the shooter's own side. */
const lob = (c: MatchController): void => {
  c.setAim({ angleDeg: 85, power: 15 });
  c.fire();
  c.shotLanded();
};

/**
 * Plays the turn machine forward. The `shooter` team fires `onShot()` at its aiming steps;
 * the other team fires harmless lobs. Reloads are answered wrong, so only `RIGHT` Power
 * Shots come from tests that ask for them. Stops when `done()` is true or the match ends.
 */
function drive(c: MatchController, shooter: Team, onShot: () => void, done: () => boolean): void {
  for (let guard = 0; guard < 400 && !done(); guard++) {
    const t = c.snapshot().turn;
    if (c.snapshot().status === 'OVER') return;
    if (t.phase === 'PASS_SCREEN') c.ready();
    else if (t.phase === 'AIMING' || t.phase === 'BONUS_AIMING') {
      if (t.team === shooter) onShot();
      else lob(c);
    } else if (t.phase === 'RELOAD') c.reloadDone(WRONG);
    else if (t.phase === 'NEXT_PLAYER') c.pass();
  }
}

/** Hits `target` with `times` direct hits, spread over as many turns as it takes. */
function hitTimes(c: MatchController, target: UnitId, times: number): BlastOutcome[] {
  const outcomes: BlastOutcome[] = [];
  const shooter = otherTeam(unitsOf('FUTURE').some((u) => u.id === target) ? 'FUTURE' : 'PAST');
  drive(
    c,
    shooter,
    () => outcomes.push(shoot(c, { direct: target })),
    () => outcomes.length >= times,
  );
  return outcomes;
}

describe('the flag', () => {
  it('is off by default, with the owner numbers', () => {
    expect(CHARACTER_HEALTH.enabled).toBe(false);
    // Pace (owner, 2026-10-24): four health, so a perfect team needs about five turns.
    expect(CHARACTER_HEALTH.hp).toBe(4);
    expect(CHARACTER_HEALTH.directHit).toBe(1);
    expect(CHARACTER_HEALTH.nearHit).toBe(0);
  });
  it('powerHit is directHit x the Power Shot multiplier, rounded (1.5 rounds to 2)', () => {
    expect(CHARACTER_HEALTH.powerHit).toBe(
      Math.round(CHARACTER_HEALTH.directHit * BONUS.damageMultiplier),
    );
    expect(CHARACTER_HEALTH.powerHit).toBe(2);
  });
  it('a match made with no option follows the constant (off)', () => {
    expect(createMatch({ players: PLAYERS, seed: 1 }).snapshot().characterHealth).toBe(false);
  });
});

describe('start of a match', () => {
  it('gives all ten fighters full health, five alive per team', () => {
    const s = mk(true).snapshot();
    expect(s.characterHealth).toBe(true);
    expect(Object.keys(s.unitHp).sort()).toEqual([...UNIT_IDS].sort());
    for (const id of UNIT_IDS) expect(s.unitHp[id]).toBe(HP);
    expect(s.maxUnitHp).toBe(HP);
    expect(s.aliveCount).toEqual({ PAST: 5, FUTURE: 5 });
    expect(UNITS).toHaveLength(10);
  });
  it('keeps baseHp in the snapshot at full', () => {
    expect(mk(true).snapshot().baseHp).toEqual(FULL_BASE);
  });
  it('a rematch keeps the setting', () => {
    expect(createMatch(mk(true).rematchOptions()).snapshot().characterHealth).toBe(true);
    expect(createMatch(mk(false).rematchOptions()).snapshot().characterHealth).toBe(false);
  });
});

describe('damage table', () => {
  it('direct 1, Power Shot 2, near miss 0, miss 0', () => {
    expect(unitDamage('direct', false)).toBe(1);
    expect(unitDamage('direct', true)).toBe(2);
    expect(unitDamage('near', false)).toBe(0);
    expect(unitDamage('near', true)).toBe(0);
    expect(unitDamage('miss', false)).toBe(0);
  });
});

describe('resolveUnitBlast (pure geometry)', () => {
  const hp = freshUnitHp();
  const box = unitBox('FUTURE', '1', PHASE1_LAYOUT);
  const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  it('a path through the box is one direct hit, and the shell stops there', () => {
    const r = resolveUnitBlast(
      [{ x: 0, y: 0 }, centre],
      { x: 9999, y: 9999 },
      'FUTURE',
      hp,
      PHASE1_LAYOUT,
    );
    expect(r.hits.filter((h) => h.result === 'direct')).toEqual([{ unit: '1', result: 'direct' }]);
    expect(r.impact).toEqual(centre);
  });
  it('a landing near the box (not in it) is a near miss only', () => {
    const near = { x: box.x - 60, y: box.y + box.h / 2 };
    const r = resolveUnitBlast([near], near, 'FUTURE', hp, PHASE1_LAYOUT);
    expect(r.hits).toContainEqual({ unit: '1', result: 'near' });
    expect(r.hits.some((h) => h.result === 'direct')).toBe(false);
  });
  it('a far landing hits nobody', () => {
    const far = { x: 600, y: 100 };
    expect(resolveUnitBlast([far], far, 'FUTURE', hp, PHASE1_LAYOUT).hits).toEqual([]);
  });
  it('a knocked-out fighter is never hit or tumbled', () => {
    const down = { ...hp, '1': 0 };
    const r = resolveUnitBlast([centre], centre, 'FUTURE', down, PHASE1_LAYOUT);
    expect(r.hits.some((h) => h.unit === '1')).toBe(false);
  });
  it('only the target team is scored', () => {
    const r = resolveUnitBlast([centre], centre, 'PAST', hp, PHASE1_LAYOUT);
    expect(r.hits.every((h) => unitsOf('PAST').some((u) => u.id === h.unit))).toBe(true);
  });
});

// Each shot searches the aim grid, so these are slow on a busy machine.
describe('hits in a match', { timeout: 120_000 }, () => {
  it('a direct hit costs 1 health and nothing else changes', () => {
    const c = mk(true);
    c.ready();
    const out = shoot(c, { direct: '1' });
    expect(out.result).toBe('direct');
    expect(out.damage).toBe(1);
    expect(out.units?.find((u) => u.unit === '1')).toMatchObject({
      damage: 1,
      hp: HP - 1,
      knockedOut: false,
    });
    const s = c.snapshot();
    expect(s.unitHp['1']).toBe(HP - 1);
    expect(s.aliveCount.FUTURE).toBe(5);
    expect(s.baseHp).toEqual(FULL_BASE);
    expect(s.stats.PAST.directHits).toBe(1);
    expect(s.status).toBe('PLAYING');
  });

  it('full health in direct hits knocks a fighter out, reported once', () => {
    const c = mk(true);
    const outs = hitTimes(c, '1', HP);
    const countdown = Array.from({ length: HP }, (_, i) => HP - 1 - i);
    expect(outs.map((o) => o.units?.find((u) => u.unit === '1')?.hp)).toEqual(countdown);
    for (const o of outs.slice(0, -1)) expect(o.knockedOut).toEqual([]);
    expect(outs[HP - 1]!.knockedOut).toEqual(['1']);
    const last = outs[HP - 1]!.units?.find((u) => u.unit === '1');
    expect(last).toMatchObject({ knockedOut: true, tumble: true });
    expect(last?.bubbleIndex).not.toBeNull();
    const s = c.snapshot();
    expect(s.unitHp['1']).toBe(0);
    expect(s.aliveCount.FUTURE).toBe(4);
    expect(s.status).toBe('PLAYING');
  });

  it('a Power Shot direct hit costs 2', () => {
    const c = mk(true);
    c.ready();
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 85, power: 15 });
      c.fire();
      c.shotLanded();
    }
    c.reloadDone(RIGHT);
    expect(c.snapshot().turn.phase).toBe('BONUS_AIMING');
    const out = shoot(c, { direct: '1' });
    expect(out.damage).toBe(CHARACTER_HEALTH.powerHit);
    expect(c.snapshot().unitHp['1']).toBe(HP - CHARACTER_HEALTH.powerHit);
  });

  it('a Power Shot can finish a fighter on 1 health (no negative health)', () => {
    const c = mk(true);
    hitTimes(c, '1', HP - 1);
    // Finish Team Past's turn with harmless lobs, then take the Power Shot.
    while (c.snapshot().turn.phase === 'AIMING') lob(c);
    expect(c.snapshot().turn.phase).toBe('RELOAD');
    expect(c.snapshot().unitHp['1']).toBe(1);
    c.reloadDone(RIGHT);
    const out = shoot(c, { direct: '1' });
    expect(out.units?.find((u) => u.unit === '1')).toMatchObject({
      damage: CHARACTER_HEALTH.powerHit,
      hp: 0,
      knockedOut: true,
    });
    expect(c.snapshot().unitHp['1']).toBe(0);
  });

  it('a near miss does no damage but the fighter tumbles', () => {
    const c = mk(true);
    c.ready();
    const out = shoot(c, { near: true });
    expect(out.result).toBe('near');
    expect(out.damage).toBe(0);
    expect(out.tumble).toBe(true);
    expect(out.bubbleIndex).not.toBeNull();
    expect(out.units?.every((u) => u.damage === 0 && u.tumble && !u.knockedOut)).toBe(true);
    const s = c.snapshot();
    for (const id of UNIT_IDS) expect(s.unitHp[id]).toBe(HP);
    expect(s.stats.PAST.nearHits).toBe(1);
  });

  it('a knocked-out fighter takes no more hits, cannot be picked, and the pick moves on', () => {
    const c = mk(true);
    hitTimes(c, '1', HP);
    const s = c.snapshot();
    expect(s.selected.FUTURE).not.toBe('1');
    expect(aliveUnitIds(s.unitHp, 'FUTURE')).not.toContain('1');
    // Shots can no longer find it.
    expect(() => findAim(c, { direct: '1' })).toThrow();
    // Its team cannot select it on their turn.
    drive(
      c,
      'PAST',
      () => lob(c),
      () => c.snapshot().turn.team === 'FUTURE' && c.snapshot().turn.phase === 'AIMING',
    );
    expect(() => c.selectUnit('1')).toThrow(RangeError);
    c.selectUnit('2');
    expect(c.snapshot().selected.FUTURE).toBe('2');
  });

  it('a team with one fighter left still gets its 2 shots and a reload', () => {
    const c = mk(true);
    for (const id of ['1', '2', '3', '4'] as const) hitTimes(c, id, HP);
    expect(c.snapshot().aliveCount.FUTURE).toBe(1);
    expect(c.snapshot().selected.FUTURE).toBe('5');
    drive(
      c,
      'PAST',
      () => lob(c),
      () => c.snapshot().turn.team === 'FUTURE' && c.snapshot().turn.phase === 'AIMING',
    );
    const before = c.snapshot().stats.FUTURE.shotsFired;
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 80, power: 20 });
      c.fire();
      c.shotLanded();
    }
    expect(c.snapshot().turn.phase).toBe('RELOAD');
    expect(c.snapshot().stats.FUTURE.shotsFired - before).toBe(2);
  });
});

describe('win condition', { timeout: 120_000 }, () => {
  it('a team loses when ALL its fighters are knocked out, and base health is ignored', () => {
    const c = mk(true);
    for (const id of ['1', '2', '3', '4'] as const) hitTimes(c, id, HP);
    expect(c.snapshot().status).toBe('PLAYING');
    const last = hitTimes(c, '5', HP);
    expect(last[HP - 1]!.knockedOut).toEqual(['5']);
    const s = c.snapshot();
    expect(s.status).toBe('OVER');
    expect(s.winner).toBe('PAST');
    expect(s.aliveCount).toEqual({ PAST: 5, FUTURE: 0 });
    expect(s.baseHp).toEqual(FULL_BASE);
    expect(() => c.pass()).toThrow(MatchOverError);
  });

  it('pure winner helpers work in both modes', () => {
    const hp = freshUnitHp();
    expect(winnerOfUnits(hp)).toBeNull();
    const futureOut = { ...hp, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    expect(teamKnockedOut(futureOut, 'FUTURE')).toBe(true);
    expect(winnerOfUnits(futureOut)).toBe('PAST');
    const pastOut = { ...hp, A: 0, B: 0, C: 0, D: 0, E: 0 };
    expect(winnerOfUnits(pastOut)).toBe('FUTURE');
    const base = { PAST: 100, FUTURE: 0 };
    // Flag off: the base decides. Flag on: the fighters decide and a 0 base does not matter.
    expect(winnerOfMatch({ baseHp: base, unitHp: hp, characterHealth: false })).toBe('PAST');
    expect(winnerOfMatch({ baseHp: base, unitHp: hp, characterHealth: true })).toBeNull();
    expect(winnerOfMatch({ baseHp: base, unitHp: pastOut, characterHealth: true })).toBe('FUTURE');
    expect(winnerOf(base)).toBe('PAST');
  });
});

describe('flag off behaves as before', () => {
  it('a direct hit on the base still costs base health and leaves fighters alone', () => {
    const c = mk(false);
    c.ready();
    // Aim straight at the Future base using the old scoring.
    let aim: AimInput | null = null;
    const snap = c.snapshot();
    for (let p = 100; p >= 10 && !aim; p--)
      for (let a = 0; a <= 90 && !aim; a++) {
        const r = simulateShot({
          angleDeg: a,
          power: p,
          wind: snap.wind,
          origin: c.layout.launchOrigins.PAST,
          facing: 1,
          layout: c.layout,
        });
        if (r.hit.kind === 'base') aim = { angleDeg: a, power: p };
      }
    c.setAim(aim as AimInput);
    c.fire();
    const out = c.shotLanded();
    expect(out.units).toBeUndefined();
    expect(out.knockedOut).toBeUndefined();
    const s = c.snapshot();
    expect(s.baseHp.FUTURE).toBeLessThan(DAMAGE.startingBaseHp);
    for (const id of UNIT_IDS) expect(s.unitHp[id]).toBe(HP);
    expect(s.aliveCount).toEqual({ PAST: 5, FUTURE: 5 });
  });

  it('selecting any fighter still works with the flag off', () => {
    const c = mk(false);
    c.ready();
    c.selectUnit('A');
    expect(c.snapshot().selected.PAST).toBe('A');
  });
});

describe('determinism', { timeout: 120_000 }, () => {
  it('the same seed and the same shots give the same outcomes', () => {
    const run = (): string => {
      const c = mk(true, 11);
      return JSON.stringify([hitTimes(c, '1', HP), c.snapshot()]);
    };
    expect(run()).toBe(run());
  });
});

describe('bot with fighters knocked out', () => {
  const base = (): Match => mk(true, 3).snapshot();
  const withHp = (down: UnitId[], selected: Partial<Record<Team, UnitId>> = {}): Match => {
    const s = base();
    const unitHp = { ...s.unitHp };
    for (const id of down) unitHp[id] = 0;
    return { ...s, unitHp, selected: { ...s.selected, ...selected } };
  };

  it('moves off a knocked-out pick to a fighter that stands', () => {
    const rng = createRng(1);
    const shot = chooseShot(withHp(['C'], { PAST: 'C' }), 'PAST', 'medium', rng);
    expect(shot.unit).not.toBe('C');
    expect(unitsOf('PAST').map((u) => u.id)).toContain(shot.unit);
  });

  it('only ever picks alive fighters, over many random survivor sets', () => {
    const rng = createRng(77);
    for (let i = 0; i < 60; i++) {
      const team: Team = i % 2 ? 'PAST' : 'FUTURE';
      const ids = unitsOf(team).map((u) => u.id);
      const keep = rng.pick(ids);
      const extra = rng.next() < 0.5 ? rng.pick(ids) : keep;
      const down = ids.filter((id) => id !== keep && id !== extra);
      const state = withHp(down, { [team]: rng.pick(ids) });
      const shot = chooseShot(state, team, 'hard', rng);
      expect([keep, extra]).toContain(shot.unit);
      expect(shot.angleDeg).toBeGreaterThanOrEqual(0);
      expect(shot.angleDeg).toBeLessThanOrEqual(90);
      expect(shot.power).toBeGreaterThanOrEqual(0);
      expect(shot.power).toBeLessThanOrEqual(100);
    }
  });

  it('with the flag off it keeps the pick even if the numbers say 0', () => {
    const s = { ...withHp(['C'], { PAST: 'C' }), characterHealth: false };
    expect(chooseShot(s, 'PAST', 'medium', createRng(1)).unit).toBe('C');
  });
});

describe('matches always end with the flag on', () => {
  it('200 seeded bot matches each end with a winner under the turn cap', () => {
    const levels = PRACTICE_BOT.levels;
    const profiles = [levels.easy, levels.medium, levels.hard, PRACTICE_BOT.scriptedHuman];
    for (let seed = 1; seed <= 200; seed++) {
      const r = playBotMatch({
        seed,
        characterHealth: true,
        firstTeam: seed % 2 ? 'PAST' : 'FUTURE',
        profiles: { PAST: profiles[seed % 4]!, FUTURE: profiles[(seed >> 2) % 4]! },
      });
      expect(r.ended, `seed ${seed}`).toBe(true);
      expect(r.winner, `seed ${seed}`).not.toBeNull();
      expect(r.turns, `seed ${seed}`).toBeLessThanOrEqual(PRACTICE_BOT.maxSimTurns);
    }
  }, 900_000);
});
