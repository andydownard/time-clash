// @vitest-environment jsdom
// The hawk over the Camp circles on a true oval, faces the way it flies, and banks round each end.
import { describe, expect, it } from 'vitest';
import { startHawk, type Scheduler } from '../../src/ui/ambientFlights';
import { hawkPose } from '../../src/ui/flightPhysics';

describe('hawkPose', () => {
  const orbit = { rx: 340, ry: 60, seconds: 16 };
  const samples = Array.from({ length: 160 }, (_, i) => hawkPose((i / 160) * orbit.seconds, orbit));

  it('travels a true oval: every point sits on the ellipse', () => {
    for (const p of samples) {
      expect((p.x / orbit.rx) ** 2 + (p.y / orbit.ry) ** 2).toBeCloseTo(1, 1);
    }
  });

  it('comes back to where it began after a lap', () => {
    expect(hawkPose(0, orbit)).toEqual(hawkPose(orbit.seconds, orbit));
    expect(hawkPose(3, orbit)).toEqual(hawkPose(3 + orbit.seconds * 2, orbit));
  });

  it('goes clockwise: right along the top, left along the bottom', () => {
    expect(hawkPose(0.5, orbit).x).toBeGreaterThan(hawkPose(0, orbit).x);
    expect(hawkPose(8.5, orbit).x).toBeLessThan(hawkPose(8, orbit).x);
    expect(hawkPose(0, orbit).y).toBeLessThan(0);
    expect(hawkPose(8, orbit).y).toBeGreaterThan(0);
  });

  it('faces the way it flies', () => {
    expect(hawkPose(0, orbit).scaleX).toBe(1);
    expect(hawkPose(8, orbit).scaleX).toBe(-1);
  });

  it('banks round each end: it narrows but never vanishes', () => {
    const quarter = hawkPose(4, orbit);
    expect(Math.abs(quarter.scaleX)).toBeLessThan(0.25);
    for (const p of samples) expect(Math.abs(p.scaleX)).toBeGreaterThanOrEqual(0.18);
  });

  it('tilts with the dive and climb, within a gentle limit', () => {
    expect(hawkPose(4, orbit).tilt).toBeGreaterThan(0);
    expect(hawkPose(12, orbit).tilt).toBeLessThan(0);
    for (const p of samples) expect(Math.abs(p.tilt)).toBeLessThanOrEqual(16);
  });

  it('holds still on bad input', () => {
    expect(hawkPose(Number.NaN, orbit)).toEqual(hawkPose(0, orbit));
    expect(hawkPose(5, { ...orbit, seconds: 0 })).toEqual(hawkPose(0, orbit));
  });
});

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
    pending: () => queued.length,
  };
}

const NS = 'http://www.w3.org/2000/svg';
function hawk() {
  const svg = document.createElementNS(NS, 'svg');
  const parts = ['tc-camp-hawk', 'tc-camp-hawk-flip', 'tc-camp-hawk-bank'].map((c) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', c);
    svg.append(g);
    return g as SVGElement;
  });
  return { svg, move: parts[0]!, flip: parts[1]!, bank: parts[2]! };
}

describe('startHawk', () => {
  it('moves, turns and tilts the hawk each frame', () => {
    const h = hawk();
    const m = manual();
    startHawk(h.svg, m.scheduler, { reduced: false });
    m.at(0);
    expect(h.move.getAttribute('transform')).toBe('translate(0 -60)');
    expect(h.flip.getAttribute('transform')).toBe('scale(1 1)');
    m.at(4000);
    expect(h.move.getAttribute('transform')).toBe('translate(340 0)');
    expect(h.bank.getAttribute('transform')).toMatch(/^rotate\(/);
  });

  it('leaves the hawk where it is drawn when motion is reduced', () => {
    const h = hawk();
    const m = manual();
    startHawk(h.svg, m.scheduler, { reduced: true });
    m.at(1000);
    expect(h.move.hasAttribute('transform')).toBe(false);
    expect(m.pending()).toBe(0);
  });

  it('stops, and puts the hawk back, when told to', () => {
    const h = hawk();
    const m = manual();
    const stop = startHawk(h.svg, m.scheduler, { reduced: false });
    m.at(500);
    stop();
    expect(h.move.hasAttribute('transform')).toBe(false);
    m.at(900);
    expect(h.move.hasAttribute('transform')).toBe(false);
  });

  it('does nothing when the picture has no hawk', () => {
    const m = manual();
    const stop = startHawk(document.createElementNS(NS, 'svg'), m.scheduler, { reduced: false });
    expect(m.pending()).toBe(0);
    expect(() => stop()).not.toThrow();
  });
});
