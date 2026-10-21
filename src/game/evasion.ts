// Evasion abilities (Phase 2). Pure, no Phaser. One ability per team:
//   Team Future: Hoverboard Dodge. The first hit that would do damage misses. Ready again 2 own turns later.
//   Team Past: Stone Barricade Wall. A wall stands in front of the castle. Once per match.
// A player arms it on their own turn (free, not a shot). It guards during the other team's next turn.
// Cycle: ready -> armed (this turn) -> active (enemy turn) -> recharging or used -> ready.
import { EVASION } from './config';
import type { EvasionView, Rect, Team } from './types';

export type EvasionId = 'dodge' | 'barricade';
export type EvasionPhase = 'ready' | 'armed' | 'active' | 'recharging' | 'used';

export type EvasionState = {
  readonly id: EvasionId;
  readonly phase: EvasionPhase;
  /** Own turns still to start before it is ready again. */
  readonly cooldown: number;
  /** Uses left this match. Infinity when there is no limit. */
  readonly usesLeft: number;
};

export type EvasionRefusal = 'already_armed' | 'recharging' | 'used_up' | 'not_armed';

export class EvasionError extends Error {
  readonly reason: EvasionRefusal;
  constructor(reason: EvasionRefusal) {
    super(`Evasion cannot do that: ${reason}`);
    this.name = 'EvasionError';
    this.reason = reason;
  }
}

/** The ability each team has. */
export const evasionIdFor = (team: Team): EvasionId =>
  EVASION.dodge.team === team ? 'dodge' : 'barricade';

export const freshEvasion = (team: Team): EvasionState => {
  const id = evasionIdFor(team);
  return {
    id,
    phase: 'ready',
    cooldown: 0,
    usesLeft: id === 'barricade' ? EVASION.barricade.usesPerMatch : Number.POSITIVE_INFINITY,
  };
};

/** Arms a ready ability. Throws EvasionError with the reason when it is not ready. */
export function arm(s: EvasionState): EvasionState {
  if (s.phase === 'armed' || s.phase === 'active') throw new EvasionError('already_armed');
  if (s.phase === 'recharging') throw new EvasionError('recharging');
  if (s.phase === 'used' || s.usesLeft <= 0) throw new EvasionError('used_up');
  return {
    ...s,
    phase: 'armed',
    usesLeft: s.usesLeft - 1,
    cooldown: s.id === 'dodge' ? EVASION.dodge.rechargeTurns : 0,
  };
}

/** Takes back an ability armed this turn. The use comes back. */
export function disarm(s: EvasionState): EvasionState {
  if (s.phase !== 'armed') throw new EvasionError('not_armed');
  return { ...s, phase: 'ready', usesLeft: s.usesLeft + 1, cooldown: 0 };
}

/** The owner's turn ends: an armed ability starts guarding. */
export function endOwnTurn(s: EvasionState): EvasionState {
  return s.phase === 'armed' ? { ...s, phase: 'active' } : s;
}

/** After the guard ends: the dodge recharges, the wall is used up (or ready if uses are left). */
const afterGuard = (s: EvasionState): EvasionState => {
  if (s.id === 'dodge') return { ...s, phase: 'recharging' };
  return { ...s, phase: s.usesLeft > 0 ? 'ready' : 'used', cooldown: 0 };
};

/** The owner's next turn starts: the guard ends and the recharge counts down one turn. */
export function startOwnTurn(s: EvasionState): EvasionState {
  if (s.phase !== 'active' && s.phase !== 'recharging') return s;
  const next = s.phase === 'active' ? afterGuard(s) : s;
  if (next.phase !== 'recharging') return next;
  const cooldown = Math.max(0, next.cooldown - 1);
  return cooldown === 0 ? { ...next, phase: 'ready', cooldown } : { ...next, cooldown };
}

/** A dodge was used on a hit. Only an active dodge changes. The wall is never spent by a hit. */
export function spend(s: EvasionState): EvasionState {
  return s.id === 'dodge' && s.phase === 'active' ? { ...s, phase: 'recharging' } : s;
}

/** True when this ability makes the next damaging hit miss. */
export const dodgesNow = (s: EvasionState): boolean => s.id === 'dodge' && s.phase === 'active';

/** The walls standing right now (a barricade guarding its base). */
export const wallsFor = (all: Record<Team, EvasionState>): Rect[] =>
  (['PAST', 'FUTURE'] as const)
    .filter((t) => all[t].id === 'barricade' && all[t].phase === 'active')
    .map(() => ({ ...EVASION.barricade.wall }));

/** The same as `wallsFor`, read from the public view (what the Computer player is allowed to see). */
export const wallsInView = (all: Record<Team, Pick<EvasionView, 'id' | 'phase'>>): Rect[] =>
  (['PAST', 'FUTURE'] as const)
    .filter((t) => all[t].id === 'barricade' && all[t].phase === 'active')
    .map(() => ({ ...EVASION.barricade.wall }));

export const evasionView = (s: EvasionState): EvasionView => ({
  id: s.id,
  phase: s.phase,
  turnsLeft: s.phase === 'recharging' ? s.cooldown : 0,
  usesLeft: s.usesLeft,
});
