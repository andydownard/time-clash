// Pure layout math for the Battle scene. No Phaser, so it is unit tested.
import { AIM, BASES, DAMAGE, HIT_FX, TIMING, TURN, WIND } from '../../game/config';
import type { AimInput, BattleLayout, Team, Vec2 } from '../../game/types';
import {
  BUBBLE_MAX_WORLD_W,
  BUBBLE_RISE,
  CHARACTER_OFFSET,
  DIAL,
  FALL_DX,
  TAIL_TARGET_RISE,
  WIND_ARROW_MAX,
} from './visual';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const RAD = Math.PI / 180;

/** Unit vector for an aim. facing +1 fires toward +x. y grows down, so up is negative. */
export function aimVector(angleDeg: number, facing: 1 | -1): Vec2 {
  return { x: Math.cos(angleDeg * RAD) * facing, y: -Math.sin(angleDeg * RAD) };
}

/** Where the draggable handle sits for an aim. Farther out means more power. */
export function dialHandle(origin: Vec2, angleDeg: number, power: number, facing: 1 | -1): Vec2 {
  const p = clamp(power, AIM.powerMin, AIM.powerMax);
  const span = AIM.powerMax - AIM.powerMin;
  const r = DIAL.minRadius + ((DIAL.maxRadius - DIAL.minRadius) * (p - AIM.powerMin)) / span;
  const v = aimVector(angleDeg, facing);
  return { x: origin.x + v.x * r, y: origin.y + v.y * r };
}

/**
 * The aim for a pointer position. Inverse of dialHandle for whole numbers.
 * A pointer on the launcher keeps the current angle. Bad numbers keep the current aim.
 */
export function aimFromDrag(
  origin: Vec2,
  pointer: Vec2,
  facing: 1 | -1,
  current: AimInput,
): AimInput {
  const dx = (pointer.x - origin.x) * facing;
  const dy = origin.y - pointer.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { ...current };
  const dist = Math.hypot(dx, dy);
  const span = AIM.powerMax - AIM.powerMin;
  const power = clamp(
    Math.round(AIM.powerMin + ((dist - DIAL.minRadius) / (DIAL.maxRadius - DIAL.minRadius)) * span),
    AIM.powerMin,
    AIM.powerMax,
  );
  const angleDeg =
    dist < 1e-9
      ? current.angleDeg
      : clamp(Math.round(Math.atan2(dy, dx) / RAD), AIM.angleMinDeg, AIM.angleMaxDeg);
  return { angleDeg: angleDeg + 0, power: power + 0 };
}

/** Direction and drawn length of the wind arrow. */
export function windArrow(wind: number): { dir: -1 | 0 | 1; length: number } {
  const n = Number(wind);
  if (!Number.isFinite(n) || n === 0) return { dir: 0, length: 0 };
  const limit = Math.max(Math.abs(WIND.min), Math.abs(WIND.max));
  return { dir: n > 0 ? 1 : -1, length: (Math.min(Math.abs(n), limit) / limit) * WIND_ARROW_MAX };
}

/** Health as 0..1 for a candle or battery. */
export function hpFraction(hp: number, max: number = DAMAGE.startingBaseHp): number {
  if (!Number.isFinite(hp) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp(hp / max, 0, 1);
}

/** One entry per shot in a turn. true = still to fire. */
export function shotIcons(shotsLeft: number): boolean[] {
  return Array.from({ length: TURN.shotsPerTurn }, (_, i) => i < shotsLeft);
}

/** The waiting side dims. With no active side, nothing dims. */
export function sideAlpha(team: Team, active: Team | null): number {
  return active === null || active === team ? 1 : 1 - TIMING.waitingDim;
}

/** Where a team's character stands, on the ground just outside its base. */
export function characterSpot(team: Team, layout: BattleLayout): Vec2 {
  const base = layout.bases[team] ?? BASES[team];
  const groundY = layout.terrain.ground[0]?.y ?? base.y + base.h;
  return team === 'PAST'
    ? { x: base.x + base.w + CHARACTER_OFFSET, y: groundY }
    : { x: base.x - CHARACTER_OFFSET, y: groundY };
}

/** The point the speech bubble tail aims at: just above the speaker's head. */
export function bubbleTailTarget(team: Team, layout: BattleLayout, fallen = false): Vec2 {
  const spot = characterSpot(team, layout);
  if (fallen) {
    // A fallen fighter lies FALL_DX out toward the field, so the tail aims at the stars above it.
    const dir = team === 'PAST' ? 1 : -1;
    return { x: spot.x + dir * FALL_DX, y: spot.y - HIT_FX.fallenTailRise };
  }
  return { x: spot.x, y: spot.y - TAIL_TARGET_RISE };
}

/** World anchor for the speech bubble body (its center, at the widest the bubble gets). */
export function bubbleAnchor(team: Team, layout: BattleLayout): Vec2 {
  const spot = characterSpot(team, layout);
  // Step the bubble toward the middle of the field, so it never sits on a base or its health tag.
  const base = layout.bases[team] ?? BASES[team];
  const x =
    team === 'PAST' ? base.x + base.w + BUBBLE_MAX_WORLD_W / 2 : base.x - BUBBLE_MAX_WORLD_W / 2;
  return { x, y: spot.y - BUBBLE_RISE };
}

/** How far the power meter slides back from the launcher, away from the enemy. */
const METER_SHIFT = 72;

/**
 * Left edge of the power meter. It sits above the launcher but slides back, away from the
 * enemy, so it clears the balloon drawn over the launcher (iPad mini audit, defect 5).
 */
export function meterLeft(
  originX: number,
  facing: 1 | -1,
  worldWidth: number,
  meterW: number,
): number {
  const x = originX - meterW / 2 - facing * METER_SHIFT;
  return Math.min(worldWidth - meterW - 8, Math.max(8, x));
}
