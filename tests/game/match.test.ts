import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/game/match';
import { simulateShot } from '../../src/game/ballistics';
import { classifyBlast } from '../../src/game/damage';
import { windForTurn } from '../../src/game/wind';
import { createRng } from '../../src/game/rng';
import { AIM, DAMAGE, PHASE1_LAYOUT, TEAM_FACING, TUMBLE_LINE_COUNT } from '../../src/game/config';
import { DEFAULT_EFFECTS } from '../../src/game/loadout';
import { tumblePool } from '../../src/data/copy';
import { IllegalTransitionError, MatchOverError, otherTeam } from '../../src/game/types';
import type {
  AimInput,
  BlastResult,
  MatchController,
  MatchOptions,
  Players,
  ReloadInput,
} from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 5, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'reading' },
];
const opts = (seed = 1, extra: Partial<MatchOptions> = {}): MatchOptions => ({
  players: PLAYERS,
  seed,
  ...extra,
});

/** Brute-force an aim whose real flight scores `want` for the team now aiming. */
function findAim(c: MatchController, want: BlastResult, skip = 0): AimInput {
  const snap = c.snapshot();
  const team = snap.turn.team;
  const target = otherTeam(team);
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
      });
      const scored =
        r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout'
          ? 'miss'
          : classifyBlast(r.landing, c.layout.bases[target]);
      if (scored === want && seen++ >= skip) return { angleDeg, power };
    }
  }
  throw new Error(`no ${want} aim found`);
}

const FAST: ReloadInput = { correct: true, elapsedMs: 2000 };
/** A wrong answer: no Power Shot, so the turn goes straight on (keeps the Phase 1 goldens exact). */
const WRONG: ReloadInput = { correct: false, elapsedMs: 2000 };

/** The Power Shot after a right answer: a plain shot at the default aim. */
function bonusShot(c: MatchController): void {
  c.fire();
  c.shotLanded();
}

/** Run one whole turn: both shots with the given result, then reload and pass. */
function playTurn(c: MatchController, want: BlastResult, reload: ReloadInput = WRONG): void {
  c.ready();
  for (let i = 0; i < 2; i++) {
    c.setAim(findAim(c, want, i));
    c.fire();
    c.shotLanded();
    if (c.snapshot().status === 'OVER') return;
  }
  c.reloadDone(reload);
  c.pass();
}

describe('createMatch: initial state', () => {
  it('starts with Team Past on the pass screen, full health, no scrap', () => {
    const s = createMatch(opts(7)).snapshot();
    expect(s.status).toBe('PLAYING');
    expect(s.winner).toBeNull();
    expect(s.turn).toEqual({
      phase: 'PASS_SCREEN',
      team: 'PAST',
      turnNumber: 0,
      shotsFired: 0,
      bonus: false,
    });
    expect(s.baseHp).toEqual({ PAST: DAMAGE.startingBaseHp, FUTURE: DAMAGE.startingBaseHp });
    expect(s.scrap).toEqual({ PAST: 0, FUTURE: 0 });
    expect(s.wind).toBe(windForTurn(7, 0));
    expect(s.seed).toBe(7);
    expect(s.lastShot).toBeNull();
    expect(s.aim.PAST).toEqual({ angleDeg: AIM.defaultAngleDeg, power: AIM.defaultPower });
    expect(s.aim.FUTURE).toEqual({ angleDeg: AIM.defaultAngleDeg, power: AIM.defaultPower });
    expect(s.stats.PAST).toEqual({
      shotsFired: 0,
      directHits: 0,
      nearHits: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      fastestAnswerMs: null,
      scrapEarned: 0,
    });
    expect(s.players).toEqual(PLAYERS);
  });
  it('honours firstTeam and the default layout', () => {
    const c = createMatch(opts(1, { firstTeam: 'FUTURE' }));
    expect(c.snapshot().turn.team).toBe('FUTURE');
    expect(c.layout).toBe(PHASE1_LAYOUT);
  });
  it('uses a custom layout when given', () => {
    const layout = { ...PHASE1_LAYOUT, terrain: { ...PHASE1_LAYOUT.terrain, obstacles: [] } };
    expect(createMatch(opts(1, { layout })).layout).toBe(layout);
  });
  it('snapshots are copies: editing one never changes the match', () => {
    const c = createMatch(opts());
    const s = c.snapshot() as unknown as {
      baseHp: { PAST: number };
      aim: { PAST: AimInput };
      stats: { PAST: { shotsFired: number } };
    };
    s.baseHp.PAST = 1;
    s.aim.PAST.power = 1;
    s.stats.PAST.shotsFired = 9;
    const t = c.snapshot();
    expect(t.baseHp.PAST).toBe(100);
    expect(t.aim.PAST.power).toBe(AIM.defaultPower);
    expect(t.stats.PAST.shotsFired).toBe(0);
  });
});

describe('turn flow through the controller', () => {
  it('walks PASS_SCREEN -> AIMING -> SHOT_1 -> AIMING -> SHOT_2 -> RELOAD -> NEXT_PLAYER -> PASS_SCREEN', () => {
    const c = createMatch(opts(3));
    const phases = [c.snapshot().turn.phase];
    c.ready();
    phases.push(c.snapshot().turn.phase);
    c.fire();
    phases.push(c.snapshot().turn.phase);
    c.shotLanded();
    phases.push(c.snapshot().turn.phase);
    c.fire();
    phases.push(c.snapshot().turn.phase);
    c.shotLanded();
    phases.push(c.snapshot().turn.phase);
    c.reloadDone(WRONG);
    phases.push(c.snapshot().turn.phase);
    c.pass();
    phases.push(c.snapshot().turn.phase);
    expect(phases).toEqual([
      'PASS_SCREEN',
      'AIMING',
      'SHOT_1',
      'AIMING',
      'SHOT_2',
      'RELOAD',
      'NEXT_PLAYER',
      'PASS_SCREEN',
    ]);
    const s = c.snapshot();
    expect(s.turn.team).toBe('FUTURE');
    expect(s.turn.turnNumber).toBe(1);
    expect(s.wind).toBe(windForTurn(3, 1));
  });

  it('keeps wind fixed for both shots of a turn', () => {
    const c = createMatch(opts(5));
    c.ready();
    const w = c.snapshot().wind;
    c.fire();
    c.shotLanded();
    expect(c.snapshot().wind).toBe(w);
    c.fire();
    expect(c.snapshot().lastShot?.wind).toBe(w);
  });

  it('fire() returns exactly the pure simulation for the stored aim', () => {
    const c = createMatch(opts(9));
    c.ready();
    const aim = c.setAim({ angleDeg: 40, power: 70 });
    const r = c.fire();
    expect(r).toEqual(
      simulateShot({
        ...aim,
        origin: c.layout.launchOrigins.PAST,
        facing: 1,
        wind: c.snapshot().wind,
        layout: c.layout,
      }),
    );
  });

  it('records lastShot and counts shots per team', () => {
    const c = createMatch(opts(9));
    c.ready();
    c.setAim({ angleDeg: 33, power: 44 });
    c.fire();
    const s = c.snapshot();
    expect(s.lastShot).toEqual({
      angleDeg: 33,
      power: 44,
      team: 'PAST',
      wind: s.wind,
      turnNumber: 0,
      unit: 'C',
    });
    expect(s.stats.PAST.shotsFired).toBe(1);
    expect(s.stats.FUTURE.shotsFired).toBe(0);
  });

  it('setAim clamps, returns the clamped aim, and remembers it per team across turns', () => {
    const c = createMatch(opts(2));
    c.ready();
    expect(c.setAim({ angleDeg: 500, power: -9 })).toEqual({ angleDeg: 90, power: 0 });
    c.fire();
    c.shotLanded();
    c.fire();
    c.shotLanded();
    c.reloadDone(WRONG);
    c.pass();
    c.ready();
    expect(c.snapshot().aim.PAST).toEqual({ angleDeg: 90, power: 0 });
    expect(c.snapshot().aim.FUTURE).toEqual({
      angleDeg: AIM.defaultAngleDeg,
      power: AIM.defaultPower,
    });
    c.setAim({ angleDeg: 10, power: 10 });
    expect(c.snapshot().aim.FUTURE).toEqual({ angleDeg: 10, power: 10 });
    expect(c.snapshot().aim.PAST).toEqual({ angleDeg: 90, power: 0 });
  });

  it('the second shot reuses the aim of the first until changed', () => {
    const c = createMatch(opts(2));
    c.ready();
    c.setAim({ angleDeg: 20, power: 50 });
    c.fire();
    c.shotLanded();
    expect(c.snapshot().aim.PAST).toEqual({ angleDeg: 20, power: 50 });
  });
});

describe('negative paths: illegal moves throw and change nothing', () => {
  type Action = (c: MatchController) => unknown;
  const ACTIONS: Record<string, Action> = {
    ready: (c) => c.ready(),
    setAim: (c) => c.setAim({ angleDeg: 1, power: 1 }),
    fire: (c) => c.fire(),
    shotLanded: (c) => c.shotLanded(),
    reloadDone: (c) => c.reloadDone(WRONG),
    pass: (c) => c.pass(),
  };
  // Which actions are legal in each phase. Everything else must throw.
  const LEGAL_IN: Record<string, string[]> = {
    PASS_SCREEN: ['ready'],
    AIMING: ['setAim', 'fire'],
    SHOT_1: ['shotLanded'],
    SHOT_2: ['shotLanded'],
    RELOAD: ['reloadDone'],
    NEXT_PLAYER: ['pass'],
  };
  const reach: Record<string, (c: MatchController) => void> = {
    PASS_SCREEN: () => undefined,
    AIMING: (c) => c.ready(),
    SHOT_1: (c) => {
      c.ready();
      c.fire();
    },
    SHOT_2: (c) => {
      c.ready();
      c.fire();
      c.shotLanded();
      c.fire();
    },
    RELOAD: (c) => {
      c.ready();
      c.fire();
      c.shotLanded();
      c.fire();
      c.shotLanded();
    },
    NEXT_PLAYER: (c) => {
      c.ready();
      c.fire();
      c.shotLanded();
      c.fire();
      c.shotLanded();
      c.reloadDone(WRONG);
    },
  };
  const cases = Object.keys(reach).flatMap((phase) =>
    Object.keys(ACTIONS)
      .filter((a) => !LEGAL_IN[phase]!.includes(a))
      .map((action) => ({ phase, action })),
  );

  it('covers 6 phases x 6 actions minus 7 legal pairs = 29 illegal pairs', () => {
    expect(cases).toHaveLength(29);
  });

  it.each(cases)(
    '$action during $phase throws IllegalTransitionError and leaves state alone',
    ({ phase, action }) => {
      const c = createMatch(opts(4));
      reach[phase]!(c);
      expect(c.snapshot().turn.phase).toBe(phase);
      const before = c.snapshot();
      expect(() => ACTIONS[action]!(c)).toThrow(IllegalTransitionError);
      expect(c.snapshot()).toEqual(before);
    },
  );

  it('a third shot throws', () => {
    const c = createMatch(opts(4));
    c.ready();
    c.fire();
    c.shotLanded();
    c.fire();
    c.shotLanded();
    expect(() => c.fire()).toThrow(IllegalTransitionError);
    expect(c.snapshot().stats.PAST.shotsFired).toBe(2);
  });

  it('the reload cannot be skipped', () => {
    const c = createMatch(opts(4));
    c.ready();
    c.fire();
    c.shotLanded();
    c.fire();
    c.shotLanded();
    expect(() => c.pass()).toThrow(IllegalTransitionError);
    expect(() => c.ready()).toThrow(IllegalTransitionError);
  });

  it('a turn cannot be skipped: no pass straight from the pass screen', () => {
    expect(() => createMatch(opts()).pass()).toThrow(IllegalTransitionError);
  });
});

describe('shotLanded: damage, tumble, and bubbles', () => {
  it('direct hit: -25, no tumble, no bubble', () => {
    const c = createMatch(opts(11));
    c.ready();
    c.setAim(findAim(c, 'direct'));
    c.fire();
    const out = c.shotLanded();
    expect(out).toEqual({
      result: 'direct',
      target: 'FUTURE',
      damage: 25,
      tumble: false,
      bubbleIndex: null,
    });
    expect(c.snapshot().baseHp).toEqual({ PAST: 100, FUTURE: 75 });
    expect(c.snapshot().stats.PAST.directHits).toBe(1);
  });

  it('near miss: -10, tumble true, bubble index in range', () => {
    const c = createMatch(opts(11));
    c.ready();
    c.setAim(findAim(c, 'near'));
    c.fire();
    const out = c.shotLanded();
    expect(out.result).toBe('near');
    expect(out.damage).toBe(10);
    expect(out.tumble).toBe(true);
    expect(out.bubbleIndex).toBeGreaterThanOrEqual(0);
    expect(out.bubbleIndex).toBeLessThan(TUMBLE_LINE_COUNT);
    expect(c.snapshot().baseHp.FUTURE).toBe(90);
    expect(c.snapshot().stats.PAST.nearHits).toBe(1);
  });

  it('miss: no damage, no tumble', () => {
    const c = createMatch(opts(11));
    c.ready();
    c.setAim(findAim(c, 'miss'));
    c.fire();
    const out = c.shotLanded();
    expect(out).toEqual({
      result: 'miss',
      target: 'FUTURE',
      damage: 0,
      tumble: false,
      bubbleIndex: null,
    });
    expect(c.snapshot().baseHp).toEqual({ PAST: 100, FUTURE: 100 });
  });

  it('no self damage: a shot that drops on your own base hurts nobody', () => {
    const c = createMatch(opts(11));
    c.ready();
    c.setAim({ angleDeg: 90, power: 0 });
    const r = c.fire();
    expect(r.hit).toEqual({ kind: 'base', team: 'PAST' });
    const out = c.shotLanded();
    expect(out.result).toBe('miss');
    expect(c.snapshot().baseHp).toEqual({ PAST: 100, FUTURE: 100 });
  });

  it('a shot that leaves the world scores as a miss even if it ends near the base', () => {
    const c = createMatch(opts(11));
    c.ready();
    let found: AimInput | null = null;
    for (let power = 100; power > 0 && !found; power--) {
      for (let angleDeg = 0; angleDeg <= 90; angleDeg++) {
        const r = simulateShot({
          angleDeg,
          power,
          wind: c.snapshot().wind,
          origin: c.layout.launchOrigins.PAST,
          facing: 1,
          layout: c.layout,
        });
        if (r.hit.kind === 'out_of_bounds') {
          found = { angleDeg, power };
          break;
        }
      }
    }
    expect(found).not.toBeNull();
    c.setAim(found!);
    expect(c.fire().hit.kind).toBe('out_of_bounds');
    expect(c.shotLanded().result).toBe('miss');
  });

  it('shows every one of the bubble lines before any repeats', () => {
    expect(TUMBLE_LINE_COUNT).toBe(tumblePool('PAST').length);
    expect(TUMBLE_LINE_COUNT).toBeGreaterThanOrEqual(12);
    // Soft hits (1 damage) so a long run of near misses never ends the match.
    const soft = { near: 1 };
    const c = createMatch(
      opts(21, {
        effects: {
          PAST: { ...DEFAULT_EFFECTS.PAST, ...soft },
          FUTURE: { ...DEFAULT_EFFECTS.FUTURE, ...soft },
        },
      }),
    );
    const seen: number[] = [];
    // Alternate teams; each shot is a near miss against the other side.
    for (let turn = 0; turn < TUMBLE_LINE_COUNT / 2 + 1; turn++) {
      c.ready();
      for (let i = 0; i < 2; i++) {
        c.setAim(findAim(c, 'near', i));
        c.fire();
        const out = c.shotLanded();
        seen.push(out.bubbleIndex as number);
      }
      c.reloadDone(WRONG);
      c.pass();
    }
    expect(seen.length).toBeGreaterThanOrEqual(TUMBLE_LINE_COUNT + 2);
    expect(new Set(seen.slice(0, TUMBLE_LINE_COUNT)).size).toBe(TUMBLE_LINE_COUNT);
    expect(seen.every((i) => i >= 0 && i < TUMBLE_LINE_COUNT)).toBe(true);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it('bubble choices repeat for the same seed', () => {
    const run = (seed: number) => {
      const c = createMatch(opts(seed));
      const out: (number | null)[] = [];
      c.ready();
      for (let i = 0; i < 2; i++) {
        c.setAim(findAim(c, 'near', i));
        c.fire();
        out.push(c.shotLanded().bubbleIndex);
      }
      return out;
    };
    expect(run(8)).toEqual(run(8));
  });
});

describe('reloadDone: scrap and stats', () => {
  const toReload = (c: MatchController) => {
    c.ready();
    c.fire();
    c.shotLanded();
    c.fire();
    c.shotLanded();
  };

  it('fast and right: +2 scrap and the stats update', () => {
    const c = createMatch(opts());
    toReload(c);
    expect(c.reloadDone({ correct: true, elapsedMs: 3000 })).toEqual({
      scrap: 2,
      fast: true,
      bonus: true,
    });
    const s = c.snapshot();
    expect(s.scrap.PAST).toBe(2);
    expect(s.stats.PAST).toMatchObject({
      questionsAnswered: 1,
      correctAnswers: 1,
      fastestAnswerMs: 3000,
      scrapEarned: 2,
    });
    expect(s.scrap.FUTURE).toBe(0);
  });
  it('slow and right: +1 scrap', () => {
    const c = createMatch(opts());
    toReload(c);
    expect(c.reloadDone({ correct: true, elapsedMs: 8000 }).scrap).toBe(1);
    expect(c.snapshot().scrap.PAST).toBe(1);
  });
  it('wrong answer still reloads: +0 scrap, turn moves on, nothing blocks play', () => {
    const c = createMatch(opts());
    toReload(c);
    expect(c.reloadDone({ correct: false, elapsedMs: 1000 })).toEqual({
      scrap: 0,
      fast: false,
      bonus: false,
    });
    const s = c.snapshot();
    expect(s.turn.phase).toBe('NEXT_PLAYER');
    expect(s.stats.PAST).toMatchObject({
      questionsAnswered: 1,
      correctAnswers: 0,
      fastestAnswerMs: null,
      scrapEarned: 0,
    });
    c.pass();
    expect(c.snapshot().turn.phase).toBe('PASS_SCREEN');
  });
  it('bad elapsedMs counts as slow and never throws', () => {
    const c = createMatch(opts());
    toReload(c);
    expect(c.reloadDone({ correct: true, elapsedMs: NaN })).toEqual({
      scrap: 1,
      fast: false,
      bonus: true,
    });
    expect(c.snapshot().stats.PAST.fastestAnswerMs).toBeNull();
  });
  it('keeps the fastest correct time across turns and accumulates scrap', () => {
    const c = createMatch(opts(6));
    toReload(c);
    c.reloadDone({ correct: true, elapsedMs: 5000 });
    bonusShot(c);
    c.pass();
    toReload(c);
    c.reloadDone({ correct: true, elapsedMs: 1000 });
    bonusShot(c);
    c.pass();
    toReload(c);
    c.reloadDone({ correct: true, elapsedMs: 9000 });
    bonusShot(c);
    c.pass();
    const s = c.snapshot();
    expect(s.stats.PAST.fastestAnswerMs).toBe(5000);
    expect(s.scrap.PAST).toBe(3);
    expect(s.scrap.FUTURE).toBe(2);
    expect(s.stats.FUTURE.fastestAnswerMs).toBe(1000);
  });
  it('a second reload for the same turn throws (double-call does not double scrap)', () => {
    const c = createMatch(opts());
    toReload(c);
    c.reloadDone(FAST);
    expect(() => c.reloadDone(FAST)).toThrow(IllegalTransitionError);
    expect(c.snapshot().scrap.PAST).toBe(2);
  });
});

describe('winning', () => {
  it('four direct hits end the match: status OVER, winner set, hp 0, never negative', () => {
    const c = createMatch(opts(13));
    let guard = 0;
    while (c.snapshot().status === 'PLAYING' && guard++ < 20) {
      const s = c.snapshot();
      playTurn(c, s.turn.team === 'PAST' || guard % 2 === 1 ? 'direct' : 'miss');
    }
    const s = c.snapshot();
    expect(s.status).toBe('OVER');
    expect(s.winner).not.toBeNull();
    const loser = otherTeam(s.winner!);
    expect(s.baseHp[loser]).toBe(0);
    expect(s.baseHp[s.winner!]).toBeGreaterThan(0);
  });

  it('Team Past wins on its second turn at shot 2 with no reload after the final hit', () => {
    const c = createMatch(opts(13));
    playTurn(c, 'direct');
    playTurn(c, 'miss');
    c.ready();
    c.setAim(findAim(c, 'direct'));
    c.fire();
    c.shotLanded();
    expect(c.snapshot().status).toBe('PLAYING');
    c.setAim(findAim(c, 'direct'));
    c.fire();
    const out = c.shotLanded();
    expect(out.damage).toBe(25);
    const s = c.snapshot();
    expect(s.baseHp.FUTURE).toBe(0);
    expect(s.status).toBe('OVER');
    expect(s.winner).toBe('PAST');
    expect(s.turn.turnNumber).toBe(2);
  });

  it('a win on shot 1 ends right there', () => {
    const c = createMatch(opts(14));
    // 3 directs over two turns (Future just misses), then the 4th ends it on shot 1.
    playTurn(c, 'direct'); // Past: 2 hits
    playTurn(c, 'miss');
    c.ready();
    c.setAim(findAim(c, 'direct'));
    c.fire();
    c.shotLanded(); // 3rd hit (FUTURE hp 25)
    c.setAim(findAim(c, 'miss'));
    c.fire();
    c.shotLanded();
    c.reloadDone(WRONG);
    c.pass();
    playTurn(c, 'miss');
    c.ready();
    c.setAim(findAim(c, 'direct'));
    c.fire();
    c.shotLanded();
    const s = c.snapshot();
    expect(s.baseHp.FUTURE).toBe(0);
    expect(s.status).toBe('OVER');
    expect(s.turn.shotsFired).toBe(1);
  });

  it('after the match is over every action throws MatchOverError, but snapshot still works', () => {
    const c = createMatch(opts(13));
    let guard = 0;
    while (c.snapshot().status === 'PLAYING' && guard++ < 20)
      playTurn(c, c.snapshot().turn.team === 'PAST' ? 'direct' : 'miss');
    const before = c.snapshot();
    expect(() => c.ready()).toThrow(MatchOverError);
    expect(() => c.setAim({ angleDeg: 1, power: 1 })).toThrow(MatchOverError);
    expect(() => c.fire()).toThrow(MatchOverError);
    expect(() => c.shotLanded()).toThrow(MatchOverError);
    expect(() => c.reloadDone(WRONG)).toThrow(MatchOverError);
    expect(() => c.pass()).toThrow(MatchOverError);
    expect(c.snapshot()).toEqual(before);
  });

  it('hp never goes negative when overkill is possible', () => {
    const c = createMatch(opts(15));
    let guard = 0;
    while (c.snapshot().status === 'PLAYING' && guard++ < 30)
      playTurn(c, c.snapshot().turn.team === 'PAST' ? 'near' : 'miss');
    const hp = c.snapshot().baseHp;
    expect(hp.FUTURE).toBeGreaterThanOrEqual(0);
    expect(hp.FUTURE).toBe(0); // 10 near hits drain 100 exactly
    expect(c.snapshot().winner).toBe('PAST');
  });
});

describe('determinism and rematch', () => {
  const scripted = (seed: number) => {
    const c = createMatch(opts(seed));
    const log: unknown[] = [];
    let guard = 0;
    while (c.snapshot().status === 'PLAYING' && guard++ < 40) {
      const team = c.snapshot().turn.team;
      c.ready();
      for (let i = 0; i < 2 && c.snapshot().status === 'PLAYING'; i++) {
        c.setAim(findAim(c, team === 'PAST' ? 'direct' : 'near', i));
        log.push(c.fire().landing);
        log.push(c.shotLanded());
      }
      if (c.snapshot().status === 'OVER') break;
      const reloaded = c.reloadDone({ correct: guard % 3 !== 0, elapsedMs: 1500 * guard });
      log.push(reloaded);
      if (reloaded.bonus) {
        c.setAim(findAim(c, team === 'PAST' ? 'direct' : 'near', 0));
        log.push(c.fire().landing);
        log.push(c.shotLanded());
        if (c.snapshot().status === 'OVER') break;
      }
      c.pass();
    }
    return { log, final: c.snapshot() };
  };

  it('a full scripted match reaches a winner', () => {
    const { final } = scripted(100);
    expect(final.status).toBe('OVER');
    expect(final.winner).not.toBeNull();
    expect(final.stats.PAST.shotsFired + final.stats.FUTURE.shotsFired).toBeGreaterThanOrEqual(6);
  });

  it('two runs with the same seed give identical logs and final state', () => {
    expect(scripted(100)).toEqual(scripted(100));
  });

  it('a different seed changes the wind', () => {
    const winds = (seed: number) => Array.from({ length: 6 }, (_, t) => windForTurn(seed, t));
    expect(winds(100)).not.toEqual(winds(101));
  });

  it('rematchOptions: same players, seed + 1, the other team starts', () => {
    const c = createMatch(opts(40));
    const r = c.rematchOptions();
    expect(r.players).toEqual(PLAYERS);
    expect(r.seed).toBe(41);
    expect(r.firstTeam).toBe('FUTURE');
    const next = createMatch(r);
    expect(next.snapshot().turn.team).toBe('FUTURE');
    expect(next.snapshot().wind).toBe(windForTurn(41, 0));
    expect(next.rematchOptions()).toMatchObject({ seed: 42, firstTeam: 'PAST' });
  });

  it('rematchOptions works mid-match and after a win, and keeps the layout', () => {
    const layout = { ...PHASE1_LAYOUT };
    const c = createMatch(opts(40, { layout }));
    expect(c.rematchOptions().layout).toBe(layout);
  });
});

describe('property loops: random seeded matches keep every invariant', () => {
  it('200 random matches never break the rules', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed * 7919 + 1);
      const c = createMatch(opts(seed, { firstTeam: rng.pick(['PAST', 'FUTURE'] as const) }));
      let turns = 0;
      while (c.snapshot().status === 'PLAYING' && turns++ < 60) {
        c.ready();
        let fired = 0;
        for (let i = 0; i < 2; i++) {
          c.setAim({ angleDeg: rng.int(-10, 100), power: rng.int(-10, 110) });
          const r = c.fire();
          fired++;
          expect(Number.isFinite(r.landing.x) && Number.isFinite(r.landing.y)).toBe(true);
          const out = c.shotLanded();
          expect([0, 10, 25]).toContain(out.damage);
          const hp = c.snapshot().baseHp;
          expect(hp.PAST).toBeGreaterThanOrEqual(0);
          expect(hp.FUTURE).toBeGreaterThanOrEqual(0);
          expect(hp.PAST).toBeLessThanOrEqual(100);
          if (c.snapshot().status === 'OVER') break;
        }
        if (c.snapshot().status === 'OVER') break;
        expect(fired).toBe(2);
        const score = c.reloadDone({ correct: rng.next() < 0.5, elapsedMs: rng.int(-100, 20000) });
        expect([0, 1, 2]).toContain(score.scrap);
        expect(score.bonus).toBe(score.scrap > 0);
        if (score.bonus) {
          c.setAim({ angleDeg: rng.int(-10, 100), power: rng.int(-10, 110) });
          c.fire();
          expect([0, 15, 38]).toContain(c.shotLanded().damage);
          expect(c.snapshot().turn.shotsFired).toBe(2);
          if (c.snapshot().status === 'OVER') break;
        }
        c.pass();
      }
      const s = c.snapshot();
      expect(s.scrap.PAST).toBe(s.stats.PAST.scrapEarned);
      expect(s.scrap.FUTURE).toBe(s.stats.FUTURE.scrapEarned);
      if (s.status === 'OVER') expect(s.winner).not.toBeNull();
      else expect(s.winner).toBeNull();
    }
  });
});
