// Parses a single HTTP byte range (RFC 9110). iPad Safari needs 206 answers to play media.

export type RangeResult =
  { kind: 'full' } | { kind: 'partial'; start: number; end: number } | { kind: 'unsatisfiable' };

/** `end` is inclusive. Anything we cannot read as one range gets the full body (allowed). */
export function parseRange(header: string | undefined, size: number): RangeResult {
  if (header === undefined) return { kind: 'full' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return { kind: 'full' };
  const [, a = '', b = ''] = m;
  if (a === '' && b === '') return { kind: 'full' };
  if (a === '') {
    // Suffix: the last N bytes.
    const n = Number(b);
    if (!Number.isSafeInteger(n) || n === 0 || size === 0) return { kind: 'unsatisfiable' };
    return { kind: 'partial', start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(a);
  if (!Number.isSafeInteger(start) || start >= size) return { kind: 'unsatisfiable' };
  if (b === '') return { kind: 'partial', start, end: size - 1 };
  const end = Number(b);
  if (!Number.isSafeInteger(end) || end < start) return { kind: 'full' };
  return { kind: 'partial', start, end: Math.min(end, size - 1) };
}
