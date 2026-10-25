// Weapons and upgrades inside a real match: damage, walls, force field, health, repair, range.
import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import { DAMAGE, TEAM_FACING } from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import {
  DEFAULT_EFFECTS,
  effectsFor,
  freshLoadout,
  type MatchEffects,
  type TeamLoadout,
} from '../../src/game/loadout';
import { createMatch } from '../../src/game/match';
import {
  otherTeam,
  type AimInput,
  type BlastResult,
  type MatchController,
  type Players,
  type Team,
} from '../../src/game/types';

/** A fresh base's full health. */
const FULL = DAMAGE.startingBaseHp;

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 5, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'reading' },
];

const effectsWith = (
  past: Partial<TeamLoadout> = {},
  future: Partial<TeamLoadout> = {},
): MatchEffects => ({
  PAST: effectsFor('PAST', { ...freshLoadout('PAST'), ...past }),
  FUTURE: effectsFor('FUTURE', { ...freshLoadout('FUTURE'), ...future }),
});

/** Brute-force an aim that really scores `want` for the team now aiming, using its weapon speed. */
function findAim(c: MatchController, effects: MatchEffects, want: BlastResult, skip = 0): AimInput {
  const snap = c.snapshot();
  const team = snap.turn.team;
  let seen = 0;
  for (let power = 100; power >= 0; power -= 1) {
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += 1) {
      const r = simulateShot({
        angleDeg,
        power,
        wind: snap.wind,
        origin: c.layout.launchOrigins[team],
        facing: TEAM_FACING[team],
        layout: c.layout,
        speedScale: effects[team].speedScale,
      });
      const scored =
        r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout'
          ? 'miss'
          : classifyBlast(r.landing, c.layout.bases[otherTeam(team)]);
      if (scored === want && seen++ >= skip) return { angleDeg, power };
    }
  }
  throw new Error(`no ${want} aim found`);
}

/** A wrong answer: no Power Shot, so these tests keep their exact numbers. */
const FAST = { correct: false, elapsedMs: 2000 };

/** One shot by the team now aiming. Returns what landed. */
function shoot(c: MatchController, effects: MatchEffects, want: BlastResult, skip = 0) {
  c.setAim(findAim(c, effects, want, skip));
  c.fire();
  return c.shotLanded();
}

/** A whole turn: both shots score `want`, then reload and pass (unless the match ended). */
function turn(c: MatchController, effects: MatchEffects, want: BlastResult): void {
  c.ready();
  shoot(c, effects, want, 0);
  if (c.snapshot().status === 'OVER') return;
  shoot(c, effects, want, 1);
  if (c.snapshot().status === 'OVER') return;
  c.reloadDone(FAST);
  c.pass();
}

describe('default effects (a fresh game)', () => {
  it('play exactly like a match with no effects at all (Phase 1 is unchanged)', () => {
    const a = createMatch({ disturbances: false, players: PLAYERS, seed: 5 });
    const b = createMatch({ disturbances: false, players: PLAYERS, seed: 5, effects: DEFAULT_EFFECTS });
    for (const c of [a, b]) {
      turn(c, DEFAULT_EFFECTS, 'direct');
      turn(c, DEFAULT_EFFECTS, 'near');
    }
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(a.snapshot().baseHp).toEqual({
      PAST: FULL - 2 * DAMAGE.near,
      FUTURE: FULL - 2 * DAMAGE.direct,
    });
    expect(a.snapshot().maxBaseHp).toEqual({ PAST: FULL, FUTURE: FULL });
  });
});

describe('weapons', () => {
  it('a heavier weapon does its own direct damage', () => {
    const e = effectsWith({
      weapon: 'ironCannon',
      owned: { royalSword: 1, ironCannon: 1 },
    });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 3, effects: e });
    c.ready();
    const out = shoot(c, e, 'direct');
    expect(out.damage).toBe(e.PAST.direct);
    expect(e.PAST.direct).toBe(32);
    expect(c.snapshot().baseHp.FUTURE).toBe(FULL - 32);
  });
  it('a weapon forged to level 3 hits harder than at level 1', () => {
    const e = effectsWith({ owned: { royalSword: 3 } });
    expect(e.PAST.direct).toBeGreaterThan(DEFAULT_EFFECTS.PAST.direct);
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 3, effects: e });
    c.ready();
    expect(shoot(c, e, 'direct').damage).toBe(e.PAST.direct);
  });
  it('a longer-range weapon throws farther at the same aim', () => {
    const slow = createMatch({ disturbances: false, players: PLAYERS, seed: 4 });
    const e = effectsWith({ weapon: 'ironCannon', owned: { royalSword: 1, ironCannon: 1 } });
    const fast = createMatch({ disturbances: false, players: PLAYERS, seed: 4, effects: e });
    const aim = { angleDeg: 40, power: 50 };
    for (const c of [slow, fast]) {
      c.ready();
      c.setAim(aim);
    }
    const a = slow.fire();
    const b = fast.fire();
    expect(b.landing.x).toBeGreaterThan(a.landing.x);
  });
  it('the Future weapon speed applies to the Future shooter only', () => {
    const e = effectsWith({}, { weapon: 'railCannon', owned: { plasmaBlade: 1, railCannon: 1 } });
    expect(e.FUTURE.speedScale).toBeGreaterThan(1);
    expect(e.PAST.speedScale).toBe(1);
  });
});

describe('upgrades: base health', () => {
  it('starts a base at its raised full health', () => {
    const e = effectsWith({ upgrades: { tower: 2 } });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 6, effects: e });
    expect(c.snapshot().maxBaseHp).toEqual({ PAST: e.PAST.maxHp, FUTURE: FULL });
    expect(c.snapshot().baseHp.PAST).toBe(e.PAST.maxHp);
    expect(e.PAST.maxHp).toBeGreaterThan(FULL);
  });
});

describe('upgrades: walls', () => {
  it('a wall takes damage off a direct hit, never below 1', () => {
    const e = effectsWith({ upgrades: { wall: 3 } });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 7, effects: e, firstTeam: 'FUTURE' });
    c.ready();
    const out = shoot(c, e, 'direct');
    expect(out.damage).toBe(DEFAULT_EFFECTS.FUTURE.direct - e.PAST.directCut);
    expect(out.damage).toBeGreaterThanOrEqual(1);
  });
  it('a huge wall still lets 1 damage through', () => {
    const e = effectsWith({ upgrades: { wall: 3 } });
    const huge: MatchEffects = { ...e, PAST: { ...e.PAST, directCut: 999, nearCut: 999 } };
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 7, effects: huge, firstTeam: 'FUTURE' });
    c.ready();
    expect(shoot(c, huge, 'direct').damage).toBe(1);
  });
  it('a gate takes damage off a near miss, and it still tumbles', () => {
    const e = effectsWith({ upgrades: { gate: 3 } });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 8, effects: e, firstTeam: 'FUTURE' });
    c.ready();
    const out = shoot(c, e, 'near');
    expect(out.damage).toBe(Math.max(1, DEFAULT_EFFECTS.FUTURE.near - e.PAST.nearCut));
    expect(out.tumble).toBe(true);
  });
  it('a wall does not soften a near miss, and a gate does not soften a direct hit', () => {
    const wall = effectsWith({ upgrades: { wall: 3 } });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 8, effects: wall, firstTeam: 'FUTURE' });
    c.ready();
    expect(shoot(c, wall, 'near').damage).toBe(DEFAULT_EFFECTS.FUTURE.near);
    const gate = effectsWith({ upgrades: { gate: 3 } });
    const d = createMatch({ disturbances: false, players: PLAYERS, seed: 8, effects: gate, firstTeam: 'FUTURE' });
    d.ready();
    expect(shoot(d, gate, 'direct').damage).toBe(DEFAULT_EFFECTS.FUTURE.direct);
  });
});

describe('upgrades: force field', () => {
  const fielded = effectsWith({}, { upgrades: { forceField: 2 } });

  it('blocks the first hits on that base, then lets damage through', () => {
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 9, effects: fielded });
    c.ready();
    const first = shoot(c, fielded, 'direct');
    expect(first.damage).toBe(0);
    expect(first.blocked).toBe(true);
    const second = shoot(c, fielded, 'direct', 1);
    expect(second.blocked).toBe(true);
    expect(c.snapshot().baseHp.FUTURE).toBe(FULL);
    c.reloadDone(FAST);
    c.pass();
    c.ready();
    c.setAim({ angleDeg: 45, power: 60 });
    c.fire();
    c.shotLanded();
    c.setAim({ angleDeg: 45, power: 60 });
    c.fire();
    c.shotLanded();
    c.reloadDone(FAST);
    c.pass();
    c.ready();
    const third = shoot(c, fielded, 'direct');
    expect(third.blocked).toBeUndefined();
    expect(third.damage).toBe(DEFAULT_EFFECTS.PAST.direct);
    expect(c.snapshot().baseHp.FUTURE).toBe(FULL - DEFAULT_EFFECTS.PAST.direct);
  });
  it('does not block a miss, and a miss does not use up the field', () => {
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 9, effects: fielded });
    c.ready();
    const miss = shoot(c, fielded, 'miss');
    expect(miss.blocked).toBeUndefined();
    const hit = shoot(c, fielded, 'direct');
    expect(hit.blocked).toBe(true);
  });
  it('still counts a blocked hit in the stats (the shooter did hit)', () => {
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 9, effects: fielded });
    c.ready();
    shoot(c, fielded, 'direct');
    expect(c.snapshot().stats.PAST.directHits).toBe(1);
  });
  it('is fresh in a rematch', () => {
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 9, effects: fielded });
    c.ready();
    shoot(c, fielded, 'direct');
    shoot(c, fielded, 'direct', 1);
    const again = createMatch(c.rematchOptions());
    again.ready();
    // The rematch starts with FUTURE first, so PAST shoots on the second turn.
    again.setAim({ angleDeg: 45, power: 60 });
    expect(again.snapshot().baseHp.FUTURE).toBe(FULL);
  });
});

describe('upgrades: missiles and squad', () => {
  it('a missile launcher adds to that team direct hits', () => {
    const e = effectsWith({}, { upgrades: { missiles: 3 } });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 10, effects: e, firstTeam: 'FUTURE' });
    c.ready();
    const out = shoot(c, e, 'direct');
    expect(out.damage).toBe(DEFAULT_EFFECTS.FUTURE.direct + e.FUTURE.directBonus);
    expect(e.FUTURE.directBonus).toBeGreaterThan(0);
  });
  it('a squad heals its own base at the end of its own turn, up to full health', () => {
    const e = effectsWith({}, { upgrades: { squad: 2 } });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 11, effects: e });
    turn(c, e, 'direct'); // PAST hits FUTURE twice
    const hurt = FULL - 2 * DAMAGE.direct;
    expect(c.snapshot().baseHp.FUTURE).toBe(hurt);
    turn(c, e, 'miss'); // FUTURE misses; its turn ends and the squad heals it
    expect(c.snapshot().baseHp.FUTURE).toBe(Math.min(FULL, hurt + e.FUTURE.repair));
    expect(e.FUTURE.repair).toBeLessThan(2 * DAMAGE.direct); // a real heal, not a full one
  });
  it('does not heal the other team, and never past full health', () => {
    const e = effectsWith({}, { upgrades: { squad: 3 } });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 12, effects: e });
    turn(c, e, 'miss');
    turn(c, e, 'miss');
    expect(c.snapshot().baseHp).toEqual({ PAST: FULL, FUTURE: FULL });
  });
  it('a team with no squad is not healed', () => {
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 13 });
    turn(c, DEFAULT_EFFECTS, 'miss');
    turn(c, DEFAULT_EFFECTS, 'direct');
    turn(c, DEFAULT_EFFECTS, 'miss');
    expect(c.snapshot().baseHp.PAST).toBe(FULL - 2 * DAMAGE.direct);
  });
});

describe('rematch', () => {
  it('keeps the same weapons and upgrades', () => {
    const e = effectsWith({ upgrades: { tower: 1 } }, { upgrades: { forceField: 1 } });
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 14, effects: e });
    expect(c.rematchOptions().effects).toBe(e);
    const again = createMatch(c.rematchOptions());
    expect(again.snapshot().maxBaseHp).toEqual({ PAST: e.PAST.maxHp, FUTURE: e.FUTURE.maxHp });
  });
});

describe('who gets the damage', () => {
  it.each<Team>(['PAST', 'FUTURE'])('%s hits the other team and never itself', (team) => {
    const c = createMatch({ disturbances: false, players: PLAYERS, seed: 15, firstTeam: team });
    c.ready();
    const out = shoot(c, DEFAULT_EFFECTS, 'direct');
    expect(out.target).toBe(otherTeam(team));
    expect(c.snapshot().baseHp[team]).toBe(FULL);
  });
});
