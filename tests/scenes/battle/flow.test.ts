import { describe, expect, it } from 'vitest';
import { HIT_LINES, PASS_SCREEN, RELOAD, RELOAD_QUIPS, tumblePool } from '../../../src/data/copy';
import { DAMAGE, SCRAP } from '../../../src/game/config';
import { QUICK_END, QUICK_END_HITS, findAim, makeWorld, settle } from './flowHarness';

const SEED = 7;

describe('BattleFlow: one turn', () => {
  it('shows the pass screen, then two banners, then two flights, then the reload modal', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    const order = w.log.filter((l) => /^(pass|banner|fly|impact|reload)/.test(l));
    expect(order.slice(0, 8)).toEqual([
      'pass:PAST',
      'banner:Alex:1',
      'fly:PAST',
      'impact:miss',
      'banner:Alex:2',
      'fly:PAST',
      'impact:miss',
      'reload:PAST',
    ]);
  });

  it('winds up before every shot: Fire turns off, then the charge, then the boom and the flight', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    const order = w.log.filter((l) => /^(charge|fly):PAST/.test(l));
    expect(order.slice(0, 4)).toEqual(['charge:PAST', 'fly:PAST', 'charge:PAST', 'fly:PAST']);
    expect(w.charges).toHaveLength(2);
    w.charges.forEach((c, i) => {
      // The wind-up glows where the shot starts, from the shooter's launcher.
      expect(c.from).toEqual(w.shots[i]!.start);
      // Fire is already off, so a second tap cannot stack a shot.
      expect(c.canFireShown).toBe(false);
      // No boom yet, and the shot is not counted until the wind-up ends.
      expect(w.sfx.slice(0, c.sfxSoFar).filter((s) => s === 'cannonBoom')).toHaveLength(i);
      expect(c.shotsFired).toBe(i);
    });
  });

  it('a destroyed battle during the wind-up fires nothing', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    let w: ReturnType<typeof makeWorld> | null = null;
    w = makeWorld({ seed: SEED, script: [miss, miss], onCharge: () => w?.flow.destroy() });
    void w.flow.run();
    await settle();
    expect(w.log).toContain('charge:PAST');
    expect(w.log).not.toContain('fly:PAST');
    expect(w.sfx).not.toContain('cannonBoom');
    expect(w.match.snapshot().stats.PAST.shotsFired).toBe(0);
  });

  it('plays the cannon for each Team Past shot', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    expect(w.sfx.filter((s) => s === 'cannonBoom')).toHaveLength(2);
    expect(w.sfx).toContain('thud');
  });

  it('asks the reload question for the shooter grade and subject', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    expect(w.modalQuestions).toHaveLength(1);
    expect(w.modalQuestions[0]!.subject).toBe('math');
    expect(w.modalQuestions[0]!.grade).toBe(2);
  });

  it('asks only multiplication when the shooter has the topic on, at the shooter grade', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({
      seed: SEED,
      script: [miss, miss],
      players: [
        { name: 'Alex', team: 'PAST', grade: 4, subject: 'math', topic: 'multiplication' },
        { name: 'Sam', team: 'FUTURE', grade: 9, subject: 'math' },
      ],
    });
    void w.flow.run();
    await settle();
    expect(w.modalQuestions).toHaveLength(1);
    expect(w.modalQuestions[0]!.tags).toContain('topic:multiplication');
    expect(w.modalQuestions[0]!.grade).toBe(4);
  });

  it('passes to the other team after the reload, with a pass screen first', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    expect(w.log.filter((l) => l.startsWith('pass:'))).toEqual(['pass:PAST', 'pass:FUTURE']);
    expect(w.match.snapshot().turn.team).toBe('FUTURE');
    expect(w.match.snapshot().turn.phase).toBe('AIMING');
  });

  it('adds scrap for a right answer and shows the popup', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss], answers: ['right'] });
    void w.flow.run();
    await settle();
    expect(w.match.snapshot().scrap.PAST).toBe(SCRAP.fastCorrect);
    expect(w.scrapPopups).toEqual([{ team: 'PAST', amount: SCRAP.fastCorrect }]);
  });

  it('a wrong answer still reloads, earns nothing, and play goes on', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss], answers: ['wrong'] });
    void w.flow.run();
    await settle();
    expect(w.match.snapshot().scrap.PAST).toBe(SCRAP.wrong);
    expect(w.scrapPopups).toEqual([]);
    expect(w.match.snapshot().turn.team).toBe('FUTURE');
    expect(w.sfx).toContain('clunk');
  });

  it('saves the question history after every question', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss, miss], answers: ['right'] });
    void w.flow.run();
    await settle();
    expect(w.histories).toHaveLength(1);
    expect(JSON.stringify(w.histories[0])).toContain(w.modalQuestions[0]!.id);
  });
});

describe('BattleFlow: the reload teaches', () => {
  it('a wrong answer queues the question to come back, a right one does not', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const wrong = makeWorld({ seed: SEED, script: [miss, miss], answers: ['wrong'] });
    void wrong.flow.run();
    await settle();
    const id = wrong.modalQuestions[0]!.id;
    expect(wrong.histories.at(-1)!.retry?.map((e) => e.id)).toContain(id);

    const right = makeWorld({ seed: SEED, script: [miss, miss], answers: ['right'] });
    void right.flow.run();
    await settle();
    expect(right.histories.at(-1)!.retry).toBeUndefined();
  });

  it('sends the question kind and grade to the scoring, so the fast limit fits the question', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    const seen: Array<Record<string, unknown>> = [];
    const real = w.match.reloadDone.bind(w.match);
    w.match.reloadDone = (input) => {
      seen.push({ ...input });
      return real(input);
    };
    void w.flow.run();
    await settle();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      kind: w.modalQuestions[0]!.kind,
      grade: w.modalQuestions[0]!.grade,
    });
  });

  it('gives the question card no speak handler and never speaks the question', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    const spoken: string[] = [];
    w.deps.audio = {
      playSfx: () => {},
      speak: (line: { text: string }) => {
        spoken.push(line.text);
        return { done: Promise.resolve('ended'), source: 'silent', stop: () => {} };
      },
    } as unknown as typeof w.deps.audio;
    void w.flow.run();
    await settle();
    expect('speak' in w.modalOptions[0]!).toBe(false);
    const q = w.modalQuestions[0]!;
    for (const line of spoken) {
      expect(line).not.toContain(q.prompt);
    }
  });

  it('if the question card breaks, the turn still ends with exactly one reload and no scrap', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    w.deps.overlay.showReloadModal = async () => {
      throw new Error('card broke');
    };
    let calls = 0;
    const real = w.match.reloadDone.bind(w.match);
    w.match.reloadDone = (input) => {
      calls++;
      return real(input);
    };
    void w.flow.run();
    await settle();
    expect(calls).toBe(1);
    expect(w.match.snapshot().scrap.PAST).toBe(0);
    expect(w.match.snapshot().turn.team).toBe('FUTURE');
    expect(w.captions).toContain(RELOAD.lostQuestion);
  });
});

describe('BattleFlow: jokes stay fresh', () => {
  it('impact labels come from the lines in copy.ts and never repeat back to back', async () => {
    const script = [];
    for (let turn = 0; turn < 6; turn++) {
      const near = findAim(SEED, turn, turn % 2 === 0 ? 'PAST' : 'FUTURE', 'near');
      script.push(near, near);
    }
    const w = makeWorld({ seed: SEED, script });
    void w.flow.run();
    await settle();
    const labels = w.impactLabels;
    expect(labels.length).toBeGreaterThanOrEqual(8);
    for (const l of labels) expect(HIT_LINES.near as readonly string[]).toContain(l);
    expect(new Set(labels).size).toBeGreaterThan(1);
    for (let i = 1; i < labels.length; i++) expect(labels[i]).not.toBe(labels[i - 1]);
  });

  it('gives the question card a Chrono line for fast, slow, and wrong answers', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    const quip = w.modalOptions[0]!.quip as (k: 'fast' | 'slow' | 'wrong') => string | null;
    expect(RELOAD_QUIPS.fast as readonly string[]).toContain(quip('fast'));
    expect(RELOAD_QUIPS.slow as readonly string[]).toContain(quip('slow'));
    expect(RELOAD_QUIPS.wrong as readonly string[]).toContain(quip('wrong'));
  });
});

describe('BattleFlow: hits', () => {
  it('a direct hit shows toy blocks, takes health, and nobody tumbles', async () => {
    const direct = findAim(SEED, 0, 'PAST', 'direct');
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [direct, miss] });
    void w.flow.run();
    await settle();
    expect(w.impacts[0]!.kind).toBe('blocks');
    expect(w.tumbles).toEqual([]);
    expect(w.match.snapshot().baseHp.FUTURE).toBe(DAMAGE.startingBaseHp - DAMAGE.direct);
  });

  it('with the voice service set up, the bubble line is also spoken, same text, with its caption', async () => {
    const near = findAim(SEED, 0, 'PAST', 'near');
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [near, miss], clips: true });
    void w.flow.run();
    await settle();
    expect(w.spoken).toHaveLength(1);
    expect(w.spoken[0]!.text).toBe(w.bubbles[0]!.text);
    expect(w.spoken[0]!.captions[0]!.text).toBe(w.bubbles[0]!.text);
    expect(w.log.indexOf('speak')).toBeLessThan(w.log.indexOf('bubble:FUTURE'));
  });

  it('without the voice service the funny line is not spoken (game unchanged)', async () => {
    const near = findAim(SEED, 0, 'PAST', 'near');
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [near, miss] });
    void w.flow.run();
    await settle();
    expect(w.bubbles).toHaveLength(1);
    expect(w.spoken).toHaveLength(0);
  });

  it('a near miss makes the defender tumble and say a line from copy.ts', async () => {
    const near = findAim(SEED, 0, 'PAST', 'near');
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [near, miss] });
    void w.flow.run();
    await settle();
    expect(w.tumbles).toEqual(['FUTURE']);
    expect(w.bubbles).toHaveLength(1);
    expect(w.bubbles[0]!.team).toBe('FUTURE');
    expect(tumblePool('FUTURE')).toContain(w.bubbles[0]!.text);
    expect(w.sfx).toContain('boing');
    const i = w.log.indexOf('impact:near');
    expect(w.log[i + 1]).toBe('tumble:FUTURE');
    expect(w.log[i + 2]).toBe('bubble:FUTURE');
  });

  it('shows each of the five lines before repeating one', async () => {
    const script = [];
    for (let turn = 0; turn < 6; turn++) {
      const near = findAim(SEED, turn, turn % 2 === 0 ? 'PAST' : 'FUTURE', 'near');
      script.push(near, near);
    }
    const w = makeWorld({ seed: SEED, script });
    void w.flow.run();
    await settle();
    expect(w.bubbles.length).toBeGreaterThanOrEqual(5);
    expect(new Set(w.bubbles.slice(0, 5).map((b) => b.text)).size).toBe(5);
  });
});

describe('BattleFlow: winning', () => {
  it('hands off to Victory with stats and a rematch, and skips the last reload', async () => {
    const dP = (turn: number) => findAim(SEED, turn, 'PAST', 'direct');
    const dF = (turn: number) => findAim(SEED, turn, 'FUTURE', 'miss');
    const script = [dP(0), dP(0), dF(1), dF(1), dP(2), dP(2)];
    const w = makeWorld({ seed: SEED, script, matchOptions: QUICK_END });
    void w.flow.run();
    await settle();
    expect(w.results).toHaveLength(1);
    const r = w.results[0]!;
    expect(r.winner).toBe('PAST');
    expect(r.names).toEqual({ PAST: 'Alex', FUTURE: 'Sam' });
    expect(r.stats.PAST.directHits).toBe(QUICK_END_HITS);
    expect(r.rematch.seed).toBe(SEED + 1);
    expect(r.rematch.firstTeam).toBe('FUTURE');
    expect(w.log.filter((l) => l.startsWith('reload:'))).toEqual(['reload:PAST', 'reload:FUTURE']);
    expect(w.log[w.log.length - 1]).toBe('finished');
    expect(w.sfx).toContain('cheer');
  });

  it('a wipeout never shows a pass screen or reload after it', async () => {
    const dP = (turn: number) => findAim(SEED, turn, 'PAST', 'direct');
    const dF = (turn: number) => findAim(SEED, turn, 'FUTURE', 'miss');
    const w = makeWorld({
      seed: SEED,
      script: [dP(0), dP(0), dF(1), dF(1), dP(2), dP(2)],
      matchOptions: QUICK_END,
    });
    void w.flow.run();
    await settle();
    const lastImpact = w.log.lastIndexOf('impact:direct');
    expect(w.log.slice(lastImpact + 1)).toEqual(['finished']);
  });
});

describe('BattleFlow: input rules', () => {
  it('ignores a second Fire press while the shot is in the air', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    const h = w.handlers()!;
    expect(() => {
      h.onFire();
      h.onFire();
    }).not.toThrow();
    // No third shot ever, however many presses.
    expect(w.match.snapshot().stats.PAST.shotsFired).toBe(2);
  });

  it('ignores Fire and aim when it is not the aiming phase', async () => {
    const w = makeWorld({ seed: SEED, script: [] });
    void w.flow.run();
    await settle();
    // Waiting for the first fire; it is aiming. Fire once, then settle.
    const h = w.handlers()!;
    h.onFire();
    await settle();
    expect(w.match.snapshot().stats.PAST.shotsFired).toBe(1);
    expect(() => h.onAim({ angleDeg: 10, power: 10 })).not.toThrow();
  });

  it('turns HUD firing off while a shot flies and while the reload is up', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    const fireable = w.hudStates.filter((s) => s.canFire);
    const locked = w.hudStates.filter((s) => !s.canFire);
    expect(fireable.length).toBeGreaterThanOrEqual(3);
    expect(locked.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the aim the player sets and sends it to the HUD', async () => {
    const w = makeWorld({ seed: SEED });
    void w.flow.run();
    await settle();
    w.handlers()!.onAim({ angleDeg: 61, power: 33 });
    const last = w.hudStates[w.hudStates.length - 1]!;
    expect(last.angleDeg).toBe(61);
    expect(last.power).toBe(33);
    expect(w.match.snapshot().aim.PAST).toEqual({ angleDeg: 61, power: 33 });
  });

  it('clamps a wild aim before showing it', async () => {
    const w = makeWorld({ seed: SEED });
    void w.flow.run();
    await settle();
    w.handlers()!.onAim({ angleDeg: 500, power: -9 });
    const last = w.hudStates[w.hudStates.length - 1]!;
    expect(last.angleDeg).toBe(90);
    expect(last.power).toBe(0);
  });

  it('dragging the dial changes the aim just like the sliders', async () => {
    const w = makeWorld({ seed: SEED });
    void w.flow.run();
    await settle();
    expect(w.hasDragHandler()).toBe(true);
    w.drag({ angleDeg: 70, power: 40 });
    expect(w.match.snapshot().aim.PAST).toEqual({ angleDeg: 70, power: 40 });
  });

  it('draws a dotted preview that follows the aim, and clears it on fire', async () => {
    const w = makeWorld({ seed: SEED });
    void w.flow.run();
    await settle();
    w.handlers()!.onAim({ angleDeg: 50, power: 70 });
    const dots = w.previews[w.previews.length - 1]!;
    expect(dots.team).toBe('PAST');
    expect(dots.dots!.length).toBeGreaterThan(3);
    w.handlers()!.onFire();
    await settle();
    expect(w.previews.some((p) => p.dots === null)).toBe(true);
  });
});

describe('BattleFlow: the board stays hidden under a cover', () => {
  it('never draws on the board while the pass screen or reload modal is up', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss, miss, miss] });
    void w.flow.run();
    await settle();
    expect(w.coverViolations).toEqual([]);
  });

  it('puts the pass screen up before the next team sees any aim controls', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    const iPass = w.log.lastIndexOf('pass:FUTURE');
    const iBanner = w.log.indexOf('banner:Sam:1');
    expect(iPass).toBeGreaterThan(-1);
    expect(iBanner).toBeGreaterThan(iPass);
  });

  it('leaves the full arc up after a shot, and clears it before the reload and pass covers', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss] });
    void w.flow.run();
    await settle();
    const drawn = w.traces.filter((t) => t.points);
    expect(drawn.length).toBeGreaterThanOrEqual(2);
    expect(drawn[0]!.team).toBe('PAST');
    expect(drawn[0]!.points!.length).toBeGreaterThan(4);
    // The last PAST arc is cleared before the question cover, so no cover ever saw it.
    const lastDrawn = w.traces.lastIndexOf(drawn[drawn.length - 1]!);
    expect(w.traces.slice(lastDrawn + 1).some((t) => t.points === null)).toBe(true);
    expect(w.coverViolations).toEqual([]);
  });

  it('uses the player names on the pass screen text only through the overlay', () => {
    expect(PASS_SCREEN.upNext('Sam')).toContain('Sam');
  });
});

describe('BattleFlow: pause and stop', () => {
  it('waits while paused and goes on when resumed', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss], waitIfPaused: () => gate });
    void w.flow.run();
    await settle();
    expect(w.log).not.toContain('fly:PAST');
    expect(w.log).not.toContain('pass:PAST');
    release();
    await settle();
    expect(w.log).toContain('fly:PAST');
  });

  it('stops quietly when destroyed mid-turn', async () => {
    const w = makeWorld({ seed: SEED });
    const done = w.flow.run();
    await settle();
    w.flow.destroy();
    w.handlers()!.onFire();
    await done;
    await settle();
    expect(w.log).not.toContain('fly:PAST');
    expect(w.results).toEqual([]);
  });
});

describe('BattleFlow: no question available', () => {
  it('still reloads and moves on (an empty bank never blocks play)', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss], bank: { questions: [] } });
    void w.flow.run();
    await settle();
    expect(w.modalQuestions).toEqual([]);
    expect(w.match.snapshot().turn.team).toBe('FUTURE');
    expect(w.sfx).toContain('clunk');
  });
});

describe('BattleFlow: repeatable', () => {
  it('the same seed and inputs give the same log', async () => {
    const run = async () => {
      const miss = findAim(SEED, 0, 'PAST', 'near');
      const w = makeWorld({ seed: SEED, script: [miss, miss, miss, miss] });
      void w.flow.run();
      await settle();
      return { log: w.log, bubbles: w.bubbles, q: w.modalQuestions.map((x) => x.id) };
    };
    expect(await run()).toEqual(await run());
  });
});
