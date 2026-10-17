import { describe, expect, it } from 'vitest';
import {
  CALIBRATION,
  effectiveGrade,
  freshCalibration,
  levelOffset,
  nameKey,
  recordAnswer,
  recordFor,
  withRecord,
  windowStep,
  type CalibrationState,
} from '../../src/questions/calibration';

const feed = (s: CalibrationState, answers: boolean[]): CalibrationState =>
  answers.reduce((acc, a) => recordAnswer(acc, a), s);
const T = true;
const F = false;

describe('calibration rule', () => {
  it('starts at zero', () => {
    expect(freshCalibration()).toEqual({ offset: 0, recent: [] });
    expect(levelOffset(freshCalibration())).toBe(0);
  });

  it('windowStep: 4 or 5 right is up, 2 or fewer right is down, 3 holds', () => {
    expect(windowStep([T, T, T, T, T])).toBe(1);
    expect(windowStep([T, T, T, T, F])).toBe(1);
    expect(windowStep([T, T, T, F, F])).toBe(0);
    expect(windowStep([T, T, F, F, F])).toBe(-1);
    expect(windowStep([F, F, F, F, F])).toBe(-1);
    expect(windowStep([T, T])).toBe(0); // fewer than 5 answers
  });

  it('holds the offset until five answers are in', () => {
    const s = feed(freshCalibration(), [T, T, T, T]);
    expect(s.offset).toBe(0);
    expect(s.recent).toHaveLength(4);
  });

  it('moves up one after 5 right, then clears the window', () => {
    expect(feed(freshCalibration(), [T, T, T, T, T])).toEqual({ offset: 1, recent: [] });
  });

  it('4 of 5 nudges up, 2 of 5 nudges down, 3 of 5 stays', () => {
    expect(feed(freshCalibration(), [T, T, T, T, F]).offset).toBe(1);
    expect(feed(freshCalibration(), [T, F, T, F, F]).offset).toBe(-1);
    expect(feed(freshCalibration(), [T, F, T, F, T]).offset).toBe(0);
  });

  it('keeps climbing one step per window but never past +2 or -2', () => {
    let s = freshCalibration();
    for (let i = 0; i < 6; i++) s = feed(s, [T, T, T, T, T]);
    expect(s.offset).toBe(2);
    for (let i = 0; i < 8; i++) s = feed(s, [F, F, F, F, F]);
    expect(s.offset).toBe(-2);
  });

  it('does not change its input', () => {
    const s = Object.freeze({ offset: 0, recent: Object.freeze([T]) as boolean[] });
    expect(() => recordAnswer(s, T)).not.toThrow();
    expect(s.recent).toEqual([T]);
  });

  it('survives bad state', () => {
    const bad = {
      offset: NaN,
      recent: [T, 'x', 1, T, T, T, T, T, T],
    } as unknown as CalibrationState;
    const s = recordAnswer(bad, T);
    expect(Number.isInteger(s.offset)).toBe(true);
    expect(Math.abs(s.offset)).toBeLessThanOrEqual(2);
    expect(s.recent.length).toBeLessThanOrEqual(CALIBRATION.window);
    expect(levelOffset({ offset: 99, recent: [] })).toBe(2);
    expect(levelOffset({ offset: -99, recent: [] })).toBe(-2);
    expect(levelOffset({ offset: Infinity, recent: [] })).toBe(0);
  });
});

describe('effectiveGrade', () => {
  it('adds the offset', () => {
    expect(effectiveGrade(4, 1)).toBe(5);
    expect(effectiveGrade(4, -2)).toBe(2);
  });
  it('clamps to 0..12 (K is 0)', () => {
    expect(effectiveGrade(0, -2)).toBe(0);
    expect(effectiveGrade(1, -2)).toBe(0);
    expect(effectiveGrade(12, 2)).toBe(12);
    expect(effectiveGrade(11, 2)).toBe(12);
  });
  it('never moves more than 2 from the player grade', () => {
    expect(effectiveGrade(5, 9)).toBe(7);
    expect(effectiveGrade(5, -9)).toBe(3);
  });
  it('bad input falls back safely', () => {
    expect(effectiveGrade(5, NaN)).toBe(5);
    expect(effectiveGrade(NaN, 1)).toBe(1);
    expect(effectiveGrade(-3, 0)).toBe(0);
    expect(effectiveGrade(99, 0)).toBe(12);
  });
});

describe('per name and subject', () => {
  it('nameKey ignores capitals and extra spaces', () => {
    expect(nameKey('  Alex   Smith ')).toBe('alex smith');
    expect(nameKey('ALEX')).toBe(nameKey('alex'));
  });
  it('recordFor reads fresh when nothing is saved', () => {
    expect(recordFor({}, 'Alex', 'math')).toEqual(freshCalibration());
  });
  it('withRecord saves under the normalised name and keeps subjects apart', () => {
    const a = withRecord({}, ' ALEX ', 'math', { offset: 1, recent: [] });
    expect(recordFor(a, 'alex', 'math').offset).toBe(1);
    expect(recordFor(a, 'Alex', 'reading').offset).toBe(0);
    expect(recordFor(a, 'Sam', 'math').offset).toBe(0);
  });
  it('withRecord keeps at most 50 names', () => {
    let l = {};
    for (let i = 0; i < 60; i++) l = withRecord(l, `kid${i}`, 'math', { offset: 1, recent: [] });
    expect(Object.keys(l)).toHaveLength(50);
    expect(recordFor(l, 'kid59', 'math').offset).toBe(1);
  });
});
