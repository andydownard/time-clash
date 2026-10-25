import { describe, expect, it } from 'vitest';
import { PRACTICE_BOT } from '../../src/game/config';
import {
  aimDurationMs,
  aimSteps,
  computerTeamOf,
  isComputerTurn,
  needsPassScreen,
  practiceEnabled,
  practiceRun,
  reloadWaitMs,
  withComputer,
} from '../../src/game/practice';
import type { Players } from '../../src/game/types';

const humans: Players = [
  { name: 'Alex', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 5, subject: 'reading' },
];

describe('practiceEnabled', () => {
  it('is on for everyone and follows the config flag', () => {
    expect(PRACTICE_BOT.enabled).toBe(true);
    expect(practiceEnabled('')).toBe(true);
    expect(practiceEnabled('?e2e=1')).toBe(true);
    expect(practiceEnabled('', false)).toBe(false);
    expect(practiceEnabled('', true)).toBe(true);
  });
  it('?computer=0 turns it off and ?computer=1 turns it on, whatever the flag', () => {
    expect(practiceEnabled('?computer=0')).toBe(false);
    expect(practiceEnabled('?e2e=1&computer=0')).toBe(false);
    expect(practiceEnabled('?computer=0', true)).toBe(false);
    expect(practiceEnabled('?computer=1', false)).toBe(true);
    expect(practiceEnabled('?e2e=1&computer=1', false)).toBe(true);
  });
  it('any other value falls back to the flag', () => {
    for (const q of ['?computer=true', '?computer', '?computer=no', '?computer=01'])
      for (const flag of [true, false]) expect(practiceEnabled(q, flag)).toBe(flag);
  });
});

describe('withComputer', () => {
  it('makes the other side the Computer player at the human grade and subject', () => {
    const players = withComputer(humans, 'FUTURE');
    expect(players[0]).toEqual(humans[0]);
    expect(players[1]).toEqual({
      name: PRACTICE_BOT.displayName,
      team: 'FUTURE',
      grade: 3,
      subject: 'math',
    });
  });
  it('works for Team Past too', () => {
    const players = withComputer(humans, 'PAST');
    expect(players[0].name).toBe('Computer player');
    expect(players[0].grade).toBe(5);
    expect(players[1]).toEqual(humans[1]);
  });
});

describe('computerTeamOf and practiceRun', () => {
  it('finds the side called Computer player', () => {
    expect(computerTeamOf(humans)).toBeNull();
    expect(computerTeamOf(withComputer(humans, 'FUTURE'))).toBe('FUTURE');
    expect(computerTeamOf(withComputer(humans, 'PAST'))).toBe('PAST');
  });
  it('a run needs the choice, the flag and a computer side', () => {
    const players = withComputer(humans, 'FUTURE');
    const computer = { opponent: 'computer', level: 'hard' } as const;
    expect(practiceRun(computer, players, true)).toEqual({ team: 'FUTURE', level: 'hard' });
    expect(practiceRun(computer, players, false)).toBeNull();
    expect(practiceRun(null, players, true)).toBeNull();
    expect(practiceRun({ opponent: 'person', level: 'hard' }, players, true)).toBeNull();
    expect(practiceRun(computer, humans, true)).toBeNull();
  });
});

describe('turn ownership', () => {
  const run = { team: 'FUTURE', level: 'medium' } as const;
  it('only the Computer player side is a computer turn', () => {
    expect(isComputerTurn(run, 'FUTURE')).toBe(true);
    expect(isComputerTurn(run, 'PAST')).toBe(false);
    expect(isComputerTurn(null, 'FUTURE')).toBe(false);
  });
  it('the pass screen shows for two people, and never when one child plays alone', () => {
    expect(needsPassScreen(null)).toBe(true);
    expect(needsPassScreen(run)).toBe(false);
  });
});

describe('pacing', () => {
  it('the dial takes 1.2 to 2 seconds, faster on harder levels', () => {
    const easy = aimDurationMs('easy');
    const medium = aimDurationMs('medium');
    const hard = aimDurationMs('hard');
    for (const ms of [easy, medium, hard]) {
      expect(ms).toBeGreaterThanOrEqual(1200);
      expect(ms).toBeLessThanOrEqual(2000);
    }
    expect(easy).toBeGreaterThanOrEqual(medium);
    expect(medium).toBeGreaterThanOrEqual(hard);
  });
  it('the reload wait is capped and the whole turn stays under the budget', () => {
    const { reloadCapMs, turnBudgetMs, reloadMinMs } = PRACTICE_BOT.pace;
    expect(reloadWaitMs(14000, 0)).toBe(reloadCapMs);
    expect(reloadWaitMs(1800, 0)).toBe(1800);
    expect(reloadWaitMs(100, 0)).toBe(reloadMinMs);
    // Two slow aims and a long answer still end inside the budget.
    const spent = aimDurationMs('easy') * 2;
    expect(spent + reloadWaitMs(14000, spent)).toBeLessThanOrEqual(turnBudgetMs);
    // Room is kept for the Power Shot aim a right answer earns.
    const worst = spent + reloadWaitMs(14000, spent, aimDurationMs('easy')) + aimDurationMs('easy');
    expect(worst).toBeLessThanOrEqual(turnBudgetMs);
    // Nothing is left: a short beat only, never a negative wait.
    expect(reloadWaitMs(5000, turnBudgetMs)).toBe(0);
    expect(reloadWaitMs(5000, turnBudgetMs + 500)).toBe(0);
  });
});

describe('aimSteps', () => {
  it('walks from the current aim to the target and ends exactly on it', () => {
    const steps = aimSteps({ angleDeg: 45, power: 60 }, { angleDeg: 70, power: 30 }, 10);
    expect(steps).toHaveLength(10);
    expect(steps[9]).toEqual({ angleDeg: 70, power: 30 });
    for (const s of steps) {
      expect(Number.isInteger(s.angleDeg)).toBe(true);
      expect(Number.isInteger(s.power)).toBe(true);
    }
    // Always moves the same way, never backs up.
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.angleDeg).toBeGreaterThanOrEqual(steps[i - 1]!.angleDeg);
      expect(steps[i]!.power).toBeLessThanOrEqual(steps[i - 1]!.power);
    }
  });
  it('one step is a jump to the target, and bad counts still end on the target', () => {
    const to = { angleDeg: 33, power: 44 };
    expect(aimSteps({ angleDeg: 1, power: 1 }, to, 1)).toEqual([to]);
    expect(aimSteps({ angleDeg: 1, power: 1 }, to, 0)).toEqual([to]);
    expect(aimSteps(to, to, 5).every((s) => s.angleDeg === 33 && s.power === 44)).toBe(true);
  });
});
