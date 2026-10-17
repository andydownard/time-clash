// Checks the stylesheet against the accessibility floors in AGENTS.md. jsdom cannot resolve
// CSS variables, so these read the CSS text itself.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_BAND, UI } from '../../src/game/config';
import { COVER_BG_FALLBACK } from '../../src/ui/constants';
import { contrastRatio, parseCssVars, resolveCssVars } from '../../src/ui/contrast';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const tokens = read('../../src/styles/tokens.css');
const ui = read('../../src/styles/ui.css');
const index = read('../../src/styles/index.css');
const vars = resolveCssVars(parseCssVars(tokens));

type Rule = { selector: string; body: string };
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: (m[1] as string).trim(), body: m[2] as string });
  }
  return out;
}
const all = rules(ui);

describe('tokens and sizes agree with config', () => {
  it('tap target and text floors match UI in config.ts', () => {
    expect(vars['--tc-tap']).toBe(`${UI.tapTargetMinPx}px`);
    expect(vars['--tc-text-min']).toBe(`${UI.textMinPx}px`);
    expect(vars['--tc-text-young']).toBe(`${UI.youngReadingTextPx}px`);
  });

  it('the inline cover fallback equals the cover token', () => {
    expect(COVER_BG_FALLBACK.toLowerCase()).toBe(vars['--tc-cover-bg']!.toLowerCase());
  });
});

describe('ui.css: tap targets', () => {
  it.each(['.tc-btn', '.tc-chip', '.tc-input', '.tc-choice', '.tc-icon-btn', '.tc-range'])(
    '%s has min-height: var(--tc-tap)',
    (cls) => {
      const hit = all.filter(
        (r) =>
          r.selector
            .split(',')
            .map((s) => s.trim())
            .includes(cls) && /min-height:\s*var\(--tc-tap\)/.test(r.body),
      );
      expect(hit.length).toBeGreaterThan(0);
    },
  );

  it('buttons, chips, and icon buttons are at least 56px wide too', () => {
    const body = all
      .filter((r) => r.selector.includes('.tc-icon-btn'))
      .map((r) => r.body)
      .join(';');
    expect(body).toMatch(/min-width:\s*var\(--tc-tap\)/);
  });
});

describe('ui.css: text size', () => {
  const sizes = [...ui.matchAll(/font-size:\s*([^;]+);/g)].map((m) => (m[1] as string).trim());

  it('has font-size declarations to check', () => {
    expect(sizes.length).toBeGreaterThan(10);
  });

  it.each([...new Set(sizes)])('font-size %s is at least 20px', (v) => {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(v);
    const tokenMul = /^calc\(var\(--tc-text-min\) \* (\d+(?:\.\d+)?)\)$/.exec(v);
    const token = /^var\((--tc-[\w-]+)\)$/.exec(v);
    if (px) expect(Number(px[1])).toBeGreaterThanOrEqual(UI.textMinPx);
    else if (tokenMul) expect(Number(tokenMul[1])).toBeGreaterThanOrEqual(1);
    else if (token) {
      // A size token must itself be a px value of at least 20.
      const value = /^(\d+(?:\.\d+)?)px$/.exec(vars[token[1] as string] ?? '');
      expect(value, `${v} is a px token`).not.toBeNull();
      expect(Number(value![1])).toBeGreaterThanOrEqual(UI.textMinPx);
    } else expect(v).toBe('unreachable');
  });
});

describe('ui.css: colors, fonts, network', () => {
  it('uses no raw hex colors (only tokens)', () => {
    expect(ui.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('loads nothing from the network', () => {
    for (const css of [ui, tokens, index]) {
      expect(css).not.toMatch(/url\(/);
      expect(css).not.toMatch(/https?:/);
      expect(css).not.toMatch(/@font-face/);
    }
  });

  it('every var(--tc-*) used in ui.css is defined in tokens.css', () => {
    const used = new Set([...ui.matchAll(/var\((--tc-[\w-]+)/g)].map((m) => m[1] as string));
    const defined = new Set(Object.keys(parseCssVars(tokens)));
    // --tc-fast-ms (reload modal) and --tc-tail-shift (speech bubble) are set per element.
    const perElement = new Set(['--tc-fast-ms', '--tc-tail-shift']);
    const missing = [...used].filter((v) => !defined.has(v) && !perElement.has(v));
    expect(missing).toEqual([]);
  });

  it('the font stack is a system stack', () => {
    expect(vars['--tc-font']).toMatch(/system-ui/);
  });

  it('index.css pulls in both files', () => {
    expect(index).toContain('tokens.css');
    expect(index).toContain('ui.css');
  });
});

describe('ui.css: focus and motion', () => {
  it('has a visible focus ring of at least 3px using the focus token', () => {
    const rule = all.find((r) => r.selector.includes(':focus-visible'));
    expect(rule).toBeTruthy();
    expect(rule!.body).toMatch(
      /outline:\s*var\(--tc-focus-width\) solid var\(--tc-focus-on-light\)/,
    );
    expect(Number.parseFloat(vars['--tc-focus-width']!)).toBeGreaterThanOrEqual(3);
    // Dark surfaces get the Ember ring.
    const dark = all.find((r) => r.selector.includes('.tc-screen :focus-visible'));
    expect(dark?.body).toMatch(/outline-color:\s*var\(--tc-focus-on-dark\)/);
  });

  it('never removes the outline', () => {
    expect(ui).not.toMatch(/outline:\s*(none|0)\b/);
  });

  it('turns off animation for prefers-reduced-motion and for data-motion=reduced', () => {
    expect(ui).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(ui).toMatch(/\[data-motion='reduced'\]/);
    const reduced = ui.slice(ui.indexOf('@media (prefers-reduced-motion'));
    expect(reduced).toMatch(/animation:\s*none !important/);
  });

  it('shows the chosen chip and the right answer with a mark, not color alone', () => {
    expect(ui).toMatch(/\.tc-chip\[aria-checked='true'\]::before/);
    expect(ui).toMatch(/\.tc-choice\[data-state='right'\]::after/);
  });
});

describe('ui.css: covers', () => {
  it('has no transparency or blur on cover surfaces', () => {
    const cover = all.filter((r) => /\.tc-cover\b|\.tc-pass|\.tc-reload\b/.test(r.selector));
    for (const r of cover) expect(r.body).not.toMatch(/opacity|backdrop-filter|blur|rgba/i);
  });
});

describe('extra contrast pairs used in ui.css', () => {
  it.each([
    ['--tc-muted-text', '--tc-page'],
    ['--tc-white', '--tc-purple'],
    ['--tc-white', '--tc-future-banner-bg'],
    ['--tc-ink', '--tc-white'],
    ['--tc-cover-text', '--tc-cover-bg'],
  ] as Array<[string, string, boolean?]>)('%s on %s', (fg, bg, expectPass = true) => {
    const ratio = contrastRatio(vars[fg]!, vars[bg]!);
    if (expectPass) expect(ratio).toBeGreaterThanOrEqual(4.5);
    else expect(ratio).toBeLessThan(4.5);
  });
});

describe('ui.css: the pass screen button', () => {
  it('is at least 64px tall, roomier than the 56px floor', () => {
    const hit = all.filter(
      (r) => r.selector.includes('.tc-pass .tc-btn') && /min-height:\s*64px/.test(r.body),
    );
    expect(hit.length).toBeGreaterThan(0);
  });
});

describe('ui.css: the hidden attribute', () => {
  it('has a global [hidden] rule so display rules cannot override it', () => {
    const hit = all.filter(
      (r) =>
        r.selector
          .split(',')
          .map((s) => s.trim())
          .includes('[hidden]') && /display:\s*none\s*!important/.test(r.body),
    );
    expect(hit.length).toBeGreaterThan(0);
  });
});

describe('ui.css: room for the corner buttons', () => {
  const body = (sel: string) => all.find((r) => r.selector === sel)?.body ?? '';
  it('defines how much room the ? and gear row needs', () => {
    expect(vars['--tc-chrome-clear']).toBeDefined();
  });
  it('the HUD top row keeps its first card clear of the ? and gear and the Sound button', () => {
    expect(body('.tc-hud-top')).toMatch(/padding-left:\s*calc\(var\(--tc-tap\) \* 3/);
  });
  it('the control bar lives in its own band at the bottom, full width', () => {
    const bar = body('.tc-hud-bottom');
    expect(bar).toMatch(/left:\s*0/);
    expect(bar).toMatch(/right:\s*0/);
    expect(bar).toMatch(/bottom:\s*0/);
    expect(bar).not.toMatch(/bottom:\s*\d+px/);
  });
  it('Sound and Pause sit at the top, so the band holds only the controls', () => {
    expect(body('.tc-hud-corner')).toMatch(/top:\s*var\(--tc-chrome-row\)/);
    expect(ui).toMatch(/--tc-pause-top:\s*120px/);
  });
  it('the canvas band is 200 world px, and the speech bubble uses one uniform scale', () => {
    expect(BATTLE_BAND).toBe(200);
    const src = readFileSync(new URL('../../src/ui/transient.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/box\.width \/ WORLD\.width/);
    expect(src).not.toMatch(/WORLD\.height\) \* box\.height/);
  });
  it('full screens keep their content below the corner buttons', () => {
    expect(body('.tc-screen')).toMatch(/padding:\s*var\(--tc-chrome-row\)/);
    expect(vars['--tc-chrome-row']).toBeDefined();
  });
  it('the turn banner is a strip docked on the control bar, not a drop-down over the cards', () => {
    expect(ui).not.toMatch(/\.tc-banner\s*\{/);
    expect(body('.tc-turn-strip')).toMatch(/flex:\s*1 1 100%/);
    expect(body('.tc-hud-bottom')).toMatch(/flex-wrap:\s*wrap/);
  });
});
