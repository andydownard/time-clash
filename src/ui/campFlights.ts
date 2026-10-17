// What flies over the Camp, and where it lands. The numbers are spots in the 1600 by 900 picture
// (see campArt.ts). Arrows and the cannonball start in Team Past's camp and land on Team Future's
// bases. The missile starts at Team Future's base and lands on Team Past's tower. Each one is a
// real arc under gravity (flightPhysics.ts). Lasers are not here: a laser does not fall, so it
// keeps its straight CSS animation.
import { startFlights, startHawk, type FlightSpec, type Scheduler } from './ambientFlights';

type Point = readonly [number, number];

/** One shot: where the picture draws it, and where it comes down. */
export type Shot = { selector: string; start: Point; target: Point };

/** The seconds one loop of the picture lasts, and the share of it a shot spends in the air. */
export const CAMP_LOOP_SECONDS = 4;
const FIRE_DELAY = 0.16;
// Short enough that the highest arc stays below the logo (the rise grows with the square of the time).
const ARROW_SECONDS = 1.3;
const HEAVY_SECONDS = 1.4;
/** The second one of a pair fires a moment after the first (the `tc-camp-d2` shapes). */
export const CAMP_PAIR_DELAY = 0.12;

/** An arrow is drawn centred on its start, inside a group that moves it to that spot. */
const arrow = (x: number, y: number, target: Point): FullShot => ({
  selector: `g[transform="translate(${x} ${y})"] > .tc-camp-arrow`,
  start: [x, y],
  target,
  seconds: ARROW_SECONDS,
  faces: 0,
});

type FullShot = Shot & { seconds: number; faces: number };

export const CAMP_SHOTS: readonly FullShot[] = [
  // Archers on the big castle and the small castle (Past), shooting at the Future bases.
  arrow(198, 394, [1165, 446]),
  arrow(248, 394, [1215, 452]),
  arrow(168, 478, [1385, 548]),
  arrow(284, 478, [1440, 556]),
  arrow(467, 386, [1250, 460]),
  // The cannon. It lands on the near Future base.
  {
    selector: '.tc-camp-ball',
    start: [346, 630],
    target: [1290, 488],
    seconds: HEAVY_SECONDS,
    faces: 0,
  },
  // The Future missile, drawn nose-left, lands on the big castle's right tower.
  {
    selector: '.tc-camp-miss',
    start: [1415, 520],
    target: [316, 478],
    seconds: HEAVY_SECONDS,
    faces: 180,
  },
];

/** The flights in the form `startFlights` wants: the landing is an offset from the start. */
export function campFlightSpecs(): FlightSpec[] {
  return CAMP_SHOTS.map((s) => ({
    selector: s.selector,
    faces: s.faces,
    flight: {
      to: { x: s.target[0] - s.start[0], y: s.target[1] - s.start[1] },
      seconds: s.seconds,
      delay: FIRE_DELAY,
      period: CAMP_LOOP_SECONDS,
    },
  }));
}

/** Env pieces the Camp needs to run frames. `raf` is optional; without it we use timers. */
export type CampMotionEnv = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
};

const FRAME_MS = 33;

/**
 * A scheduler that uses animation frames when the window has them, otherwise timers. A frame
 * does nothing, and asks for no more, once `alive()` is false (the screen has left the page).
 */
export function campScheduler(
  win: Window | null | undefined,
  env: CampMotionEnv,
  alive: () => boolean = () => true,
): Scheduler {
  const raf = win?.requestAnimationFrame?.bind(win);
  const caf = win?.cancelAnimationFrame?.bind(win);
  const guard = (fn: () => void) => () => {
    if (alive()) fn();
  };
  if (raf && caf) {
    return { now: env.now, next: (fn) => raf(guard(fn)), cancel: (h) => caf(h as number) };
  }
  return {
    now: env.now,
    next: (fn) => env.setTimeout(guard(fn), FRAME_MS),
    cancel: (h) => env.clearTimeout(h),
  };
}

/** Starts everything that flies over the Camp. Returns a function that stops it all. */
export function flyOverCamp(
  root: ParentNode,
  scheduler: Scheduler,
  options: { reduced: boolean },
): () => void {
  const stopShots = startFlights(root, campFlightSpecs(), scheduler, {
    reduced: options.reduced,
    extraDelay: CAMP_PAIR_DELAY,
  });
  const stopHawk = startHawk(root, scheduler, options);
  return () => {
    stopShots();
    stopHawk();
  };
}
