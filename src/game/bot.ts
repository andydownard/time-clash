// The practice opponent ("Computer player"). Pure rules, no Phaser, no network, seeded randomness.
// It sees only what a child could see: bases, health, wind, and its own question.
import { simulateShot, clampAim } from './ballistics';
import {
  BOT_LEVELS,
  PRACTICE_BOT,
  TEAM_FACING,
  PHASE1_LAYOUT,
  type BotLevel,
  type BotProfile,
} from './config';
import { DEFAULT_EFFECTS, type MatchEffects } from './loadout';
import { otherTeam } from './types';
import type { AimInput, BattleLayout, Match, Rect, Rng, Team, Vec2 } from './types';
import { DEFAULT_UNIT, unitById, type UnitId } from './units';

export type BotShot = AimInput & { unit: UnitId };

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
): AimInput => {
  const perLayout = solutions.get(layout) ?? new Map<string, Solution>();
  solutions.set(layout, perLayout);
  const key = `${team}|${origin.x}|${origin.y}|${wind}|${speedScale}`;
  const cached = perLayout.get(key);
  if (cached) return pickAim(cached, rng);
  const target = layout.bases[otherTeam(team)];
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
    const flewAway = r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout';
    const score = flewAway ? Number.MAX_SAFE_INTEGER : gap(r.landing, target);
    return { angleDeg, power, score };
  };
  let best: Candidate = { angleDeg: 45, power: 60, score: Number.POSITIVE_INFINITY };
  for (let a = 15; a <= 85; a += angleStepDeg)
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

/** Shot choice for any profile (a level, or the scripted player the simulation uses). */
export const chooseShotWith = (
  state: Match,
  side: Team,
  profile: BotProfile,
  rng: Rng,
  ctx: BotContext = {},
): BotShot => {
  const layout = ctx.layout ?? PHASE1_LAYOUT;
  const effects = ctx.effects ?? DEFAULT_EFFECTS;
  const unitId = state.selected[side] ?? DEFAULT_UNIT[side];
  const unit =
    unitById(unitId) ?? (unitById(DEFAULT_UNIT[side]) as NonNullable<ReturnType<typeof unitById>>);
  const origin = unit.id === DEFAULT_UNIT[side] ? layout.launchOrigins[side] : unit.origin;
  const speedScale = effects[side].speedScale * unit.speedScale;
  // The bot reads only a share of the wind, like a child who half-notices the arrows.
  const seenWind = state.wind * profile.windSkill;
  const ideal = solve(origin, side, seenWind, layout, speedScale, rng);
  const aim = clampAim({
    angleDeg: Math.round(ideal.angleDeg + normal(rng) * profile.angleSpreadDeg),
    power: Math.round(ideal.power + normal(rng) * profile.powerSpreadPct),
  });
  return { ...aim, unit: unit.id };
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
