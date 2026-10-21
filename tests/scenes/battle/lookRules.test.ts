// Pins the hard rules for the Battle and Victory look: no external URLs, fonts present, copy lint,
// tap size, text size, and contrast of the shapes the panels draw. Rule source: AGENTS.md and
// docs/DESIGN_SYSTEM.md.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PHASE1_LAYOUT, UI, WORLD } from '../../../src/game/config';
import { PALETTE as TOKENS, css } from '../../../src/scenes/palette';
import { worldFontPx } from '../../../src/scenes/battle/textScale';
import { TEXT_ROLES } from '../../../src/scenes/battle/textStyle';
import { ART, DIAL, PALETTE, PANEL, TEAM_COLOR } from '../../../src/scenes/battle/visual';
import { contrastRatio } from '../../../src/ui/contrast';
import { extractFromTs, findBanned } from '../../data/copyLintScan';

const ROOT = new URL('../../../', import.meta.url).pathname;
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

/** The files this look owns. */
const OWNED = [
  ...walk(join(ROOT, 'src/scenes/battle')),
  ...['BattleScene.ts', 'VictoryScene.ts', 'backdrop.ts', 'palette.ts'].map((f) =>
    join(ROOT, 'src/scenes', f),
  ),
].filter((f) => f.endsWith('.ts'));
const rel = (f: string): string => relative(ROOT, f);

describe('no external resources', () => {
  it('owns a healthy set of files', () => {
    expect(OWNED.length).toBeGreaterThan(15);
  });
  for (const f of OWNED) {
    it(`${rel(f)} has no http(s) URL and no font service`, () => {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/https?:\/\//i);
      expect(src).not.toMatch(/googleapis|gstatic|cdn\./i);
    });
  }
  it('public/assets has no stray files that point off-site', () => {
    const dir = join(ROOT, 'public/assets');
    const files = existsSync(dir) ? walk(dir) : [];
    for (const f of files) expect(readFileSync(f, 'utf8')).not.toMatch(/https?:\/\//i);
  });
});

describe('self-hosted fonts', () => {
  const fontsCss = readFileSync(join(ROOT, 'src/styles/fonts.css'), 'utf8');
  it('ships a woff2 file for every face the canvas text asks for', () => {
    const wanted = new Set(
      Object.values(TEXT_ROLES).map((s) =>
        s.family === 'old'
          ? 'medievalsharp-latin-400-normal.woff2'
          : `orbitron-latin-${s.weight}-normal.woff2`,
      ),
    );
    for (const file of wanted) {
      expect(existsSync(join(ROOT, 'public/fonts', file)), file).toBe(true);
      expect(fontsCss, file).toContain(`/fonts/${file}`);
    }
  });
});

describe('copy on the canvas', () => {
  const extra = [/\bdestroy(?:ed|s)?\b/i, /\bplayer\s*[12]\b/i, /\bP[12]\b/, /\bdefeat/i];
  for (const f of OWNED) {
    it(`${rel(f)} has no banned word or P1/P2 in a string`, () => {
      for (const s of extractFromTs(readFileSync(f, 'utf8'))) {
        expect(findBanned(s.text), `line ${s.line}: ${s.text}`).toEqual([]);
        for (const re of extra) expect(s.text, `line ${s.line}`).not.toMatch(re);
      }
    });
  }
});

describe('sizes', () => {
  it('draws every text role at 20px or more on screen at 1280, 1024, and 768 wide', () => {
    for (const w of [1280, 1024, 768]) {
      for (const [name, s] of Object.entries(TEXT_ROLES)) {
        const screenPx = (worldFontPx(s.basePx, w, WORLD.width) * Math.min(1, w / WORLD.width)) | 0;
        expect(screenPx, `${name} at ${w}`).toBeGreaterThanOrEqual(UI.textMinPx);
      }
    }
  });
  it('makes the dial handle at least 56px to grab on every supported screen', () => {
    for (const w of [1280, 1024, 768]) {
      const scale = Math.min(1, w / WORLD.width);
      expect(DIAL.grabRadius * 2 * scale, `${w} wide`).toBeGreaterThanOrEqual(UI.tapTargetMinPx);
    }
  });
  it('keeps the visible handle small and the invisible grab circle much larger', () => {
    expect(DIAL.grabRadius).toBeGreaterThanOrEqual(DIAL.handleRadius * 3);
  });
  it('keeps the guide line short (90 to 120 px on a 1280x800 board)', () => {
    expect(DIAL.guideLength).toBeGreaterThanOrEqual(90);
    expect(DIAL.guideLength).toBeLessThanOrEqual(120);
  });
});

describe('contrast of drawn shapes (3:1 for large UI)', () => {
  const c = (n: number): string => css(n);
  const grass = [ART.grassTop, ART.grassLow];
  const soil = [ART.soilTop, ART.hullDark];
  // The panels, wind pill and meter sit in the upper sky. The pink horizon is below y 465.
  const sky = [ART.skyTop, ART.skyMid, ART.skyLow];
  // Each entry is checked against every background it can sit on (a gradient has two ends).
  const pairs: Array<[string, number | number[], number[]]> = [
    ['candle wax on its track', PALETTE.past.parchment, [PALETTE.shared.ink]],
    ['candle flame on the Past panel', PALETTE.past.gold, [PALETTE.past.deep]],
    ['Past shot dot on the Past panel', PALETTE.past.gold, [PALETTE.past.deep]],
    // Two strokes (ink outside, light inside): one of them shows on either end of the gradient.
    ['Past panel edge on the ground', [PALETTE.shared.ink, PALETTE.past.light], grass],
    ['battery charge on its track', PALETTE.future.glow, [PALETTE.shared.ink]],
    ['battery edge on the Future panel', PALETTE.future.steel, [PALETTE.future.night]],
    ['Future shot dot on the Future panel', PALETTE.future.glow, [PALETTE.future.night]],
    ['Future panel edge on the ground', PALETTE.future.glow, soil],
    ['wind arrow on its pill', PALETTE.past.gold, [PALETTE.shared.ink]],
    ['Past angle guide on its ink outline', TEAM_COLOR.PAST, [PALETTE.shared.ink]],
    ['Future angle guide on its ink outline', TEAM_COLOR.FUTURE, [PALETTE.shared.ink]],
    ['podium edge on the ground', [PALETTE.shared.ink, PALETTE.past.gold], grass],
  ];
  // Rims drawn on the sky must still show (the wind pill sits over the sky).
  const rims: Array<[string, number | number[], number[]]> = [
    ['wind pill rim on the sky', PALETTE.past.parchment, sky],
  ];
  for (const [name, fg, bgs] of [...pairs, ...rims]) {
    it(name, () => {
      const fgs = Array.isArray(fg) ? fg : [fg];
      for (const bg of bgs) {
        const best = Math.max(...fgs.map((f) => contrastRatio(c(f), c(bg))));
        expect(best, c(bg)).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe('team identity does not depend on color alone', () => {
  it('uses different shapes for the two health gauges (candle and battery)', () => {
    const src = readFileSync(join(ROOT, 'src/scenes/battle/statusArt.ts'), 'utf8');
    expect(src).toContain('drawCandle');
    expect(src).toContain('drawBattery');
  });
  it('gives the two teams different projectile colors that are still tokens', () => {
    expect(TEAM_COLOR.PAST).not.toBe(TEAM_COLOR.FUTURE);
    expect(TEAM_COLOR.PAST).toBe(TOKENS.ember);
    expect(TEAM_COLOR.FUTURE).toBe(TOKENS.pulse);
  });
});

describe('health panels', () => {
  it('sit in the ground strip, above the Pause button, inside the world', () => {
    const ground = PHASE1_LAYOUT.terrain.ground[0]!.y;
    expect(PANEL.y).toBeGreaterThan(ground);
    expect(PANEL.y + PANEL.h).toBeLessThanOrEqual(680);
    expect(PANEL.y + PANEL.h).toBeLessThanOrEqual(WORLD.height);
    expect(PANEL.edge).toBeGreaterThan(0);
  });
  it('are tall enough for the text label at its largest scaled size on portrait iPad', () => {
    // 20px floor at 768 wide grows to 34 world px. The text needs about 1.25x that, plus padding.
    const textH = worldFontPx(TEXT_ROLES.hud.basePx, 768, WORLD.width) * 1.25 + 8;
    expect(PANEL.h).toBeGreaterThanOrEqual(textH);
  });
});
