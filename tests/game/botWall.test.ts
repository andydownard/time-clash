import { describe, expect, it } from 'vitest';
import { chooseShot, chooseShotWith, profileOf } from '../../src/game/bot';
import { playBotMatch } from '../../src/game/botPlay';
import { simulateShot } from '../../src/game/ballistics';
import { buildLayout, withWalls } from '../../src/game/battlefield';
import { BIOME_IDS, BOT_LEVELS, EVASION, TEAM_FACING } from '../../src/game/config';
import { wallsInView } from '../../src/game/evasion';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import { firingOrigin } from '../../src/game/units';
import type { BattleLayout, Match, Players } from '../../src/game/types';

const players: Players = [
  { name: 'Knight', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Rocket', team: 'FUTURE', grade: 3, subject: 'math' },
];

/** Team Past armed its wall and ended its turn. Team Future is up, with the wall standing. */
const wallUp = (seed: number, layout?: BattleLayout): Match => {
  const m = createMatch({ players, seed, ...(layout ? { layout } : {}) });
  m.ready();
  m.armEvasion();
  for (let i = 0; i < 2; i++) {
    m.setAim({ angleDeg: 45, power: 50 });
    m.fire();
    m.shotLanded();
  }
  m.reloadDone({ correct: false, elapsedMs: 9000, kind: 'choice', grade: 3 });
  m.pass();
  return m.snapshot();
};

const withPhase = (s: Match, phase: 'ready' | 'armed' | 'used'): Match => ({
  ...s,
  evasion: { ...s.evasion, PAST: { ...s.evasion.PAST, phase } },
});

const fly = (s: Match, shot: { angleDeg: number; power: number; unit: never }, lay: BattleLayout) =>
  simulateShot({
    angleDeg: shot.angleDeg,
    power: shot.power,
    origin: firingOrigin('FUTURE', shot.unit, lay),
    facing: TEAM_FACING.FUTURE,
    wind: s.wind,
    layout: lay,
    speedScale: 1,
  });

describe('wallsInView', () => {
  const view = (phase: string) =>
    ({
      PAST: { id: 'barricade', phase, turnsLeft: 0, usesLeft: 0 },
      FUTURE: { id: 'dodge', phase: 'active', turnsLeft: 0, usesLeft: Infinity },
    }) as never;

  it('lists a wall only while the barricade is active', () => {
    expect(wallsInView(view('active'))).toEqual([EVASION.barricade.wall]);
  });

  it('negative: ready, armed, used and recharging walls are not standing', () => {
    for (const p of ['ready', 'armed', 'used', 'recharging'])
      expect(wallsInView(view(p))).toEqual([]);
  });
});

describe('computer aims around a standing wall', () => {
  it('the setup really has the wall up on Future turn', () => {
    const s = wallUp(3);
    expect(s.evasion.PAST.phase).toBe('active');
    expect(s.turn.team).toBe('FUTURE');
  });

  it('a perfect shot is searched on the walled field, so it does not stop at the wall', () => {
    const perfect = { ...profileOf('hard'), angleSpreadDeg: 0, powerSpreadPct: 0, windSkill: 1 };
    const lay = buildLayout({ biome: 'aspen', spot: null });
    const walled = withWalls(lay, [EVASION.barricade.wall]);
    const wall = EVASION.barricade.wall;
    let stuck = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const state = { ...wallUp(seed), wind: 0 };
      const shot = chooseShotWith(state, 'FUTURE', perfect, createRng(seed), { layout: lay });
      const r = fly(state, shot as never, walled);
      if (r.landing.x >= wall.x - 25 && r.landing.x <= wall.x + wall.w + 25) stuck++;
    }
    expect(stuck).toBe(0);
  });

  it('chooses a different aim than it would with no wall', () => {
    let differed = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const up = wallUp(seed);
      const a = chooseShot(up, 'FUTURE', 'hard', createRng(seed));
      const b = chooseShot(withPhase(up, 'ready'), 'FUTURE', 'hard', createRng(seed));
      if (a.angleDeg !== b.angleDeg || a.power !== b.power) differed++;
    }
    expect(differed).toBeGreaterThan(0);
  });

  it('is deterministic with a wall up', () => {
    const up = wallUp(9);
    expect(chooseShot(up, 'FUTURE', 'medium', createRng(2))).toEqual(
      chooseShot(up, 'FUTURE', 'medium', createRng(2)),
    );
  });

  it('negative: an armed-only or used wall changes nothing', () => {
    const up = wallUp(5);
    const base = chooseShot(withPhase(up, 'ready'), 'FUTURE', 'hard', createRng(1));
    expect(chooseShot(withPhase(up, 'armed'), 'FUTURE', 'hard', createRng(1))).toEqual(base);
    expect(chooseShot(withPhase(up, 'used'), 'FUTURE', 'hard', createRng(1))).toEqual(base);
  });

  it('is not perfect: easy and medium miss the base most of the time with a wall up', () => {
    const lay = buildLayout({ biome: 'aspen', spot: null });
    const walled = withWalls(lay, [EVASION.barricade.wall]);
    for (const level of ['easy', 'medium'] as const) {
      let hits = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const state = wallUp(seed);
        const shot = chooseShot(state, 'FUTURE', level, createRng(seed));
        if (fly(state, shot as never, walled).hit.kind === 'base') hits++;
      }
      expect(hits).toBeLessThan(30);
    }
  });

  it('works on every biome and returns a legal whole-number aim', () => {
    for (const biome of BIOME_IDS)
      for (const level of BOT_LEVELS) {
        const lay = buildLayout({ biome, spot: null });
        const state = wallUp(7, lay);
        const s = chooseShot(state, 'FUTURE', level, createRng(3), { layout: lay });
        expect(Number.isInteger(s.angleDeg) && Number.isInteger(s.power)).toBe(true);
      }
  });
});

describe('seeded 240-match simulation with walls on every biome', () => {
  it('no stalemate and no crash, and walls really get raised', () => {
    let capped = 0;
    let withWall = 0;
    for (let i = 0; i < 240; i++) {
      const lvl = BOT_LEVELS[i % 3] as (typeof BOT_LEVELS)[number];
      const other = BOT_LEVELS[(i + 1) % 3] as (typeof BOT_LEVELS)[number];
      const biome = BIOME_IDS[i % BIOME_IDS.length] as (typeof BIOME_IDS)[number];
      const r = playBotMatch({
        seed: 5000 + i,
        profiles: { PAST: profileOf(lvl), FUTURE: profileOf(other) },
        firstTeam: i % 2 ? 'FUTURE' : 'PAST',
        layout: buildLayout({ biome, spot: null }),
        raiseWall: true,
      });
      if (!r.ended || r.winner === null) capped++;
      if (r.wallRaised) withWall++;
    }
    expect(capped).toBe(0);
    expect(withWall).toBeGreaterThan(100);
  }, 240_000);
});
