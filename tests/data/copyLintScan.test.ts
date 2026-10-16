import { describe, expect, it } from 'vitest';
import {
  applyAllowlist,
  extractFromHtml,
  extractFromJson,
  extractFromTs,
  findBanned,
  type AllowEntry,
  type Finding,
} from './copyLintScan';

const strings = (src: string) => extractFromTs(src).map((s) => s.text);

describe('extractFromTs', () => {
  it('finds single, double, and template strings', () => {
    expect(strings(`const a = 'one'; const b = "two"; const c = \`three\`;`)).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  it('handles escapes', () => {
    expect(strings(`const a = 'it\\'s fine'; const b = "say \\"hi\\"";`)).toEqual([
      "it's fine",
      'say "hi"',
    ]);
  });

  it('ignores line and block comments, even with apostrophes', () => {
    const src = `// don't kill the vibe\n/* it's "dead" here */\nconst a = 'ok';`;
    expect(strings(src)).toEqual(['ok']);
  });

  it('keeps comment-like text inside strings', () => {
    expect(strings(`const a = 'http://x // not a comment';`)).toEqual([
      'http://x // not a comment',
    ]);
  });

  it('reads template text around ${} and code inside it', () => {
    const src = 'const a = `Hello ${name + "there"} and ${n}!`;';
    expect(strings(src)).toEqual(['Hello ', 'there', ' and ', '!']);
  });

  it('survives nested templates', () => {
    const src = 'const a = `a${`b${1}c`}d`;';
    expect(strings(src)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not treat a regex literal with a quote as a string start', () => {
    const src = `const re = /['"]/g; const a = 'after';`;
    expect(strings(src)).toEqual(['after']);
  });

  it('treats division as division, not a regex', () => {
    const src = `const x = a / 2; const y = 'real';`;
    expect(strings(src)).toEqual(['real']);
  });

  it('reports line numbers', () => {
    const found = extractFromTs(`const a = 1;\n\nconst b = 'x';`);
    expect(found).toEqual([{ text: 'x', line: 3 }]);
  });

  it('does not hang on an unterminated string', () => {
    expect(() => extractFromTs(`const a = 'oops`)).not.toThrow();
  });
});

describe('extractFromJson', () => {
  it('walks nested values and arrays, not keys', () => {
    const json = JSON.stringify({ kill: 'a', list: ['b', { deep: 'c' }], n: 3, ok: true });
    expect(extractFromJson(json).map((s) => s.text)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to quoted strings when the JSON is broken', () => {
    expect(extractFromJson('{"a": "x", oops "y"').map((s) => s.text)).toEqual(
      expect.arrayContaining(['x', 'y']),
    );
  });
});

describe('extractFromHtml', () => {
  it('reads text, title, and common attributes; skips scripts and styles', () => {
    const html = `<!doctype html><html><head><title>Time Clash</title><style>.kill{}</style>
      <script>var dead = 1;</script><!-- die --></head>
      <body><p>Hello kids</p><button aria-label="Go now" data-x="skip">OK</button><img alt="A knight"></body></html>`;
    const text = extractFromHtml(html).map((s) => s.text);
    expect(text).toEqual(
      expect.arrayContaining(['Time Clash', 'Hello kids', 'Go now', 'OK', 'A knight']),
    );
    expect(text.join(' ')).not.toMatch(/kill|dead|die\b/);
  });
});

describe('findBanned', () => {
  it.each(['kill', 'die', 'dead', 'blood', 'gore', 'defeat', 'buy', 'price', 'upgrade to pro'])(
    'flags "%s"',
    (w) => {
      expect(findBanned(`You can ${w} it`)).toContain(w);
    },
  );

  it('matches whole words, any case', () => {
    expect(findBanned('KILL the lights')).toEqual(['kill']);
  });

  it('flags simple inflections', () => {
    expect(findBanned('it kills and killed and dies and died and prices and buying')).toEqual(
      expect.arrayContaining(['kill', 'die', 'price', 'buy']),
    );
  });

  it('does not flag words that merely contain them', () => {
    expect(findBanned('skill, diet, deadline, ignore, Diego, undeadly, Gorey, priceless')).toEqual(
      [],
    );
  });

  it('flags upgrade to pro across spacing and case', () => {
    expect(findBanned('Upgrade  to PRO now')).toContain('upgrade to pro');
  });

  it('returns each word once', () => {
    expect(findBanned('kill kill kill')).toEqual(['kill']);
  });

  it('is safe on empty and non-matching text', () => {
    expect(findBanned('')).toEqual([]);
    expect(findBanned('Nice try! The answer is 7.')).toEqual([]);
  });
});

describe('applyAllowlist', () => {
  const finding = (file: string, word: string, text = `the ${word}`): Finding => ({
    file,
    line: 1,
    word,
    text,
  });
  const entry = (over: Partial<AllowEntry> = {}): AllowEntry => ({
    file: 'src/a.ts',
    word: 'die',
    reason: 'A name blocklist must contain the word.',
    ...over,
  });

  it('removes a finding that matches file and word', () => {
    const r = applyAllowlist([finding('src/a.ts', 'die')], [entry()]);
    expect(r.remaining).toEqual([]);
    expect(r.unused).toEqual([]);
    expect(r.invalid).toEqual([]);
  });

  it('does not hide a different word in the same file', () => {
    const r = applyAllowlist([finding('src/a.ts', 'kill')], [entry()]);
    expect(r.remaining).toHaveLength(1);
    expect(r.unused).toHaveLength(1);
  });

  it('does not hide the same word in a different file', () => {
    const r = applyAllowlist([finding('src/b.ts', 'die')], [entry()]);
    expect(r.remaining).toHaveLength(1);
  });

  it('can be narrowed to one exact string', () => {
    const e = entry({ text: 'the die is cast' });
    const r = applyAllowlist(
      [finding('src/a.ts', 'die', 'the die is cast'), finding('src/a.ts', 'die', 'please die')],
      [e],
    );
    expect(r.remaining.map((f) => f.text)).toEqual(['please die']);
  });

  it('reports an entry that matched nothing (stale)', () => {
    const r = applyAllowlist([], [entry()]);
    expect(r.unused).toEqual([entry()]);
  });

  it('rejects an entry with no reason', () => {
    const r = applyAllowlist([finding('src/a.ts', 'die')], [entry({ reason: '   ' })]);
    expect(r.invalid).toHaveLength(1);
    expect(r.remaining).toHaveLength(1);
  });

  it('rejects an entry for a word that is not on the banned list', () => {
    const r = applyAllowlist([], [entry({ word: 'puppy' })]);
    expect(r.invalid).toHaveLength(1);
  });

  it('rejects a wildcard file', () => {
    const r = applyAllowlist([finding('src/a.ts', 'die')], [entry({ file: 'src/**' })]);
    expect(r.invalid).toHaveLength(1);
    expect(r.remaining).toHaveLength(1);
  });
});
