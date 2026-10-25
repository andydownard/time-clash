// No stalemate with walking dashers. Walks every board the dasher rules can reach, then plays
// whole matches where one side, or both, only use their dashers.
import { describe, expect, it } from 'vitest';
import {
  CHARACTER_HEALTH,
  DAMAGE,
  PHASE1_LAYOUT as LAYOUT,
  PRACTICE_BOT,
  SQUADS,
} from '../../src/game/config';
import {
  dashTargets,
  dasherOf,
  doorstepOf,
  hitDasher,
  groundSpotPoint,
  planDash,
  planRecall,
  planStand,
  startingCrew,
  wakeDashers,
  type Crew,
} from '../../src/game/crew';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import { playBotMatch } from '../../src/game/botPlay';
import { profileOf } from '../../src/game/bot';
import type { MatchController, Players, Team } from '../../src/game/types';

const HP = CHARACTER_HEALTH.hp;
const TEAMS: readonly Team[] = ['PAST', 'FUTURE'];
const REST = { PAST: 1, FUTURE: 1 } as const;
const bubble = () => 0;
const key = (c: Crew): string =>
  c.helpers
    .filter((h) => h.kind === 'dasher')
    .map((h) => `${h.state}:${h.spot}:${h.hp}`)
    .join('|');
const picked = (c: Crew, team: Team): Crew => ({
  ...c,
  picked: { ...c.picked, [team]: `${team}-dasher` },
});

/** Every board one move away: a walk out, a call home, a turn start, a shell, or a wake-up. */
function nextBoards(c: Crew): Crew[] {
  const out: Crew[] = [];
  for (const team of TEAMS) {
    const p = picked(c, team);
    const to = dashTargets(p, team)[0];
    if (to) out.push(planDash(p, team, to, HP).crew);
    if (dasherOf(c, team).state === 'out') out.push(planRecall(p, team, 1).crew);
    out.push(planStand(c, team, REST, bubble).crew);
    out.push(wakeDashers(c, team, 1, HP));
    const d = dasherOf(c, team);
    if (d.state === 'out' && d.spot) {
      const at = groundSpotPoint(d.spot, LAYOUT);
      out.push(hitDasher(c, team, { x: at.x, y: at.y - 8 }, LAYOUT, false, 1, bubble).crew);
    }
  }
  return out;
}

function reachable(): Crew[] {
  const seen = new Map<string, Crew>();
  const queue = [startingCrew()];
  while (queue.length) {
    const c = queue.shift() as Crew;
    if (seen.has(key(c))) continue;
    seen.set(key(c), c);
    queue.push(...nextBoards(c));
  }
  return [...seen.values()];
}

describe('every board the dasher rules can reach', () => {
  const boards = reachable();

  it('is a small, finite set', () => {
    expect(boards.length).toBeGreaterThan(10);
    expect(boards.length).toBeLessThan(500);
  });

  it('never has two dashers on one spot, or a dasher on the enemy doorstep', () => {
    for (const c of boards) {
      const past = dasherOf(c, 'PAST');
      const future = dasherOf(c, 'FUTURE');
      if (past.spot && future.spot) expect(past.spot).not.toBe(future.spot);
      for (const d of [past, future]) {
        if (d.spot) expect(doorstepOf(d.spot) === null || doorstepOf(d.spot) === d.team).toBe(true);
        expect(d.state === 'out').toBe(d.spot !== null);
      }
    }
  });

  it('a dasher at home can always walk out (there is always a free spot)', () => {
    for (const c of boards) {
      for (const team of TEAMS) {
        if (dasherOf(c, team).state === 'home')
          expect(dashTargets(picked(c, team), team), key(c)).toHaveLength(1);
      }
    }
  });

  it('at every turn start, every dasher out bonks something, so nothing stands still forever', () => {
    for (const c of boards) {
      for (const active of TEAMS) {
        const r = planStand(c, active, REST, bubble);
        const outTeams = TEAMS.filter((t) => dasherOf(c, t).state === 'out');
        expect(r.beats.map((b) => b.team).sort(), key(c)).toEqual([...outTeams].sort());
        for (const b of r.beats) {
          if (b.target.kind === 'base') expect(b.target.damage).toBe(SQUADS.standBonkDamage);
          else
            expect(b.target.hp).toBeLessThan(dasherOf(c, b.team === 'PAST' ? 'FUTURE' : 'PAST').hp);
        }
      }
    }
  });
});

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'math' },
];
/**
 * A safe bound on match length when nobody aims: at least one base bonk lands every few rounds
 * of a duel (each dasher bonked to 0, a rest, then out again), so the cap grows with base health
 * and dasher health, both from config.
 */
const CAP =
  Math.ceil(DAMAGE.startingBaseHp / SQUADS.standBonkDamage) * 6 * (CHARACTER_HEALTH.hp + 2);

type Style = 'dasherOnly' | 'aims';

/**
 * Plays to the end. A 'dasherOnly' side never aims: it walks its dasher out whenever it can,
 * never calls him home, and spends any other go on a harmless shell. An 'aims' side never uses
 * its dasher and fires seeded random aims. Returns the turns played and the most base health
 * lost at any one turn start.
 */
function play(seed: number, styles: Record<Team, Style>): { turns: number; worstStart: number } {
  const c: MatchController = createMatch({
    disturbances: false,
    players: PLAYERS,
    seed,
    squads: true,
  });
  const rng = createRng(seed);
  let worstStart = 0;
  for (let turns = 1; turns <= CAP; turns++) {
    const before = c.snapshot().baseHp;
    c.ready();
    const after = c.snapshot().baseHp;
    worstStart = Math.max(worstStart, before.PAST - after.PAST + before.FUTURE - after.FUTURE);
    if (c.snapshot().status === 'OVER') return { turns, worstStart };
    const team = c.snapshot().turn.team;
    while (c.snapshot().turn.phase === 'AIMING') {
      if (
        styles[team] === 'dasherOnly' &&
        dasherOf(c.snapshot().squads!.crew, team).state === 'home'
      ) {
        c.selectHelper(`${team}-dasher`);
        c.dash(c.helperTargets()[0]!);
        continue;
      }
      c.selectHelper(`${team}-launcher`);
      c.setAim(
        styles[team] === 'aims'
          ? { angleDeg: 20 + Math.floor(rng.next() * 50), power: 50 + Math.floor(rng.next() * 50) }
          : { angleDeg: 90, power: 0 },
      );
      c.fire();
      c.shotLanded();
      if (c.snapshot().status === 'OVER') return { turns, worstStart };
    }
    c.reloadDone({ correct: false, elapsedMs: 1000 });
    c.pass();
  }
  return { turns: CAP + 1, worstStart };
}

describe('no stalemate in whole matches', () => {
  it('a side that never aims cannot stall the match: it still ends', () => {
    for (const seed of [1, 2, 3]) {
      expect(play(seed, { PAST: 'dasherOnly', FUTURE: 'aims' }).turns).toBeLessThanOrEqual(CAP);
      expect(play(seed, { PAST: 'aims', FUTURE: 'dasherOnly' }).turns).toBeLessThanOrEqual(CAP);
    }
  });

  it('when both sides only use their dashers the match still ends, and a turn start is bounded', () => {
    for (const seed of [1, 2, 3]) {
      const r = play(seed, { PAST: 'dasherOnly', FUTURE: 'dasherOnly' });
      expect(r.turns).toBeLessThanOrEqual(CAP);
      // At most both dashers bonk a base at one turn start.
      expect(r.worstStart).toBeLessThanOrEqual(2 * SQUADS.standBonkDamage);
    }
  });

  it('the Computer player with Squads on (it leaves its dasher home) still finishes', () => {
    const medium = profileOf('medium');
    for (const seed of [1, 2, 3]) {
      const r = playBotMatch({ seed, profiles: { PAST: medium, FUTURE: medium } });
      expect(r.ended).toBe(true);
      expect(r.turns).toBeLessThan(PRACTICE_BOT.maxSimTurns);
    }
  });
});
