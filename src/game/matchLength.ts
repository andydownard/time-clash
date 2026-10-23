// Match length: Short, Normal or Long. Pure rules code, no Phaser. See MATCH_LENGTH in config.ts.
import { MATCH_LENGTH } from './config';

export type MatchLength = (typeof MATCH_LENGTH.ids)[number];

export const isMatchLength = (v: unknown): v is MatchLength =>
  typeof v === 'string' && (MATCH_LENGTH.ids as readonly string[]).includes(v);

/** Anything that is not a known length (missing, old, edited by hand) is Normal. */
export const normalizeMatchLength = (v: unknown): MatchLength =>
  isMatchLength(v) ? v : MATCH_LENGTH.default;

/** Full health for this length. Whole numbers, never below 1, so nobody starts out. */
export const scaleHealth = (full: number, length: unknown): number =>
  Math.max(1, Math.round(full * MATCH_LENGTH.healthScale[normalizeMatchLength(length)]));
