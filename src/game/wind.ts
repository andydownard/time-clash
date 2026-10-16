import { RNG_SALT, WIND } from './config';
import { createRng } from './rng';
import type { WindForTurn } from './types';

/** Golden-ratio multiplier. Spreads neighbouring turn numbers across the 32-bit range. */
const TURN_MIX = 0x9e3779b1;

/** Integer wind in [WIND.min, WIND.max]. Same seed and turn, same wind. */
export const windForTurn: WindForTurn = (seed, turnNumber) => {
  const mixed = (seed ^ RNG_SALT.wind ^ Math.imul(turnNumber + 1, TURN_MIX)) >>> 0;
  return createRng(mixed).int(WIND.min, WIND.max);
};

/** 0 calm, 1 breezy, 2 windy, 3 super windy. Left and right count the same. Bad numbers are calm. */
export function windLevel(wind: number): 0 | 1 | 2 | 3 {
  const n = Math.abs(Number(wind));
  if (Number.isNaN(n)) return 0;
  if (n >= WIND.levels.superWindy) return 3;
  if (n >= WIND.levels.windy) return 2;
  if (n >= WIND.levels.breezy) return 1;
  return 0;
}
