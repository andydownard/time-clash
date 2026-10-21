// Squads S1 (docs/SQUADS_PLAN.md): each side has a launcher and one dasher. Pure, no Phaser.
// The launcher is today's cannon or laser: it fires with the match's own aim and ammo.
// The dasher rolls along five ground spots and bonks what is next to it.
// Nothing here is random. The caller passes in the seeded tumble-line bag.
import { SQUADS, TURN } from './config';
import { otherTeam, type Team } from './types';

export type HelperKind = 'launcher' | 'dasher';
export type HelperId = `${Team}-${HelperKind}`;
/** A ground spot: 'g0' to 'g4'. */
export type GroundSpotId = string;

export type Helper = {
  readonly id: HelperId;
  readonly team: Team;
  readonly kind: HelperKind;
  /** Where a dasher stands. A launcher stays on its base and has no spot. */
  readonly spot: GroundSpotId | null;
};

export type Crew = {
  readonly helpers: readonly Helper[];
  /** The helper each team will use next. Remembered between turns. */
  readonly picked: Readonly<Record<Team, HelperId>>;
};

export type IllegalCommandReason =
  'flag_off' | 'not_your_helper' | 'wrong_command' | 'out_of_range' | 'spot_taken' | 'own_doorstep';

/** A helper command that the rules refuse. The caller shows nothing and nothing changes. */
export class IllegalCommandError extends RangeError {
  readonly reason: IllegalCommandReason;
  constructor(reason: IllegalCommandReason) {
    super(`Illegal helper command: ${reason}`);
    this.name = 'IllegalCommandError';
    this.reason = reason;
  }
}

export type DashBonk =
  | { kind: 'base'; target: Team; damage: number }
  | { kind: 'helper'; helper: HelperId; from: GroundSpotId; to: GroundSpotId; bubbleIndex: number };

export type DashOutcome = {
  helper: HelperId;
  from: GroundSpotId;
  to: GroundSpotId;
  bonk: DashBonk | null;
};

export const helperId = (team: Team, kind: HelperKind): HelperId => `${team}-${kind}`;

/** 'g0' to 'g4', left to right. */
export const groundSpotIds = (): GroundSpotId[] =>
  Array.from({ length: SQUADS.groundSpots }, (_, i) => `g${i}`);

const indexOf = (spot: GroundSpotId): number => groundSpotIds().indexOf(spot);
const spotAt = (i: number): GroundSpotId => `g${i}`;

/** The team whose base this spot guards: g0 is Team Past's doorstep, the last spot Team Future's. */
export function doorstepOf(spot: GroundSpotId): Team | null {
  const i = indexOf(spot);
  if (i === 0) return 'PAST';
  if (i === SQUADS.groundSpots - 1) return 'FUTURE';
  return null;
}

export function startingCrew(): Crew {
  const helpers: Helper[] = [];
  for (const team of ['PAST', 'FUTURE'] as const) {
    helpers.push({ id: helperId(team, 'launcher'), team, kind: 'launcher', spot: null });
    helpers.push({
      id: helperId(team, 'dasher'),
      team,
      kind: 'dasher',
      spot: spotAt(SQUADS.dasherHome[team]),
    });
  }
  return {
    helpers,
    picked: { PAST: 'PAST-launcher', FUTURE: 'FUTURE-launcher' },
  };
}

const find = (crew: Crew, id: HelperId): Helper | undefined =>
  crew.helpers.find((h) => h.id === id);

/** Why a dash to this spot is refused, or null when it is fine. */
function refusal(crew: Crew, dasher: Helper, to: GroundSpotId): IllegalCommandReason | null {
  const to_i = indexOf(to);
  const from_i = indexOf(dasher.spot ?? '');
  if (to_i < 0 || from_i < 0) return 'out_of_range';
  if (doorstepOf(to) === dasher.team) return 'own_doorstep';
  if (crew.helpers.some((h) => h.spot === to)) return 'spot_taken';
  if (Math.abs(to_i - from_i) > SQUADS.dashRange) return 'out_of_range';
  return null;
}

/** Spots the picked helper may dash to now. Empty for a launcher. */
export function dashTargets(
  crew: Crew,
  team: Team,
  id: HelperId = crew.picked[team],
): GroundSpotId[] {
  const dasher = find(crew, id);
  if (!dasher || dasher.team !== team || dasher.kind !== 'dasher') return [];
  return groundSpotIds().filter((s) => refusal(crew, dasher, s) === null);
}

/**
 * Plan one dash. Returns the new crew and what happened, or throws IllegalCommandError.
 * Landing on the enemy doorstep bonks the base. Otherwise an enemy dasher on a next-door spot
 * tumbles and walks home (it stays put if someone stands on its home). `bubble` is called once
 * per tumble and must come from the match's seeded bag.
 */
export function planDash(
  crew: Crew,
  team: Team,
  to: GroundSpotId,
  bubble: () => number,
  id: HelperId = crew.picked[team],
): { crew: Crew; outcome: DashOutcome } {
  const dasher = find(crew, id);
  if (!dasher || dasher.team !== team) throw new IllegalCommandError('not_your_helper');
  if (dasher.kind !== 'dasher' || dasher.spot === null)
    throw new IllegalCommandError('wrong_command');
  const why = refusal(crew, dasher, to);
  if (why) throw new IllegalCommandError(why);

  const from = dasher.spot;
  const moved = crew.helpers.map((h) => (h.id === dasher.id ? { ...h, spot: to } : h));
  let helpers: Helper[] = moved;
  let bonk: DashBonk | null = null;

  if (doorstepOf(to) === otherTeam(team)) {
    bonk = { kind: 'base', target: otherTeam(team), damage: SQUADS.dashBonkDamage };
  } else {
    const at = indexOf(to);
    const victim = moved.find(
      (h) => h.team !== team && h.spot !== null && Math.abs(indexOf(h.spot) - at) === 1,
    );
    if (victim && victim.spot !== null) {
      const home = spotAt(SQUADS.dasherHome[victim.team]);
      const homeFree = !moved.some((h) => h.spot === home);
      const landed = homeFree ? home : victim.spot;
      bonk = {
        kind: 'helper',
        helper: victim.id,
        from: victim.spot,
        to: landed,
        bubbleIndex: bubble(),
      };
      helpers = moved.map((h) => (h.id === victim.id ? { ...h, spot: landed } : h));
    }
  }
  return {
    crew: { helpers, picked: crew.picked },
    outcome: { helper: dasher.id, from, to, bonk },
  };
}

/** The banner words for the go about to start. `goesDone` is how many goes this turn already used. */
export function goLabel(goesDone: number): string {
  const go = Math.min(TURN.shotsPerTurn, goesDone + 1);
  return `GO ${go} OF ${SQUADS.goesPerTurn}`;
}
