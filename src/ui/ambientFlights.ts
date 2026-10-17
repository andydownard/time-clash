// Drives the arrows, cannonball and missiles in a picture with real physics (flightPhysics.ts)
// instead of hand-drawn keyframes. Each one climbs, slows, peaks and falls onto its target, and
// turns its nose the way it is flying. Lasers are not here: a laser does not fall, so its straight
// line stays a plain animation. With reduced motion nothing flies.
import { poseAt, flightTransform, hawkPose, type Flight } from './flightPhysics';

/** A picture to fly: which shapes, how they fly, and which way they point when drawn. */
export type FlightSpec = {
  selector: string;
  /** Flight in the picture's own units, from the shape's starting spot. */
  flight: Omit<Flight, 'from'> & { from?: Flight['from'] };
  /** The way the shape points when drawn, in degrees (0 right, 180 left). */
  faces: number;
};

export type Scheduler = {
  /** Time in milliseconds. */
  now: () => number;
  /** Runs `fn` on the next frame. Returns something to give to `cancel`. */
  next: (fn: () => void) => unknown;
  cancel: (handle: unknown) => void;
};

const ZERO = { x: 0, y: 0 };

/**
 * Starts the flights. `extraDelay` is added to a shape's delay when it has the class
 * `tc-camp-d2` (the second one of a pair fires a moment later). Returns a function that stops them.
 */
export function startFlights(
  root: ParentNode,
  specs: readonly FlightSpec[],
  scheduler: Scheduler,
  options: { reduced: boolean; extraDelay: number },
): () => void {
  const flights = specs.flatMap((spec) =>
    [...root.querySelectorAll<SVGElement>(spec.selector)].map((el) => ({
      el,
      faces: spec.faces,
      flight: {
        from: spec.flight.from ?? ZERO,
        to: spec.flight.to,
        seconds: spec.flight.seconds,
        period: spec.flight.period,
        delay: spec.flight.delay + (el.classList.contains('tc-camp-d2') ? options.extraDelay : 0),
      } satisfies Flight,
    })),
  );
  const hide = (el: SVGElement): void => {
    el.setAttribute('opacity', '0');
    el.removeAttribute('transform');
  };
  for (const f of flights) hide(f.el);
  if (options.reduced) return () => undefined;

  const began = scheduler.now();
  let handle: unknown = null;
  let stopped = false;
  const frame = (): void => {
    if (stopped) return;
    const t = (scheduler.now() - began) / 1000;
    for (const f of flights) {
      const pose = poseAt(f.flight, t);
      const transform = flightTransform(f.flight, pose, f.faces);
      if (transform === null) {
        if (f.el.getAttribute('opacity') !== '0') hide(f.el);
      } else {
        f.el.setAttribute('opacity', '1');
        f.el.setAttribute('transform', transform);
      }
    }
    handle = scheduler.next(frame);
  };
  handle = scheduler.next(frame);
  return () => {
    stopped = true;
    if (handle !== null) scheduler.cancel(handle);
    for (const f of flights) hide(f.el);
  };
}

/**
 * Makes the hawk circle on a true oval. The picture nests three groups: `.tc-camp-hawk` moves it,
 * `.tc-camp-hawk-flip` turns it to face the way it flies, and `.tc-camp-hawk-bank` tilts it.
 * With reduced motion the hawk stays where the picture draws it. Returns a function that stops it.
 */
export function startHawk(
  root: ParentNode,
  scheduler: Scheduler,
  options: { reduced: boolean },
): () => void {
  const move = root.querySelector<SVGElement>('.tc-camp-hawk');
  const flip = root.querySelector<SVGElement>('.tc-camp-hawk-flip');
  const bank = root.querySelector<SVGElement>('.tc-camp-hawk-bank');
  if (options.reduced || !move || !flip || !bank) return () => undefined;
  const began = scheduler.now();
  let stopped = false;
  let handle: unknown = null;
  const frame = (): void => {
    if (stopped) return;
    const pose = hawkPose((scheduler.now() - began) / 1000);
    move.setAttribute('transform', `translate(${pose.x} ${pose.y})`);
    flip.setAttribute('transform', `scale(${pose.scaleX} 1)`);
    bank.setAttribute('transform', `rotate(${pose.tilt})`);
    handle = scheduler.next(frame);
  };
  handle = scheduler.next(frame);
  return () => {
    stopped = true;
    if (handle !== null) scheduler.cancel(handle);
    for (const el of [move, flip, bank]) el.removeAttribute('transform');
  };
}
