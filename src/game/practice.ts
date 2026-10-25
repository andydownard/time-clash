// Rules for playing alone against the "Computer player". Pure: no Phaser, no DOM, no storage.
// The shot and answer choices are in bot.ts. This file decides who the computer is, whose turn
// is the computer's, who sees the pass-the-mouse cover, and how long the screen takes.
import { BOT_LEVELS, PRACTICE_BOT, type BotLevel } from './config';
import type { AimInput, Grade, Player, Players, Team } from './types';

/** What the family picked on Setup. Saved on this device. */
export type PracticeChoice = { opponent: 'person' | 'computer'; level: BotLevel };

export const DEFAULT_PRACTICE: PracticeChoice = { opponent: 'person', level: 'medium' };

/** A match with a computer side. Only exists while one child plays alone. */
export type PracticeRun = { team: Team; level: BotLevel };

export const isBotLevel = (v: unknown): v is BotLevel =>
  typeof v === 'string' && (BOT_LEVELS as readonly string[]).includes(v);

/**
 * The choice follows the config flag. The address can override it: ?computer=1 shows it and
 * ?computer=0 hides it (the same pattern as ?builder=). Only those exact values count.
 */
export function practiceEnabled(search: string, flag: boolean = PRACTICE_BOT.enabled): boolean {
  try {
    const asked = new URLSearchParams(search).get('computer');
    if (asked === '1') return true;
    if (asked === '0') return false;
  } catch {
    // An unreadable address falls back to the setting.
  }
  return flag;
}

/** The players with `team` replaced by the Computer player, who copies the other side's grade and subject. */
export function withComputer(players: Players, team: Team): Players {
  const human = players[team === 'PAST' ? 1 : 0];
  const computer: Player = {
    name: PRACTICE_BOT.displayName,
    team,
    grade: human.grade as Grade,
    subject: human.subject,
  };
  return team === 'PAST' ? [computer, players[1]] : [players[0], computer];
}

/** The side called "Computer player", or null for two people. Names are 12 letters at most, so no child can match it. */
export function computerTeamOf(players: Players): Team | null {
  const found = players.find((p) => p.name === PRACTICE_BOT.displayName);
  return found ? found.team : null;
}

/** A run only when the flag is on, the family chose the computer, and the saved players have one. */
export function practiceRun(
  choice: PracticeChoice | null,
  players: Players,
  enabled: boolean,
): PracticeRun | null {
  if (!enabled || !choice || choice.opponent !== 'computer') return null;
  const team = computerTeamOf(players);
  return team ? { team, level: choice.level } : null;
}

export const isComputerTurn = (run: PracticeRun | null, team: Team): boolean =>
  run !== null && run.team === team;

/** The cover hides one player's screen from the other. One child alone has nobody to hide it from. */
export const needsPassScreen = (run: PracticeRun | null): boolean => run === null;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** How long the dial moves before Fire. 1.2 to 2 seconds, quicker on harder levels. */
export function aimDurationMs(level: BotLevel): number {
  const { aimBaseMs, aimMinMs, aimMaxMs } = PRACTICE_BOT.pace;
  return clamp(Math.round(aimBaseMs * PRACTICE_BOT.levels[level].thinkScale), aimMinMs, aimMaxMs);
}

/**
 * How long the computer "thinks" about its reload question. The answer model may want up to 14 s.
 * The screen waits at most reloadCapMs, and never past what is left of the turn budget.
 * `reserveMs` keeps room for the Power Shot aim that a right answer earns.
 */
export function reloadWaitMs(delayMs: number, spentMs: number, reserveMs = 0): number {
  const { reloadCapMs, reloadMinMs, turnBudgetMs } = PRACTICE_BOT.pace;
  const left = Math.max(0, turnBudgetMs - Math.max(0, spentMs) - Math.max(0, reserveMs));
  return Math.min(clamp(delayMs, reloadMinMs, reloadCapMs), left);
}

/** Whole-number aims on an eased path from `from` to `to`. The last one is exactly `to`. */
export function aimSteps(from: AimInput, to: AimInput, count: number): AimInput[] {
  const n = Number.isInteger(count) && count > 1 ? count : 1;
  const out: AimInput[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    out.push(
      i === n
        ? { angleDeg: to.angleDeg, power: to.power }
        : {
            angleDeg: Math.round(from.angleDeg + (to.angleDeg - from.angleDeg) * e),
            power: Math.round(from.power + (to.power - from.power) * e),
          },
    );
  }
  return out;
}
