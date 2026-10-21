// The bowyer's pose on the Past Forge picture, as plain numbers. The picture is a pair of
// two-bone arms (shoulder, elbow, hand) that hold a two-handled carving knife (a draw knife).
// The hands follow the knife along the bow stave. The CSS keyframes in ui.css are made from these
// numbers, and tests/ui/forgePose.test.ts checks that the two still agree.
// All lengths are in the picture's own units (its viewBox is 1600 by 900).

export type Point = { x: number; y: number };

/** Where the bowyer's shoulder sits in the picture. */
export const SHOULDER: Point = { x: 385, y: 692 };
/** How far each elbow is bent, in degrees from the line between shoulder and hand. */
export const ARM_BEND_DEG = 28;
/** Height of the hands on the knife handles when the knife rests on the stave. */
export const HAND_Y = 680;
/** Where the near and far handles sit across the stave when the knife is at rest. */
export const HANDLE_X = { near: 575, far: 615 } as const;
/** One loop, in seconds. Chips pop with each stroke, so the loop is calm: 2 to 3 seconds. */
export const BOW_LOOP_SECONDS = 2.4;
/** How far the knife travels each way from its rest spot, and how high it lifts between strokes. */
export const STROKE_REACH = 30;
export const LIFT = 8;

/** Knife position over the loop: percent of the loop, slide (+ is away from her), lift (up). */
export const KNIFE_KEYS: readonly { pct: number; slide: number; lift: number }[] = [
  { pct: 0, slide: STROKE_REACH, lift: LIFT },
  { pct: 6, slide: STROKE_REACH, lift: 0 },
  { pct: 46, slide: -STROKE_REACH, lift: 0 },
  { pct: 54, slide: -STROKE_REACH, lift: LIFT },
  { pct: 92, slide: STROKE_REACH, lift: LIFT },
  { pct: 100, slide: STROKE_REACH, lift: LIFT },
];

/** Knife slide and lift at any point in the loop, by straight lines between the keys. */
export function knifeAt(pct: number): { slide: number; lift: number } {
  const keys = KNIFE_KEYS;
  const p = Math.min(100, Math.max(0, pct));
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (p <= b.pct) {
      const f = b.pct === a.pct ? 0 : (p - a.pct) / (b.pct - a.pct);
      return { slide: a.slide + (b.slide - a.slide) * f, lift: a.lift + (b.lift - a.lift) * f };
    }
  }
  const last = keys[keys.length - 1]!;
  return { slide: last.slide, lift: last.lift };
}

/** Percent marks where the arms and knife get a keyframe: every 4 percent plus the key marks. */
export function sampleMarks(): number[] {
  const set = new Set<number>(KNIFE_KEYS.map((k) => k.pct));
  for (let p = 0; p <= 100; p += 4) set.add(p);
  return [...set].sort((a, b) => a - b);
}

const DEG = 180 / Math.PI;

/**
 * The cartoon arm. Each arm has two equal bones that stretch a little as the hand moves, with the
 * elbow always bent the same amount, so the elbow stays below the line from shoulder to hand.
 */
export type ArmPose = {
  /** Upper arm angle in degrees from straight right (clockwise is positive, as in SVG). */
  upper: number;
  /** Length of each of the two bones. */
  bone: number;
};

/** Pose that puts the hand on `hand`. The forearm turns back by twice the bend, always. */
export function armPose(shoulder: Point, hand: Point): ArmPose {
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const bend = ARM_BEND_DEG / DEG;
  return {
    upper: Math.atan2(dy, dx) * DEG + ARM_BEND_DEG,
    bone: Math.hypot(dx, dy) / (2 * Math.cos(bend)),
  };
}

/** Forward kinematics: where the hand ends up for this pose. */
export function handFrom(shoulder: Point, pose: ArmPose): Point {
  const a = pose.upper / DEG;
  const b = (pose.upper - 2 * ARM_BEND_DEG) / DEG;
  return {
    x: shoulder.x + pose.bone * (Math.cos(a) + Math.cos(b)),
    y: shoulder.y + pose.bone * (Math.sin(a) + Math.sin(b)),
  };
}

export type Handle = keyof typeof HANDLE_X;

/** Where a hand is, at a point in the loop. */
export function handAt(handle: Handle, pct: number): Point {
  const { slide, lift } = knifeAt(pct);
  return { x: HANDLE_X[handle] + slide, y: HAND_Y - lift };
}

/** The arm pose for a hand at a point in the loop. */
export function armAt(handle: Handle, pct: number): ArmPose {
  return armPose(SHOULDER, handAt(handle, pct));
}

const r = (n: number): string => String(Math.round(n * 100) / 100);

/** The CSS keyframes for the arms and the knife, ready to paste into ui.css. */
export function bowKeyframesCss(): string {
  const marks = sampleMarks();
  const block = (name: string, body: (pct: number) => string): string =>
    `@keyframes ${name} {\n${marks.map((p) => `  ${p}% {\n    transform: ${body(p)};\n  }`).join('\n')}\n}`;
  const out: string[] = [];
  for (const h of ['near', 'far'] as const) {
    out.push(block(`tc-forge-${h}-upper`, (p) => `rotate(${r(armAt(h, p).upper)}deg)`));
    out.push(block(`tc-forge-${h}-bone`, (p) => `scale(${r(armAt(h, p).bone)}, 1)`));
    out.push(block(`tc-forge-${h}-reach`, (p) => `translate(${r(armAt(h, p).bone)}px, 0)`));
  }
  out.push(
    block('tc-forge-knife', (p) => {
      const k = knifeAt(p);
      return `translate(${r(k.slide)}px, ${r(-k.lift)}px)`;
    }),
  );
  return out.join('\n');
}
