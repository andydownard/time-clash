// The pace rule with Squads on (owner, 2026-10-24): a perfect-aim player still needs about five
// turns of their own to win. A dasher adds a little speed, never a lot. Perfect bots that keep
// their dasher out every turn still need at least 9 turns in all (both sides counted).
import { describe, expect, it } from 'vitest';
import { chooseShotWith, profileOf } from '../../src/game/bot';
import { DAMAGE, PHASE1_LAYOUT } from '../../src/game/config';
import { dasherOf } from '../../src/game/crew';
import { DEFAULT_EFFECTS, type MatchEffects } from '../../src/game/loadout';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import type { Players, Team } from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Knight', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Rocket', team: 'FUTURE', grade: 3, subject: 'math' },
];
const PERFECT = {
  ...profileOf('hard'),
  angleSpreadDeg: 0,
  powerSpreadPct: 0,
  windSkill: 1,
  reloadAccuracy: 1,
};
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

const withHp = (hp: number): MatchEffects => ({
  PAST: { ...DEFAULT_EFFECTS.PAST, maxHp: hp },
  FUTURE: { ...DEFAULT_EFFECTS.FUTURE, maxHp: hp },
});

/** Turns in all (both sides) until someone wins. Every turn ends with a right answer. */
function perfectMatch(seed: number, soldiers: boolean, effects: MatchEffects): number {
  const c = createMatch({ disturbances: false, players: PLAYERS, seed, squads: true, effects });
  const rng = createRng(seed);
  const over = () => c.snapshot().status === 'OVER';
  const shoot = (team: Team) => {
    if (c.snapshot().turn.phase === 'AIMING') c.selectHelper(`${team}-launcher`);
    const shot = chooseShotWith(c.snapshot(), team, PERFECT, rng, {
      layout: PHASE1_LAYOUT,
      effects,
    });
    c.selectUnit(shot.unit);
    c.setAim(shot);
    c.fire();
    c.shotLanded();
  };
  for (let turns = 1; turns <= 200; turns++) {
    c.ready();
    if (over()) return turns;
    const team = c.snapshot().turn.team;
    if (soldiers && dasherOf(c.snapshot().squads!.crew, team).state === 'home') {
      c.selectHelper(`${team}-dasher`);
      c.dash(c.helperTargets()[0]!);
    }
    while (c.snapshot().turn.phase === 'AIMING' && !over()) shoot(team);
    if (over()) return turns;
    c.reloadDone({ correct: true, elapsedMs: 1000 });
    shoot(team);
    if (over()) return turns;
    c.pass();
  }
  throw new Error('the match never ended');
}

describe('pace with Squads on', () => {
  // The real base health from config (the owner's pace decision, 2026-10-24).
  const paced = withHp(DAMAGE.startingBaseHp);

  it('perfect bots with their dashers out every turn still need at least 9 turns in all', () => {
    const turns = SEEDS.map((seed) => perfectMatch(seed, true, paced));
    for (const [i, n] of turns.entries()) expect(n, `seed ${SEEDS[i]}`).toBeGreaterThanOrEqual(9);
  });

  it('a dasher saves at most one own turn (two in all) against the launcher-only game', () => {
    for (const effects of [paced, withHp(DAMAGE.startingBaseHp / 4)]) {
      for (const seed of SEEDS) {
        const without = perfectMatch(seed, false, effects);
        const withSoldiers = perfectMatch(seed, true, effects);
        expect(withSoldiers, `seed ${seed}`).toBeGreaterThanOrEqual(without - 2);
      }
    }
  });
});
