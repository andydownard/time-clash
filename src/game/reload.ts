import { RELOAD, SCRAP } from './config';
import type { ScoreReload } from './types';

/**
 * The time limit for a "fast" answer, in ms. It depends on the kind of question and on grade
 * (K and 1 get extra time). Unknown or missing values use RELOAD.fastMs.
 */
export function fastWindowMs(kind?: string, grade?: number): number {
  const base = (kind !== undefined ? RELOAD.fastMsByKind[kind] : undefined) ?? RELOAD.fastMs;
  const early = grade !== undefined && grade <= RELOAD.earlyGradeMax ? RELOAD.earlyGradeExtraMs : 0;
  return base + early;
}

/**
 * Wrong answer: 0 scrap, but the reload still happens (Gate 2, decided in docs/CONTRACTS.md).
 * Right and under RELOAD.fastMs: 2. Right and slow: 1. A slow answer never loses anything.
 * Bad elapsedMs (NaN, negative, infinite) counts as slow. Never throws.
 */
export const scoreReload: ScoreReload = ({ correct, elapsedMs, kind, grade }) => {
  if (!correct) return { scrap: SCRAP.wrong, fast: false };
  const fast =
    Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < fastWindowMs(kind, grade);
  return { scrap: fast ? SCRAP.fastCorrect : SCRAP.slowCorrect, fast };
};
