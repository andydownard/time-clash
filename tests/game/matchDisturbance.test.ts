// Birds, gusts and recoil inside a match (MatchOptions.disturbances).
import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/game/ballistics';
import { playBotMatch } from '../../src/game/botPlay';
import {
  DISTURBANCE,
  PHASE1_LAYOUT,
  PRACTICE_BOT,
  TEAM_FACING,
  type BotProfile,
} from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import {
  birdsForTurn,
  gustForTurn,
  kickAim,
  levelForTurn,
  recoilFor,
  type FlightDisturbance,
} from '../../src/game/disturbance';
import { createMatch } from '../../src/game/match';
import { firingOrigin, unitById } from '../../src/game/units';
import type { MatchOptions, Players } from '../../src/game/types';
import { windForTurn } from '../../src/game/wind';

const players: Players = [
  { name: 'Ada', team: 'PAST', grade: 2, subject: 'math' },
  { name: 'Bo', team: 'FUTURE', grade: 3, subject: 'math' },
];
const make = (extra: Partial<MatchOptions> = {}) => createMatch({ players, seed: 777, ...extra });

describe('disturbances in a match', () => {
  it('are on by default, from the config', () => {
    const s = make().snapshot();
    expect(DISTURBANCE.enabled).toBe(true);
    expect(s.disturbances).toBe(true);
    expect(s.birds).toEqual(birdsForTurn(777, 0));
  });

  it('turned off: no birds, no bumps, no gust, and the dials do not move', () => {
    const m = make({ disturbances: false });
    expect(m.snapshot().birds).toEqual([]);
    m.ready();
    m.setAim({ angleDeg: 50, power: 70 });
    const r = m.fire({ birdMs: 1000 });
    expect(r).not.toHaveProperty('bumps');
    expect(r).not.toHaveProperty('gust');
    expect(m.snapshot().aim.PAST).toEqual({ angleDeg: 50, power: 70 });
    expect(m.snapshot().lastShot).not.toHaveProperty('birdMs');
  });

  it('the flight is the turn birds and gust at the bird clock, so a replay matches', () => {
    const m = make();
    m.ready();
    m.setAim({ angleDeg: 52, power: 66 });
    const r = m.fire({ birdMs: 4321 });
    const disturbance: FlightDisturbance = {
      birds: birdsForTurn(777, 0),
      birdMs: 4321,
      gust: gustForTurn(777, 0),
    };
    const replay = simulateShot({
      angleDeg: 52,
      power: 66,
      origin: firingOrigin('PAST', 'C', PHASE1_LAYOUT),
      facing: TEAM_FACING.PAST,
      wind: windForTurn(777, 0),
      layout: PHASE1_LAYOUT,
      speedScale: unitById('C')!.speedScale,
      disturbance,
    });
    expect(r).toEqual(replay);
    expect(r.bumps).toBeDefined();
    expect(m.snapshot().lastShot?.birdMs).toBe(4321);
  });

  it('a bad bird clock counts as 0', () => {
    const a = make();
    a.ready();
    const b = make();
    b.ready();
    expect(a.fire({ birdMs: Number.NaN })).toEqual(b.fire());
    expect(a.snapshot().lastShot?.birdMs).toBe(0);
    const c = make();
    c.ready();
    const d = make();
    d.ready();
    expect(c.fire({ birdMs: -50 })).toEqual(d.fire({ birdMs: 0 }));
    expect(c.snapshot().lastShot?.birdMs).toBe(0);
  });

  it('the preview stays plain wind only: no birds, no gust', () => {
    const m = make();
    m.ready();
    m.setAim({ angleDeg: 52, power: 66 });
    const preview = m.previewShot();
    expect(preview).not.toHaveProperty('bumps');
    expect(preview).not.toHaveProperty('gust');
    const plain = make({ disturbances: false });
    plain.ready();
    plain.setAim({ angleDeg: 52, power: 66 });
    expect(preview).toEqual(plain.previewShot());
  });

  it('recoil slides the aim after each shot, seeded by turn and shot, by fighter', () => {
    const m = make();
    m.ready();
    m.selectUnit('D');
    m.setAim({ angleDeg: 50, power: 60 });
    m.fire();
    const first = kickAim({ angleDeg: 50, power: 60 }, recoilFor(777, 0, 0, 'catapult'));
    expect(m.snapshot().aim.PAST).toEqual(first);
    m.shotLanded();
    m.fire();
    expect(m.snapshot().aim.PAST).toEqual(kickAim(first, recoilFor(777, 0, 1, 'catapult')));
  });

  it('the Power Shot is the third shot of the turn for recoil', () => {
    const m = make();
    m.ready();
    m.setAim({ angleDeg: 40, power: 30 });
    m.fire();
    m.shotLanded();
    m.fire();
    m.shotLanded();
    m.reloadDone({ correct: true, elapsedMs: 3000 });
    const before = m.snapshot().aim.PAST;
    m.fire();
    expect(m.snapshot().aim.PAST).toEqual(kickAim(before, recoilFor(777, 0, 2, 'cannon')));
  });

  it('recoil is always inside the aim limits', () => {
    const m = make();
    m.ready();
    m.setAim({ angleDeg: 90, power: 100 });
    m.fire();
    const a = m.snapshot().aim.PAST;
    expect(a.angleDeg).toBeLessThanOrEqual(90);
    expect(a.power).toBeLessThanOrEqual(100);
  });

  it('a new turn brings new birds and a new gust, and recoil counts shots from 0 again', () => {
    const m = make();
    m.ready();
    m.fire();
    m.shotLanded();
    m.fire();
    m.shotLanded();
    m.reloadDone({ correct: false, elapsedMs: 3000 });
    m.pass();
    expect(m.snapshot().birds).toEqual(birdsForTurn(777, 1));
    m.ready();
    m.setAim({ angleDeg: 45, power: 60 });
    m.fire();
    expect(m.snapshot().aim.FUTURE).toEqual(
      kickAim({ angleDeg: 45, power: 60 }, recoilFor(777, 1, 0, 'tank')),
    );
  });

  it('each turn draws its level once: the birds, gust and recoil of a turn all match it', () => {
    const m = make();
    const level = levelForTurn(777, 0);
    expect(m.snapshot().birds).toEqual(birdsForTurn(777, 0, level));
    m.ready();
    m.selectUnit('D');
    m.setAim({ angleDeg: 50, power: 60 });
    const r = m.fire();
    if (r.gust) expect(r.gust.level).toBe(level);
    expect(m.snapshot().aim.PAST).toEqual(
      kickAim({ angleDeg: 50, power: 60 }, recoilFor(777, 0, 0, 'catapult', level)),
    );
  });

  it('turned off, the level draw changes no flight', () => {
    // A match with disturbances off flies exactly the plain physics, whatever the turn level.
    const m = make({ disturbances: false });
    m.ready();
    m.setAim({ angleDeg: 52, power: 66 });
    const r = m.fire();
    const plain = simulateShot({
      angleDeg: 52,
      power: 66,
      origin: firingOrigin('PAST', 'C', PHASE1_LAYOUT),
      facing: TEAM_FACING.PAST,
      wind: windForTurn(777, 0),
      layout: PHASE1_LAYOUT,
      speedScale: unitById('C')!.speedScale,
    });
    expect(r).toEqual(plain);
  });

  it('a rematch keeps the switch', () => {
    expect(make({ disturbances: false }).rematchOptions().disturbances).toBe(false);
    expect(make().rematchOptions()).not.toHaveProperty('disturbances');
  });

  it('a snapshot is a copy: changing its birds changes nothing', () => {
    const m = make();
    const s = m.snapshot();
    (s.birds as unknown as { x0: number }[])[0]!.x0 = -9999;
    expect(m.snapshot().birds).toEqual(birdsForTurn(777, 0));
  });
});

describe('fairness', () => {
  it.each(['turn', ...DISTURBANCE.levelOrder] as const)(
    'a direct hit is still reachable by retrying aim, for every seed, turn and bird clock (%s level)',
    (lv) => {
      const level = lv === 'turn' ? undefined : lv;
      for (let seed = 1; seed <= 10; seed++) {
        for (let turn = 0; turn < 2; turn++) {
          for (const birdMs of [0, 6000]) {
            const disturbance: FlightDisturbance = {
              birds: birdsForTurn(seed, turn, level),
              birdMs,
              gust: gustForTurn(seed, turn, level),
            };
            const wind = windForTurn(seed, turn);
            let found = false;
            for (let a = 20; a <= 80 && !found; a += 3)
              for (let p = 40; p <= 100 && !found; p += 2) {
                const r = simulateShot({
                  angleDeg: a,
                  power: p,
                  origin: PHASE1_LAYOUT.launchOrigins.PAST,
                  facing: 1,
                  wind,
                  layout: PHASE1_LAYOUT,
                  disturbance,
                });
                if (r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout') continue;
                if (classifyBlast(r.landing, PHASE1_LAYOUT.bases.FUTURE) === 'direct') found = true;
              }
            expect(found, `seed ${seed} turn ${turn} birdMs ${birdMs}`).toBe(true);
          }
        }
      }
    },
  );

  it('birds only ever nudge: most shells that pass through the sky are not bumped at all', () => {
    let shots = 0;
    let bumped = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const disturbance: FlightDisturbance = {
        birds: birdsForTurn(seed, 0),
        birdMs: 0,
        gust: null,
      };
      for (let a = 30; a <= 70; a += 10) {
        const r = simulateShot({
          angleDeg: a,
          power: 75,
          origin: PHASE1_LAYOUT.launchOrigins.PAST,
          facing: 1,
          wind: 0,
          layout: PHASE1_LAYOUT,
          disturbance,
        });
        shots += 1;
        if ((r.bumps ?? []).length > 0) bumped += 1;
        // A bird bumps a shell at most once.
        expect(new Set((r.bumps ?? []).map((b) => b.bird)).size).toBe((r.bumps ?? []).length);
      }
    }
    expect(bumped).toBeGreaterThan(0);
    expect(bumped / shots).toBeLessThan(0.5);
  });

  const perfect: BotProfile = {
    angleSpreadDeg: 0,
    powerSpreadPct: 0,
    windSkill: 1,
    reloadAccuracy: 1,
    thinkScale: 1,
  };
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const run = (profile: BotProfile, disturbances: boolean, seeds: number) =>
    Array.from({ length: seeds }, (_, i) =>
      playBotMatch({
        seed: 100 + i,
        profiles: { PAST: profile, FUTURE: profile },
        disturbances,
      }),
    );

  it('no stalemate: every match with birds and gusts still ends', () => {
    const results = run(PRACTICE_BOT.scriptedHuman, true, 20);
    expect(results.every((r) => r.ended)).toBe(true);
    const winners = new Set(results.map((r) => r.winner));
    expect(winners.has('PAST') && winners.has('FUTURE')).toBe(true);
  });

  it('a perfect aimer takes as long or longer with disturbances on (it cannot know them)', () => {
    const on = mean(run(perfect, true, 20).map((r) => r.turns));
    const off = mean(run(perfect, false, 20).map((r) => r.turns));
    expect(on).toBeGreaterThanOrEqual(off);
  });
});
