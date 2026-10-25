// The practice opponent ("Computer player"). Pure rules, no Phaser, no network, seeded randomness.
// It sees only what a child could see: bases, health, wind, and its own question.
import { simulateShot, clampAim } from './ballistics';
import {
  BASE_IN_BATTLE,
  BOT_LEVELS,
  PRACTICE_BOT,
  TEAM_FACING,
  PHASE1_LAYOUT,
  type BotLevel,
  type BotProfile,
} from './config';
import { DEFAULT_EFFECTS, type MatchEffects } from './loadout';
import { otherTeam } from './types';
import type { AimInput, BattleLayout, Match, MountId, Rect, Rng, Team, Vec2 } from './types';
import { flightLayout, mountAim, roleAngles } from './builtBase';
import { withWalls } from './battlefield';
import { aliveUnitIds, pathGap } from './damage';
import { wallsInView } from './evasion';
import { DEFAULT_UNIT, firingOrigin, unitBox, unitById, type UnitId } from './units';

/** `mount` is set when the bot picked a mounted weapon (BASE_IN_BATTLE on); `unit` is then the fighter that stays picked. */
export type BotShot = AimInput & { unit: UnitId; mount?: MountId };

export type BotContext = { layout?: BattleLayout; effects?: MatchEffects };

/** The parts of a question the bot may use. It is the bot's OWN question, never the other player's. */
export type BotQuestion = {
  grade: number;
  kind?: string;
  choices: readonly string[];
  answer: string;
};

export type BotAnswer = {
  /** The choice the bot picks (one of question.choices). */
  answer: string;
  correct: boolean;
  /** How long to wait before showing the answer, so the UI can pace it. */
  delayMs: number;
};

export const profileOf = (level: BotLevel): BotProfile => {
  const profile = PRACTICE_BOT.levels[level];
  if (!profile) throw new RangeError(`Unknown level: ${String(level)}`);
  return profile;
};

/** Roughly normal, mean 0, spread 1. Four uniform draws keep it cheap and seeded. */
const normal = (rng: Rng): number =>
  (rng.next() + rng.next() + rng.next() + rng.next() - 2) * Math.sqrt(3);

const gap = (pt: Vec2, r: Rect): number =>
  Math.hypot(
    Math.max(r.x - pt.x, 0, pt.x - (r.x + r.w)),
    Math.max(r.y - pt.y, 0, pt.y - (r.y + r.h)),
  );

type Candidate = AimInput & { score: number };
type Solution = { best: Candidate; exact: Candidate[] };

/** The search is pure, so its answer is kept per layout, shooter spot, wind and range. */
const solutions = new WeakMap<BattleLayout, Map<string, Solution>>();

/** Search a grid of aims on a perfect copy of the physics and keep those that land closest. */
const solve = (
  origin: Vec2,
  team: Team,
  wind: number,
  layout: BattleLayout,
  speedScale: number,
  rng: Rng,
  /** A fighter to aim at (character health on). Default: the other team's base. */
  mark?: { id: UnitId; box: Rect },
  /** Angles this shooter may use (a mounted weapon). Default: 15 to 85. */
  range?: { min: number; max: number },
  /** A built base to aim at (base health mode): the box around its standing bricks. */
  baseBox?: Rect,
): AimInput => {
  const perLayout = solutions.get(layout) ?? new Map<string, Solution>();
  solutions.set(layout, perLayout);
  const boxKey = baseBox ? `${baseBox.x},${baseBox.y},${baseBox.w},${baseBox.h}` : 'base';
  const key = `${team}|${origin.x}|${origin.y}|${wind}|${speedScale}|${mark?.id ?? boxKey}|${range ? `${range.min}-${range.max}` : 'any'}`;
  const cached = perLayout.get(key);
  if (cached) return pickAim(cached, rng);
  const target = mark ? mark.box : (baseBox ?? layout.bases[otherTeam(team)]);
  const { angleStepDeg, powerStep, fineRadius, fineStep } = PRACTICE_BOT.search;
  const tryAim = (angleDeg: number, power: number): Candidate => {
    const r = simulateShot({
      angleDeg,
      power,
      origin,
      facing: TEAM_FACING[team],
      wind,
      layout,
      speedScale,
    });
    // A fighter can be hit in flight, so its score is the closest the shell comes.
    if (mark) return { angleDeg, power, score: pathGap(r.path, target) };
    const flewAway = r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout';
    const score = flewAway ? Number.MAX_SAFE_INTEGER : gap(r.landing, target);
    return { angleDeg, power, score };
  };
  let best: Candidate = { angleDeg: 45, power: 60, score: Number.POSITIVE_INFINITY };
  for (
    let a = Math.max(15, range?.min ?? 0);
    a <= Math.min(85, range?.max ?? 90);
    a += angleStepDeg
  )
    for (let p = 20; p <= 100; p += powerStep) {
      const c = tryAim(a, p);
      if (c.score < best.score) best = c;
    }
  const exact: Candidate[] = [];
  for (let a = best.angleDeg - fineRadius; a <= best.angleDeg + fineRadius; a += fineStep)
    for (let p = best.power - fineRadius; p <= best.power + fineRadius; p += fineStep) {
      const c = tryAim(a, p);
      if (c.score < best.score) best = c;
      if (c.score === 0) exact.push(c);
    }
  const found = { best, exact };
  perLayout.set(key, found);
  return pickAim(found, rng);
};

/** Many aims score a direct hit. Pick one at random so the bot does not always shoot the same way. */
const pickAim = ({ best, exact }: Solution, rng: Rng): AimInput => {
  const chosen = exact.length > 0 ? rng.pick(exact) : best;
  return { angleDeg: chosen.angleDeg, power: chosen.power };
};

/** One walled copy of each field, so the search cache below still finds its answers. */
const walled = new WeakMap<BattleLayout, BattleLayout>();
const withStandingWall = (layout: BattleLayout, state: Match): BattleLayout => {
  const walls = state.evasion ? wallsInView(state.evasion) : [];
  if (walls.length === 0) return layout;
  const known = walled.get(layout);
  if (known) return known;
  const made = withWalls(layout, walls);
  walled.set(layout, made);
  return made;
};

/**
 * A built base in base health mode: the box around the other team's standing bricks (plain to
 * see on the field). Undefined when that team has no built base or nothing stands.
 */
export const standingBricksBox = (state: Match, foe: Team): Rect | undefined => {
  if (state.characterHealth || !state.builtBase?.[foe] || !state.bricks) return undefined;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of Object.values(state.bricks)) {
    if (b.team !== foe || !b.alive) continue;
    x0 = Math.min(x0, b.box.x);
    y0 = Math.min(y0, b.box.y);
    x1 = Math.max(x1, b.box.x + b.box.w);
    y1 = Math.max(y1, b.box.y + b.box.h);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : undefined;
};

/** Shot choice for any profile (a level, or the scripted player the simulation uses). */
export const chooseShotWith = (
  state: Match,
  side: Team,
  profile: BotProfile,
  rng: Rng,
  ctx: BotContext = {},
): BotShot => {
  // A team that brought a built base has no fixed base box. The bot still aims by the plain
  // physics and ignores the bricks: a shell that meets a brick just hits it.
  // The field includes the biome's middle shape, and the Stone Wall while it stands (both are
  // plain to see, so the bot plans its arc over them, then adds its usual aim error).
  const flat = state.builtBase
    ? flightLayout(ctx.layout ?? PHASE1_LAYOUT, state.builtBase)
    : (ctx.layout ?? PHASE1_LAYOUT);
  const layout = withStandingWall(flat, state);
  const effects = ctx.effects ?? DEFAULT_EFFECTS;
  // With character health on, only a fighter still standing may shoot.
  const standing = state.characterHealth ? aliveUnitIds(state.unitHp, side) : null;
  const picked = state.selected[side] ?? DEFAULT_UNIT[side];
  const unitId =
    standing && standing.length > 0 && !standing.includes(picked)
      ? standing.includes(DEFAULT_UNIT[side])
        ? DEFAULT_UNIT[side]
        : (standing[0] as UnitId)
      : picked;
  const unit =
    unitById(unitId) ?? (unitById(DEFAULT_UNIT[side]) as NonNullable<ReturnType<typeof unitById>>);
  // With built bases on, a mounted weapon that can fire is another shooter the bot may pick.
  const firing = (state.mounts?.[side] ?? []).filter((m) => m.alive && m.canFire);
  const mount =
    firing.length > 0 && rng.next() < BASE_IN_BATTLE.botMountChance ? rng.pick(firing) : null;
  const origin = mount ? mount.origin : firingOrigin(side, unit.id, layout);
  const speedScale = mount
    ? BASE_IN_BATTLE.mountSpeedScale
    : effects[side].speedScale * unit.speedScale;
  // The bot reads only a share of the wind, like a child who half-notices the arrows.
  const seenWind = state.wind * profile.windSkill;
  // With character health on, aim at one of the other team's fighters still standing.
  const foes = state.characterHealth ? aliveUnitIds(state.unitHp, otherTeam(side)) : [];
  const foe = foes.length > 0 ? rng.pick(foes) : null;
  const mark = foe ? { id: foe, box: unitBox(otherTeam(side), foe, layout) } : undefined;
  // Aiming at fighters has many more cases to search, so the wind is rounded to a whole number
  // there (an error far smaller than the bot's own aim spread).
  const ideal = solve(
    origin,
    side,
    mark ? Math.round(seenWind) : seenWind,
    layout,
    speedScale,
    rng,
    mark,
    mount ? roleAngles(mount.role) : undefined,
    mark ? undefined : standingBricksBox(state, otherTeam(side)),
  );
  const noisy = clampAim({
    angleDeg: Math.round(ideal.angleDeg + normal(rng) * profile.angleSpreadDeg),
    power: Math.round(ideal.power + normal(rng) * profile.powerSpreadPct),
  });
  const aim = mount ? mountAim(mount.role, noisy) : noisy;
  return { ...aim, unit: unit.id, ...(mount ? { mount: mount.id } : {}) };
};

/** The shot for `side` this turn at the given level. Always legal (clamped). */
export const chooseShot = (
  state: Match,
  side: Team,
  level: BotLevel,
  rng: Rng,
  ctx: BotContext = {},
): BotShot => chooseShotWith(state, side, profileOf(level), rng, ctx);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Chance of a right answer for this profile and question grade. */
export const reloadChance = (profile: BotProfile, grade: number): number => {
  const g = Number.isFinite(grade) ? Math.max(0, grade) : 0;
  const { gradeDrop, floor, ceiling } = PRACTICE_BOT.reload;
  return clamp(profile.reloadAccuracy - gradeDrop * g, floor, ceiling);
};

/** Reload answer for any profile. Needs only the bot's own question. */
export const answerReloadWith = (
  question: BotQuestion,
  profile: BotProfile,
  rng: Rng,
): BotAnswer => {
  const r = PRACTICE_BOT.reload;
  const correct = rng.next() < reloadChance(profile, question.grade);
  const wrong = question.choices.filter((c) => c !== question.answer);
  const answer = correct || wrong.length === 0 ? question.answer : rng.pick(wrong);
  const reading =
    question.kind !== undefined && question.kind !== 'numeric' && question.kind !== 'choice';
  const think =
    r.thinkBaseMs +
    r.thinkPerGradeMs * Math.max(0, question.grade) +
    (reading ? r.thinkReadingExtraMs : 0);
  const delayMs = clamp(
    Math.round((think + rng.next() * r.thinkJitterMs) * profile.thinkScale),
    r.minDelayMs,
    r.maxDelayMs,
  );
  return { answer, correct: answer === question.answer, delayMs };
};

export const answerReload = (question: BotQuestion, level: BotLevel, rng: Rng): BotAnswer =>
  answerReloadWith(question, profileOf(level), rng);

export { BOT_LEVELS };
