// Individual calibration. Pure: no DOM, no storage. Nothing here is ever shown to a child.
//
// The rule (from the owner): after every 5 answers in a subject,
//   4 or 5 right -> the level offset goes up one step,
//   2 or fewer right -> it goes down one step,
//   3 right -> it stays.
// Then the window of 5 is cleared. The offset stays within -2..+2 of the player's own
// grade. Reading and math are tracked separately, per player name on this device.

import type { Grade } from '../game/types';

export type Recent = boolean[];
export type CalibrationState = { offset: number; recent: Recent };
export type Offset = -2 | -1 | 0 | 1 | 2;
export type CalibrationSubject = 'reading' | 'math';
export type LevelRecord = { reading?: CalibrationState; math?: CalibrationState };
/** Keyed by `nameKey(name)`. */
export type Levels = Record<string, LevelRecord>;

export const CALIBRATION = {
  window: 5,
  upAt: 4,
  downAt: 2,
  maxOffset: 2,
  maxNames: 50,
  gradeMin: 0,
  gradeMax: 12,
} as const;

export const freshCalibration = (): CalibrationState => ({ offset: 0, recent: [] });

/** Same normalisation as the Camp wallet key: trim, collapse spaces, lowercase. */
export const nameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

const clampOffset = (n: number): Offset =>
  (Number.isFinite(n)
    ? Math.max(-CALIBRATION.maxOffset, Math.min(CALIBRATION.maxOffset, Math.round(n)))
    : 0) as Offset;

/** The step for a full window: +1, -1, or 0. Fewer than 5 answers is always 0. */
export function windowStep(recent: Recent): -1 | 0 | 1 {
  if (recent.length < CALIBRATION.window) return 0;
  const right = recent.slice(-CALIBRATION.window).filter((a) => a === true).length;
  if (right >= CALIBRATION.upAt) return 1;
  if (right <= CALIBRATION.downAt) return -1;
  return 0;
}

/** The current offset of a state, always a whole number from -2 to +2. */
export const levelOffset = (state: CalibrationState): Offset => clampOffset(state.offset);

/** The grade to ask. Never more than 2 from the player's own grade, and always 0 to 12 (K is 0). */
export function effectiveGrade(grade: number, offset: number): Grade {
  const base = Number.isFinite(grade)
    ? Math.max(CALIBRATION.gradeMin, Math.min(CALIBRATION.gradeMax, Math.round(grade)))
    : CALIBRATION.gradeMin;
  return Math.max(
    CALIBRATION.gradeMin,
    Math.min(CALIBRATION.gradeMax, base + clampOffset(offset)),
  ) as Grade;
}

/** Notes one answer. Returns a new state and never changes its input. */
export function recordAnswer(state: CalibrationState, correct: boolean): CalibrationState {
  const past = Array.isArray(state.recent)
    ? state.recent.filter((a) => typeof a === 'boolean')
    : [];
  const recent = [...past, correct === true].slice(-CALIBRATION.window);
  const offset = levelOffset(state);
  if (recent.length < CALIBRATION.window) return { offset, recent };
  return { offset: clampOffset(offset + windowStep(recent)), recent: [] };
}

export const recordFor = (
  levels: Levels,
  name: string,
  subject: CalibrationSubject,
): CalibrationState => levels[nameKey(name)]?.[subject] ?? freshCalibration();

/** A new Levels with one record changed. Keeps at most 50 names (the oldest are dropped). */
export function withRecord(
  levels: Levels,
  name: string,
  subject: CalibrationSubject,
  state: CalibrationState,
): Levels {
  const key = nameKey(name);
  const { [key]: old, ...rest } = levels;
  const next: Levels = { ...rest, [key]: { ...old, [subject]: state } };
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - CALIBRATION.maxNames))) delete next[k];
  return next;
}
