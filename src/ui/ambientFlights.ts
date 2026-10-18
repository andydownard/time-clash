// Drives the arrows, cannonball and missiles in a picture with real physics (flightPhysics.ts)
// instead of hand-drawn keyframes. Each one climbs, slows, peaks and falls onto its target, and
// turns its nose the way it is flying. Lasers are not here: a laser does not fall, so its straight
// line stays a plain animation. With reduced motion nothing flies.
import { poseAt, flightTransform, hawkPose, type Flight } from './flightPhysics';
import { HAWK_STILL, HAWK_STILL_AT, hawkPaints, type HawkPaint } from './hawkModel';

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

/** Gives a layer exactly `paints`, reusing its path elements so a frame makes no new garbage. */
function paintLayer(layer: Element, paints: readonly HawkPaint[]): void {
  const box = layer.querySelector('.tc-camp-hawk-paths');
  if (!box) return;
  const doc = box.ownerDocument;
  const have = box.children;
  while (have.length < paints.length) {
    box.append(doc.createElementNS('http://www.w3.org/2000/svg', 'path'));
  }
  while (have.length > paints.length) have[have.length - 1]!.remove();
  paints.forEach((p, i) => {
    const el = have[i]!;
    el.setAttribute('d', p.d);
    el.setAttribute('fill', p.fill);
    el.setAttribute('stroke', p.stroke);
    el.setAttribute('stroke-width', String(p.width));
    el.setAttribute('stroke-linejoin', 'round');
  });
}

/**
 * Makes the hawk circle a true 3D oval around the title. The picture has two hawk layers: `back`
 * sits under the title and `front` over it. On the far half of the circle the hawk is painted in
 * the back layer, small and a little dim. At each turn it moves to the other layer, and on the
 * near half it is painted in the front layer, larger and with a soft shadow. Each frame turns the
 * 3D bird to face the way it flies. With reduced motion the hawk stays as the picture draws it
 * (a still three-quarter pose). Returns a function that stops it.
 */
export function startHawk(
  root: ParentNode,
  scheduler: Scheduler,
  options: { reduced: boolean },
): () => void {
  const back = root.querySelector<SVGElement>('.tc-camp-hawk[data-layer="back"]');
  const front = root.querySelector<SVGElement>('.tc-camp-hawk[data-layer="front"]');
  if (options.reduced || !back) return () => undefined;
  const shade = front?.querySelector<SVGElement>('.tc-camp-hawk-shade');
  const began = scheduler.now();
  let stopped = false;
  let handle: unknown = null;
  const frame = (): void => {
    if (stopped) return;
    const pose = hawkPose((scheduler.now() - began) / 1000);
    const on = pose.front && front ? front : back;
    const off = on === back ? front : back;
    off?.setAttribute('display', 'none');
    off?.removeAttribute('transform');
    on.removeAttribute('display');
    on.setAttribute('transform', `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
    on.setAttribute('opacity', String(pose.opacity));
    shade?.setAttribute('opacity', String(pose.shadow));
    paintLayer(on, hawkPaints({ yaw: pose.yaw, flap: pose.flap }));
    handle = scheduler.next(frame);
  };
  handle = scheduler.next(frame);
  return () => {
    stopped = true;
    if (handle !== null) scheduler.cancel(handle);
    front?.removeAttribute('transform');
    front?.removeAttribute('opacity');
    back.setAttribute('transform', `translate(${HAWK_STILL_AT.x} ${HAWK_STILL_AT.y}) scale(${HAWK_STILL_AT.scale})`);
    back.removeAttribute('opacity');
    front?.setAttribute('display', 'none');
    shade?.setAttribute('opacity', '0');
    back.removeAttribute('display');
    if (front) paintLayer(front, []);
    paintLayer(back, hawkPaints(HAWK_STILL));
  };
}
