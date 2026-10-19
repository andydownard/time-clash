import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAIRS, contrastTable, ratio, tokensCss, vars } from './designPairs';

const root = new URL('../../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const px = (name: string) => {
  const m = /^(\d+(?:\.\d+)?)px$/.exec(vars[name] ?? '');
  if (!m) throw new Error(`${name} is not a px value: ${vars[name]}`);
  return Number(m[1]);
};

describe('palette values from the design handoff', () => {
  it.each([
    ['--tc-blue-100', '#e1eaff'],
    ['--tc-blue-300', '#86a9ff'],
    ['--tc-blue-500', '#2f6bff'],
    ['--tc-blue-700', '#1a3fb5'],
    ['--tc-blue-900', '#0a1a4f'],
    ['--tc-purple-100', '#efe6ff'],
    ['--tc-purple-300', '#bc9cff'],
    ['--tc-purple-500', '#8247e8'],
    ['--tc-purple-700', '#5a28b8'],
    ['--tc-purple-900', '#25104f'],
    ['--tc-ink-deep', '#12102b'],
    ['--tc-parchment-warm', '#f7ebcb'],
    ['--tc-oak', '#7a4a24'],
    ['--tc-steel-blue', '#9aa8bd'],
    ['--tc-ember', '#ffb23e'],
    ['--tc-pulse', '#4fd8ff'],
  ])('%s is %s', (name, hex) => {
    expect(vars[name]?.toLowerCase()).toBe(hex);
  });
});

describe('contrast of every pair in docs/DESIGN_SYSTEM.md', () => {
  it.each(PAIRS.map((p) => [p.name, p] as const))('%s', (_n, p) => {
    expect(ratio(p)).toBeGreaterThanOrEqual(p.min);
  });
  it('the doc table matches the tokens', () => {
    expect(read('docs/DESIGN_SYSTEM.md')).toContain(contrastTable());
  });
  it('Steel is never used as a text color in the pair list', () => {
    expect(PAIRS.some((p) => p.min === 4.5 && p.fg === '--tc-steel-blue')).toBe(false);
  });
});

describe('sizes', () => {
  it('every type size is at least 20px', () => {
    const sizes = Object.keys(vars).filter((k) => k.startsWith('--tc-fs-'));
    expect(sizes.length).toBeGreaterThanOrEqual(7);
    for (const s of sizes) expect(px(s), s).toBeGreaterThanOrEqual(20);
  });
  it('tap targets are at least 56px', () => {
    expect(px('--tc-tap')).toBeGreaterThanOrEqual(56);
    expect(px('--tc-chip-min')).toBeGreaterThanOrEqual(56);
    expect(px('--tc-input-min-h')).toBeGreaterThanOrEqual(56);
  });
  it('focus ring is at least 3px', () => {
    expect(px('--tc-focus-width')).toBeGreaterThanOrEqual(3);
  });
  it('the progress bar is not a hairline', () => {
    expect(px('--tc-bar-h')).toBeGreaterThanOrEqual(20);
  });
});

describe('type families', () => {
  it('names both fonts with system fallbacks', () => {
    expect(vars['--tc-font-voice-old']).toMatch(/^'MedievalSharp',.*serif$/);
    expect(vars['--tc-font-voice-new']).toMatch(/^'Orbitron',.*sans-serif$/);
  });
});

describe('button recipes', () => {
  it('wood, neon, and primary recipes exist', () => {
    for (const k of ['wood', 'neon', 'primary']) {
      for (const part of ['bg', 'text', 'border', 'text-shadow']) {
        expect(vars[`--tc-btn-${k}-${part}`], `${k}-${part}`).toBeTruthy();
      }
    }
  });
  it('primary has the gold border', () => {
    expect(vars['--tc-btn-primary-border']).toContain('--tc-ember');
  });
  it('wood gradient stays on Purple 700 to 900 so text keeps contrast', () => {
    expect(vars['--tc-btn-wood-bg']).toContain('var(--tc-purple-700), var(--tc-purple-900)');
  });
});

describe('fonts are self-hosted', () => {
  const fontsCss = read('src/styles/fonts.css');
  const files = [
    'medievalsharp-latin-400-normal.woff2',
    'orbitron-latin-700-normal.woff2',
    'orbitron-latin-800-normal.woff2',
    'orbitron-latin-900-normal.woff2',
  ];
  it.each(files)('%s exists, is a woff2 file, and fonts.css uses it', (f) => {
    const p = join(root, 'public/fonts', f);
    expect(existsSync(p)).toBe(true);
    expect(statSync(p).size).toBeGreaterThan(1000);
    expect(readFileSync(p).subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(fontsCss).toContain(`url('/fonts/${f}')`);
  });
  it('every @font-face swaps and every url is a local /fonts path', () => {
    const faces = fontsCss.match(/@font-face\s*{[^}]*}/g) ?? [];
    expect(faces).toHaveLength(4);
    for (const f of faces) expect(f).toContain('font-display: swap');
    for (const m of fontsCss.matchAll(/url\(([^)]*)\)/g)) expect(m[1]).toMatch(/^'\/fonts\//);
  });
  it('license files ship with the fonts', () => {
    expect(existsSync(join(root, 'public/fonts/LICENSE-MedievalSharp.txt'))).toBe(true);
    expect(existsSync(join(root, 'public/fonts/LICENSE-Orbitron.txt'))).toBe(true);
    const doc = read('docs/DESIGN_SYSTEM.md');
    expect(doc).toContain('## Fonts');
    expect(doc).toContain('SIL Open Font License');
  });
  it('the app entry imports fonts.css and tokens reach the app', () => {
    expect(read('src/main.ts')).toContain("import './styles/fonts.css'");
    expect(read('src/styles/index.css')).toContain('tokens.css');
  });
  it('tokens.css does not declare fonts or fetch anything', () => {
    expect(tokensCss).not.toMatch(/url\(|@font-face|@import/);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|html)$/.test(name)) out.push(p);
  }
  return out;
}

// The one outside origin allowed anywhere: the planned voice service (docs/VOICE_SERVICE.md).
const VOICE_ORIGIN = 'https://voice.timeclash.rallytasks.com';

describe('no network references', () => {
  const files = [
    ...walk(join(root, 'src')),
    ...walk(join(root, 'public')),
    join(root, 'index.html'),
  ];
  it('finds files to scan', () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });
  it('no http(s) URL in css or html except the xmlns attribute', () => {
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
        .replace(/xmlns(:\w+)?="[^"]*"/g, '')
        .replaceAll(VOICE_ORIGIN, '');
      expect(text, f).not.toMatch(/https?:\/\//);
    }
  });
  it('no protocol-relative URLs or fontsource/googleapis mentions', () => {
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/url\(\s*['"]?\/\/|googleapis|gstatic/);
    }
  });
});

describe('Content-Security-Policy', () => {
  const html = read('index.html');
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? '';
  it('has font-src self and no external origin', () => {
    expect(csp).toContain("font-src 'self'");
    // The one allowed outside origin is the planned voice service (docs/VOICE_SERVICE.md).
    expect(csp.replaceAll(VOICE_ORIGIN, '')).not.toMatch(/https?:|\/\/|\*/);
  });
});

describe('copy lint on design docs', () => {
  it('DESIGN_SYSTEM.md never says Player 1 or 2', () => {
    expect(read('docs/DESIGN_SYSTEM.md')).not.toMatch(/\bplayer [12]\b/i);
  });
});
