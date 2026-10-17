// The flight of a missile, arrow, bolt or cannonball in the pictures. It follows the same laws as
// the game's shots: constant speed sideways, a steady pull down (gravity), and the nose always
// pointing the way it is going. Pure math, no DOM, so it is easy to test.
import { BALLISTICS } from '../game/config';

export type Vec2 = { x: number; y: number };

/** The pictures are 1600 wide and the game world is 1280 wide, so gravity scales the same way. */
export const PICTURE_SCALE = 1600 / 1280;
export const PICTURE_GRAVITY = BALLISTICS.gravity * PICTURE_SCALE;

export type Flight = {
  /** Where it starts (the offset is added to the picture's own starting spot). */
  from: Vec2;
  /** Where it lands. */
  to: Vec2;
  /** Seconds in the air. */
  seconds: number;
  /** Seconds of waiting before it flies. */
  delay: number;
  /** Seconds for one whole loop (flight, then hidden until it fires again). */
  period: number;
};

/** The launch velocity (px per second) that lands exactly on `to` after `seconds`. */
export function launchVelocity(flight: Flight, g = PICTURE_GRAVITY): Vec2 {
  const { from, to, seconds } = flight;
  return {
    x: (to.x - from.x) / seconds,
    y: (to.y - from.y) / seconds - 0.5 * g * seconds,
  };
}

export type FlightPose = {
  /** True while it is in the air. */
  flying: boolean;
  /** Position, from the start point. */
  x: number;
  y: number;
  /** Velocity at this moment. */
  vx: number;
  vy: number;
  /** Heading in degrees. 0 is right, 90 is down. */
  heading: number;
};

const HIDDEN: FlightPose = { flying: false, x: 0, y: 0, vx: 0, vy: 0, heading: 0 };

/** Where the projectile is, and which way it points, `t` seconds after the loop began. */
export function poseAt(flight: Flight, t: number, g = PICTURE_GRAVITY): FlightPose {
  if (!Number.isFinite(t) || flight.seconds <= 0 || flight.period <= 0) return HIDDEN;
  const into = (((t % flight.period) + flight.period) % flight.period) - flight.delay;
  if (into < 0 || into > flight.seconds) return HIDDEN;
  const v = launchVelocity(flight, g);
  const vy = v.y + g * into;
  return {
    flying: true,
    x: flight.from.x + v.x * into,
    y: flight.from.y + v.y * into + 0.5 * g * into * into,
    vx: v.x,
    vy,
    heading: (Math.atan2(vy, v.x) * 180) / Math.PI,
  };
}

/**
 * The SVG transform that moves a picture along its flight and turns it to face the way it flies.
 * `faces` is the way the picture points when drawn, in degrees (0 is right, 180 is left).
 */
export function flightTransform(flight: Flight, pose: FlightPose, faces: number): string | null {
  if (!pose.flying) return null;
  const round = (n: number): number => Math.round(n * 100) / 100;
  const dx = round(pose.x - flight.from.x);
  const dy = round(pose.y - flight.from.y);
  return `translate(${dx} ${dy}) rotate(${round(pose.heading - faces)})`;
}

/** The oval the hawk circles on, in picture units, around where the picture draws it. */
export type Orbit = { rx: number; ry: number; seconds: number };
export const HAWK_ORBIT: Orbit = { rx: 340, ry: 60, seconds: 16 };

export type HawkPose = {
  /** Offset from where the picture draws the hawk. */
  x: number;
  y: number;
  /** Width flip: 1 faces right, -1 faces left. It narrows through 0 as the hawk banks at each end. */
  scaleX: number;
  /** Tilt in degrees in the hawk's own drawing: positive dips the nose, negative lifts it. */
  tilt: number;
};

/** The thinnest the hawk gets while it turns, so it never vanishes edge-on. */
const MIN_TURN_WIDTH = 0.18;
/** How much of its climb or dive shows as tilt, and the most it ever tilts. */
const TILT_FRACTION = 0.5;
const MAX_TILT = 16;

/**
 * Where the hawk is `t` seconds in. It travels a true oval (clockwise, along the top first),
 * faces the way it flies, narrows as it banks round each end, and tilts with its climb or dive.
 */
export function hawkPose(t: number, orbit: Orbit = HAWK_ORBIT): HawkPose {
  const turn = Number.isFinite(t) && orbit.seconds > 0 ? (2 * Math.PI * t) / orbit.seconds : 0;
  const x = orbit.rx * Math.sin(turn);
  const y = -orbit.ry * Math.cos(turn);
  const vx = orbit.rx * Math.cos(turn);
  const vy = orbit.ry * Math.sin(turn);
  const width = vx / orbit.rx;
  const scaleX = Math.abs(width) < MIN_TURN_WIDTH ? (width < 0 ? -1 : 1) * MIN_TURN_WIDTH : width;
  const raw = ((Math.atan2(vy, Math.abs(vx)) * 180) / Math.PI) * TILT_FRACTION;
  const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, raw));
  // Adding 0 turns -0 into 0, so a lap compares equal to its start.
  const round = (n: number): number => Math.round(n * 100) / 100 + 0;
  return { x: round(x), y: round(y), scaleX: round(scaleX), tilt: round(tilt) };
}
