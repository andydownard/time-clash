import { otherTeam, IllegalTransitionError } from './types';
import type { CreateTurn, Transition, TurnState } from './types';

export const createTurn: CreateTurn = (team, turnNumber) => ({
  phase: 'PASS_SCREEN',
  team,
  turnNumber,
  shotsFired: 0,
  bonus: false,
});

const next = (s: TurnState, patch: Partial<TurnState>): TurnState => ({ ...s, ...patch });

/** The whole turn flow lives here. Any pair not listed throws. */
export const transition: Transition = (state, event) => {
  const illegal = (): never => {
    throw new IllegalTransitionError(state.phase, event.type);
  };
  switch (event.type) {
    case 'READY':
      return state.phase === 'PASS_SCREEN' ? next(state, { phase: 'AIMING' }) : illegal();
    case 'FIRE':
      if (state.phase === 'AIMING' && state.shotsFired === 0)
        return next(state, { phase: 'SHOT_1', shotsFired: 1 });
      if (state.phase === 'AIMING' && state.shotsFired === 1)
        return next(state, { phase: 'SHOT_2', shotsFired: 2 });
      if (state.phase === 'BONUS_AIMING') return next(state, { phase: 'BONUS_SHOT' });
      return illegal();
    case 'SHOT_LANDED':
      if (state.phase === 'SHOT_1') return next(state, { phase: 'AIMING' });
      if (state.phase === 'SHOT_2') return next(state, { phase: 'RELOAD' });
      if (state.phase === 'BONUS_SHOT') return next(state, { phase: 'NEXT_PLAYER' });
      return illegal();
    case 'RELOAD_DONE':
      if (state.phase !== 'RELOAD') return illegal();
      // Only a right answer earns the Power Shot. A wrong one just moves on (Gate 2).
      return event.correct === true
        ? next(state, { phase: 'BONUS_AIMING', bonus: true })
        : next(state, { phase: 'NEXT_PLAYER' });
    case 'PASS':
      return state.phase === 'NEXT_PLAYER'
        ? {
            phase: 'PASS_SCREEN',
            team: otherTeam(state.team),
            turnNumber: state.turnNumber + 1,
            shotsFired: 0,
            bonus: false,
          }
        : illegal();
    default:
      return illegal();
  }
};
