// Built bases with base health (owner, 2026-10-25): character health stays off, the bricks are the
// base health. Pure rules only. See docs/GAME_SPEC.md "How a built base plays".
import { describe, expect, it } from 'vitest';
import { chooseSlot, freshBases, saveSlot } from '../../src/game/baseBuilder';
import { HUGE, TINY, TYPICAL, baseOf, brick } from '../helpers/builtBases';
import {
  BASE_IN_BATTLE,
  BONUS,
  DAMAGE,
  FORTS,
  PHASE1_LAYOUT,
  PRACTICE_BOT,
  SPOTS,
  WORLD,
} from '../../src/game/config';
import {
  battleBasesFor,
  builtHealth,
  createBuilt,
  fitFrame,
  fitRoom,
  healthPlan,
  plotFrame,
  pointToWorld,
  splitHealth,
} from '../../src/game/builtBase';
import { playBotMatch } from '../../src/game/botPlay';
import { DEFAULT_EFFECTS } from '../../src/game/loadout';
import { createMatch } from '../../src/game/match';
import type {
  BlastOutcome,
  MatchController,
  MatchOptions,
  Players,
  ShotResult,
} from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'math' },
];

const mk = (bases: MatchOptions['bases'], over: Partial<MatchOptions> = {}): MatchController =>
  createMatch({
    disturbances: false,
    squads: false,
    players: PLAYERS,
    seed: 5,
    characterHealth: false,
    baseInBattle: true,
    bases,
    ...over,
  });

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

describe('the flag', () => {
  it('is on for everyone, and character health stays off', () => {
    expect(BASE_IN_BATTLE.enabled).toBe(true);
  });
});

describe('fitting the base into the old base footprint', () => {
  for (const team of ['PAST', 'FUTURE'] as const) {
    for (const [name, base] of [
      ['tiny', TINY(team)],
      ['typical', TYPICAL(team)],
      ['huge', HUGE(team)],
    ] as const) {
      it(`${team} ${name}: inside the widened footprint, standing on its bottom edge`, () => {
        const box = fitRoom(PHASE1_LAYOUT.bases[team]);
        const built = createBuilt(
          { [team]: base },
          { layout: PHASE1_LAYOUT, flatHp: { PAST: 400, FUTURE: 400 } },
        );
        const bricks = built[team].bricks;
        expect(bricks.length).toBe(base.pieces.length);
        let bottom = 0;
        for (const b of bricks) {
          expect(b.box.x).toBeGreaterThanOrEqual(box.x - 1e-6);
          expect(b.box.x + b.box.w).toBeLessThanOrEqual(box.x + box.w + 1e-6);
          expect(b.box.y).toBeGreaterThanOrEqual(box.y - 1e-6);
          expect(b.box.y + b.box.h).toBeLessThanOrEqual(box.y + box.h + 1e-6);
          bottom = Math.max(bottom, b.box.y + b.box.h);
        }
        expect(bottom).toBeCloseTo(box.y + box.h, 6);
      });
    }
  }

  it('is never drawn bigger than fitMaxScale px a step', () => {
    const f = fitFrame('PAST', TINY('PAST'), PHASE1_LAYOUT.bases.PAST);
    expect(f.scale).toBe(BASE_IN_BATTLE.fitMaxScale);
    const g = fitFrame('PAST', HUGE('PAST'), PHASE1_LAYOUT.bases.PAST);
    // The biggest base is as wide as the plot, so the widened footprint fits it at about 1.25.
    expect(g.scale).toBeCloseTo(240 / 192, 6);
  });

  it('a typical base is drawn at 3.75 px a step, 240 by 120 px', () => {
    // Owner report (2026-10-28): a built base was drawn way too small, 128 by 64 px at 2 px a step.
    for (const team of ['PAST', 'FUTURE'] as const) {
      const built = createBuilt(
        { [team]: TYPICAL(team) },
        { layout: PHASE1_LAYOUT, flatHp: { PAST: 400, FUTURE: 400 } },
      );
      const boxes = built[team].bricks.map((b) => b.box);
      const w = Math.max(...boxes.map((b) => b.x + b.w)) - Math.min(...boxes.map((b) => b.x));
      const h = Math.max(...boxes.map((b) => b.y + b.h)) - Math.min(...boxes.map((b) => b.y));
      expect(w).toBeCloseTo(240, 6);
      expect(h).toBeCloseTo(120, 6);
    }
  });

  it('never overhangs its rock or deck by more than 40 px a side, never rises above the footprint', () => {
    for (const [id, spot] of [...Object.entries(FORTS), ...Object.entries(SPOTS)]) {
      for (const team of [id in FORTS ? 'PAST' : 'FUTURE'] as const) {
        for (const base of [TINY(team), TYPICAL(team), HUGE(team)]) {
          const built = createBuilt(
            { [team]: base },
            {
              layout: { ...PHASE1_LAYOUT, bases: { ...PHASE1_LAYOUT.bases, [team]: spot.base } },
              flatHp: { PAST: 400, FUTURE: 400 },
            },
          );
          for (const b of built[team].bricks) {
            expect(b.box.x, id).toBeGreaterThanOrEqual(
              spot.base.x - BASE_IN_BATTLE.fitWiden / 2 - 1e-6,
            );
            expect(b.box.x + b.box.w, id).toBeLessThanOrEqual(
              spot.base.x + spot.base.w + BASE_IN_BATTLE.fitWiden / 2 + 1e-6,
            );
            expect(b.box.y, id).toBeGreaterThanOrEqual(spot.base.y - 1e-6);
            expect(b.box.x, id).toBeGreaterThan(0);
            expect(b.box.x + b.box.w, id).toBeLessThan(WORLD.width);
          }
        }
      }
    }
  });

  it('Team Future is mirrored so it faces Team Past', () => {
    const base = baseOf([brick('panel', 0, 10, 20), brick('beam', 6, 10, 50)]);
    const fp = fitFrame('PAST', base, PHASE1_LAYOUT.bases.PAST);
    const ff = fitFrame('FUTURE', base, PHASE1_LAYOUT.bases.FUTURE);
    expect(ff.mirror).toBe(true);
    expect(fp.mirror).toBe(false);
    // The leftmost brick of the plot is Future's rightmost (its back).
    const a = pointToWorld('FUTURE', 0, 88, ff);
    const b = pointToWorld('FUTURE', 80, 88, ff);
    expect(a.x).toBeGreaterThan(b.x);
  });

  it('the old plot frame is unchanged for character health', () => {
    expect(pointToWorld('PAST', 0, 88)).toEqual(pointToWorld('PAST', 0, 88, plotFrame('PAST')));
  });

  it('follows the base to a raised spot (Skyscraper)', () => {
    const box = { x: 1040, y: 330, w: 160, h: 130 };
    const layout = { ...PHASE1_LAYOUT, bases: { ...PHASE1_LAYOUT.bases, FUTURE: box } };
    const built = createBuilt(
      { FUTURE: TYPICAL('FUTURE') },
      { layout, flatHp: { PAST: 400, FUTURE: 400 } },
    );
    const lowest = Math.max(...built.FUTURE.bricks.map((b) => b.box.y + b.box.h));
    expect(lowest).toBeCloseTo(box.y + box.h, 6);
  });
});

describe('brick health', () => {
  it('splitHealth shares a total by weight, whole numbers, every share at least 1, same every time', () => {
    expect(splitHealth(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(sum(splitHealth(361, [20, 50, 35]))).toBe(361);
    expect(splitHealth(2, [5, 5, 5])).toEqual([1, 1, 1]);
    expect(splitHealth(0, [])).toEqual([]);
  });

  it.each([
    ['tiny', TINY('PAST')],
    ['typical', TYPICAL('PAST')],
    ['huge', HUGE('PAST')],
  ] as const)(
    '%s: the starting total is in the fair band, the foundation holds 90 percent or more',
    (_n, base) => {
      const built = createBuilt(
        { PAST: base },
        { layout: PHASE1_LAYOUT, flatHp: { PAST: 400, FUTURE: 400 } },
      );
      const bricks = built.PAST.bricks;
      const total = sum(bricks.map((b) => b.maxHp));
      const { band, foundationShare } = BASE_IN_BATTLE.health;
      expect(total).toBeGreaterThanOrEqual(400 * band.min);
      expect(total).toBeLessThanOrEqual(400 * band.max + bricks.length);
      const ground = sum(bricks.filter((b) => b.grounded).map((b) => b.maxHp));
      expect(ground).toBeGreaterThanOrEqual(Math.floor(400 * band.min * foundationShare));
      expect(builtHealth(built.PAST)).toBe(total);
    },
  );

  it('a stronger base gets more health, never past the band', () => {
    const plan = (saved: number[]) =>
      sum(
        healthPlan(
          saved,
          saved.map(() => true),
          400,
        ),
      );
    expect(plan([10])).toBe(400);
    expect(plan([150, 150])).toBe(450);
    expect(plan([3000])).toBe(500);
  });

  it('the band follows the flat full health (match length and upgrades)', () => {
    expect(sum(healthPlan([10], [true], 200))).toBe(200);
    expect(sum(healthPlan([5000], [true], 600))).toBe(750);
  });
});

describe('which bases go into battle', () => {
  it('only a chosen base with a brick on the foundation', () => {
    let st = freshBases();
    st = saveSlot(st, 'Alex', 'PAST', 0, [brick('stone', 4, 10, 20)]);
    st = chooseSlot(st, 'Alex', 'PAST', 0);
    const bases = battleBasesFor(st, { PAST: 'Alex', FUTURE: 'Sam' });
    expect(bases.PAST?.pieces).toHaveLength(1);
    expect(bases.FUTURE).toBeUndefined();
  });
});

/** The first aim (from a sweep) whose shot gives what `want` asks for. */
function findShot(
  bases: MatchOptions['bases'],
  want: (r: ShotResult, out: BlastOutcome, c: MatchController) => boolean,
  over: Partial<MatchOptions> = {},
): { angleDeg: number; power: number } {
  for (let power = 100; power >= 20; power -= 2) {
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += 1) {
      const c = mk(bases, over);
      c.ready();
      c.setAim({ angleDeg, power });
      const r = c.fire();
      if (want(r, c.shotLanded(), c)) return { angleDeg, power };
    }
  }
  throw new Error('no aim found');
}

const shoot = (
  c: MatchController,
  aim: { angleDeg: number; power: number },
): { r: ShotResult; out: BlastOutcome } => {
  c.ready();
  c.setAim(aim);
  const r = c.fire();
  return { r, out: c.shotLanded() };
};

describe('shots hit bricks', () => {
  const BASES = { FUTURE: TYPICAL('FUTURE') };

  it('the snapshot holds the bricks, and the HUD numbers are the brick total', () => {
    const s = mk(BASES).snapshot();
    expect(s.builtBase).toEqual({ PAST: false, FUTURE: true });
    const total = sum(
      Object.values(s.bricks ?? {})
        .filter((b) => b.team === 'FUTURE')
        .map((b) => b.maxHp),
    );
    expect(s.maxBaseHp.FUTURE).toBe(total);
    expect(s.baseHp.FUTURE).toBe(total);
    expect(s.maxBaseHp.PAST).toBe(DAMAGE.startingBaseHp);
    // The typical test base has no weapons on its pads.
    expect(s.mounts?.FUTURE).toEqual([]);
  });

  it('a direct hit takes 25 from the brick it lands on, and the HUD drops by the same', () => {
    const aim = findShot(
      BASES,
      (r, out) => r.stoppedBy?.kind === 'brick' && out.result === 'direct',
    );
    const c = mk(BASES);
    const before = c.snapshot().baseHp.FUTURE;
    const { r, out } = shoot(c, aim);
    expect(out.result).toBe('direct');
    const id = r.stoppedBy!.id as `FUTURE:${number}`;
    const after = c.snapshot();
    const b = after.bricks![id]!;
    expect(out.built?.brickHits[0]?.id).toBe(id);
    expect(b.maxHp - (b.alive ? b.hp : 0)).toBe(Math.min(DAMAGE.direct, b.maxHp));
    expect(before - after.baseHp.FUTURE).toBe(out.damage);
  });

  it('a shell that lands on the ground near the bricks is a near miss on the closest brick', () => {
    const aim = findShot(BASES, (r, out) => !r.stoppedBy && out.result === 'near');
    const c = mk(BASES);
    const { out } = shoot(c, aim);
    expect(out.tumble).toBe(true);
    expect(out.built?.brickHits[0]?.damage).toBe(DAMAGE.near);
  });

  it('a far miss hurts nothing', () => {
    const c = mk(BASES);
    const before = c.snapshot().baseHp.FUTURE;
    const { out } = shoot(c, { angleDeg: 80, power: 25 });
    expect(out.result).toBe('miss');
    expect(c.snapshot().baseHp.FUTURE).toBe(before);
    expect(out.built?.brickHits).toEqual([]);
  });

  it('a Power Shot is 1.5 times as hard', () => {
    const c = mk(BASES);
    const power = Math.round(DAMAGE.direct * BONUS.damageMultiplier);
    expect(power).toBe(38);
    // Played through the turn: two shots, a right answer, then the Power Shot at the same brick.
    const aim = findShot(
      BASES,
      (r, out) => r.stoppedBy?.kind === 'brick' && out.result === 'direct',
    );
    c.ready();
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 80, power: 25 });
      c.fire();
      c.shotLanded();
    }
    c.reloadDone({ correct: true, elapsedMs: 1000, kind: 'choice', grade: 3 });
    c.setAim(aim);
    const r = c.fire();
    const out = c.shotLanded();
    const id = r.stoppedBy!.id as `FUTURE:${number}`;
    expect(out.built?.brickHits[0]).toMatchObject({ id, damage: power });
  });

  it('a brick that falls takes what it held up, and the HUD loses all of it', () => {
    // A thin foundation brick with a tall stack on it: knock out the bottom and it all comes down.
    const stack = baseOf([
      brick('panel', 0, 10, 20),
      brick('beam', 6, 10, 50),
      brick('panel', 6, 9, 20),
      brick('panel', 6, 8, 20),
    ]);
    const c = mk({ FUTURE: stack });
    const built = c.snapshot().bricks!;
    expect(built['FUTURE:2']!.grounded).toBe(false);
    const target = 'FUTURE:1';
    // Take the beam down with direct hits until it falls (whatever shell gets there first).
    const aim = findShot(
      { FUTURE: stack },
      (r) => r.stoppedBy?.id === target || r.stoppedBy?.id === 'FUTURE:2',
    );
    let fellWith: BlastOutcome | null = null;
    for (let turn = 0; turn < 40 && !fellWith; turn++) {
      const s = c.snapshot();
      if (s.status === 'OVER') break;
      if (s.turn.team !== 'PAST') {
        c.ready();
        c.setAim({ angleDeg: 80, power: 25 });
        c.fire();
        c.shotLanded();
        c.setAim({ angleDeg: 80, power: 25 });
        c.fire();
        c.shotLanded();
        c.reloadDone({ correct: false, elapsedMs: 1000, kind: 'choice', grade: 3 });
        c.pass();
        continue;
      }
      c.ready();
      for (let i = 0; i < 2 && !fellWith; i++) {
        const before = c.snapshot().baseHp.FUTURE;
        c.setAim(aim);
        c.fire();
        const out = c.shotLanded();
        if (out.built!.bricksFell.length > 1) {
          fellWith = out;
          expect(before - c.snapshot().baseHp.FUTURE).toBe(out.damage);
        }
      }
      if (c.snapshot().status === 'OVER' || fellWith) break;
      c.reloadDone({ correct: false, elapsedMs: 1000, kind: 'choice', grade: 3 });
      c.pass();
    }
    expect(fellWith).not.toBeNull();
    const s = c.snapshot();
    for (const id of fellWith!.built!.bricksFell) expect(s.bricks![id]!.alive).toBe(false);
  });

  it('the match is won when the foundation is gone', () => {
    // A single plank on the ground. A Short match makes it quick to wear down.
    const c = mk({ FUTURE: TINY('FUTURE') }, { matchLength: 'short' });
    const aim = findShot({ FUTURE: TINY('FUTURE') }, (_r, out) => out.result === 'direct', {
      matchLength: 'short',
    });
    for (let turn = 0; turn < 60 && c.snapshot().status !== 'OVER'; turn++) {
      c.ready();
      const mine = c.snapshot().turn.team === 'PAST';
      for (let i = 0; i < 2 && c.snapshot().status !== 'OVER'; i++) {
        c.setAim(mine ? aim : { angleDeg: 80, power: 25 });
        c.fire();
        c.shotLanded();
      }
      if (c.snapshot().status === 'OVER') break;
      c.reloadDone({ correct: false, elapsedMs: 1000, kind: 'choice', grade: 3 });
      c.pass();
    }
    const s = c.snapshot();
    expect(s.status).toBe('OVER');
    expect(s.winner).toBe('PAST');
    expect(s.baseHp.FUTURE).toBe(0);
    expect(Object.values(s.bricks!).some((b) => b.team === 'FUTURE' && b.grounded && b.alive)).toBe(
      false,
    );
  });

  it('the gate cut and the force field still work on bricks', () => {
    const effects = {
      PAST: DEFAULT_EFFECTS.PAST,
      FUTURE: { ...DEFAULT_EFFECTS.FUTURE, directCut: 5, shieldHits: 1 },
    };
    const aim = findShot(
      BASES,
      (r, out) => r.stoppedBy?.kind === 'brick' && out.result === 'direct',
    );
    const c = mk(BASES, { effects });
    const first = shoot(c, aim).out;
    expect(first.blocked).toBe(true);
    expect(first.damage).toBe(0);
    c.setAim(aim);
    c.fire();
    const second = c.shotLanded();
    expect(second.built?.brickHits[0]?.damage).toBe(DAMAGE.direct - 5);
  });

  it('a repair patches the most hurt brick, never past its full health', () => {
    const effects = {
      PAST: DEFAULT_EFFECTS.PAST,
      FUTURE: { ...DEFAULT_EFFECTS.FUTURE, repair: 8 },
    };
    // Team Future goes first and repairs at the end of its turn; nothing is hurt, so nothing changes.
    const c = mk(BASES, { effects, firstTeam: 'FUTURE' });
    const full = c.snapshot().baseHp.FUTURE;
    c.ready();
    for (let i = 0; i < 2; i++) {
      c.setAim({ angleDeg: 80, power: 25 });
      c.fire();
      c.shotLanded();
    }
    c.reloadDone({ correct: false, elapsedMs: 1000, kind: 'choice', grade: 3 });
    c.pass();
    expect(c.snapshot().baseHp.FUTURE).toBe(full);
  });

  it('the same seed gives the same events', () => {
    const play = () =>
      playBotMatch({
        seed: 11,
        characterHealth: false,
        baseInBattle: true,
        bases: { PAST: TYPICAL('PAST'), FUTURE: TYPICAL('FUTURE') },
        profiles: { PAST: PRACTICE_BOT.scriptedHuman, FUTURE: PRACTICE_BOT.scriptedHuman },
      });
    expect(play()).toEqual(play());
  });

  it('a rematch keeps the bases', () => {
    const c = mk({ PAST: TYPICAL('PAST'), FUTURE: TYPICAL('FUTURE') });
    const again = createMatch(c.rematchOptions());
    expect(again.snapshot().builtBase).toEqual({ PAST: true, FUTURE: true });
  });
});

describe('squads with built bases', () => {
  it('the walking helper is still on, and a Bonk! chips the front brick on the ground', () => {
    const c = createMatch({
      disturbances: false,
      squads: true,
      players: PLAYERS,
      seed: 3,
      characterHealth: false,
      baseInBattle: true,
      bases: { FUTURE: TYPICAL('FUTURE') },
    });
    expect(c.snapshot().squads).toBeDefined();
    // Team Past's dasher walks out (go 1) and Bonk!s the Future base (go 2).
    c.ready();
    c.selectHelper('PAST-dasher');
    c.dash(c.helperTargets()[0]!);
    const before = c.snapshot().baseHp.FUTURE;
    const b = c.bonk('base');
    expect(b.target.kind).toBe('base');
    if (b.target.kind !== 'base') return;
    expect(b.target.damage).toBeGreaterThan(0);
    expect(c.snapshot().baseHp.FUTURE).toBe(before - b.target.damage);
    const ids = (b.target.built?.brickHits ?? []).map((h) => h.id);
    expect(ids).toHaveLength(1);
    const hit = c.snapshot().bricks![ids[0] as `FUTURE:${number}`]!;
    expect(hit.grounded).toBe(true);
  });
});

describe('the Computer player and built bases', () => {
  it('seeded matches with built bases on both sides all end with a winner', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const sizes = [TINY, TYPICAL, HUGE] as const;
      const r = playBotMatch({
        seed,
        firstTeam: seed % 2 ? 'PAST' : 'FUTURE',
        characterHealth: false,
        baseInBattle: true,
        bases: { PAST: sizes[seed % 3]!('PAST'), FUTURE: sizes[(seed + 1) % 3]!('FUTURE') },
        profiles: { PAST: PRACTICE_BOT.scriptedHuman, FUTURE: PRACTICE_BOT.scriptedHuman },
      });
      expect(r.ended, `seed ${seed}`).toBe(true);
      expect(r.winner, `seed ${seed}`).not.toBeNull();
    }
  }, 120_000);
});
