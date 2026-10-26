// @vitest-environment jsdom
// Pre-reader cues: Base health, Shots left and Scrap each carry a small picture beside the words.
// The pictures are decorative (aria-hidden). Words stay for readers and screen readers, so no
// meaning rests on a picture or its color alone.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { HUD } from '../../src/data/copy';
import { freshCamp } from '../../src/game/loadout';
import { HUD_ICON_IDS, hudIcon } from '../../src/ui/hudIcons';
import { parseCssVars, resolveCssVars } from '../../src/ui/contrast';
import type { HudState } from '../../src/ui/types';
import { TEST_IDS } from '../../src/ui/types';
import { LOCAL_IDS } from '../../src/ui/constants';
import { q, qa, setup } from './helpers';

const source = readFileSync(join(process.cwd(), 'src/ui/hudIcons.ts'), 'utf8');
const ui = readFileSync(join(process.cwd(), 'src/styles/ui.css'), 'utf8');
const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const palette = new Set(
  Object.values(resolveCssVars(parseCssVars(tokens)))
    .filter((v) => /^#[0-9a-f]{6}$/i.test(v))
    .map((v) => v.toLowerCase()),
);

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const state = (over: Partial<HudState> = {}): HudState => ({
  activeTeam: 'PAST',
  names: { PAST: 'Alex', FUTURE: 'Sam' },
  baseHp: { PAST: 100, FUTURE: 75 },
  scrap: { PAST: 3, FUTURE: 0 },
  wind: 0,
  angleDeg: 45,
  power: 60,
  shotsLeft: 2,
  bonus: false,
  canFire: true,
  selected: 'C',
  units: [],
  ...over,
});

const showHud = (over: Partial<HudState> = {}): void => {
  s.overlay.showHud({
    onAim: () => {},
    onFire: () => {},
    onMuteToggle: () => {},
    onSelect: () => {},
  });
  s.overlay.updateHud(state(over));
};

describe('HUD icons', () => {
  it.each(HUD_ICON_IDS)('%s parses, is decorative, and cannot take focus', (id) => {
    const svg = hudIcon(document, id);
    expect(svg.localName).toBe('svg');
    expect(svg.hasAttribute('hidden')).toBe(false);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.getAttribute('data-icon')).toBe(id);
  });

  it('has a different shape for every readout', () => {
    const shapes = HUD_ICON_IDS.map((id) => hudIcon(document, id).innerHTML);
    expect(new Set(shapes).size).toBe(HUD_ICON_IDS.length);
  });

  it('uses only palette colors and fetches nothing', () => {
    const used = new Set([...source.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((c) => !palette.has(c))).toEqual([]);
    expect(source).not.toMatch(/<image\b|<script\b|<foreignObject\b|url\(\s*['"]?http|href=/i);
  });

  it('has a size rule, so a picture never shrinks below a pre-reader can see', () => {
    expect(ui).toMatch(/\.tc-hud-icon\s*\{[^}]*width:\s*(2[4-9]|3\d)px/);
  });
});

describe('the battle HUD shows a picture beside each readout', () => {
  it('Base health: a heart sits beside the meter, and the words stay for screen readers', () => {
    showHud();
    for (const t of ['PAST', 'FUTURE'] as const) {
      const hp = q(TEST_IDS.baseHp(t))!;
      const icon = hp.querySelector('.tc-hp-row svg[data-icon="health"]');
      expect(icon).not.toBeNull();
      expect(icon!.getAttribute('aria-hidden')).toBe('true');
      expect(hp.querySelector('.tc-hp-label')!.textContent).toBe(HUD.baseHealth);
    }
  });

  it('Scrap: a gear sits before the word and the number', () => {
    showHud();
    const row = q(LOCAL_IDS.hudScrap('PAST'))!.closest('.tc-scrap-row')!;
    expect(row.querySelector('svg[data-icon="scrap"]')).not.toBeNull();
    expect(row.textContent).toBe(`${HUD.scrap}: 3`);
  });

  it('Shots left: a shot picture leads the pips, and the pips still count shots', () => {
    showHud({ shotsLeft: 1 });
    const pips = qa('.tc-pips')[0]!;
    expect(pips.querySelector('svg[data-icon="shots"]')).not.toBeNull();
    expect(pips.querySelectorAll('.tc-pip')).toHaveLength(3);
    expect(q(TEST_IDS.shotsLeft)!.textContent).toContain(HUD.shotsValue(1));
  });

  it('keeps the shot picture after each repaint (no duplicates)', () => {
    showHud({ shotsLeft: 2 });
    s.overlay.updateHud(state({ shotsLeft: 1 }));
    s.overlay.updateHud(state({ shotsLeft: 0 }));
    expect(qa('.tc-pips svg[data-icon="shots"]')).toHaveLength(1);
  });
});

describe('Forge shows the Scrap picture', () => {
  const NAMES = { PAST: 'Alex', FUTURE: 'Sam' };
  it('Forge Weapon', () => {
    void s.overlay.showForge({ camp: freshCamp(), names: NAMES, save: () => {} });
    expect(q(TEST_IDS.forgeScrap)!.querySelector('svg[data-icon="scrap"]')).not.toBeNull();
  });
});
