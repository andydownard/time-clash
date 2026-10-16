// A tiny, safe arithmetic evaluator for the question checker. No eval, no Function.
// Works in exact rational numbers (bigint), so 1/3 + 1/6 is exactly 1/2.

export type Rational = { readonly n: bigint; readonly d: bigint }; // d > 0, lowest terms

const MAX_INPUT_LENGTH = 200;
const MAX_DIGITS = 60; // cap on digits of numerator or denominator
const MAX_EXPONENT = 64;
const MAX_DEPTH = 50;

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** Returns null when the value is too big or has a zero denominator. */
export function makeRational(n: bigint, d: bigint): Rational | null {
  if (d === 0n) return null;
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d) || 1n;
  const r = { n: (sign * n) / g, d: (sign * d) / g };
  if (r.n.toString().length > MAX_DIGITS || r.d.toString().length > MAX_DIGITS) return null;
  return r;
}

export function add(a: Rational, b: Rational): Rational | null {
  return makeRational(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function sub(a: Rational, b: Rational): Rational | null {
  return makeRational(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function mul(a: Rational, b: Rational): Rational | null {
  return makeRational(a.n * b.n, a.d * b.d);
}
export function div(a: Rational, b: Rational): Rational | null {
  if (b.n === 0n) return null;
  return makeRational(a.n * b.d, a.d * b.n);
}
export function pow(a: Rational, e: Rational): Rational | null {
  if (e.d !== 1n) return null; // whole-number exponents only
  const k = e.n < 0n ? -e.n : e.n;
  if (k > BigInt(MAX_EXPONENT)) return null;
  if (e.n < 0n && a.n === 0n) return null;
  const count = Number(k);
  let n = 1n;
  let d = 1n;
  for (let i = 0; i < count; i++) {
    n *= a.n;
    d *= a.d;
    if (n.toString().length > MAX_DIGITS * 2 || d.toString().length > MAX_DIGITS * 2) return null;
  }
  return e.n < 0n ? makeRational(d, n) : makeRational(n, d);
}

export function fromInt(n: number | bigint): Rational {
  return { n: BigInt(n), d: 1n };
}

/** "12" or "0.25" (no sign, no exponent) to a Rational, else null. */
export function parseDecimal(text: string): Rational | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const frac = m[2] ?? '';
  return makeRational(BigInt(m[1]! + frac), 10n ** BigInt(frac.length));
}

/** Canonical text: "5", "-3", or "a/b" in lowest terms. */
export function formatRational(r: Rational): string {
  return r.d === 1n ? r.n.toString() : `${r.n}/${r.d}`;
}

/**
 * Parses what a child might see as an answer: "-5", "0.75", "3/4", "1,000".
 * Returns null for anything else.
 */
export function parseAnswerValue(text: string): Rational | null {
  const t = text.trim();
  let m = /^(-?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(t);
  if (m) {
    const r = parseDecimal(`${m[2]!.replace(/,/g, '')}${m[3] ? `.${m[3]}` : ''}`);
    return r && m[1] ? makeRational(-r.n, r.d) : r;
  }
  m = /^(-?)(\d+)\/(\d+)$/.exec(t);
  if (m) {
    const n = BigInt(m[2]!);
    return makeRational(m[1] ? -n : n, BigInt(m[3]!));
  }
  return null;
}

export function equalRational(a: Rational, b: Rational): boolean {
  return a.n === b.n && a.d === b.d;
}

// ---------- Expression parser ----------

type Token =
  | { t: 'num'; v: Rational }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: 'paren'; v: '(' | ')' };

function tokenize(src: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ' || c === '\t') {
      i++;
    } else if (/\d/.test(c)) {
      const m = /^\d+(?:\.\d+)?/.exec(src.slice(i))!;
      const v = parseDecimal(m[0]);
      if (!v) return null;
      tokens.push({ t: 'num', v });
      i += m[0].length;
    } else if (c === '+' || c === '-' || c === '/' || c === '^') {
      tokens.push({ t: 'op', v: c });
      i++;
    } else if (c === 'x' || c === '*' || c === '×') {
      tokens.push({ t: 'op', v: '*' });
      i++;
    } else if (c === '÷') {
      tokens.push({ t: 'op', v: '/' });
      i++;
    } else if (c === '(' || c === ')') {
      tokens.push({ t: 'paren', v: c });
      i++;
    } else {
      return null;
    }
  }
  return tokens;
}

class Failure extends Error {}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Rational {
    const v = this.expr(0);
    if (this.pos !== this.tokens.length) throw new Failure('trailing tokens');
    return v;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private ok(r: Rational | null): Rational {
    if (!r) throw new Failure('bad value');
    return r;
  }

  // expr = term (('+' | '-') term)*
  private expr(depth: number): Rational {
    let left = this.term(depth);
    for (;;) {
      const tok = this.peek();
      if (tok?.t === 'op' && (tok.v === '+' || tok.v === '-')) {
        this.pos++;
        const right = this.term(depth);
        left = this.ok(tok.v === '+' ? add(left, right) : sub(left, right));
      } else return left;
    }
  }

  // term = unary (('*' | '/') unary)*
  private term(depth: number): Rational {
    let left = this.unary(depth);
    for (;;) {
      const tok = this.peek();
      if (tok?.t === 'op' && (tok.v === '*' || tok.v === '/')) {
        this.pos++;
        const right = this.unary(depth);
        left = this.ok(tok.v === '*' ? mul(left, right) : div(left, right));
      } else return left;
    }
  }

  // unary = '-' unary | power   (so -2^2 is -4)
  private unary(depth: number): Rational {
    const tok = this.peek();
    if (tok?.t === 'op' && tok.v === '-') {
      this.pos++;
      const v = this.unary(depth);
      return this.ok(makeRational(-v.n, v.d));
    }
    return this.power(depth);
  }

  // power = atom ('^' unary)?   (right associative)
  private power(depth: number): Rational {
    const base = this.atom(depth);
    const tok = this.peek();
    if (tok?.t === 'op' && tok.v === '^') {
      this.pos++;
      const e = this.unary(depth);
      return this.ok(pow(base, e));
    }
    return base;
  }

  private atom(depth: number): Rational {
    if (depth > MAX_DEPTH) throw new Failure('too deep');
    const tok = this.peek();
    if (tok?.t === 'num') {
      this.pos++;
      return tok.v;
    }
    if (tok?.t === 'paren' && tok.v === '(') {
      this.pos++;
      const v = this.expr(depth + 1);
      const close = this.peek();
      if (close?.t !== 'paren' || close.v !== ')') throw new Failure('missing )');
      this.pos++;
      return v;
    }
    throw new Failure('unexpected token');
  }
}

/**
 * Evaluates an arithmetic expression using + - x * / ^ and parentheses.
 * Returns null for anything it cannot evaluate exactly (bad syntax, divide by zero, huge numbers).
 */
export function evaluateExpression(src: string): Rational | null {
  if (src.length === 0 || src.length > MAX_INPUT_LENGTH) return null;
  const tokens = tokenize(src);
  if (!tokens || tokens.length === 0) return null;
  try {
    return new Parser(tokens).parse();
  } catch (e) {
    if (e instanceof Failure) return null;
    throw e;
  }
}
