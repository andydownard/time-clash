// @vitest-environment jsdom
// The loading picture: three balloon riders, a sword and a laser gun, jokes from the copy file.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOADING } from '../../src/data/copy';
import { loadingScene } from '../../src/ui/art';

const scene = loadingScene(document);
const css = readFileSync(join(process.cwd(), 'src/styles/ui.css'), 'utf8');

describe('loading scene (balloon riders)', () => {
  it('has three riders, three speech bubbles, the sword arm and the gun arm', () => {
    for (const i of [0, 1, 2]) {
      expect(scene.querySelector(`.tc-ld-rid${i}`), `rider ${i}`).not.toBeNull();
      expect(scene.querySelector(`.tc-ld-say${i}`), `bubble ${i}`).not.toBeNull();
    }
    expect(scene.querySelector('.tc-ld-arm-l')).not.toBeNull();
    expect(scene.querySelector('.tc-ld-arm-r')).not.toBeNull();
    expect(scene.querySelectorAll('.tc-ld-br').length).toBeGreaterThan(2);
  });

  it('says three different lines that come from the copy file', () => {
    for (const [i, lines] of LOADING.riderLines.entries()) {
      const text = [...scene.querySelectorAll(`.tc-ld-say${i} text`)].map((t) => t.textContent);
      expect(text).toEqual([...lines]);
    }
    expect(new Set(LOADING.riderLines.map((l) => l.join(' '))).size).toBe(3);
  });

  it('draws no text under 24 units, so it is 20 px or more on every supported screen', () => {
    for (const t of scene.querySelectorAll('text')) {
      expect(Number(t.getAttribute('font-size'))).toBeGreaterThanOrEqual(24);
    }
  });

  it('has no question mark, sweat drop, or spinning dial', () => {
    expect(scene.textContent).not.toContain('?');
    expect(scene.querySelector('.tc-ld-sweat, .tc-ld-spin')).toBeNull();
  });

  it('has CSS for every animated class, and the still scene shows the first joke', () => {
    const classes = new Set(
      [...scene.querySelectorAll('[class]')].flatMap((e) => [...e.classList]),
    );
    for (const c of [...classes].filter((c) => c.startsWith('tc-ld-'))) {
      expect(css, c).toContain(`.${c}`);
    }
    expect(css).toMatch(/\.tc-ld-say0,\s*\.tc-ld-dizzy0\s*\{\s*opacity: 1/);
  });

  it('every animation names keyframes that exist', () => {
    const block = css.slice(css.indexOf('/* Loading scene:'));
    const used = new Set([...block.matchAll(/animation:\s*(tc-ld-[a-z0-9-]+)/g)].map((m) => m[1]));
    for (const name of used) expect(css, name).toContain(`@keyframes ${name}`);
    expect(used.size).toBeGreaterThan(10);
  });
});
