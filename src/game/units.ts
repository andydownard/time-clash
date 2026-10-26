// The fighters: five per side. Only one acts at a time. Pure, no Phaser.
// Mirror pairs (A~2, B~5, C~1, D~3, E~4) share speedScale and damageScale, so neither side is favored.
// The default fighters (C and 1) are today's launchers, so a fresh game plays exactly as before.
import { BASES, CHARACTER_HEALTH, LAUNCH_ORIGINS } from './config';
import type { BattleLayout, Rect, Team, Vec2 } from './types';

export type UnitId = 'A' | 'B' | 'C' | 'D' | 'E' | '1' | '2' | '3' | '4' | '5';

export type UnitRole =
  | 'balloon'
  | 'archer'
  | 'cannon'
  | 'catapult'
  | 'spear'
  | 'tank'
  | 'helicopter'
  | 'bunker'
  | 'saber'
  | 'laserGun';

export type UnitDef = {
  id: UnitId;
  team: Team;
  /** Plain words a child can read. */
  name: string;
  role: UnitRole;
  /** World point where this fighter's shot starts. Outside both bases, above the ground. */
  origin: Vec2;
  /** Multiplies launch speed (range). */
  speedScale: number;
  /** Multiplies the weapon's damage. */
  damageScale: number;
};

/**
 * Balance numbers for the five roles. A mirror pair uses the same row.
 * Pace (owner, 2026-10-24): no fighter hits harder than the default. A perfect turn (two direct
 * hits and a Power Shot) must stay at 25 + 25 + 38 = 88 so perfect aim needs five turns; any
 * damageScale above 1 rounds a direct hit to 26 or more and breaks that (1.3 did 116, 1.1 did 98).
 * So the fighters differ by range and where they stand: the Catapult and Missile Bunkers reach
 * farthest, the Spearman and Saber Robot stand closest with a slow, easy-to-aim launch, and the
 * Archer and Laser Gun Robot trade a softer hit for a little more reach.
 * `tests/game/pace.test.ts` plays every fighter.
 */
const STATS = {
  balloon: { speedScale: 0.9, damageScale: 1.0 },
  archer: { speedScale: 1.05, damageScale: 0.8 },
  standard: { speedScale: 1.0, damageScale: 1.0 },
  heavy: { speedScale: 1.15, damageScale: 1.0 },
  short: { speedScale: 0.75, damageScale: 1.0 },
} as const;

export const UNITS: readonly UnitDef[] = [
  {
    id: 'A',
    team: 'PAST',
    name: 'Hot Air Balloon',
    role: 'balloon',
    origin: { x: 330, y: 330 },
    ...STATS.balloon,
  },
  {
    id: 'B',
    team: 'PAST',
    name: 'Archer',
    role: 'archer',
    origin: { x: 150, y: 440 },
    ...STATS.archer,
  },
  {
    id: 'C',
    team: 'PAST',
    name: 'Cannon Knight',
    role: 'cannon',
    origin: LAUNCH_ORIGINS.PAST,
    ...STATS.standard,
  },
  {
    id: 'D',
    team: 'PAST',
    name: 'Catapult',
    role: 'catapult',
    origin: { x: 330, y: 600 },
    ...STATS.heavy,
  },
  {
    id: 'E',
    team: 'PAST',
    name: 'Spearman',
    role: 'spear',
    origin: { x: 420, y: 600 },
    ...STATS.short,
  },
  {
    id: '1',
    team: 'FUTURE',
    name: 'Tank',
    role: 'tank',
    origin: LAUNCH_ORIGINS.FUTURE,
    ...STATS.standard,
  },
  {
    id: '2',
    team: 'FUTURE',
    name: 'Helicopter',
    role: 'helicopter',
    origin: { x: 950, y: 330 },
    ...STATS.balloon,
  },
  {
    id: '3',
    team: 'FUTURE',
    name: 'Missile Bunkers',
    role: 'bunker',
    origin: { x: 950, y: 600 },
    ...STATS.heavy,
  },
  {
    id: '4',
    team: 'FUTURE',
    name: 'Saber Robot',
    role: 'saber',
    origin: { x: 860, y: 600 },
    ...STATS.short,
  },
  {
    id: '5',
    team: 'FUTURE',
    name: 'Laser Gun Robot',
    role: 'laserGun',
    origin: { x: 1130, y: 440 },
    ...STATS.archer,
  },
];

/** Who each team starts a match with (and falls back to). */
export const DEFAULT_UNIT: Record<Team, UnitId> = { PAST: 'C', FUTURE: '1' };

export const unitsOf = (team: Team): UnitDef[] => UNITS.filter((u) => u.team === team);

/** The fighter with this id, or null for an unknown id. */
export const unitById = (id: string): UnitDef | null => UNITS.find((u) => u.id === id) ?? null;

/** True for a fighter that stands on its own base (so it moves when the base moves, Phase 2). */
export const ridesBase = (unit: UnitDef): boolean => {
  const base = BASES[unit.team];
  return unit.origin.x >= base.x && unit.origin.x <= base.x + base.w && unit.origin.y <= base.y;
};

/**
 * Where this fighter's shot really starts. The default fighter shoots from the layout's own
 * launcher (so a fresh game is unchanged). Every other fighter shoots from its own spot. A fighter
 * standing on its base moves with the base when Team Future picks a spot (`layout.baseShift`).
 * The shot, the bot and the angle guide on the board all read this one function.
 */
export function firingOrigin(
  team: Team,
  unitId: string,
  layout: Pick<BattleLayout, 'launchOrigins' | 'baseShift'>,
): Vec2 {
  const unit = unitById(unitId);
  if (!unit || unit.team !== team || unit.id === DEFAULT_UNIT[team]) {
    return layout.launchOrigins[team];
  }
  const shift = ridesBase(unit) ? layout.baseShift?.[team] : undefined;
  return shift ? { x: unit.origin.x + shift.x, y: unit.origin.y + shift.y } : unit.origin;
}

/** Every fighter id, both teams, in roster order. */
export const UNIT_IDS: readonly UnitId[] = UNITS.map((u) => u.id);

/**
 * A fighter's hit box: CHARACTER_HEALTH.box, centered on where its shot starts.
 * The same spot the shot, the bot and the angle guide use (`firingOrigin`).
 */
export function unitBox(
  team: Team,
  unitId: string,
  layout: Pick<BattleLayout, 'launchOrigins'>,
): Rect {
  const { w, h } = CHARACTER_HEALTH.box;
  const o = firingOrigin(team, unitId, layout);
  return { x: o.x - w / 2, y: o.y - h / 2, w, h };
}
