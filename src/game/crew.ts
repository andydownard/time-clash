// Squads S1 (docs/SQUADS_PLAN.md): each side has a launcher and one walking dasher. Pure, no Phaser.
// The launcher is today's cannon or laser: it fires with the match's own aim and ammo.
// The dasher walks out along the ground (over any obstacle: the walk is a ground line), stops
// next to the first enemy thing in front, and waits there. A Bonk! is the player's choice and one
// of the 2 goes (owner, 2026-10-28): the enemy base, or the enemy helper if he is next to him.
// Nothing bonks by itself. Nothing here is random. The caller passes in the seeded line bag.
import { CHARACTER_HEALTH, SQUADS, TURN } from './config';
import { classifyBlast } from './damage';
import { otherTeam, type BattleLayout, type Rect, type Team, type Vec2 } from './types';

export type HelperKind = 'launcher' | 'dasher';
export type HelperId = `${Team}-${HelperKind}`;
/** A ground spot: 'g0' to 'g4'. */
export type GroundSpotId = string;
/** Home and ready, out on the field, or resting after a tumble or a call home. */
export type DasherState = 'home' | 'out' | 'resting';

export type Helper = {
  readonly id: HelperId;
  readonly team: Team;
  readonly kind: HelperKind;
  /** Where an out dasher stands. Null at home, while resting, and always for a launcher. */
  readonly spot: GroundSpotId | null;
  /** A launcher is always 'home'. */
  readonly state: DasherState;
  /** The dasher's health. A launcher has none (0). */
  readonly hp: number;
  /** A resting dasher is ready again when his team's own turn count reaches this. */
  readonly readyAt: number;
};

export type Crew = {
  readonly helpers: readonly Helper[];
  /** The helper each team will use next. Remembered between turns. */
  readonly picked: Readonly<Record<Team, HelperId>>;
};

export type IllegalCommandReason =
  | 'flag_off'
  | 'not_your_helper'
  | 'wrong_command'
  | 'out_of_range'
  | 'no_free_spot'
  | 'already_out'
  | 'resting'
  | 'not_out'
  | 'nothing_to_bonk';

/** A helper command that the rules refuse. The caller shows nothing and nothing changes. */
export class IllegalCommandError extends RangeError {
  readonly reason: IllegalCommandReason;
  constructor(reason: IllegalCommandReason) {
    super(`Illegal helper command: ${reason}`);
    this.name = 'IllegalCommandError';
    this.reason = reason;
  }
}

/** A dash go: the dasher walked out to `to`. He can Bonk! on his next go. */
export type DashOutcome = { helper: HelperId; to: GroundSpotId };
/** A Come back go: the dasher walked home from `from`. */
export type RecallOutcome = { helper: HelperId; from: GroundSpotId };

/** What a Bonk! can hit. */
export type BonkKind = 'base' | 'helper';

/** What one Bonk! did. Base damage here is before shields and cuts. */
export type BonkTarget =
  | { kind: 'base'; team: Team; damage: number }
  | {
      kind: 'helper';
      helper: HelperId;
      hp: number;
      tumbled: boolean;
      bubbleIndex: number | null;
    };

/** One Bonk! go: `helper` stood at `at` and bonked `target`. */
export type BonkBeat = {
  helper: HelperId;
  team: Team;
  at: GroundSpotId;
  target: BonkTarget;
};

/** A dasher who walked on at the start of a turn because nothing was next to him. */
export type StandWalk = { helper: HelperId; team: Team; from: GroundSpotId; to: GroundSpotId };

/** A shell that landed near an out dasher. */
export type DasherHit = {
  helper: HelperId;
  team: Team;
  at: GroundSpotId;
  result: 'direct' | 'near';
  damage: number;
  hp: number;
  tumbled: boolean;
  bubbleIndex: number | null;
};

export const helperId = (team: Team, kind: HelperKind): HelperId => `${team}-${kind}`;

/** 'g0' to 'g4', left to right. */
export const groundSpotIds = (): GroundSpotId[] =>
  Array.from({ length: SQUADS.groundSpots }, (_, i) => `g${i}`);

const LAST = SQUADS.groundSpots - 1;
const indexOf = (spot: GroundSpotId): number => groundSpotIds().indexOf(spot);
const spotAt = (i: number): GroundSpotId => `g${i}`;
/** +1 for Team Past (walks right), -1 for Team Future (walks left). */
const forward = (team: Team): 1 | -1 => (team === 'PAST' ? 1 : -1);

/** The team whose base this spot guards: g0 is Team Past's doorstep, the last spot Team Future's. */
export function doorstepOf(spot: GroundSpotId): Team | null {
  const i = indexOf(spot);
  if (i === 0) return 'PAST';
  if (i === LAST) return 'FUTURE';
  return null;
}

/** The spot a team's dasher bonks the enemy base from: the one just before the enemy doorstep. */
export const attackSpotOf = (team: Team): GroundSpotId => spotAt(team === 'PAST' ? LAST - 1 : 1);

export function startingCrew(maxHp: number = CHARACTER_HEALTH.hp): Crew {
  const helpers: Helper[] = [];
  for (const team of ['PAST', 'FUTURE'] as const) {
    helpers.push({
      id: helperId(team, 'launcher'),
      team,
      kind: 'launcher',
      spot: null,
      state: 'home',
      hp: 0,
      readyAt: 0,
    });
    helpers.push({
      id: helperId(team, 'dasher'),
      team,
      kind: 'dasher',
      spot: null,
      state: 'home',
      hp: maxHp,
      readyAt: 0,
    });
  }
  return { helpers, picked: { PAST: 'PAST-launcher', FUTURE: 'FUTURE-launcher' } };
}

const find = (crew: Crew, id: HelperId): Helper | undefined =>
  crew.helpers.find((h) => h.id === id);

export const dasherOf = (crew: Crew, team: Team): Helper =>
  find(crew, helperId(team, 'dasher')) as Helper;

const patch = (crew: Crew, id: HelperId, change: Partial<Helper>): Crew => ({
  ...crew,
  helpers: crew.helpers.map((h) => (h.id === id ? { ...h, ...change } : h)),
});

/**
 * Where a team's dasher stops when he walks forward from `fromIndex` (-1 means from home):
 * the last free spot before the first enemy dasher, or the attack spot when the way is clear.
 * Null when the very first spot in front holds an enemy (no free spot).
 */
function stopIndex(crew: Crew, team: Team, fromIndex: number): number | null {
  const d = forward(team);
  const enemy = dasherOf(crew, otherTeam(team));
  const enemyAt = enemy.state === 'out' && enemy.spot !== null ? indexOf(enemy.spot) : null;
  const attack = indexOf(attackSpotOf(team));
  const start = fromIndex < 0 ? (team === 'PAST' ? 0 : LAST) : fromIndex;
  let last: number | null = fromIndex < 0 ? null : fromIndex;
  for (let i = start; d > 0 ? i <= attack : i >= attack; i += d) {
    if (i === enemyAt) break;
    last = i;
  }
  return last;
}

/** Spots the picked helper may dash to now: the one stop, while a dasher is home. */
export function dashTargets(
  crew: Crew,
  team: Team,
  id: HelperId = crew.picked[team],
): GroundSpotId[] {
  const h = find(crew, id);
  if (!h || h.team !== team || h.kind !== 'dasher' || h.state !== 'home') return [];
  const stop = stopIndex(crew, team, -1);
  return stop === null ? [] : [spotAt(stop)];
}

/** The picked helper, checked: it must be this team's dasher. */
function ownDasher(crew: Crew, team: Team, id: HelperId): Helper {
  const h = find(crew, id);
  if (!h || h.team !== team) throw new IllegalCommandError('not_your_helper');
  if (h.kind !== 'dasher') throw new IllegalCommandError('wrong_command');
  return h;
}

/**
 * Plan one dash. The dasher walks out from home to his stop, `to`, with full health.
 * He bonks at the start of the next turn, not on arrival. Throws IllegalCommandError.
 */
export function planDash(
  crew: Crew,
  team: Team,
  to: GroundSpotId,
  maxHp: number,
  id: HelperId = crew.picked[team],
): { crew: Crew; outcome: DashOutcome } {
  const d = ownDasher(crew, team, id);
  if (d.state === 'out') throw new IllegalCommandError('already_out');
  if (d.state === 'resting') throw new IllegalCommandError('resting');
  const stop = stopIndex(crew, team, -1);
  if (stop === null) throw new IllegalCommandError('no_free_spot');
  if (indexOf(to) !== stop) throw new IllegalCommandError('out_of_range');
  return {
    crew: patch(crew, d.id, { state: 'out', spot: to, hp: maxHp }),
    outcome: { helper: d.id, to },
  };
}

/** Plan one Come back go. The dasher walks home and is ready again on own turn `readyAt`. */
export function planRecall(
  crew: Crew,
  team: Team,
  readyAt: number,
  id: HelperId = crew.picked[team],
): { crew: Crew; outcome: RecallOutcome } {
  const d = ownDasher(crew, team, id);
  if (d.state !== 'out' || d.spot === null) throw new IllegalCommandError('not_out');
  return {
    crew: patch(crew, d.id, { state: 'resting', spot: null, readyAt }),
    outcome: { helper: d.id, from: d.spot },
  };
}

/** A resting dasher of `team` comes home ready, with full health, once `ownTurns` reaches readyAt. */
export function wakeDashers(crew: Crew, team: Team, ownTurns: number, maxHp: number): Crew {
  const d = dasherOf(crew, team);
  if (d.state !== 'resting' || ownTurns < d.readyAt) return crew;
  return patch(crew, d.id, { state: 'home', hp: maxHp });
}

/**
 * The start of a turn. Every out dasher walks on if nothing is next to him: to the last free
 * spot before the enemy helper, or to the attack spot. Nobody bonks here. The team whose turn
 * starts is listed first.
 */
export function planWalkOn(crew: Crew, active: Team): { crew: Crew; walks: StandWalk[] } {
  let next = crew;
  const walks: StandWalk[] = [];
  for (const team of [active, otherTeam(active)]) {
    const d = dasherOf(next, team);
    if (d.state !== 'out' || d.spot === null) continue;
    const stop = stopIndex(next, team, indexOf(d.spot));
    if (stop === null || spotAt(stop) === d.spot) continue;
    walks.push({ helper: d.id, team, from: d.spot, to: spotAt(stop) });
    next = patch(next, d.id, { spot: spotAt(stop) });
  }
  return { crew: next, walks };
}

/** True when `team`'s out dasher stands right next to the enemy dasher, who is out too. */
function nextToFoe(crew: Crew, team: Team): boolean {
  const me = dasherOf(crew, team);
  const foe = dasherOf(crew, otherTeam(team));
  return (
    me.state === 'out' &&
    foe.state === 'out' &&
    me.spot !== null &&
    foe.spot !== null &&
    indexOf(foe.spot) === indexOf(me.spot) + forward(team)
  );
}

/**
 * What the team's dasher may Bonk! right now: the enemy helper when he is next to him, and the
 * enemy base when he stands at the attack spot. Empty at home, while resting, and for a launcher.
 */
export function bonkTargets(crew: Crew, team: Team, id: HelperId = crew.picked[team]): BonkKind[] {
  const h = find(crew, id);
  if (!h || h.team !== team || h.kind !== 'dasher' || h.state !== 'out' || h.spot === null)
    return [];
  const out: BonkKind[] = [];
  if (nextToFoe(crew, team)) out.push('helper');
  if (h.spot === attackSpotOf(team)) out.push('base');
  return out;
}

/**
 * Plan one Bonk! go. The picked dasher bonks the enemy helper next to him (SQUADS.duelBonkHp
 * health; at 0 the enemy helper tumbles and rests until `restAt`) or the enemy base from the
 * attack spot (damage before shields and cuts). Throws IllegalCommandError: not his helper, not a
 * dasher, resting, at home, or nothing of that kind next to him.
 */
export function planBonk(
  crew: Crew,
  team: Team,
  kind: BonkKind,
  restAt: number,
  bubble: () => number,
  id: HelperId = crew.picked[team],
): { crew: Crew; beat: BonkBeat } {
  const d = ownDasher(crew, team, id);
  if (d.state === 'resting') throw new IllegalCommandError('resting');
  if (d.state !== 'out' || d.spot === null) throw new IllegalCommandError('not_out');
  if (!bonkTargets(crew, team, id).includes(kind)) throw new IllegalCommandError('nothing_to_bonk');
  const at = d.spot;
  if (kind === 'base') {
    return {
      crew,
      beat: {
        helper: d.id,
        team,
        at,
        target: { kind: 'base', team: otherTeam(team), damage: SQUADS.standBonkDamage },
      },
    };
  }
  const foe = dasherOf(crew, otherTeam(team));
  const hp = Math.max(0, foe.hp - SQUADS.duelBonkHp);
  const tumbled = hp === 0;
  const next = tumbled
    ? patch(crew, foe.id, { hp, state: 'resting', spot: null, readyAt: restAt })
    : patch(crew, foe.id, { hp });
  return {
    crew: next,
    beat: {
      helper: d.id,
      team,
      at,
      target: {
        kind: 'helper',
        helper: foe.id,
        hp,
        tumbled,
        bubbleIndex: tumbled ? bubble() : null,
      },
    },
  };
}

// ---------- On the field (world px) ----------

const groundY = (layout: Pick<BattleLayout, 'terrain' | 'height'>): number =>
  layout.terrain.ground[0]?.y ?? layout.height;

/**
 * A spot's place on the ground. The doorstep and attack spot sit a fixed step from each base's
 * inner edge, and any spots between are spread evenly. Always on the ground line, never on an obstacle.
 */
export function groundSpotPoint(
  spot: GroundSpotId,
  layout: Pick<BattleLayout, 'bases' | 'terrain' | 'height'>,
): Vec2 {
  const i = indexOf(spot);
  const left = layout.bases.PAST.x + layout.bases.PAST.w;
  const right = layout.bases.FUTURE.x;
  const xs = [left + SQUADS.spotInset.door, left + SQUADS.spotInset.attack];
  const a = right - SQUADS.spotInset.attack;
  const middle = LAST - 3;
  for (let k = 1; k <= middle; k++) {
    const from = xs[1] as number;
    xs.push(from + ((a - from) * k) / (middle + 1));
  }
  xs.push(a, right - SQUADS.spotInset.door);
  return { x: xs[Math.max(0, i)] as number, y: groundY(layout) };
}

/** Where a dasher waits at home: on the ground, just inside his own base's inner edge. */
export function dasherHomePoint(
  team: Team,
  layout: Pick<BattleLayout, 'bases' | 'terrain' | 'height'>,
): Vec2 {
  const b = layout.bases[team];
  const x = team === 'PAST' ? b.x + b.w - SQUADS.homeInset : b.x + SQUADS.homeInset;
  return { x, y: groundY(layout) };
}

/** A dasher's hit box: the fighter box (CHARACTER_HEALTH.box), feet on the ground at his spot. */
export function dasherBox(
  spot: GroundSpotId,
  layout: Pick<BattleLayout, 'bases' | 'terrain' | 'height'>,
): Rect {
  const { w, h } = CHARACTER_HEALTH.box;
  const p = groundSpotPoint(spot, layout);
  return { x: p.x - w / 2, y: p.y - h, w, h };
}

const DASHER_SCALE = {
  direct: CHARACTER_HEALTH.directScale,
  near: CHARACTER_HEALTH.nearScale,
} as const;

/**
 * A shell landed. If it is close to `target`'s out dasher, he takes a direct hit (directHit, or
 * powerHit for the Power Shot) or wobbles from a near miss (no health lost). At 0 he tumbles and
 * rests until own turn `readyAt`. A dasher at home or resting cannot be hit. Nobody is hurt.
 */
export function hitDasher(
  crew: Crew,
  target: Team,
  landing: Vec2,
  layout: Pick<BattleLayout, 'bases' | 'terrain' | 'height'>,
  power: boolean,
  readyAt: number,
  bubble: () => number,
): { crew: Crew; hit: DasherHit | null } {
  const d = dasherOf(crew, target);
  if (d.state !== 'out' || d.spot === null) return { crew, hit: null };
  const result = classifyBlast(landing, dasherBox(d.spot, layout), DASHER_SCALE);
  if (result === 'miss') return { crew, hit: null };
  const damage =
    result === 'direct'
      ? power
        ? CHARACTER_HEALTH.powerHit
        : CHARACTER_HEALTH.directHit
      : CHARACTER_HEALTH.nearHit;
  const hp = Math.max(0, d.hp - damage);
  const tumbled = hp === 0;
  const next = tumbled
    ? patch(crew, d.id, { hp, state: 'resting', spot: null, readyAt })
    : patch(crew, d.id, { hp });
  return {
    crew: next,
    hit: {
      helper: d.id,
      team: target,
      at: d.spot,
      result,
      damage,
      hp,
      tumbled,
      bubbleIndex: tumbled ? bubble() : null,
    },
  };
}

/** The banner words for the go about to start. `goesDone` is how many goes this turn already used. */
export function goLabel(goesDone: number): string {
  const go = Math.min(TURN.shotsPerTurn, goesDone + 1);
  return `GO ${go} OF ${SQUADS.goesPerTurn}`;
}
