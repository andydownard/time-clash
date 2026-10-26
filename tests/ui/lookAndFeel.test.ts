// Pins the look and feel rules for the screens (docs/DESIGN_SYSTEM.md): token values, contrast,
// tap sizes, fonts, motion, no outside URLs, and copy. jsdom has no layout, so the CSS tests
// read the stylesheet text and the DOM tests read the markup the screens build.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseCssVars, resolveCssVars } from '../../src/ui/contrast';

const root = new URL('../../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const tokens = read('src/styles/tokens.css');
const ui = read('src/styles/ui.css').replace(/\/\*[\s\S]*?\*\//g, '');
const vars = resolveCssVars(parseCssVars(tokens));

type Rule = { selector: string; body: string };
const rules: Rule[] = [...ui.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: (m[1] as string).trim(),
  body: m[2] as string,
}));
/** Every declaration block whose selector list names `selector` exactly, joined. */
const bodyOf = (selector: string): string =>
  rules
    .filter((r) =>
      r.selector
        .split(',')
        .map((x) => x.trim())
        .includes(selector),
    )
    .map((r) => r.body)
    .join(';');

const hex = (token: string): string => {
  const v = vars[token];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${token} is not a hex token: ${v}`);
  return v;
};

describe('new screen tokens only point at palette colors', () => {
  const block = tokens.slice(tokens.indexOf('Screen and panel tokens'));
  it('has no hex color in the screen and panel block', () => {
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it('defines every token the screens use', () => {
    for (const name of [
      '--tc-screen-split-bg',
      '--tc-screen-dark-bg',
      '--tc-cover-past-bg',
      '--tc-cover-future-bg',
      '--tc-card-past-bg',
      '--tc-card-future-bg',
      '--tc-btn-neutral-bg',
      '--tc-strip-bg',
      '--tc-panel-bg',
      '--tc-tile-bg',
      '--tc-caption-bar-bg',
    ]) {
      expect(vars[name], name).toBeTruthy();
    }
  });
});

describe('contrast of the pairs the screens use', () => {
  const text: Array<[string, string, string]> = [
    ['panel text on panel', '--tc-panel-text', '--tc-panel-bg'],
    ['strip text on Purple 700', '--tc-strip-text', '--tc-purple-700'],
    ['strip text on Blue 700', '--tc-strip-text', '--tc-blue-700'],
    ['neutral button text', '--tc-btn-neutral-text', '--tc-btn-neutral-bg'],
    ['tile text on tile', '--tc-tile-text', '--tc-tile-bg'],
    ['tile number on its badge', '--tc-tile-key-text', '--tc-tile-key-bg'],
    ['caption text on its bar', '--tc-caption-bar-text', '--tc-caption-bar-bg'],
    ['body text on Past card', '--tc-on-dark', '--tc-card-past-bg'],
    ['body text on Future card', '--tc-on-future', '--tc-card-future-bg'],
    ['Past team name on its card', '--tc-eyebrow-past', '--tc-card-past-bg'],
    ['Future team name on its card', '--tc-eyebrow-future', '--tc-card-future-bg'],
    ['body text on the dark screen top', '--tc-on-dark', '--tc-ink-deep'],
    ['body text on the dark screen bottom', '--tc-on-dark', '--tc-purple-900'],
    ['body text on the split left', '--tc-on-dark', '--tc-purple-900'],
    ['body text on the split right', '--tc-on-dark', '--tc-blue-900'],
    ['body text on the split center', '--tc-on-dark', '--tc-ink-deep'],
    ['Ember subtitle on ink', '--tc-ember', '--tc-ink-deep'],
    ['Ember subtitle on Purple 900', '--tc-ember', '--tc-purple-900'],
    ['Ember subtitle on Blue 900', '--tc-ember', '--tc-blue-900'],
    ['turn chip text on Ember', '--tc-ink-deep', '--tc-ember'],
    ['wipeout line on dark screen', '--tc-ember', '--tc-purple-900'],
    ['percent on speech bubble', '--tc-blue-900', '--tc-bubble-bg'],
    ['bubble text', '--tc-bubble-text', '--tc-bubble-bg'],
    ['hint text on its box', '--tc-ink-deep', '--tc-purple-100'],
    ['right answer on Ember', '--tc-ink-deep', '--tc-ember'],
    ['good feedback', '--tc-good-text', '--tc-good-bg'],
    ['oops feedback', '--tc-oops-text', '--tc-oops-bg'],
    ['cover text on the cover', '--tc-on-dark', '--tc-ink-deep'],
    ['placeholder on input', '--tc-muted-text', '--tc-input-bg'],
    ['VS text on Ember', '--tc-ink-deep', '--tc-ember'],
  ];
  it.each(text)('%s is at least 4.5:1', (_n, fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  const ui3: Array<[string, string, string]> = [
    ['Past card edge on Past card', '--tc-card-past-edge', '--tc-card-past-bg'],
    ['Future card edge on Future card', '--tc-card-future-edge', '--tc-card-future-bg'],
    ['neutral button edge on ink', '--tc-parchment-warm', '--tc-ink-deep'],
    ['neutral button edge on panel', '--tc-ink-deep', '--tc-panel-bg'],
    ['tile border on white', '--tc-purple-700', '--tc-tile-bg'],
    ['panel ring on dark cover', '--tc-ember', '--tc-ink-deep'],
    ['Past cover frame on its cover', '--tc-purple-500', '--tc-purple-900'],
    ['Future cover frame on its cover', '--tc-blue-500', '--tc-blue-900'],
    ['wood button cream edge on the Past cover', '--tc-parchment-warm', '--tc-purple-900'],
    ['selected chip edge on Past card', '--tc-ember', '--tc-card-past-bg'],
    ['selected chip edge on Future card', '--tc-ember', '--tc-card-future-bg'],
    ['selected chip fill on Past card', '--tc-parchment-warm', '--tc-card-past-bg'],
    ['dot ring on dark', '--tc-parchment-warm', '--tc-ink-deep'],
    ['current dot on dark', '--tc-ember', '--tc-ink-deep'],
    ['ink border on panel', '--tc-ink-deep', '--tc-panel-bg'],
  ];
  it.each(ui3)('%s is at least 3:1', (_n, fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3);
  });

  it('the progress fill stops stay 3:1 or better on the progress track', () => {
    const track = hex('--tc-blue-900');
    for (const stop of ['--tc-pulse', '--tc-blue-500', '--tc-purple-300']) {
      expect(contrastRatio(hex(stop), track), stop).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('tap targets', () => {
  it('chips are at least 56px, and so is the grade dropdown', () => {
    expect(Number.parseFloat(vars['--tc-chip-min']!)).toBeGreaterThanOrEqual(56);
    expect(bodyOf('.tc-chip')).toMatch(/min-width:\s*var\(--tc-chip-min\)/);
    expect(bodyOf('.tc-select')).toMatch(/min-height:\s*var\(--tc-tap\)/);
  });
  it('every button recipe keeps a 56px floor or more', () => {
    for (const sel of ['.tc-btn-past', '.tc-btn-future', '.tc-btn-primary']) {
      const m = /min-height:\s*(\d+)px/.exec(bodyOf(sel));
      expect(Number(m?.[1] ?? 0), sel).toBeGreaterThanOrEqual(56);
    }
    expect(bodyOf('.tc-btn')).toMatch(/min-height:\s*var\(--tc-tap\)/);
  });
  it('answer tiles are big: 88px tall', () => {
    expect(bodyOf('.tc-choice')).toMatch(/min-height:\s*88px/);
  });
  it('the corner buttons and the cards below them do not overlap', () => {
    expect(bodyOf('.tc-screen')).toMatch(/padding:\s*var\(--tc-chrome-row\)/);
  });
});

describe('fonts', () => {
  const oldVoice = 'var(--tc-font-voice-old)';
  const newVoice = 'var(--tc-font-voice-new)';
  const family = (sel: string): string | undefined =>
    /font-family:\s*([^;]+);/.exec(bodyOf(sel))?.[1]?.trim();

  it('titles, jokes, and speech use the old voice', () => {
    for (const sel of ['.tc-big', '.tc-bubble', '.tc-caption', '.tc-instructions']) {
      expect(family(sel), sel).toBe(oldVoice);
    }
  });
  it('buttons, chips, banners, and counters use the new voice', () => {
    for (const sel of ['.tc-turn-strip', '.tc-percent', '.tc-vs', '.tc-chrono', '.tc-label']) {
      expect(family(sel), sel).toBe(newVoice);
    }
    const shared = rules.find(
      (r) => r.selector.includes('.tc-range') && r.selector.includes('.tc-chip'),
    );
    expect(shared?.body).toMatch(/font-family:\s*var\(--tc-font-voice-new\)/);
  });
  it('only the wood button puts the old voice on a button', () => {
    expect(family('.tc-btn-past')).toBe(oldVoice);
    for (const sel of ['.tc-btn-future', '.tc-btn-primary', '.tc-btn-neutral', '.tc-chip']) {
      expect(family(sel), sel).not.toBe(oldVoice);
    }
  });
  it('the old voice never sets numbers: percent and VS are the new voice', () => {
    expect(family('.tc-percent')).toBe(newVoice);
  });
  // Orbitron draws 1 as a bar and 7 as a flag, so young readers mix them up. Questions, answer
  // tiles and the grade dropdown use the plain rounded stack, which has open numerals.
  it('the equation, answer tiles and grade dropdown use plain numerals, not Orbitron', () => {
    for (const sel of [
      ".tc-reload[data-layout='math'] .tc-prompt",
      ".tc-reload[data-layout='math'] .tc-choice",
      '.tc-select',
    ]) {
      expect(bodyOf(sel), sel).toMatch(/font-family:\s*var\(--tc-font\)/);
    }
  });
  it('reading questions use plain letters, easy to read', () => {
    expect(bodyOf(".tc-reload[data-layout^='reading'] .tc-choice")).toMatch(
      /font-family:\s*var\(--tc-font\)/,
    );
  });
  it('declares no font of its own: only the two voices and the system stack', () => {
    const used = new Set([...ui.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1]!.trim()));
    for (const v of used) {
      expect(['var(--tc-font)', oldVoice, newVoice, 'var(--tc-font-display)']).toContain(v);
    }
  });
});

describe('focus', () => {
  it('has a ring on light surfaces and an Ember ring on dark ones', () => {
    const base = rules.find((r) => r.selector.startsWith('[data-tc-root] :focus-visible'));
    expect(base?.body).toMatch(/solid var\(--tc-focus-on-light\)/);
    const dark = rules.find((r) => r.selector.includes('.tc-screen :focus-visible'));
    expect(dark?.body).toMatch(/var\(--tc-focus-on-dark\)/);
    const light = rules.find((r) => r.selector.includes('.tc-panel :focus-visible'));
    expect(light?.body).toMatch(/var\(--tc-focus-on-light\)/);
  });
  it('the ring colors have 3:1 against the surface they sit on', () => {
    expect(contrastRatio(hex('--tc-focus-on-light'), hex('--tc-panel-bg'))).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrastRatio(hex('--tc-focus-on-dark'), hex('--tc-purple-900'))).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrastRatio(hex('--tc-focus-on-dark'), hex('--tc-blue-900'))).toBeGreaterThanOrEqual(
      3,
    );
  });
});

describe('no color-only meaning', () => {
  it('the chosen chip is a solid fill, the right tile a check and a thick border, the near miss a dashed border', () => {
    // A picked chip is filled against outlined neighbours, with no check mark (Regression 24).
    expect(bodyOf(".tc-chip[aria-checked='true']")).toMatch(
      /background:\s*var\(--tc-chip-picked-bg\)/,
    );
    expect(bodyOf('.tc-chip')).toMatch(/background:\s*transparent/);
    expect(ui).not.toMatch(/\.tc-chip\[aria-checked='true'\]::before/);
    expect(bodyOf(".tc-choice[data-state='right']")).toMatch(/border:\s*6px solid/);
    expect(ui).toMatch(/\.tc-choice\[data-state='right'\]::after\s*\{\s*content:\s*'\\2713'/);
    expect(bodyOf(".tc-choice[data-state='tried']")).toMatch(/border:\s*4px dashed/);
  });
  it('the current step dot is bigger and the turn banner carries a team shape', () => {
    expect(bodyOf(".tc-dot[aria-current='step']")).toMatch(/scale\(/);
    expect(ui).toMatch(/\.tc-turn-strip\[data-team='PAST'\] \.tc-turn-text::before/);
    expect(ui).toMatch(/\.tc-turn-strip\[data-team='FUTURE'\] \.tc-turn-text::before/);
  });
});

describe('motion', () => {
  const reduced = ui.slice(ui.indexOf('@media (prefers-reduced-motion: reduce)'));
  it('the reduced-motion block turns off every animation and transition', () => {
    expect(reduced).toMatch(/animation:\s*none !important/);
    expect(reduced).toMatch(/transition:\s*none !important/);
  });
  it('stops the flashing chevrons and the turn flash when motion is reduced', () => {
    // The blanket rule reaches every animation under the app root, including the turn strip.
    expect(reduced).toMatch(/animation:\s*none !important/);
    expect(ui).toMatch(/\[data-motion='reduced'\],\s*\[data-motion='reduced'\] \*/);
    expect(ui).toMatch(/\.tc-turn-chev\s*\{[^}]*animation:/);
  });
  it('every keyframe is used by a class that the reduced rule reaches (all under the app root)', () => {
    const names = [...ui.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const n of names) expect(ui, n).toMatch(new RegExp(`animation:[^;]*\\b${n}\\b`));
  });
  it('glows are static: no animation touches a box-shadow', () => {
    for (const m of ui.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\n\}/g)) {
      expect(m[1]).not.toMatch(/box-shadow|text-shadow/);
    }
  });
});

describe('covers stay opaque', () => {
  it('cover surfaces use gradients of palette colors with no transparency', () => {
    for (const sel of [
      '.tc-cover',
      ".tc-cover[data-team='PAST']",
      ".tc-cover[data-team='FUTURE']",
    ]) {
      expect(bodyOf(sel), sel).not.toMatch(/rgba|opacity|blur/i);
    }
    for (const t of ['--tc-screen-dark-bg', '--tc-cover-past-bg', '--tc-cover-future-bg']) {
      expect(vars[t], t).not.toMatch(/rgba|transparent|\//);
    }
  });
});

describe('no outside URLs in the look and feel files', () => {
  const dirs = ['src/ui', 'src/styles', 'src/scenes'];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(join(root, dir), { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else if (/\.(ts|css)$/.test(name.name)) files.push(p);
    }
  };
  dirs.forEach(walk);
  it('scans files', () => {
    expect(files.length).toBeGreaterThan(20);
  });
  it('has no http(s) address except the SVG namespace', () => {
    for (const f of files) {
      const text = read(f).replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '');
      expect(text, f).not.toMatch(/https?:\/\//);
    }
  });
  it('has no @import of a remote sheet, no Google Fonts, no <link>, no <img>, no <image>', () => {
    for (const f of files) {
      const text = read(f);
      expect(text, f).not.toMatch(/googleapis|gstatic|@import\s+url|<link\b|<img\b|<image\b/i);
    }
  });
  it('the only url() in the styles is in fonts.css, and it is a local path', () => {
    for (const f of files.filter((x) => x.endsWith('.css') && !x.endsWith('fonts.css'))) {
      expect(read(f), f).not.toMatch(/url\(/);
    }
    for (const m of read('src/styles/fonts.css').matchAll(/url\(([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^'\/fonts\//);
    }
  });
  it('the font files the styles name are in public/fonts', () => {
    const present = new Set(readdirSync(join(root, 'public/fonts')));
    for (const m of read('src/styles/fonts.css').matchAll(/url\('\/fonts\/([^']+)'\)/g)) {
      expect(present.has(m[1]!), m[1]).toBe(true);
    }
  });
});

describe('vocabulary in the screen code', () => {
  it('never says Player 1 or Player 2', () => {
    for (const f of [
      'src/ui/setupScreen.ts',
      'src/ui/passScreen.ts',
      'src/ui/reloadModal.ts',
      'src/ui/introScreen.ts',
      'src/ui/simpleScreens.ts',
      'src/scenes/chrome.ts',
      'src/data/copy.ts',
    ]) {
      expect(read(f), f).not.toMatch(/\bplayer\s*[12]\b/i);
    }
  });
  it('the Wipeout screen never says destroyed, defeat, dead, die, or kill', () => {
    const text = read('src/ui/simpleScreens.ts') + read('src/data/copy.ts');
    expect(text).not.toMatch(/\b(destroy(ed|s)?|defeat(ed)?|dead|die[sd]?|kill(s|ed|er)?)\b/i);
  });
});
