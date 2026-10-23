// More prompt shapes for the answer-key recompute: lists (mean, median, range), slope, right
// triangles, rounding, equations, volume, sequences and more. Each shape matches a whole prompt,
// so a reworded prompt falls back to the "manual" tag instead of being guessed. Exact rationals only.
import {
  add,
  div,
  evaluateExpression,
  fromInt,
  makeRational,
  mul,
  parseDecimal,
  pow,
  sub,
  type Rational,
} from './mathEval';

const NUM = String.raw`\d+(?:\.\d+)?`;
const PI = parseDecimal('3.14')!;

/** Product that passes a missing value along. */
function times(a: Rational | null, b: Rational | null): Rational | null {
  return a && b ? mul(a, b) : null;
}

function num(text: string): Rational | null {
  return parseDecimal(text);
}

function int(text: string): bigint {
  return BigInt(text);
}

/** Signed whole number like "-3" to a Rational. */
function signed(text: string): Rational {
  return fromInt(BigInt(text));
}

/** The whole number whose square is n, or null. */
function exactRoot(n: bigint): bigint | null {
  if (n < 0n) return null;
  let r = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (r * r > n) r--;
  while ((r + 1n) * (r + 1n) <= n) r++;
  return r * r === n ? r : null;
}

function rootOf(sq: bigint): Rational | null {
  const r = exactRoot(sq);
  return r === null ? null : fromInt(r);
}

function listNumbers(text: string): bigint[] | null {
  if (!/^\d+(?:(?:, | and |, and )\d+)+$/.test(text)) return null;
  return (text.match(/\d+/g) ?? []).map(BigInt);
}

function sumOf(values: bigint[]): bigint {
  return values.reduce((a, b) => a + b, 0n);
}

function compareBig(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function roundTo(n: bigint, step: bigint): Rational {
  return fromInt(((n + step / 2n) / step) * step);
}

const STEPS: Record<string, bigint> = {
  ten: 10n,
  hundred: 100n,
  thousand: 1000n,
  'hundred thousand': 100000n,
};

/** The expression with x replaced by (value). The tokenizer reads a letter x as times, so swap first. */
function withX(expr: string, value: string): Rational | null {
  if (!/^[\dx+\-^ ().]+$/.test(expr)) return null;
  const swapped = expr
    .replace(/(\d)x/g, `$1 * (${value})`)
    .replace(/x/g, `(${value})`)
    .replace(/(\d|\))\(/g, '$1 * (');
  return evaluateExpression(swapped);
}

/** Solves left = right when both sides are straight lines in x. */
function solveLinear(left: string, right: string): Rational | null {
  const l0 = withX(left, '0');
  const l1 = withX(left, '1');
  const r0 = withX(right, '0');
  const r1 = withX(right, '1');
  if (!l0 || !l1 || !r0 || !r1) return null;
  const dl = sub(l1, l0);
  const dr = sub(r1, r0);
  const slope = dl && dr ? sub(dl, dr) : null;
  const gap = sub(r0, l0);
  return slope && gap ? div(gap, slope) : null;
}

/** Next term of a list that adds the same amount or multiplies by the same whole number. */
function nextTerm(values: bigint[]): Rational | null {
  if (values.length < 3) return null;
  const diffs = values.slice(1).map((v, i) => v - values[i]!);
  if (diffs.every((d) => d === diffs[0])) return fromInt(values[values.length - 1]! + diffs[0]!);
  const first = values[0]!;
  const second = values[1]!;
  if (first === 0n || second % first !== 0n) return null;
  const ratio = second / first;
  if (!values.slice(1).every((v, i) => v === values[i]! * ratio)) return null;
  return fromInt(values[values.length - 1]! * ratio);
}

function gcd(a: bigint, b: bigint): bigint {
  return b === 0n ? a : gcd(b, a % b);
}

function logOf(base: bigint, n: Rational): Rational | null {
  if (base < 2n) return null;
  for (let k = -20; k <= 40; k++) {
    const p = pow(fromInt(base), fromInt(k));
    if (p && p.n === n.n && p.d === n.d) return fromInt(k);
  }
  return null;
}

type Shape = (prompt: string) => Rational | null;

const shapes: Shape[] = [
  // What is the mean|median|range of 4, 8, 9, and 15?
  (p) => {
    const m = /^What is the (mean|median|range) of (.+)\?$/.exec(p);
    const values = m ? listNumbers(m[2]!) : null;
    if (!m || !values) return null;
    const sorted = [...values].sort(compareBig);
    const count = BigInt(sorted.length);
    if (m[1] === 'mean') return makeRational(sumOf(sorted), count);
    if (m[1] === 'range') return fromInt(sorted[sorted.length - 1]! - sorted[0]!);
    const mid = sorted.length >> 1;
    return sorted.length % 2 === 1
      ? fromInt(sorted[mid]!)
      : makeRational(sorted[mid - 1]! + sorted[mid]!, 2n);
  },
  // What is the slope of the line through (1, 2) and (3, 8)?   A line goes through the points ...
  (p) => {
    const pts = String.raw`\((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)`;
    const m =
      new RegExp(String.raw`^What is the slope of the line through ${pts}\?$`).exec(p) ??
      new RegExp(String.raw`^A line goes through the points ${pts}\. What is its slope\?$`).exec(p);
    if (!m) return null;
    return makeRational(int(m[4]!) - int(m[2]!), int(m[3]!) - int(m[1]!));
  },
  // Right triangle: legs to the long side, or the hypotenuse and a leg to the other leg.
  (p) => {
    const legs =
      /^A right triangle has (?:legs|short sides)(?: of)? (\d+) and (\d+)\. How long is the (?:longest|long) side\?$/.exec(
        p,
      );
    if (legs) return rootOf(int(legs[1]!) ** 2n + int(legs[2]!) ** 2n);
    const other =
      /^A right triangle has a hypotenuse of (\d+) and one leg of (\d+)\. How long is the other leg\?$/.exec(
        p,
      );
    if (other) return rootOf(int(other[1]!) ** 2n - int(other[2]!) ** 2n);
    const dist =
      /^(?:How far is the point \((-?\d+), (-?\d+)\) from the point \((-?\d+), (-?\d+)\)|What is the distance between the points \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\))\?$/.exec(
        p,
      );
    if (dist) {
      const v = dist
        .slice(1)
        .filter((s) => s !== undefined)
        .map(int);
      return rootOf((v[2]! - v[0]!) ** 2n + (v[3]! - v[1]!) ** 2n);
    }
    return null;
  },
  // Round 47 to the nearest ten.   What is 4,672 rounded to the nearest hundred?
  (p) => {
    const m =
      /^Round ([\d,]+) to the nearest (ten|hundred|thousand|hundred thousand)\.$/.exec(p) ??
      /^What is ([\d,]+) rounded to the nearest (ten|hundred|thousand|hundred thousand)\?$/.exec(p);
    if (!m || !/^\d{1,3}(?:,\d{3})*$|^\d+$/.test(m[1]!)) return null;
    return roundTo(int(m[1]!.replace(/,/g, '')), STEPS[m[2]!]!);
  },
  // What is the square root of 169?   (also: ... of 144 plus the square root of 25)
  (p) => {
    const m =
      /^What is the (square|cube) root of (\d+)(?: plus the (square|cube) root of (\d+))?\?$/.exec(
        p,
      );
    if (!m) return null;
    const root = (kind: string, n: bigint): Rational | null => {
      if (kind === 'square') return rootOf(n);
      for (let k = 0n; k <= 1000n; k++) if (k * k * k === n) return fromInt(k);
      return null;
    };
    const a = root(m[1]!, int(m[2]!));
    if (!m[3]) return a;
    const b = root(m[3], int(m[4]!));
    return a && b ? add(a, b) : null;
  },
  // Solve for x: 3x + 5 = 2x + 12   A knight solves 5x - 4 = 3x + 10. What is x?
  (p) => {
    const m =
      /^Solve for x: (.+) = (.+)$/.exec(p) ?? /^A knight solves (.+) = (.+)\. What is x\?$/.exec(p);
    return m ? solveLinear(m[1]!, m[2]!) : null;
  },
  // Evaluate an expression in x at a point.
  (p) => {
    const m =
      /^What is (.+) when x = (-?\d+)\?$/.exec(p) ??
      /^If f\(x\) = (.+), what is f\((-?\d+)\)\?$/.exec(p) ??
      /^For the line y = (.+), what is y when x = (-?\d+)\?$/.exec(p) ??
      /^A hoverboard track follows y = (.+)\. What is y when x = (-?\d+)\?$/.exec(p);
    return m ? withX(m[1]!, m[2]!) : null;
  },
  // Cylinder, cone and sphere volume, and circle area and circumference, with 3.14.
  (p) => {
    const cyl =
      /^A cylinder(?: drum)? has radius (\d+) and height (\d+)\. Use 3\.14\. What is its volume\?$/.exec(
        p,
      );
    if (cyl) return times(times(PI, fromInt(int(cyl[1]!) ** 2n)), signed(cyl[2]!));
    const cone =
      /^A cone(?:-shaped wizard hat)? has radius (\d+) and height (\d+)\. Use 3\.14\. What is its volume\?$/.exec(
        p,
      );
    if (cone) {
      const base = times(times(PI, fromInt(int(cone[1]!) ** 2n)), signed(cone[2]!));
      return base ? div(base, fromInt(3)) : null;
    }
    const sphere =
      /^A (?:cannonball )?sphere has radius (\d+)\. Use 3\.14\. What is its volume\?$/.exec(p);
    if (sphere) {
      const cubed = times(times(PI, fromInt(int(sphere[1]!) ** 3n)), fromInt(4));
      return cubed ? div(cubed, fromInt(3)) : null;
    }
    const circle =
      /(radius|diameter) of (\d+)[^.]*\. What is its (area|circumference)[^?]*\? Use 3\.14\.$/.exec(
        p,
      );
    if (circle) {
      const given = signed(circle[2]!);
      const r = circle[1] === 'radius' ? given : div(given, fromInt(2));
      if (!r) return null;
      return circle[3] === 'area' ? times(times(PI, r), r) : times(times(PI, r), fromInt(2));
    }
    return null;
  },
  // Box volume, cube volume.
  (p) => {
    const box = new RegExp(
      String.raw`^A [\w ]+? is (${NUM})(?: \w+)? long, (${NUM})(?: \w+)? wide, and (${NUM})(?: \w+)? (?:tall|high|deep)\. What is its volume(?: in cubic \w+)?\?$`,
    ).exec(p);
    if (box) {
      const [a, b, c] = [num(box[1]!), num(box[2]!), num(box[3]!)];
      const ab = a && b ? times(a, b) : null;
      return ab && c ? times(ab, c) : null;
    }
    const cube =
      /^A cube has sides of (\d+) inches\. What is its volume in cubic inches\?$/.exec(p) ??
      /^What is the volume of a cube with side length (\d+)\?$/.exec(p);
    return cube ? fromInt(int(cube[1]!) ** 3n) : null;
  },
  // Rectangle perimeter, square perimeter, square area from the perimeter.
  (p) => {
    const rect =
      /^A rectangle is (\d+)(?: units)? long and (\d+)(?: units)? wide\. (?:What is the distance all the way around it|How far is it around the edge|What is the distance around it|What is its perimeter)\?$/.exec(
        p,
      );
    if (rect) return fromInt(2n * (int(rect[1]!) + int(rect[2]!)));
    const square = /^A square flag has sides of (\d+) units\. What is its perimeter\?$/.exec(p);
    if (square) return fromInt(4n * int(square[1]!));
    const side = /^A square courtyard has a perimeter of (\d+) feet\. How long is one side\?$/.exec(
      p,
    );
    if (side) return makeRational(int(side[1]!), 4n);
    const area = /^A square has a perimeter of (\d+)\. What is its area\?$/.exec(p);
    if (area) {
      const s = makeRational(int(area[1]!), 4n);
      return s ? times(s, s) : null;
    }
    return null;
  },
  // Triangle area, and the third angle.
  (p) => {
    if (/triang/.test(p) && /What is (?:its|the) area|area\?/.test(p) && !/area of \d/.test(p)) {
      const m = /base (?:of )?(\d+)(?: \w+)?,? (?:and )?(?:a )?height (?:of )?(\d+)/.exec(p);
      if (m) return makeRational(int(m[1]!) * int(m[2]!), 2n);
    }
    if (/triangle/.test(p) && /third/.test(p)) {
      const nums = (p.match(/\d+/g) ?? []).map(BigInt);
      if (nums[0] === 180n) nums.shift();
      if (nums.length === 2) return fromInt(180n - nums[0]! - nums[1]!);
    }
    const other =
      /^(?:A straight angle is 180 degrees|Two angles on a straight line add up to 180 degrees)\. One angle is (\d+) degrees\. (?:What is|How big is) the other angle\?$/.exec(
        p,
      );
    return other ? fromInt(180n - int(other[1]!)) : null;
  },
  // Ratio: The ratio of cats to dogs is 3 to 5. There are 15 dogs. How many cats are there?
  (p) => {
    const m =
      /^The ratio of (\w+) to (\w+) is (\d+) to (\d+)\. There are (\d+) (\w+)\. How many (\w+) are there\?$/.exec(
        p,
      );
    if (!m || m[6] !== m[2] || m[7] !== m[1]) return null;
    const unit = makeRational(int(m[5]!), int(m[4]!));
    return unit ? times(unit, signed(m[3]!)) : null;
  },
  // 5 jam tarts cost $40. At the same rate, how much do 8 jam tarts cost?
  (p) => {
    const m =
      /^(\d+) ([\w ]+?) cost \$(\d+)\. At the same rate, (?:how much do|what do) (\d+) \2 cost(?:,? in dollars)?\?$/.exec(
        p,
      );
    if (!m) return null;
    const each = makeRational(int(m[3]!), int(m[1]!));
    return each ? times(each, signed(m[4]!)) : null;
  },
  // Count by 5s: 5, 10, 15, 20, ___      What number comes next? 3, 6, 12, 24, ...
  (p) => {
    const m =
      /^Count by (?:tens|\d+s): (\d+(?:, \d+)+)(?:, _+|\. What number comes next\?)$/.exec(p) ??
      /^What number comes next\?:? (\d+(?:, \d+)+),? (?:\?|\.\.\.)$/.exec(p) ??
      /^What number comes next: (\d+(?:, \d+)+), \.\.\.\?$/.exec(p);
    return m ? nextTerm(m[1]!.split(', ').map(BigInt)) : null;
  },
  // Number order: after, before, one more, one less, 10 more, 100 less.
  (p) => {
    const near = /^(?:Which|What) number comes (?:right )?(after|before) (\d+)\?$/.exec(p);
    if (near) return fromInt(int(near[2]!) + (near[1] === 'after' ? 1n : -1n));
    const gap =
      /^(?:What is|What number is|Which number is) (one|\d+) (more|less) than (\d+)\?$/.exec(p);
    if (!gap) return null;
    const by = gap[1] === 'one' ? 1n : int(gap[1]!);
    return fromInt(int(gap[3]!) + (gap[2] === 'more' ? by : -by));
  },
  // Whole-number division leftovers and floors.
  (p) => {
    const rem = /^What is the remainder of (\d+) \/ (\d+)\?$/.exec(p);
    if (rem && int(rem[2]!) > 0n) return fromInt(int(rem[1]!) % int(rem[2]!));
    const floor = /^What is (\d+) \/ (\d+), rounded down to a whole number\?$/.exec(p);
    if (floor && int(floor[2]!) > 0n) return fromInt(int(floor[1]!) / int(floor[2]!));
    const full =
      /^(\d+) \w+ sit at tables of (\d+)\. How many tables are completely full\?$/.exec(p) ??
      /^Robots pack (\d+) bolts into boxes of (\d+)\. How many boxes are completely full\?$/.exec(
        p,
      );
    if (full && int(full[2]!) > 0n) return fromInt(int(full[1]!) / int(full[2]!));
    const left =
      /^(\d+) stickers are shared by (\d+) friends equally\. How many are left over\?$/.exec(p);
    return left && int(left[2]!) > 0n ? fromInt(int(left[1]!) % int(left[2]!)) : null;
  },
  // Factors, multiples, GCF, LCM, factorial, absolute value, diameter.
  (p) => {
    const factors = /^How many factors does (\d+) have\?/.exec(p);
    if (factors) {
      const n = int(factors[1]!);
      let count = 0n;
      for (let d = 1n; d <= n; d++) if (n % d === 0n) count++;
      return fromInt(count);
    }
    const next = /^What is the next multiple of (\d+) after (\d+)\?$/.exec(p);
    if (next) {
      const step = int(next[1]!);
      return step > 0n ? fromInt((int(next[2]!) / step + 1n) * step) : null;
    }
    const pair =
      /^What is the (greatest common factor|least common multiple) of (\d+) and (\d+)\?$/.exec(p);
    if (pair) {
      const [a, b] = [int(pair[2]!), int(pair[3]!)];
      const g = gcd(a, b);
      if (g === 0n) return null;
      return fromInt(pair[1] === 'greatest common factor' ? g : (a / g) * b);
    }
    const fact = /^What is (\d+)! \(\w+ factorial\)\?$/.exec(p);
    if (fact && int(fact[1]!) <= 20n) {
      let f = 1n;
      for (let i = 2n; i <= int(fact[1]!); i++) f *= i;
      return fromInt(f);
    }
    const abs = /^What is the absolute value of (-?\d+)\?$/.exec(p);
    if (abs) return fromInt(int(abs[1]!) < 0n ? -int(abs[1]!) : int(abs[1]!));
    const diameter =
      /^A circle has a radius of (\d+)\. What is its diameter\?$/.exec(p) ??
      /^What is the diameter of a circle with a radius of (\d+)\?$/.exec(p);
    return diameter ? fromInt(2n * int(diameter[1]!)) : null;
  },
  // Logarithms with a whole-number answer.
  (p) => {
    const m =
      new RegExp(String.raw`^What is log base (\d+) of (${NUM})\?$`).exec(p) ??
      new RegExp(String.raw`^What is the log of (${NUM}) in base (\d+)\?$`).exec(p);
    if (!m) return null;
    const swap = p.startsWith('What is the log of');
    const n = num(swap ? m[1]! : m[2]!);
    return n ? logOf(int(swap ? m[2]! : m[1]!), n) : null;
  },
];

/** Value for the extra prompt shapes, or null when no shape matches the whole prompt. */
export function recomputeMore(prompt: string): Rational | null {
  for (const shape of shapes) {
    const v = shape(prompt);
    if (v) return v;
  }
  return null;
}
