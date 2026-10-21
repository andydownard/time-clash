// @vitest-environment jsdom
// What flies over the Camp starts where the picture draws it, lands on the other camp, and moves
// on real physics. Lasers stay straight CSS. Nothing flies with reduced motion.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Scheduler } from '../../src/ui/ambientFlights';
import { campScene } from '../../src/ui/campArt';
import { CAMP_SHOTS, campFlightSpecs, campScheduler, flyOverCamp } from '../../src/ui/campFlights';
import { PICTURE_GRAVITY, poseAt } from '../../src/ui/flightPhysics';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

const STILL = 'translate(390 96) scale(1.05)';
const ui = readFileSync(join(process.cwd(), 'src/styles/ui.css'), 'utf8');

function manual() {
  let time = 0;
  let queued: Array<() => void> = [];
  const scheduler: Scheduler = {
    now: () => time,
    next: (fn) => queued.push(fn),
    cancel: () => {
      queued = [];
    },
  };
  return {
    scheduler,
    at(ms: number) {
      time = ms;
      const run = queued;
      queued = [];
      for (const fn of run) fn();
    },
  };
}

/** Where a shape's own wrappers put its origin in the 1600 x 900 picture. */
function origin(el: Element): [number, number] {
  let x = 0;
  let y = 0;
  for (let n: Element | null = el.parentElement; n && n.localName !== 'svg'; n = n.parentElement) {
    const m = /^translate\((-?[\d.]+) (-?[\d.]+)\)$/.exec(n.getAttribute('transform') ?? '');
    if (m) {
      x += Number(m[1]);
      y += Number(m[2]);
    }
  }
  return [x, y];
}

describe('Camp flights: geometry', () => {
  const svg = campScene(document);

  it('has a shot for every arrow, the cannonball and the missile', () => {
    expect(svg.querySelectorAll('.tc-camp-arrow')).toHaveLength(5);
    expect(CAMP_SHOTS).toHaveLength(7);
    for (const s of CAMP_SHOTS) {
      expect(svg.querySelectorAll(s.selector), s.selector).toHaveLength(1);
    }
  });

  it('starts each shot where the picture draws it', () => {
    for (const s of CAMP_SHOTS) {
      const el = svg.querySelector(s.selector)!;
      const [ox, oy] = origin(el);
      const cx = Number(el.getAttribute('cx') ?? 0);
      const cy = Number(el.getAttribute('cy') ?? 0);
      expect([ox + cx, oy + cy], s.selector).toEqual([s.start[0], s.start[1]]);
    }
  });

  it('sends Past shots to the Future bases and the Future missile to the Past castle', () => {
    const past = CAMP_SHOTS.filter((s) => s.faces === 0);
    const future = CAMP_SHOTS.filter((s) => s.faces === 180);
    expect(future).toHaveLength(1);
    for (const s of past) {
      expect(s.start[0]).toBeLessThan(600);
      expect(s.target[0]).toBeGreaterThan(1060);
      expect(s.target[0]).toBeLessThan(1580);
    }
    for (const s of future) {
      expect(s.start[0]).toBeGreaterThan(1300);
      expect(s.target[0]).toBeLessThan(450);
      expect(s.target[0]).toBeGreaterThan(40);
    }
  });

  it('lands each shot exactly on its target, after climbing, slowing, peaking and falling', () => {
    for (const spec of campFlightSpecs()) {
      const flight = { ...spec.flight, from: { x: 0, y: 0 } };
      const early = poseAt(flight, flight.delay + 0.05);
      const mid = poseAt(flight, flight.delay + flight.seconds / 2);
      const end = poseAt(flight, flight.delay + flight.seconds);
      expect(end.x).toBeCloseTo(flight.to.x, 0);
      expect(end.y).toBeCloseTo(flight.to.y, 0);
      // A real arc: it rises above the straight line between start and end.
      expect(mid.y).toBeLessThan(Math.min(0, flight.to.y) - 40);
      // Gravity only changes the downward speed: the sideways speed never changes.
      expect(early.vx).toBe(end.vx);
      expect(end.vy).toBeGreaterThan(early.vy);
      expect(PICTURE_GRAVITY).toBeGreaterThan(0);
    }
  });

  it('keeps the arcs on the picture', () => {
    for (const s of CAMP_SHOTS) {
      const spec = campFlightSpecs().find((f) => f.selector === s.selector)!;
      const flight = { ...spec.flight, from: { x: 0, y: 0 } };
      for (let i = 0; i <= 20; i++) {
        const p = poseAt(flight, flight.delay + (flight.seconds * i) / 20);
        const y = s.start[1] + p.y;
        const x = s.start[0] + p.x;
        // Below the logo, which fills the top 230 or so of the picture.
        expect(y, s.selector).toBeGreaterThan(230);
        expect(y, s.selector).toBeLessThan(900);
        expect(x, s.selector).toBeGreaterThan(0);
        expect(x, s.selector).toBeLessThan(1600);
      }
    }
  });

  it('leaves lasers on their straight CSS animation and gives shots no keyframes of their own', () => {
    expect(ui).toMatch(/animation: tc-camp-bolt /);
    for (const name of ['arrow', 'ball', 'miss']) {
      expect(ui).not.toContain(`@keyframes tc-camp-${name}`);
      expect(ui).not.toContain(`animation: tc-camp-${name} `);
    }
    expect(campFlightSpecs().some((s) => s.selector.includes('bolt'))).toBe(false);
  });
});

describe('Camp flights: running', () => {
  it('flies the shots and the hawk, and stops them', () => {
    const svg = campScene(document);
    const m = manual();
    const stop = flyOverCamp(svg, m.scheduler, { reduced: false });
    m.at(1000);
    const miss = svg.querySelector('.tc-camp-miss')!;
    expect(miss.getAttribute('opacity')).toBe('1');
    expect(miss.getAttribute('transform')).toMatch(/^translate\(.+\) rotate\(.+\)$/);
    expect(svg.querySelector('.tc-camp-hawk')!.getAttribute('transform')).toMatch(/^translate\(/);
    stop();
    expect(miss.getAttribute('opacity')).toBe('0');
    expect(svg.querySelector('.tc-camp-hawk')!.getAttribute('transform')).toBe(STILL);
  });

  it('flies nothing when motion is reduced', () => {
    const svg = campScene(document);
    const m = manual();
    flyOverCamp(svg, m.scheduler, { reduced: true });
    m.at(1000);
    for (const el of svg.querySelectorAll('.tc-camp-arrow, .tc-camp-ball, .tc-camp-miss')) {
      expect(el.getAttribute('opacity')).toBe('0');
      expect(el.hasAttribute('transform')).toBe(false);
    }
    expect(svg.querySelector('.tc-camp-hawk')!.getAttribute('transform')).toBe(STILL);
  });

  it('uses animation frames when the window has them, otherwise the env timers', () => {
    const calls: string[] = [];
    const env = {
      now: () => 0,
      setTimeout: (_fn: () => void, ms: number) => {
        calls.push(`timer ${ms}`);
        return 1;
      },
      clearTimeout: () => calls.push('clear'),
    };
    const timers = campScheduler(null, env);
    timers.next(() => undefined);
    timers.cancel(1);
    expect(calls).toEqual(['timer 33', 'clear']);

    const win = {
      requestAnimationFrame: (fn: () => void) => {
        calls.push('raf');
        fn();
        return 7;
      },
      cancelAnimationFrame: () => calls.push('caf'),
    } as unknown as Window;
    calls.length = 0;
    const frames = campScheduler(win, env);
    frames.next(() => calls.push('ran'));
    frames.cancel(7);
    expect(calls).toEqual(['raf', 'ran', 'caf']);
  });

  it('does not run a frame once the screen has left the page', () => {
    let alive = true;
    const queued: Array<() => void> = [];
    const env = {
      now: () => 0,
      setTimeout: (fn: () => void) => queued.push(fn),
      clearTimeout: () => undefined,
    };
    const s = campScheduler(null, env, () => alive);
    let ran = 0;
    s.next(() => ran++);
    alive = false;
    queued.shift()!();
    expect(ran).toBe(0);
  });
});
