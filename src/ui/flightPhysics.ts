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
export const HAWK_ORBIT: Orbit = { rx: 340, ry: 52, seconds: 16 };

/** How the hawk reads in depth, and how its wings move. All in one place so they are easy to tune. */
export const HAWK_3D = {
  /** Size on the near pass (over the title) and on the far pass (behind it). 1 at the turns. */
  nearScale: 1.22,
  farScale: 0.8,
  /** How much the far pass is dimmed (0 none, 1 gone), and how dark the near pass's soft shadow gets. */
  farDim: 0.3,
  nearShadow: 1,
  /** Wing beat: degrees either side of `flapMid`, and seconds for one full beat. */
  flapMid: 3,
  flapSwing: 11,
  flapSeconds: 1.6,
} as const;

export type HawkPose = {
  /** Offset from where the picture draws the hawk. */
  x: number;
  y: number;
  /** Size: below 1 on the far pass, above 1 on the near pass. */
  scale: number;
  /** -1 at the far end of the oval, 0 at the two turns, 1 at the near end. */
  depth: number;
  /** True on the near half (the hawk is over the title). False on the far half (behind it). */
  front: boolean;
  /** Heading around the upright axis, in degrees from 0 up to 360. 0 flies right, 90 comes at us, 180 flies left. */
  yaw: number;
  /** Wing lift in degrees: positive raises the tips. */
  flap: number;
  /** Paint opacity: dimmed on the far pass so depth reads, full from the turn onward. */
  opacity: number;
  /** Strength of the soft shadow on the near pass, 0 to 1. */
  shadow: number;
};

/**
 * Where the hawk is `t` seconds in. It circles a true oval (clockwise, along the far side first),
 * turns about its upright axis as it banks round each end, grows on the near half and shrinks on
 * the far half, and beats its wings. It is over the title on the near half and behind it on the
 * far half, switching exactly at the two turns.
 */
export function hawkPose(t: number, orbit: Orbit = HAWK_ORBIT): HawkPose {
  const ok = Number.isFinite(t) && orbit.seconds > 0;
  const turn = ok ? (2 * Math.PI * t) / orbit.seconds : 0;
  const x = orbit.rx * Math.sin(turn);
  const y = -orbit.ry * Math.cos(turn);
  const depth = -Math.cos(turn);
  const scale = 1 + (depth >= 0 ? HAWK_3D.nearScale - 1 : 1 - HAWK_3D.farScale) * depth;
  const yaw = (((turn * 180) / Math.PI) % 360 + 360) % 360;
  const beat = ok ? (2 * Math.PI * t) / HAWK_3D.flapSeconds : 0;
  const flap = HAWK_3D.flapMid + HAWK_3D.flapSwing * Math.sin(beat);
  // Rounding keeps -0 and tiny sines from showing up, so a lap compares equal to its start.
  const round = (n: number, places = 100): number => Math.round(n * places) / places + 0;
  return {
    x: round(x),
    y: round(y),
    scale: round(scale, 1000),
    depth: round(depth, 1000),
    front: round(y) > 0,
    yaw: round(yaw) % 360,
    flap: round(flap),
    opacity: round(depth < 0 ? 1 + HAWK_3D.farDim * depth : 1, 1000),
    shadow: round(depth > 0 ? HAWK_3D.nearShadow * depth : 0, 1000),
  };
}
