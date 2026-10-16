import { otherTeam, IllegalTransitionError } from './types';
import type { CreateTurn, Transition, TurnState } from './types';

export const createTurn: CreateTurn = (team, turnNumber) => ({
  phase: 'PASS_SCREEN',
  team,
  turnNumber,
  shotsFired: 0,
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
      return illegal();
    case 'SHOT_LANDED':
      if (state.phase === 'SHOT_1') return next(state, { phase: 'AIMING' });
      if (state.phase === 'SHOT_2') return next(state, { phase: 'RELOAD' });
      return illegal();
    case 'RELOAD_DONE':
      return state.phase === 'RELOAD' ? next(state, { phase: 'NEXT_PLAYER' }) : illegal();
    case 'PASS':
      return state.phase === 'NEXT_PLAYER'
        ? {
            phase: 'PASS_SCREEN',
            team: otherTeam(state.team),
            turnNumber: state.turnNumber + 1,
            shotsFired: 0,
          }
        : illegal();
    default:
      return illegal();
  }
};
