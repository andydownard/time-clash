// Copy lint helpers: find string literals in source files and check them against the banned
// word list (AGENTS.md risk 1). Plain functions so they can be tested on their own.

export type Extracted = { text: string; line: number };
export type Finding = { file: string; line: number; word: string; text: string };
export type AllowEntry = {
  /** Exact repo-relative path. No wildcards. */
  file: string;
  /** One of the banned words. */
  word: string;
  /** Why this use is fine. Required. */
  reason: string;
  /** Optional: only this exact string is allowed, not the whole file. */
  text?: string;
};

/** The banned list from AGENTS.md. */
export const BANNED_WORDS = [
  'kill',
  'die',
  'dead',
  'blood',
  'gore',
  'defeat',
  'buy',
  'price',
  'upgrade to pro',
] as const;

/** Whole-word patterns, with the simple inflections kids might meet in a sentence. */
const PATTERNS: Array<[string, RegExp]> = [
  ['kill', /\bkill(?:s|ed|ing|er|ers)?\b/i],
  ['die', /\b(?:die|dies|died|dying)\b/i],
  ['dead', /\bdead\b/i],
  ['blood', /\bblood(?:y)?\b/i],
  ['gore', /\b(?:gore|gory)\b/i],
  ['defeat', /\bdefeat(?:s|ed|ing)?\b/i],
  ['buy', /\b(?:buy|buys|buying|bought)\b/i],
  ['price', /\bpric(?:e|es|ed|ing)\b/i],
  ['upgrade to pro', /\bupgrade\s+to\s+pro\b/i],
];

export function findBanned(text: string): string[] {
  const out: string[] = [];
  for (const [word, re] of PATTERNS) if (re.test(text)) out.push(word);
  return out;
}

// ---------- TypeScript / JavaScript ----------

const REGEX_PRECEDERS = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '~',
  '^',
]);
const REGEX_KEYWORDS = new Set([
  'return',
  'typeof',
  'case',
  'delete',
  'void',
  'throw',
  'in',
  'of',
  'new',
]);

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0' };

/**
 * Returns every string literal in a TS/JS source, with comments and regex literals skipped.
 * Template text is returned in pieces around `${}`; code inside `${}` is scanned too.
 */
export function extractFromTs(src: string): Extracted[] {
  const out: Extracted[] = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  /** Each entry is a template whose `${` is open; value is the brace depth inside it. */
  const templates: number[] = [];
  let lastToken = '';
  let lastWord = '';

  const readTemplateText = (): void => {
    // Called with i just after "`" or after the "}" that closes a ${}.
    let buf = '';
    const startLine = line;
    while (i < n) {
      const c = src[i] as string;
      if (c === '\\') {
        const next = src[i + 1] ?? '';
        buf += ESCAPES[next] ?? next;
        if (next === '\n') line++;
        i += 2;
        continue;
      }
      if (c === '`') {
        i++;
        if (buf) out.push({ text: buf, line: startLine });
        return;
      }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        if (buf) out.push({ text: buf, line: startLine });
        templates.push(0);
        return;
      }
      if (c === '\n') line++;
      buf += c;
      i++;
    }
    if (buf) out.push({ text: buf, line: startLine });
  };

  while (i < n) {
    const c = src[i] as string;
    const next = src[i + 1];
    if (c === '\n') {
      line++;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const startLine = line;
      let buf = '';
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\') {
          const e = src[i + 1] ?? '';
          buf += ESCAPES[e] ?? e;
          i += 2;
          continue;
        }
        buf += src[i];
        i++;
      }
      i++;
      out.push({ text: buf, line: startLine });
      lastToken = 'str';
      lastWord = '';
      continue;
    }
    if (c === '`') {
      i++;
      readTemplateText();
      lastToken = 'str';
      lastWord = '';
      continue;
    }
    if (templates.length > 0) {
      if (c === '{') templates[templates.length - 1]!++;
      else if (c === '}') {
        if (templates[templates.length - 1] === 0) {
          templates.pop();
          i++;
          readTemplateText();
          continue;
        }
        templates[templates.length - 1]!--;
      }
    }
    if (c === '/') {
      const regexAllowed =
        lastToken === '' || REGEX_PRECEDERS.has(lastToken) || REGEX_KEYWORDS.has(lastWord);
      if (regexAllowed) {
        i++;
        let inClass = false;
        while (i < n && src[i] !== '\n') {
          const r = src[i] as string;
          if (r === '\\') {
            i += 2;
            continue;
          }
          if (r === '[') inClass = true;
          else if (r === ']') inClass = false;
          else if (r === '/' && !inClass) break;
          i++;
        }
        i++;
        while (i < n && /[a-z]/i.test(src[i] as string)) i++;
        lastToken = 'regex';
        lastWord = '';
        continue;
      }
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let w = '';
      while (i < n && /[\w$]/.test(src[i] as string)) w += src[i++];
      lastToken = 'word';
      lastWord = w;
      continue;
    }
    if (/\d/.test(c)) {
      while (i < n && /[\w.]/.test(src[i] as string)) i++;
      lastToken = 'num';
      lastWord = '';
      continue;
    }
    lastToken = c;
    lastWord = '';
    i++;
  }
  return out;
}

// ---------- JSON ----------

export function extractFromJson(raw: string): Extracted[] {
  const out: Extracted[] = [];
  try {
    const walk = (v: unknown): void => {
      if (typeof v === 'string') out.push({ text: v, line: 1 });
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(JSON.parse(raw));
    return out;
  } catch {
    const fallback: Extracted[] = [];
    for (const m of raw.matchAll(/"((?:[^"\\\n]|\\.)*)"/g))
      fallback.push({ text: m[1] as string, line: 1 });
    return fallback;
  }
}

// ---------- HTML ----------

const TEXT_ATTRS = ['alt', 'title', 'aria-label', 'placeholder', 'value', 'content'];

export function extractFromHtml(raw: string): Extracted[] {
  const out: Extracted[] = [];
  const cleaned = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  for (const m of cleaned.matchAll(/<[^>]+>|[^<]+/g)) {
    const piece = m[0];
    if (piece.startsWith('<')) {
      for (const a of piece.matchAll(/\s([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        if (TEXT_ATTRS.includes((a[1] as string).toLowerCase())) {
          out.push({ text: (a[2] ?? a[3]) as string, line: 1 });
        }
      }
    } else {
      const t = piece.replace(/\s+/g, ' ').trim();
      if (t) out.push({ text: t, line: 1 });
    }
  }
  return out;
}

// ---------- Allowlist ----------

export type AllowResult = {
  remaining: Finding[];
  /** Entries that matched no finding. Remove them. */
  unused: AllowEntry[];
  /** Entries that break the rules (no reason, unknown word, wildcard file). */
  invalid: AllowEntry[];
};

export function applyAllowlist(findings: Finding[], allow: readonly AllowEntry[]): AllowResult {
  const invalid = allow.filter(
    (e) =>
      !e.reason.trim() ||
      !(BANNED_WORDS as readonly string[]).includes(e.word) ||
      /[*?]/.test(e.file) ||
      !e.file.trim(),
  );
  const valid = allow.filter((e) => !invalid.includes(e));
  const used = new Set<AllowEntry>();
  const remaining = findings.filter((f) => {
    const hit = valid.find(
      (e) => e.file === f.file && e.word === f.word && (e.text === undefined || e.text === f.text),
    );
    if (hit) used.add(hit);
    return !hit;
  });
  return { remaining, unused: valid.filter((e) => !used.has(e)), invalid };
}

// ---------- Scanning a repo ----------

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function walk(dir: string, accept: (name: string) => boolean, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names.sort()) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, accept, out);
    else if (accept(name)) out.push(full);
  }
  return out;
}

/** Files the lint covers: src/**\/*.ts, src/**\/*.json (the question bank), public/*.html, index.html. */
export function listLintFiles(root: string): string[] {
  const files = [
    ...walk(join(root, 'src'), (n) => n.endsWith('.ts') || n.endsWith('.json')),
    ...walk(join(root, 'public'), (n) => n.endsWith('.html')).filter(
      (f) => relative(join(root, 'public'), f).split(sep).length === 1,
    ),
  ];
  const indexHtml = join(root, 'index.html');
  try {
    if (statSync(indexHtml).isFile()) files.push(indexHtml);
  } catch {
    /* no index.html */
  }
  return files;
}

export function scanRepo(root: string): { files: string[]; findings: Finding[] } {
  const files = listLintFiles(root);
  const findings: Finding[] = [];
  for (const abs of files) {
    const file = relative(root, abs).split(sep).join('/');
    const raw = readFileSync(abs, 'utf8');
    const strings = file.endsWith('.json')
      ? extractFromJson(raw)
      : file.endsWith('.html')
        ? extractFromHtml(raw)
        : extractFromTs(raw);
    for (const s of strings) {
      for (const word of findBanned(s.text))
        findings.push({ file, line: s.line, word, text: s.text });
    }
  }
  return { files: files.map((f) => relative(root, f).split(sep).join('/')), findings };
}
