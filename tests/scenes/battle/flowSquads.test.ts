// Squads S1 in the battle flow: Hear it, the first-go hint, and a full turn with the crew.
import { describe, expect, it } from 'vitest';
import { SQUAD_COPY } from '../../../src/data/copy';
import { SCRAP } from '../../../src/game/config';
import { findAim, makeWorld, settle } from './flowHarness';

const SEED = 7;

describe('BattleFlow with Squads on', () => {
  it('shows the first-go hint on each side first go only, then never again', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss], matchOptions: { squads: true } });
    void w.flow.run();
    await settle();
    const past = w.hudStates.filter((h) => h.activeTeam === 'PAST' && h.canFire && h.squads);
    expect(past[0]!.squads!.hint).toBe(true);
    expect(past.some((h) => h.squads!.goesDone === 1 && h.squads!.hint)).toBe(false);
    // Said once for Team Past (two goes, one line) and once for Team Future (now waiting), each
    // with its words on screen as a caption.
    expect(w.spoken.filter((l) => l.id === 'squad-first-go')).toHaveLength(2);
    expect(w.spoken[0]!.text).toBe(SQUAD_COPY.firstGo);
    expect(w.captions).toContain(SQUAD_COPY.firstGo);
  });

  it('Hear it speaks the picked helper with a caption and costs no go', async () => {
    const w = makeWorld({ seed: SEED, matchOptions: { squads: true } });
    void w.flow.run();
    await settle();
    w.handlers()!.onHearHelper!();
    const line = w.spoken.find((l) => l.id.startsWith('squad-hear-'))!;
    expect(line.text).toBe(SQUAD_COPY.hearLine('launcher', 'Cannon Crew'));
    expect(line.captions.length).toBeGreaterThan(0);
    expect(w.captions).toContain(line.text);
    expect(w.match.snapshot().turn.shotsFired).toBe(0);
    w.flow.destroy();
  });

  it('Hear it names the dasher after a pick, and never asks for a network clip', async () => {
    const w = makeWorld({ seed: SEED, matchOptions: { squads: true }, clips: true });
    void w.flow.run();
    await settle();
    w.handlers()!.onHelper!('PAST-dasher');
    w.handlers()!.onHearHelper!();
    const line = w.spoken.find((l) => l.id === 'squad-hear-PAST-dasher')!;
    expect(line.text).toBe(SQUAD_COPY.hearLine('dasher', 'Chariot Archers'));
    expect(line.noClip).toBe(true);
    w.flow.destroy();
  });

  it('plays 2 goes, then the covered reload, then the next side with its full crew', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({
      seed: SEED,
      script: [miss, miss],
      answers: ['wrong'],
      matchOptions: { squads: true },
    });
    void w.flow.run();
    await settle();
    const order = w.log.filter((l) => /^(pass|banner|reload)/.test(l));
    expect(order.slice(0, 5)).toEqual([
      'pass:PAST',
      'banner:Alex:1',
      'banner:Alex:2',
      'reload:PAST',
      'pass:FUTURE',
    ]);
    expect(w.modalQuestions).toHaveLength(1);
    expect(w.coverViolations).toEqual([]);
    const m = w.match.snapshot();
    expect(m.scrap.PAST).toBe(SCRAP.wrong);
    expect(m.turn.team).toBe('FUTURE');
    expect(m.turn.shotsFired).toBe(0);
    expect(m.squads!.crew.helpers.filter((h) => h.team === 'FUTURE')).toHaveLength(2);
    w.flow.destroy();
  });

  it('with the flag off there is no hint, no squad state and nothing spoken', async () => {
    const w = makeWorld({ seed: SEED });
    void w.flow.run();
    await settle();
    expect(w.hudStates.every((h) => h.squads === undefined)).toBe(true);
    expect(w.spoken).toHaveLength(0);
    w.handlers()!.onHearHelper?.();
    expect(w.spoken).toHaveLength(0);
    w.flow.destroy();
  });
});
