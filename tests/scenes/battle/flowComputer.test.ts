// One child alone against the Computer player, inside the battle loop (no Phaser).
import { describe, expect, it } from 'vitest';
import { COMPUTER } from '../../../src/data/computerCopy';
import { SQUAD_COPY } from '../../../src/data/copy';
import { dasherHomePoint, dasherOf, groundSpotPoint } from '../../../src/game/crew';
import { PRACTICE_BOT, type BotLevel } from '../../../src/game/config';
import { withComputer } from '../../../src/game/practice';
import { BattleFlow } from '../../../src/scenes/battle/flow';
import { PLAYERS, makeWorld, settle } from './flowHarness';

const SHORT = { angleDeg: 45, power: 20 };

function computerWorld(level: BotLevel = 'hard', seed = 11, reduced = false) {
  const w = makeWorld({
    seed,
    players: withComputer(PLAYERS, 'FUTURE'),
    script: Array.from({ length: 40 }, () => SHORT),
    answers: Array.from({ length: 40 }, () => 'right' as const),
  });
  const thinking: Array<string | null> = [];
  const waits: Array<{ ms: number; thinking: boolean }> = [];
  let showing = false;
  const overlay = {
    ...(w.deps.overlay as object),
    showThinking: (o: { text: string } | null) => {
      thinking.push(o ? o.text : null);
      showing = o !== null;
    },
  } as unknown as typeof w.deps.overlay;
  const flow = new BattleFlow({
    ...w.deps,
    overlay,
    practice: { team: 'FUTURE', level },
    reducedMotion: () => reduced,
    wait: async (ms) => void waits.push({ ms, thinking: showing }),
  });
  return { ...w, flow, thinking, waits };
}

describe('BattleFlow with the Computer player', () => {
  it('the computer winds up before every shot too, after its thinking note is gone', async () => {
    const w = computerWorld();
    await w.flow.run();
    const order = w.log.filter((l) => /^(charge|fly):FUTURE/.test(l));
    expect(order.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < order.length; i += 2) {
      expect(order.slice(i, i + 2)).toEqual(['charge:FUTURE', 'fly:FUTURE']);
    }
    const computerCharges = w.charges.filter((c) => c.team === 'FUTURE');
    // Fire is never on for the computer, and its shot is not taken before the wind-up.
    for (const c of computerCharges) expect(c.canFireShown).toBe(false);
    expect(w.thinking.at(-1) ?? null).toBeNull();
  });

  it('never shows the pass-the-mouse screen, before or after the computer', async () => {
    const w = computerWorld();
    await w.flow.run();
    expect(w.log.some((l) => l.startsWith('pass:'))).toBe(false);
    expect(w.match.snapshot().status).toBe('OVER');
  });

  it('the computer takes both shots and a reload with no question card for the child', async () => {
    const w = computerWorld();
    await w.flow.run();
    const flights = w.log.filter((l) => l === 'fly:FUTURE').length;
    expect(flights).toBeGreaterThanOrEqual(2);
    // Only the human's own reload cards are ever opened.
    expect(w.log.filter((l) => l.startsWith('reload:'))).not.toContain('reload:FUTURE');
    expect(w.modalQuestions.length).toBe(w.log.filter((l) => l === 'reload:PAST').length);
    // The thinking note says who, and never holds a question or an answer.
    const texts = w.thinking.filter((t): t is string => t !== null);
    expect(texts).toContain(COMPUTER.aiming);
    expect(texts).toContain(COMPUTER.thinking);
    for (const t of texts) expect(t).toMatch(/^Computer player is (aiming|thinking)$/);
    expect(w.thinking[w.thinking.length - 1]).toBeNull();
  });

  it('the dial and meter move by themselves, and the child cannot touch them meanwhile', async () => {
    const w = computerWorld();
    await w.flow.run();
    const computerStates = w.hudStates.filter((s) => s.activeTeam === 'FUTURE');
    expect(computerStates.length).toBeGreaterThan(5);
    expect(computerStates.every((s) => !s.canFire)).toBe(true);
    expect(computerStates.every((s) => s.computerTeam === 'FUTURE')).toBe(true);
    const aims = new Set(computerStates.map((s) => `${s.angleDeg}/${s.power}`));
    expect(aims.size).toBeGreaterThan(3);
  });

  it('a stray tap on Fire or a drag during the computer turn does nothing', async () => {
    const w = makeWorld({
      seed: 11,
      players: withComputer(PLAYERS, 'FUTURE'),
      script: Array.from({ length: 6 }, () => SHORT),
      answers: ['right', 'right'],
    });
    // The computer's dial stops to wait, so the test can poke the screen mid-aim.
    let hold: (() => void) | null = null;
    let thinkingNow = false;
    const flow = new BattleFlow({
      ...w.deps,
      overlay: {
        ...(w.deps.overlay as object),
        showThinking: (o: unknown) => void (thinkingNow = o !== null),
      } as unknown as typeof w.deps.overlay,
      practice: { team: 'FUTURE', level: 'hard' },
      wait: () => (thinkingNow ? new Promise<void>((r) => void (hold = r)) : Promise.resolve()),
    });
    void flow.run();
    await settle();
    expect(w.match.snapshot().turn.team).toBe('FUTURE');
    const before = w.match.snapshot().aim.FUTURE;
    w.handlers()?.onFire();
    w.drag({ angleDeg: 10, power: 10 });
    w.handlers()?.onAim({ angleDeg: 10, power: 10 });
    w.handlers()?.onSelect('1');
    const after = w.match.snapshot();
    expect(after.stats.FUTURE.shotsFired).toBe(0);
    expect(after.aim.FUTURE).toEqual(before);
    expect(hold).not.toBeNull();
    flow.destroy();
    (hold as (() => void) | null)?.();
  });

  it('keeps a computer turn under 8 seconds of thinking, including the reload', async () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      for (const seed of [3, 11, 21]) {
        const w = computerWorld(level, seed);
        const perTurn = new Map<number, number>();
        let thinkingNow = false;
        const flow = new BattleFlow({
          ...w.deps,
          overlay: {
            ...(w.deps.overlay as object),
            showThinking: (o: unknown) => void (thinkingNow = o !== null),
          } as unknown as typeof w.deps.overlay,
          practice: { team: 'FUTURE', level },
          wait: async (ms) => {
            const n = w.match.snapshot().turn.turnNumber;
            if (thinkingNow) perTurn.set(n, (perTurn.get(n) ?? 0) + ms);
          },
        });
        await flow.run();
        expect(perTurn.size).toBeGreaterThan(0);
        for (const ms of perTurn.values())
          expect(ms).toBeLessThanOrEqual(PRACTICE_BOT.pace.turnBudgetMs);
      }
    }
  });

  it('a wrong computer answer never blocks play (Gate 2)', async () => {
    // Easy at grade 2 misses often; across seeds the match still always finishes.
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = computerWorld('easy', seed);
      await w.flow.run();
      expect(w.match.snapshot().status).toBe('OVER');
    }
  });

  it('reduced motion jumps the dial in one move and still shows the note briefly', async () => {
    const w = computerWorld('hard', 11, true);
    await w.flow.run();
    const thinkingWaits = w.waits.filter((x) => x.thinking);
    expect(thinkingWaits.length).toBeGreaterThan(0);
    expect(thinkingWaits.every((x) => x.ms <= PRACTICE_BOT.pace.reducedBeatMs)).toBe(true);
  });

  it('is repeatable: the same seed plays the same match', async () => {
    const a = computerWorld('medium', 21);
    const b = computerWorld('medium', 21);
    await a.flow.run();
    await b.flow.run();
    expect(a.log).toEqual(b.log);
  });

  it('two people still get the pass screen (the flag-off game is unchanged)', async () => {
    const w = makeWorld({ seed: 7, script: [SHORT, SHORT], answers: ['wrong'] });
    void w.flow.run();
    await settle();
    expect(w.log).toContain('pass:PAST');
    expect(w.log).toContain('pass:FUTURE');
  });
});

describe('the Computer player and its walking helper', () => {
  /** The child walks the helper out on go 1, then fires a harmless go 2. The computer is Hard. */
  async function childWalksOut(level: BotLevel = 'hard', reduced = false) {
    const w = makeWorld({ seed: 11, players: withComputer(PLAYERS, 'FUTURE') });
    const events: string[] = [];
    let showing = false;
    const flow = new BattleFlow({
      ...w.deps,
      overlay: {
        ...(w.deps.overlay as object),
        showThinking: (o: { text: string } | null) => {
          showing = o !== null;
          events.push(o ? `think:${o.text}` : 'think:off');
        },
      } as unknown as typeof w.deps.overlay,
      view: {
        ...w.deps.view,
        walkDasher: async (team, from, to, dizzy) => {
          events.push(`walk:${team}:${showing ? 'thinking' : 'clear'}`);
          await w.deps.view.walkDasher?.(team, from, to, dizzy);
        },
      },
      practice: { team: 'FUTURE', level },
      reducedMotion: () => reduced,
      wait: async (ms) => void events.push(`wait:${ms}:${showing}`),
    });
    void flow.run();
    await settle();
    const h = w.handlers()!;
    h.onHelper!('PAST-dasher');
    h.onDash!(w.match.helperTargets()[0]!);
    await settle();
    h.onHelper!('PAST-launcher');
    h.onAim({ angleDeg: 90, power: 0 });
    h.onFire();
    // The child's reload (wrong by default), then the whole computer turn, then the child again.
    await settle();
    return { ...w, flow, events };
  }

  it("meets the child's helper with the same walk a child gets, as go 1 of its turn", async () => {
    const w = await childWalksOut();
    const LAYOUT = w.match.layout;
    const home = Math.round(dasherHomePoint('FUTURE', LAYOUT).x);
    const doorstep = Math.round(groundSpotPoint('g4', LAYOUT).x);
    expect(w.log).toContain(`walk:FUTURE:${home}>${doorstep}`);
    expect(w.captions).toContain(
      SQUAD_COPY.walked(SQUAD_COPY.helperName['FUTURE-dasher'] as string),
    );
    // The walk is go 1. Go 2 is a normal shot with the launcher, then a Power Shot only after a
    // right answer. Nothing else: no third go of its own.
    const future = w.log.filter((l) => /^(walk|fly):FUTURE/.test(l));
    expect(future[0]).toBe(`walk:FUTURE:${home}>${doorstep}`);
    expect(future.slice(1).every((l) => l === 'fly:FUTURE')).toBe(true);
    expect(future.length).toBeGreaterThanOrEqual(2);
    expect(future.length).toBeLessThanOrEqual(3);
    expect(w.match.snapshot().stats.FUTURE.shotsFired).toBe(future.length - 1);
    // A short "thinking" note shows first, and is gone before he walks.
    const walk = w.events.indexOf('walk:FUTURE:clear');
    expect(walk).toBeGreaterThan(0);
    expect(w.events.slice(0, walk)).toContain(`think:${COMPUTER.thinking}`);
    expect(w.events.slice(0, walk)).toContain(`wait:${PRACTICE_BOT.helper.thinkMs}:true`);
    // Both helpers are out now, next to each other, and the child is back on its turn.
    const crew = w.match.snapshot().squads!.crew;
    expect(dasherOf(crew, 'FUTURE').state).toBe('out');
    expect(w.match.snapshot().turn.team).toBe('PAST');
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });

  it('with reduced motion the note before a helper go is short too', async () => {
    const w = await childWalksOut('hard', true);
    expect(w.events).toContain(
      `wait:${Math.min(PRACTICE_BOT.helper.thinkMs, PRACTICE_BOT.pace.reducedBeatMs)}:true`,
    );
    expect(w.events).toContain('walk:FUTURE:clear');
    w.flow.destroy();
  });

  it('never walks out on an empty field at its levels (it answers the child in kind)', async () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const w = computerWorld(level, 11);
      await w.flow.run();
      expect(w.log.some((l) => l.startsWith('walk:FUTURE'))).toBe(false);
    }
  });
});
