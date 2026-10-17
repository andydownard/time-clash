// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { startFlights, type FlightSpec, type Scheduler } from '../../src/ui/ambientFlights';

/** A scheduler we drive by hand: no real time, no real frames. */
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
    /** Moves time to `ms` and runs one frame. */
    at(ms: number) {
      time = ms;
      const run = queued;
      queued = [];
      for (const fn of run) fn();
    },
    pending: () => queued.length,
  };
}

const NS = 'http://www.w3.org/2000/svg';
function picture() {
  const svg = document.createElementNS(NS, 'svg');
  const mk = (cls: string): SVGElement => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('class', cls);
    svg.append(el);
    return el as SVGElement;
  };
  return { svg, first: mk('shot'), second: mk('shot tc-camp-d2'), laser: mk('laser') };
}

const specs: FlightSpec[] = [
  {
    selector: '.shot',
    flight: { to: { x: 1000, y: -50 }, seconds: 2, delay: 0.2, period: 4 },
    faces: 0,
  },
];
const opts = { reduced: false, extraDelay: 0.12 };

describe('startFlights', () => {
  it('hides every shot until it fires', () => {
    const p = picture();
    const m = manual();
    startFlights(p.svg, specs, m.scheduler, opts);
    expect(p.first.getAttribute('opacity')).toBe('0');
    m.at(50);
    expect(p.first.getAttribute('opacity')).toBe('0');
    expect(p.first.hasAttribute('transform')).toBe(false);
  });

  it('flies along the arc, turning its nose, then hides again after it lands', () => {
    const p = picture();
    const m = manual();
    startFlights(p.svg, specs, m.scheduler, opts);
    m.at(700);
    expect(p.first.getAttribute('opacity')).toBe('1');
    const early = p.first.getAttribute('transform')!;
    m.at(1500);
    const later = p.first.getAttribute('transform')!;
    expect(early).toMatch(/^translate\(.+\) rotate\(.+\)$/);
    expect(later).not.toBe(early);
    m.at(2300);
    expect(p.first.getAttribute('opacity')).toBe('0');
  });

  it('fires the second of a pair a moment later', () => {
    const p = picture();
    const m = manual();
    startFlights(p.svg, specs, m.scheduler, opts);
    m.at(250); // 0.05 s after the first one fired
    expect(p.first.getAttribute('opacity')).toBe('1');
    expect(p.second.getAttribute('opacity')).toBe('0');
    m.at(400);
    expect(p.second.getAttribute('opacity')).toBe('1');
  });

  it('leaves shapes that are not named alone (a laser does not fall)', () => {
    const p = picture();
    const m = manual();
    startFlights(p.svg, specs, m.scheduler, opts);
    m.at(900);
    expect(p.laser.hasAttribute('opacity')).toBe(false);
    expect(p.laser.hasAttribute('transform')).toBe(false);
  });

  it('with reduced motion, nothing flies and no frames are scheduled', () => {
    const p = picture();
    const m = manual();
    startFlights(p.svg, specs, m.scheduler, { ...opts, reduced: true });
    expect(m.pending()).toBe(0);
    m.at(900);
    expect(p.first.getAttribute('opacity')).toBe('0');
  });

  it('stops: hides the shots and schedules nothing more', () => {
    const p = picture();
    const m = manual();
    const stop = startFlights(p.svg, specs, m.scheduler, opts);
    m.at(900);
    expect(p.first.getAttribute('opacity')).toBe('1');
    stop();
    expect(p.first.getAttribute('opacity')).toBe('0');
    m.at(1200);
    expect(p.first.getAttribute('opacity')).toBe('0');
    expect(m.pending()).toBe(0);
  });

  it('does nothing and does not throw when the picture has no matching shapes', () => {
    const svg = document.createElementNS(NS, 'svg');
    const m = manual();
    const stop = startFlights(svg, specs, m.scheduler, opts);
    m.at(500);
    expect(() => stop()).not.toThrow();
  });
});
