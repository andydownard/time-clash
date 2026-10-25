// Setup form rules. Pure functions: the overlay calls these and shows the messages.
import { SETUP, UI_EXTRA } from '../data/copy';
import { GRADE, NAME } from '../game/config';
import type { Grade, Player, Players, Subject, Team } from '../game/types';
import { isBlockedName } from './nameBlocklist';

export type NameResult =
  | { ok: true; name: string }
  | { ok: false; reason: 'empty' | 'too-long' | 'blocked'; message: string };

export function validatePlayerName(raw: unknown): NameResult {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name.length < NAME.minLength) return { ok: false, reason: 'empty', message: SETUP.nameEmpty };
  // Spread counts whole characters, so an emoji is one, not two.
  if ([...name].length > NAME.maxLength) {
    return { ok: false, reason: 'too-long', message: SETUP.nameTooLong };
  }
  if (isBlockedName(name)) return { ok: false, reason: 'blocked', message: SETUP.nameBlocked };
  return { ok: true, name };
}

const SUBJECTS: readonly Subject[] = ['reading', 'math', 'both'];

export type TeamInput = { name: string; grade: number; subject: string };
export type SetupInput = Record<Team, TeamInput>;
export type TeamErrors = { name?: string; grade?: string; subject?: string };

export type SetupResult =
  { ok: true; players: Players } | { ok: false; errors: Record<Team, TeamErrors> };

function validateTeam(team: Team, input: TeamInput): { player?: Player; errors: TeamErrors } {
  const errors: TeamErrors = {};
  const name = validatePlayerName(input.name);
  if (!name.ok) errors.name = name.message;
  const gradeOk =
    Number.isInteger(input.grade) && input.grade >= GRADE.min && input.grade <= GRADE.max;
  if (!gradeOk) errors.grade = UI_EXTRA.gradeError;
  const subjectOk = SUBJECTS.includes(input.subject as Subject);
  if (!subjectOk) errors.subject = UI_EXTRA.subjectError;
  if (!name.ok || !gradeOk || !subjectOk) return { errors };
  const player: Player = {
    name: name.name,
    team,
    grade: input.grade as Grade,
    subject: input.subject as Subject,
  };
  return { errors, player };
}

export function validateSetup(input: SetupInput): SetupResult {
  const past = validateTeam('PAST', input.PAST);
  const future = validateTeam('FUTURE', input.FUTURE);
  if (past.player && future.player) return { ok: true, players: [past.player, future.player] };
  return { ok: false, errors: { PAST: past.errors, FUTURE: future.errors } };
}
