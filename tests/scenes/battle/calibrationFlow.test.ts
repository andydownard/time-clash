import { describe, expect, it } from 'vitest';
import type { AimInput, Players } from '../../../src/game/types';
import { recordFor, type Levels } from '../../../src/questions/calibration';
import { findAim, makeWorld, settle } from './flowHarness';

const SEED = 7;
const lowShot: AimInput = { angleDeg: 5, power: 10 };

/** Enough aims for many turns. */
const many = (n: number): AimInput[] => Array.from({ length: n }, () => lowShot);

const right = (n: number) => Array.from({ length: n }, () => 'right' as const);
const wrong = (n: number) => Array.from({ length: n }, () => 'wrong' as const);

describe('BattleFlow: quiet calibration', () => {
  it('after 5 right in a row the next question is one grade above the player (math, Alex grade 2)', async () => {
    // Past reloads on every other turn, 2 shots each: 6 Past reloads need 12 turns of 2 shots.
    const w = makeWorld({ seed: SEED, script: many(40), answers: right(20) });
    void w.flow.run();
    await settle();
    const asked = w.modalOptions
      .filter((o) => o.team === 'PAST')
      .map((o) => (o.question as { grade: number }).grade);
    expect(asked.length).toBeGreaterThanOrEqual(6);
    expect(asked.slice(0, 5)).toEqual([2, 2, 2, 2, 2]);
    expect(asked[5]).toBe(3);
    const saved = w.levelsSaved.at(-1)!;
    expect(recordFor(saved, 'ALEX', 'math').offset).toBeGreaterThanOrEqual(1);
  });

  it('after 5 wrong the next question is one grade below (reading, Sam grade 5), and the other player is untouched', async () => {
    const w = makeWorld({ seed: SEED, script: many(40), answers: wrong(20) });
    void w.flow.run();
    await settle();
    const futureGrades = w.modalOptions
      .filter((o) => o.team === 'FUTURE')
      .map((o) => (o.question as { grade: number }).grade);
    expect(futureGrades.slice(0, 5)).toEqual([5, 5, 5, 5, 5]);
    expect(futureGrades[5]).toBe(4);
    const saved = w.levelsSaved.at(-1)!;
    expect(recordFor(saved, 'sam', 'reading').offset).toBeLessThanOrEqual(-1);
    expect(recordFor(saved, 'sam', 'math').offset).toBe(0); // other subject
  });

  it('starts from saved levels, found whatever the capitals', async () => {
    const levels: Levels = { alex: { math: { offset: 2, recent: [] } } };
    const w = makeWorld({ seed: SEED, script: [lowShot, lowShot], levels });
    void w.flow.run();
    await settle();
    expect((w.modalOptions[0]!.question as { grade: number }).grade).toBe(4);
  });

  it('keeps reading and math apart when the player picks both', async () => {
    const players: Players = [
      { name: 'Alex', team: 'PAST', grade: 3, subject: 'both' },
      { name: 'Sam', team: 'FUTURE', grade: 3, subject: 'both' },
    ];
    const levels: Levels = {
      alex: { math: { offset: 2, recent: [] }, reading: { offset: -2, recent: [] } },
    };
    const w = makeWorld({ seed: SEED, script: many(12), answers: right(6), players, levels });
    void w.flow.run();
    await settle();
    const past = w.modalOptions
      .filter((o) => o.team === 'PAST')
      .map((o) => o.question as { grade: number; subject: string });
    expect(past.length).toBeGreaterThanOrEqual(2);
    for (const q of past) {
      if (q.subject === 'math') expect(q.grade).toBe(5);
      else expect(q.grade).toBe(1);
    }
  });

  it('never goes below K or above 12, and a wrong answer never blocks play', async () => {
    const k: Players = [
      { name: 'Alex', team: 'PAST', grade: 0, subject: 'math' },
      { name: 'Sam', team: 'FUTURE', grade: 12, subject: 'reading' },
    ];
    const levels: Levels = {
      alex: { math: { offset: -2, recent: [] } },
      sam: { reading: { offset: 2, recent: [] } },
    };
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({
      seed: SEED,
      script: [miss, miss, miss, miss],
      answers: wrong(2),
      players: k,
      levels,
    });
    void w.flow.run();
    await settle();
    const grades = w.modalOptions.map((o) => (o.question as { grade: number }).grade);
    expect(grades).toEqual([0, 12]);
    expect(w.match.snapshot().turn.team).toBe('PAST'); // play moved on after both reloads
  });

  it('does not change scrap: the fast-answer rules ignore calibration', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const plain = makeWorld({ seed: SEED, script: [miss, miss] });
    const up = makeWorld({
      seed: SEED,
      script: [miss, miss],
      levels: { alex: { math: { offset: 2, recent: [] } } },
    });
    for (const w of [plain, up]) {
      void w.flow.run();
      await settle();
    }
    expect(up.scrapPopups.length).toBe(plain.scrapPopups.length);
  });

  it('shows nothing about levels in the reload modal', async () => {
    const w = makeWorld({ seed: SEED, script: many(4), answers: right(2) });
    void w.flow.run();
    await settle();
    for (const o of w.modalOptions) {
      const keys = Object.keys(o).join(' ').toLowerCase();
      expect(keys).not.toMatch(/level|offset|harder|easier/);
    }
  });
});
