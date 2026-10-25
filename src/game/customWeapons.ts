// The Weapon Workshop, as pure rules: make your own Forge weapon. Pick a style (one of the team's
// three catalog weapons), spend a fixed budget of points on Power, Reach and Splash, and give it a
// name. Numbers live in WORKSHOP (config.ts). No custom weapon beats the best catalog weapon of its
// team (tests/game/customWeapons.test.ts sweeps every legal design). A custom weapon's id carries
// its side and a serial number ("custom:P:3"), so a bad id can never become a catalog weapon.
import { WORKSHOP as W } from './config';
import { hasBlockedWord } from './names';
import type { Team } from './types';
import {
  weaponById,
  weaponsOf,
  type CustomWeaponId,
  type ForgeWeapon,
  type RangeLabel,
  type Weapon,
  type WeaponId,
} from './weapons';

export type WeaponStyle = 'short' | 'long' | 'heavy';
export type StatId = 'power' | 'reach' | 'splash';
export type Points = Record<StatId, number>;
export type WeaponDesign = Points & { base: WeaponId };

/** One saved custom weapon. Its stats come from the points, so they can never drift. */
export type CustomWeapon = WeaponDesign & { id: CustomWeaponId; name: string };

export type DesignProblem = 'bad_design' | 'wrong_team';
export type NameProblem = 'empty' | 'long' | 'letters' | 'blocked' | 'private' | 'digits';

export const STAT_IDS: readonly StatId[] = ['power', 'reach', 'splash'];
const STYLES: readonly WeaponStyle[] = ['short', 'long', 'heavy'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Which style a catalog weapon stands for: its place in its team's list. */
export function styleOf(base: WeaponId): WeaponStyle {
  const w = weaponById(base);
  const at = w ? weaponsOf(w.team).findIndex((x) => x.id === base) : 0;
  return STYLES[Math.max(0, at)] ?? 'short';
}

/** The points a style starts with on the pad. */
export const presetFor = (base: WeaponId): Points => ({ ...W.presets[styleOf(base)] });

export const pointsUsed = (p: Points): number => p.power + p.reach + p.splash;
export const pointsLeft = (p: Points): number => W.budget - pointsUsed(p);

const isPoint = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= W.minPoints && n <= W.maxPoints;

/** Why a design cannot be forged, or null when it is fine. */
export function designProblem(design: WeaponDesign, team: Team): DesignProblem | null {
  if (!isObject(design)) return 'bad_design';
  const base = weaponById(String(design.base));
  if (!base) return 'bad_design';
  if (base.team !== team) return 'wrong_team';
  if (!STAT_IDS.every((s) => isPoint(design[s]))) return 'bad_design';
  return pointsLeft(design) < 0 ? 'bad_design' : null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** What the points do at level 1. */
export const customStats = (p: Points): { direct: number; near: number; speedScale: number } => ({
  direct: W.power.base + W.power.perPoint * p.power,
  near: W.splash.base + W.splash.perPoint * p.splash,
  speedScale: round2(W.reach.base + W.reach.perPoint * p.reach),
});

/** The range word for a launch speed scale, like the catalog (1, 1.1, 1.2). */
export const rangeOf = (speedScale: number): RangeLabel =>
  speedScale >= 1.2 - 1e-9 ? 'far' : speedScale >= 1.1 - 1e-9 ? 'long' : 'short';

/** How strong a weapon is overall (WORKSHOP doc in config.ts). */
export const powerScore = (s: { direct: number; near: number; speedScale: number }): number =>
  s.direct + s.near + W.reachWeight * (s.speedScale - 1);

/** Scrap to forge a design: a stronger one costs more. */
export function customCost(p: Points): number {
  const score = powerScore(customStats(p));
  const row = W.cost.find((r) => score <= r.upTo + 1e-9) ?? W.cost[W.cost.length - 1]!;
  return row.scrap;
}

// ---------- Names ----------

const rot13 = (s: string): string =>
  s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
/**
 * Words the game never says (AGENTS.md vocabulary and banned list), on top of the name list in
 * names.ts. Kept scrambled like src/ui/nameBlocklist.ts so the rules file holds none of them.
 */
const VOCAB = new Set(
  [
    'ohl',
    'ohlf',
    'obhtug',
    'cevpr',
    'cevprf',
    'fubc',
    'pbva',
    'pbvaf',
    'zbarl',
    'pheerapl',
    'qrsrng',
    'qrsrngrq',
    'qvrq',
    'qlvat',
    'ohlvat',
  ].map(rot13),
);
const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
};
const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[013457]/g, (c) => LEET[c] ?? c)
    .split(/[^a-z]+/)
    .filter(Boolean);

/** Trimmed, with runs of spaces made one. */
export const tidyName = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';

/**
 * Why a weapon name cannot be used, or null when it is fine. `privateNames` are the players'
 * own names: a weapon name never carries one, so nothing personal shows on the Forge.
 */
export function nameProblem(
  raw: unknown,
  privateNames: readonly string[],
  max: number = W.savedNameMax,
): NameProblem | null {
  const name = tidyName(raw);
  if (name === '') return 'empty';
  if (name.length > max) return 'long';
  if (!/^[A-Za-z0-9 ]+$/.test(name)) return 'letters';
  if (hasBlockedWord(name) || words(name).some((w) => VOCAB.has(w))) return 'blocked';
  if (new RegExp(`[0-9]{${W.maxDigitRun + 1}}`).test(name)) return 'digits';
  const mine = new Set(name.toLowerCase().split(' '));
  for (const person of privateNames) {
    const parts = tidyName(person)
      .toLowerCase()
      .split(' ')
      .filter((p) => p.length >= 2);
    if (parts.some((p) => mine.has(p))) return 'private';
  }
  return null;
}

/** A name typed on the pad: the same checks, and shorter. */
export const typedNameProblem = (
  raw: unknown,
  privateNames: readonly string[],
): NameProblem | null => nameProblem(raw, privateNames, W.typedNameMax);

// ---------- Ids ----------

const PREFIX = 'custom:';
const SIDE: Record<Team, string> = { PAST: 'P', FUTURE: 'F' };
const ID_RE = /^custom:([PF]):([1-9][0-9]{0,2})$/;

export const customWeaponId = (team: Team, serial: number): CustomWeaponId =>
  `${PREFIX}${SIDE[team]}:${serial}` as CustomWeaponId;

/** Reads a custom weapon id. Null unless it is exactly "custom:P:n" or "custom:F:n". */
export function parseCustomWeaponId(id: unknown): { team: Team; serial: number } | null {
  if (typeof id !== 'string') return null;
  const m = ID_RE.exec(id);
  if (!m) return null;
  const serial = Number(m[2]);
  if (serial > W.maxSerial) return null;
  return { team: m[1] === 'P' ? 'PAST' : 'FUTURE', serial };
}

export const isCustomWeaponId = (id: unknown): id is CustomWeaponId =>
  parseCustomWeaponId(id) !== null;

/** The id for the next weapon: one past the highest serial so far. Same name, new id. */
export function nextCustomId(team: Team, list: readonly CustomWeapon[]): CustomWeaponId {
  const top = Math.max(0, ...list.map((c) => parseCustomWeaponId(c.id)?.serial ?? 0));
  return customWeaponId(team, top + 1);
}

// ---------- As a Forge weapon ----------

/** A custom weapon read like a catalog one, so the Forge, level-ups and the match all use it. */
export function customAsWeapon(cw: CustomWeapon): ForgeWeapon {
  const base = weaponById(cw.base) as Weapon;
  const stats = customStats(cw);
  return {
    id: cw.id,
    team: base.team,
    name: cw.name,
    ...stats,
    range: rangeOf(stats.speedScale),
    cost: customCost(cw),
    base: cw.base,
    mine: true,
  };
}

/** The custom weapon with this id in a list, or null. */
export const findCustom = (
  list: readonly CustomWeapon[] | undefined,
  id: unknown,
): CustomWeapon | null =>
  isCustomWeaponId(id) ? ((list ?? []).find((c) => c.id === id) ?? null) : null;

/**
 * A saved list, checked. Anything wrong (a bad id, the other side's id, a repeated id, a bad
 * style, points out of range or over budget, a bad name) is dropped, never thrown. At most
 * WORKSHOP.maxPerTeam are kept, the first ones. Extra fields are left behind.
 */
export function cleanCustomList(raw: unknown, team: Team): CustomWeapon[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomWeapon[] = [];
  for (const v of raw) {
    if (out.length >= W.maxPerTeam) break;
    if (!isObject(v)) continue;
    const parsed = parseCustomWeaponId(v.id);
    if (!parsed || parsed.team !== team || out.some((c) => c.id === v.id)) continue;
    const design = { base: v.base, power: v.power, reach: v.reach, splash: v.splash };
    if (designProblem(design as WeaponDesign, team) !== null) continue;
    if (nameProblem(v.name, []) !== null) continue;
    out.push({
      id: v.id as CustomWeaponId,
      base: design.base as WeaponId,
      name: tidyName(v.name),
      power: design.power as number,
      reach: design.reach as number,
      splash: design.splash as number,
    });
  }
  return out;
}
